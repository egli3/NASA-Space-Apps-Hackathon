/**
 * Flight simulator — daily time step, deterministic given (design, seed, decisions). GAME_DESIGN §5. Owner: Track A.
 *
 * What happens each day: the phase clock advances (launch → cruise → arrival → aerobraking → science → extended),
 * burns use propellant, radiation dose builds up, hardware can fail (hazards), event cards can trigger, instruments
 * fill the recorder and the DSN link empties it into science credit.
 *
 * Randomness: every draw comes from a named stream (`launch`, `insertion`, `hazard:<slot|instrument>`,
 * `event:<card>`, `gamble:<card>`, `pick:<card>:<n>`), so a Hindsight replay with one design change keeps every
 * unrelated dice roll identical. Hazards and random cards are drawn as a time-to-failure (one draw per failure),
 * which is the same statistics as a daily roll of p = 1 − e^(−λ/365) but keeps streams aligned between replays.
 */
import type { Effect, EventCard, MissionPhase, SlotId } from '../types/catalog';
import type { DecisionLog, MissionDesign } from '../types/design';
import type { AdvanceResult, Catalog, HealthState, LogEntry, MissionResult, Outcome, PendingEvent, SimPhase, SimState, Simulation, Vec2 } from '../types/engine';
import { CRUISE_DOSE_KRAD_PER_YEAR, instrumentQuality, linkModel, powerModel, resolveDesign } from './budgets';
import { conditionsHold, effectDays, facts, phaseMatches, severityFromString, spaceWeatherCalendar, spaceWeatherContext } from './events';
import { realizedBudgets } from './growth';
import { addDays, isoToJulianDay, planetPositionAtJd } from './orbits';
import { Rng } from './rng';

// ---- Model constants (game-tuned; GAME_DESIGN §5) ----
/** The orbit-insertion burn stresses the engine as much as this many years of quiet cruise (§5.1). */
const INSERTION_BURN_STRESS_YEARS = 4;
/** Past its radiation tolerance, avionics fail 10 × (dose / tolerance)² times as often (§5.2). */
const OVERDOSE_HAZARD_FACTOR = 10;
/** Sun–Earth–spacecraft angle below which the Sun's radio noise drowns the downlink (§5.2). */
const CONJUNCTION_ANGLE_DEG = 3;
/** Default consequences of an unrecoverable failure in a non-critical subsystem (§5.3). */
const ADCS_FAILURE_DEGRADE = 0.5;
const ANTENNA_FAILURE_DEGRADE = 0.05; // stuck high-gain antenna: limp along on the low-gain one
const THERMAL_FAILURE_DEGRADE = 0.7;
const MISSION_ENDING_SLOTS: SlotId[] = ['transmitter', 'avionics', 'power', 'battery'];

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const fmt = (x: number, d = 0) => (Math.round(x * 10 ** d) / 10 ** d).toString();

export function createSimulation(catalog: Catalog, design: MissionDesign, seed: number): Simulation {
  // Fly the spacecraft as built: the Reality Check growth for this seed (§4.7) sets the propellant load and what is left in reserve.
  const { reveal, actual: budgets, planned } = realizedBudgets(catalog, design, seed);
  const r = resolveDesign(catalog, design);
  const { scenario, dest, traj, orbit } = r;
  const K = catalog.constants;
  const rng = new Rng(seed);
  const hazardMult = K.assurance[design.assurance]?.hazardMultiplier ?? 1;
  const isRedundant = (slot: string) => (design.redundant as string[]).includes(slot);
  const deck = scenario.eventIds.map((id) => catalog.events.find((e) => e.id === id)).filter((e): e is EventCard => !!e);

  // ---------------- timeline (days since launch) ----------------
  const launchDate = addDays(traj.launchDate, design.launchOffsetDays);
  const jd0 = isoToJulianDay(launchDate);
  const arrivalDay = Math.max(1, Math.round(traj.tofDays));
  /** Last day before science starts; aerobraking (and any delay to it) pushes this out but NOT the end of the primary mission. */
  let scienceStartDay = arrivalDay + r.aerobrakingDays;
  let primaryEndDay = arrivalDay + Math.round(scenario.primaryMissionYears * 365);
  let extendedEndDay = primaryEndDay + Math.round(scenario.extendedMissionYears * 365);
  let extendedDecided = false;
  let extendedApproved = false;

  // ---------------- geometry ----------------
  const earthEl = catalog.planetaryElements.find((p) => p.bodyId === 'earth')!;
  const targetEl = catalog.planetaryElements.find((p) => p.bodyId === dest.elementsBodyId);
  const isMoon = dest.kind === 'moon' || !targetEl;
  const earthAt = (day: number): Vec2 => planetPositionAtJd(earthEl, jd0 + day);
  const targetAt = (day: number, earth: Vec2): Vec2 =>
    isMoon ? { x: earth.x + 0.0026, y: earth.y } : planetPositionAtJd(targetEl!, jd0 + day); // the Moon sits on top of Earth at this scale
  const e0 = earthAt(0);
  const tArr = targetAt(arrivalDay, earthAt(arrivalDay));
  /** Cruise path: prograde spiral from Earth@launch to target@arrival (visual only; physics uses the trajectory table). */
  const cruisePos = (day: number): Vec2 => {
    const t = Math.min(1, day / arrivalDay);
    const r0 = Math.hypot(e0.x, e0.y), r1 = Math.hypot(tArr.x, tArr.y);
    const a0 = Math.atan2(e0.y, e0.x);
    let a1 = Math.atan2(tArr.y, tArr.x);
    while (a1 < a0) a1 += 2 * Math.PI;
    if (traj.kind === 'gravity_assist') a1 += 2 * Math.PI; // extra loop for the Earth flyby
    const rr = r0 + ((r1 - r0) * (1 - Math.cos(Math.PI * t))) / 2;
    const ang = a0 + (a1 - a0) * t;
    return { x: rr * Math.cos(ang), y: rr * Math.sin(ang) };
  };
  const cosConjunction = Math.cos((CONJUNCTION_ANGLE_DEG * Math.PI) / 180);

  // ---------------- hardware state ----------------
  const slotMult: Partial<Record<SlotId, number>> = {}; // performance multipliers from degradations
  const mult = (slot: SlotId) => slotMult[slot] ?? 1;
  const spareUsed = new Set<string>();
  const partName = (slot: SlotId) => r.parts[slot]?.name ?? slot;
  const ins = r.instruments;
  const insMult = ins.map(() => 1); // quality multipliers from instrument_degrade
  const insOff = ins.map(() => false);
  const stored = ins.map(() => 0); // Gb on the recorder, per instrument
  const dutyMult = orbit.dutyCycleMultiplier ?? 1;
  const genPerDay = ins.map((i) => (i.dataRateKbps * 1000 * i.dutyCycle * dutyMult * 86400) / 1e9);

  let rEff = r; // the design with degraded pointing applied
  let link = linkModel(catalog, design, rEff);
  const pm = powerModel(catalog, design, r);
  const insLoadW = Math.max(0, budgets.power.loadScienceW - budgets.power.loadSafeW);
  const txLoadW = Math.max(0, budgets.power.loadDownlinkW - budgets.power.loadSafeW);
  const maxDoD = r.parts.battery?.specs.maxDepthOfDischarge ?? 0.6;
  const toleranceKrad = budgets.radiation.toleranceKrad;
  const doseFactor = r.parts.shielding?.specs.doseFactor ?? 1;
  const cruiseDosePerDay = (CRUISE_DOSE_KRAD_PER_YEAR * doseFactor) / 365;
  const orbitDosePerDay = (dest.radiationKradPerYear * (orbit.radiationMultiplier ?? 1) * doseFactor) / 365;

  // ---------------- science bookkeeping (§4.5 with actual downlinked volumes) ----------------
  const objs = scenario.objectives.map((o) => ({
    o,
    bonusPct: 0,
    meas: o.measurements.map((m) => {
      const cand = ins.map((i, idx) => (i.measures.some((x) => x.type === m.type) ? idx : -1)).filter((idx) => idx >= 0);
      return { m, cand, baseQ: cand.map(() => 0), qv: 0, vol: 0, qMax: 0 };
    }),
  }));
  const refreshQuality = () => {
    for (const ob of objs)
      for (const me of ob.meas) me.baseQ = me.cand.map((ci) => instrumentQuality(rEff, design, ins[ci], me.m.type, ob.o.maxGsdM));
  };
  refreshQuality();
  const refreshPointing = () => {
    const adcs = r.parts.adcs;
    if (!adcs) return;
    const pointingDeg = (adcs.specs.pointingDeg ?? 1) / mult('adcs'); // half the performance = twice the pointing error
    rEff = { ...r, parts: { ...r.parts, adcs: { ...adcs, specs: { ...adcs.specs, pointingDeg } } } };
    link = linkModel(catalog, design, rEff);
    refreshQuality();
  };

  // ---------------- flight state ----------------
  const log: LogEntry[] = [];
  const decisions: DecisionLog = {};
  const fired = new Set<string>(); // each card at most once per mission
  const queue: PendingEvent[] = []; // cards waiting behind the one on screen
  let sciencePauseDays = 0;
  let scienceRateFactor = 1;
  let dataRateFactor = 1; // permanent
  const rateWindows: { from: number; to: number; factor: number }[] = []; // temporary, back to back
  let massKg = budgets.mass.wetKg;
  let latentEngineFault = false;
  let maintenancePossible = true;

  const health: Record<string, HealthState> = {};
  for (const slot of Object.keys(r.parts)) health[slot] = 'ok';
  for (const i of ins) health[i.id] = 'ok';

  const state: SimState = {
    day: 0, date: launchDate, phase: 'launch', spacecraft: { x: e0.x, y: e0.y }, earth: { x: e0.x, y: e0.y }, target: targetAt(0, e0),
    sunDistanceAU: Math.hypot(e0.x, e0.y), earthDistanceAU: 0, powerW: pm.generatedW(1, 0), batterySoc: 1, storageUsedGb: 0,
    propellantKg: budgets.mass.propellantKg, doseKrad: 0, reserveRemainingM: reveal.reserveRemainingM, health,
    safeModeDaysLeft: 0, downlinkedGbByObjective: {}, dataLostGb: 0, sciencePct: 0, objectivePct: {}, inConjunction: false, ended: false,
  };
  for (const ob of objs) { state.objectivePct![ob.o.id] = 0; state.downlinkedGbByObjective[ob.o.id] = 0; }

  const push = (kind: LogEntry['kind'], text: string, extra: Partial<LogEntry> = {}) => {
    log.push({ day: state.day, date: state.date, kind, text, ...extra });
  };

  const staticFacts = facts(catalog, design, state);
  const storageGb = budgets.comms.storageGb;
  const currentFacts = () => {
    staticFacts.phase = state.phase;
    staticFacts['state.batterySoc'] = state.batterySoc;
    staticFacts['state.storageFrac'] = storageGb > 0 ? state.storageUsedGb / storageGb : 0;
    staticFacts['state.propellantKg'] = state.propellantKg;
    return staticFacts;
  };

  /** End the mission. Before the end of the primary mission that is a loss; afterwards it is just the end. */
  const lose = (cause: string) => {
    if (state.ended) return;
    if (state.day <= primaryEndDay) {
      state.lossCause = cause;
      push('anomaly', `Mission lost: ${cause}`);
    } else push('milestone', `End of mission: ${cause}`);
    state.ended = true;
    state.phase = 'ended';
    state.pending = undefined;
    queue.length = 0;
  };

  const updateScience = () => {
    let total = 0;
    for (const ob of objs) {
      const credits = ob.meas.map((me) => Math.min(me.qv / me.m.requiredGb, me.qMax));
      const credit = ob.o.combine === 'any' ? Math.max(...credits) : Math.min(...credits);
      const pct = Math.min(100, credit * 100 + (credit > 0 ? ob.bonusPct : 0));
      state.objectivePct![ob.o.id] = pct;
      state.downlinkedGbByObjective[ob.o.id] = ob.meas.reduce((a, me) => a + me.vol, 0);
      total += (ob.o.weight * pct) / 100; // weights sum to 100
    }
    state.sciencePct = total;
  };

  // ---------------- propellant ----------------
  const isp = () => (r.parts.propulsion?.specs.ispS ?? 220) * mult('propulsion');
  const propellantFor = (dvMs: number) => massKg * (1 - Math.exp(-dvMs / (isp() * K.g0Ms2)));
  const useProp = (kg: number): boolean => {
    const used = Math.min(kg, state.propellantKg);
    state.propellantKg -= used;
    massKg -= used;
    return used >= kg - 1e-9;
  };
  const dvItem = (id: string) => budgets.deltaV.items.find((i) => i.id === id)?.value ?? 0;
  const dsmDay = Math.min(arrivalDay - 1, Math.max(1, Math.round(traj.flybys.length ? traj.flybys[0].dayOffset / 2 : arrivalDay * 0.4)));
  const tcmDay = Math.max(1, arrivalDay - 10);

  // ---------------- events ----------------
  const raise = (card: EventCard, context: string[]) => {
    fired.add(card.id);
    const ctx = [...context];
    const all = card.options.flatMap((o) => [...o.effects, ...o.failureEffects]);
    if (all.some((e) => e.kind === 'cost_m')) ctx.push(`Reserve left: $${fmt(state.reserveRemainingM, 1)}M`);
    if (all.some((e) => e.kind === 'propellant_use_kg')) ctx.push(`Propellant left: ${fmt(state.propellantKg)} kg`);
    const pe: PendingEvent = { card, day: state.day, context: ctx };
    push('event', card.title, { eventId: card.id });
    if (state.pending) queue.push(pe);
    else state.pending = pe;
  };
  const hazardCard = (subsystem: SlotId | 'instrument') =>
    deck.find((c) => c.trigger.kind === 'hazard' && c.trigger.subsystem === subsystem && !fired.has(c.id)
      && phaseMatches(c.trigger.phase, state.phase) && conditionsHold(c, currentFacts()));

  const degrade = (slot: SlotId, factor: number) => {
    slotMult[slot] = mult(slot) * factor;
    if (health[slot] !== 'failed') health[slot] = 'degraded';
    if (slot === 'adcs') refreshPointing();
  };

  const defaultConsequence = (slot: SlotId) => {
    if (MISSION_ENDING_SLOTS.includes(slot)) {
      health[slot] = 'failed';
      lose(isRedundant(slot) ? `Both ${partName(slot)} units failed` : `Single-string ${partName(slot)} failure`);
    } else if (slot === 'adcs') {
      degrade('adcs', ADCS_FAILURE_DEGRADE);
      push('anomaly', `${partName('adcs')} degraded: pointing is twice as coarse from now on.`);
    } else if (slot === 'antenna') {
      degrade('antenna', ANTENNA_FAILURE_DEGRADE);
      push('anomaly', `${partName('antenna')} failed: falling back to the low-gain antenna, downlink cut to ${ANTENNA_FAILURE_DEGRADE * 100}%.`);
    } else if (slot === 'thermal') {
      degrade('thermal', THERMAL_FAILURE_DEGRADE);
      push('anomaly', `${partName('thermal')} degraded: instruments must run cooler duty cycles (science rate −${Math.round((1 - THERMAL_FAILURE_DEGRADE) * 100)}%).`);
    } else if (slot === 'propulsion') {
      if (state.day < arrivalDay) {
        latentEngineFault = true; // it will show itself at the next big burn
        push('anomaly', 'Propulsion telemetry looks off: a pressure reading is drifting. The engine may misbehave at orbit insertion.');
      } else {
        health.propulsion = 'failed';
        maintenancePossible = false;
        push('anomaly', `${partName('propulsion')} failed: no more orbit maintenance, so no extended mission.`);
      }
    }
  };

  /** A subsystem failed. Redundancy absorbs the first failure; otherwise a matching event card, otherwise the default consequence. */
  const slotFailure = (slot: SlotId, allowCard: boolean, context: string[] = []) => {
    if (health[slot] === 'failed') return;
    if (isRedundant(slot) && !spareUsed.has(slot)) {
      spareUsed.add(slot);
      push('anomaly', `${partName(slot)} failed — backup engaged: redundancy paid off.`);
      return;
    }
    const card = allowCard ? hazardCard(slot) : undefined;
    if (card) raise(card, [`Failed: ${partName(slot)}`, ...context]);
    else defaultConsequence(slot);
  };

  const disableInstrument = (idx: number, why: string) => {
    if (insOff[idx]) return;
    insOff[idx] = true;
    health[ins[idx].id] = 'failed';
    push('anomaly', `${ins[idx].name} ${why}.`);
  };
  const instrumentFailure = (idx: number) => {
    const card = hazardCard('instrument');
    if (card) raise(card, [`Failed: ${ins[idx].name}`]);
    else disableInstrument(idx, 'has failed and is switched off for good');
  };

  /** "random" (or no target) picks one working instrument on its own stream; otherwise the named instrument if on board. */
  const pickInstrument = (target: string | undefined, card: EventCard, n: number): number => {
    if (target && target !== 'random') return ins.findIndex((i) => i.id === target);
    const working = ins.map((i, idx) => ({ id: i.id, idx })).filter((x) => !insOff[x.idx]).sort((a, b) => (a.id < b.id ? -1 : 1));
    const u = rng.next(`pick:${card.id}:${n}`);
    return working.length ? working[Math.min(working.length - 1, Math.floor(u * working.length))].idx : -1;
  };

  /** Apply one card effect (§5.4). Returns a plain-English log line. */
  const applyEffect = (e: Effect, card: EventCard, n: number): string | undefined => {
    const v = e.value;
    switch (e.kind) {
      case 'science_pause_days':
        if (state.phase === 'arrival' || state.phase === 'aerobraking') {
          scienceStartDay += Math.round(v); // before science starts, a pause is a delay to the start
          return `Science start slips by ${fmt(v)} days.`;
        }
        sciencePauseDays += Math.round(v);
        return `Science paused for ${fmt(v)} days.`;
      case 'safe_mode_days':
        state.safeModeDaysLeft += Math.round(v);
        return `Spacecraft in safe mode for ${fmt(v)} days: no science, no science downlink.`;
      case 'lose_data_gb': {
        const total = stored.reduce((a, b) => a + b, 0);
        const lost = Math.min(v, total);
        if (total > 0) for (let i = 0; i < stored.length; i++) stored[i] *= 1 - lost / total;
        state.dataLostGb += lost;
        state.storageUsedGb = total - lost;
        return `${fmt(lost, 1)} Gb of stored data lost.`;
      }
      case 'instrument_disable': {
        const idx = pickInstrument(e.target, card, n);
        if (idx >= 0) disableInstrument(idx, 'is switched off for good');
        return undefined;
      }
      case 'instrument_degrade': {
        const idx = pickInstrument(e.target, card, n);
        if (idx < 0) return undefined;
        insMult[idx] *= v;
        if (!insOff[idx]) health[ins[idx].id] = 'degraded';
        return `${ins[idx].name} degraded: data quality ×${fmt(v, 2)}.`;
      }
      case 'subsystem_fail':
        if (e.target) slotFailure(e.target as SlotId, false);
        return undefined;
      case 'subsystem_degrade':
        if (!e.target) return undefined;
        degrade(e.target as SlotId, v);
        return `${partName(e.target as SlotId)} degraded to ${Math.round(mult(e.target as SlotId) * 100)}% performance.`;
      case 'propellant_use_kg':
        useProp(v);
        return `Used ${fmt(v, 1)} kg of propellant (${fmt(state.propellantKg)} kg left).`;
      case 'cost_m':
        state.reserveRemainingM -= v;
        return v >= 0
          ? `Spent $${fmt(v, 1)}M from reserves (${state.reserveRemainingM >= 0 ? `$${fmt(state.reserveRemainingM, 1)}M left` : `$${fmt(-state.reserveRemainingM, 1)}M over budget`}).`
          : `$${fmt(-v, 1)}M returned to reserves.`;
      case 'mission_years_delta':
        primaryEndDay += Math.round(v * 365);
        extendedEndDay += Math.round(v * 365);
        return v >= 0 ? `Primary mission extended by ${fmt(v, 1)} years.` : `Primary mission cut short by ${fmt(-v, 1)} years.`;
      case 'dose_krad':
        state.doseKrad += v;
        return `Electronics took ${fmt(v, 1)} krad of extra radiation.`;
      case 'data_rate_factor': {
        const days = effectDays(e);
        if (days === undefined) {
          dataRateFactor *= v;
          return `Downlink rate ×${fmt(v, 2)} from now on.`;
        }
        const from = Math.max(state.day, ...rateWindows.map((w) => w.to)); // timed changes run one after another
        rateWindows.push({ from, to: from + Math.round(days), factor: v });
        return v === 0 ? `No downlink for ${fmt(days)} days.` : `Downlink rate ×${fmt(v, 2)} for ${fmt(days)} days.`;
      }
      case 'science_rate_factor':
        scienceRateFactor *= v;
        return `Science data rate ×${fmt(v, 2)} from now on.`;
      case 'science_bonus_pct':
        for (const ob of objs) if (!e.target || e.target === 'all' || e.target === ob.o.id) ob.bonusPct += v;
        return `Bonus science: +${fmt(v, 1)} points.`;
      case 'mission_loss':
        lose(e.target ?? card.title);
        return undefined;
    }
  };

  // ---------------- hazard & random-event clocks ----------------
  // Time-to-failure sampling: a clock fails when its accumulated hazard reaches an Exp(1) draw from its own stream.
  const newLimit = (draw: () => number) => -Math.log(1 - draw());
  const makeClock = (stream: string, ratePerYear: number) => {
    const draw = rng.stream(stream);
    return { draw, ratePerYear, h: 0, limit: newLimit(draw) };
  };
  /** Advance a clock by one day at `ratePerYear`; true when it fires (and re-arms). */
  const tick = (c: { draw: () => number; h: number; limit: number }, ratePerYear: number): boolean => {
    c.h += ratePerYear / 365;
    if (c.h < c.limit) return false;
    c.h = 0;
    c.limit = newLimit(c.draw);
    return true;
  };
  const slotClocks = (Object.entries(r.parts) as [SlotId, NonNullable<(typeof r.parts)[SlotId]>][])
    .filter(([, p]) => p.failureRatePerYear > 0)
    .map(([slot, p]) => ({ slot, ...makeClock(`hazard:${slot}`, p.failureRatePerYear * hazardMult) }));
  const insClocks = ins.map((i, idx) => ({ idx, ...makeClock(`hazard:${i.id}`, i.failureRatePerYear * hazardMult) }));
  const randomCards = deck.filter((c) => c.trigger.kind === 'random').map((card) => ({ card, ...makeClock(`event:${card.id}`, card.trigger.probabilityPerYear ?? 0) }));
  const scheduledCards = deck.filter((c) => c.trigger.kind === 'scheduled');
  const weatherCards = deck.filter((c) => c.trigger.kind === 'space_weather').map((card) => ({ card, minSeverity: severityFromString(card.trigger.minSeverity) }));
  const weather = weatherCards.length ? spaceWeatherCalendar(catalog.spaceWeather, seed) : undefined;
  const phaseStartDay = (p: MissionPhase): number =>
    p === 'arrival' ? arrivalDay : p === 'science' ? scienceStartDay + 1 : p === 'extended' ? primaryEndDay + 1 : 1;

  const phaseFor = (day: number): SimPhase => {
    if (day <= 0) return 'launch';
    if (day < arrivalDay) return 'cruise';
    if (day === arrivalDay) return 'arrival';
    if (day <= scienceStartDay) return orbit.aerobraking ? 'aerobraking' : 'arrival';
    if (day <= primaryEndDay) return 'science';
    if (day <= extendedEndDay && extendedApproved) return 'extended';
    return 'ended';
  };

  const decideExtended = () => {
    extendedDecided = true;
    const years = scenario.extendedMissionYears;
    const needKg = propellantFor(orbit.maintenanceDvMsPerYear * years);
    const why = years <= 0 ? 'none was planned'
      : !maintenancePossible ? 'the propulsion system cannot hold the orbit'
      : state.propellantKg < needKg ? `only ${fmt(state.propellantKg, 1)} kg of propellant left; ${fmt(needKg, 1)} kg needed to hold the orbit`
      : state.reserveRemainingM < 0 ? 'the project is over budget'
      : undefined;
    extendedApproved = why === undefined;
    if (why && years > 0) push('info', `No extended mission: ${why}.`);
  };

  const arrive = () => {
    // Burn the engine: a latent fault from cruise, or the stress of the burn itself, can spoil it.
    const lambda = (r.parts.propulsion?.failureRatePerYear ?? 0) * hazardMult;
    const burnFails = rng.next('insertion') < 1 - Math.exp(-lambda * INSERTION_BURN_STRESS_YEARS);
    if (!useProp(propellantFor(dvItem('insertion') + dvItem('aerobrake-walk')))) return lose('Ran out of propellant during orbit insertion');
    if (latentEngineFault || burnFails) {
      latentEngineFault = false;
      const card = hazardCard('propulsion');
      if (!card) return lose(`Orbit insertion burn failed — the spacecraft flew past ${dest.name}`);
      raise(card, ['The main engine misbehaved during the orbit insertion burn.']);
    }
  };

  const stepDay = () => {
    state.day += 1;
    const day = state.day;
    state.date = addDays(launchDate, day);

    // ---- phase clock ----
    if (day > primaryEndDay && !extendedDecided) decideExtended();
    const prev = state.phase;
    state.phase = phaseFor(day);
    if (prev !== state.phase) {
      const label: Record<SimPhase, string> = {
        launch: 'Launch', cruise: `Cruise to ${dest.name}`, arrival: `Arrived at ${dest.name} — orbit insertion burn`, aerobraking: 'Aerobraking begins',
        science: 'Primary science mission begins', extended: 'Extended mission approved', ended: 'Mission complete',
      };
      push('milestone', label[state.phase]);
    }
    if (state.phase === 'ended') { state.ended = true; return; }

    // ---- geometry ----
    state.earth = earthAt(day);
    state.target = targetAt(day, state.earth);
    state.spacecraft = day < arrivalDay ? cruisePos(day) : state.target;
    state.sunDistanceAU = Math.hypot(state.spacecraft.x, state.spacecraft.y);
    state.earthDistanceAU = isMoon ? dest.earthDistanceAU.mean : Math.max(0.01, dist(state.spacecraft, state.earth));
    const atTarget = day >= arrivalDay;
    const inScience = state.phase === 'science' || state.phase === 'extended';

    // ---- burns ----
    if (day === dsmDay && traj.dsmDvMs > 0 && day < arrivalDay) {
      useProp(propellantFor(traj.dsmDvMs));
      push('milestone', `Deep-space manoeuvre: ${fmt(traj.dsmDvMs)} m/s burn complete.`);
    }
    if (day === tcmDay && day < arrivalDay) useProp(propellantFor(traj.tcmDvMs));
    if (day === arrivalDay) {
      if (tcmDay >= arrivalDay) useProp(propellantFor(traj.tcmDvMs));
      arrive();
      if (state.ended) return;
    }
    if (inScience && maintenancePossible && orbit.maintenanceDvMsPerYear > 0) {
      if (!useProp(propellantFor(orbit.maintenanceDvMsPerYear / 365))) {
        maintenancePossible = false;
        if (state.phase === 'extended') return lose('Out of propellant');
        push('anomaly', 'Propellant tanks are empty: no more orbit maintenance, so no extended mission.');
      }
    }

    // ---- radiation, power, battery ----
    state.doseKrad += atTarget ? orbitDosePerDay : cruiseDosePerDay;
    const overdose = state.doseKrad / toleranceKrad;
    state.powerW = pm.generatedW(Math.max(0.3, state.sunDistanceAU), day / 365.25) * mult('power');
    const spareW = state.powerW - budgets.power.loadSafeW;
    const batteryWh = budgets.power.batteryWh * mult('battery');
    const eclipseWh = budgets.power.batteryRequiredWh * maxDoD; // energy drawn per eclipse
    state.batterySoc = inScience && batteryWh > 0 ? clamp01(1 - eclipseWh / batteryWh) : inScience && eclipseWh > 0 ? 0 : 1;

    // ---- science & downlink ----
    const safe = state.safeModeDaysLeft > 0;
    if (safe) state.safeModeDaysLeft -= 1;
    if (inScience) {
      const paused = sciencePauseDays > 0;
      if (paused) sciencePauseDays -= 1;
      const powerFrac = insLoadW > 0 ? clamp01(spareW / insLoadW) : 1; // not enough power → run fewer instrument-hours
      const batteryFrac = budgets.power.batteryRequiredWh > 0 ? Math.min(1, batteryWh / budgets.power.batteryRequiredWh) : 1; // brown-out in eclipse
      const science = paused || safe ? 0 : scienceRateFactor * mult('thermal') * powerFrac * batteryFrac;
      let total = 0;
      for (let i = 0; i < ins.length; i++) {
        if (!insOff[i]) stored[i] += genPerDay[i] * science;
        total += stored[i];
      }

      // Solar conjunction: the Sun sits between the spacecraft and Earth.
      let conjunction = false;
      if (!isMoon) {
        const sx = -state.earth.x, sy = -state.earth.y; // Earth → Sun
        const cx = state.spacecraft.x - state.earth.x, cy = state.spacecraft.y - state.earth.y; // Earth → spacecraft
        conjunction = (sx * cx + sy * cy) / (Math.hypot(sx, sy) * Math.hypot(cx, cy)) > cosConjunction;
      }
      if (conjunction !== state.inConjunction)
        push('info', conjunction ? 'Solar conjunction: the Sun is between you and Earth. No downlink until it passes.' : 'Solar conjunction is over: downlink resumes.');
      state.inConjunction = conjunction;

      let window = 1;
      for (const w of rateWindows) if (day > w.from && day <= w.to) window *= w.factor;
      const txFrac = txLoadW > 0 ? clamp01(spareW / txLoadW) : 1;
      const rateBps = link.rateBps(state.earthDistanceAU) * mult('transmitter') * mult('antenna');
      const capacityGb = conjunction || safe ? 0 : ((rateBps * design.dsnHoursPerDay * 3600) / 1e9) * dataRateFactor * window * txFrac;
      const share = total > 0 ? Math.min(1, capacityGb / total) : 0;
      if (share > 0) {
        for (const ob of objs)
          for (const me of ob.meas) {
            let v = 0, q = 0;
            for (let k = 0; k < me.cand.length; k++) {
              const ci = me.cand[k];
              const sent = stored[ci] * share;
              if (sent <= 0) continue;
              v += sent;
              q = Math.max(q, me.baseQ[k] * insMult[ci]);
            }
            if (v > 0 && q >= me.m.minQuality) { me.qv += q * v; me.vol += v; me.qMax = Math.max(me.qMax, q); }
          }
        for (let i = 0; i < stored.length; i++) stored[i] *= 1 - share;
        total *= 1 - share;
      }
      const cap = storageGb * mult('avionics');
      if (total > cap) {
        state.dataLostGb += total - cap; // recorder full: the oldest data is overwritten
        const keep = total > 0 ? cap / total : 0;
        for (let i = 0; i < stored.length; i++) stored[i] *= keep;
        total = cap;
      }
      state.storageUsedGb = total;
      updateScience();
    }

    // ---- hazards (§5.3) ----
    for (const c of slotClocks) {
      const rate = c.slot === 'avionics' && overdose > 1 ? c.ratePerYear * OVERDOSE_HAZARD_FACTOR * overdose * overdose : c.ratePerYear;
      if (health[c.slot] !== 'failed' && tick(c, rate)) slotFailure(c.slot, true);
      if (state.ended) return;
    }
    if (day > arrivalDay)
      for (const c of insClocks) if (!insOff[c.idx] && tick(c, c.ratePerYear)) instrumentFailure(c.idx);

    // ---- event cards (§5.4) ----
    for (const card of scheduledCards)
      if (!fired.has(card.id) && day === phaseStartDay(card.trigger.phase) + Math.round(card.trigger.dayOffset ?? 0) && conditionsHold(card, currentFacts())) raise(card, []);
    for (const c of randomCards)
      if (!fired.has(c.card.id) && phaseMatches(c.card.trigger.phase, state.phase) && conditionsHold(c.card, currentFacts()) && tick(c, c.ratePerYear)) raise(c.card, []);
    const storm = weather?.eventOn(day);
    if (storm)
      for (const w of weatherCards)
        if (!fired.has(w.card.id) && storm.severity >= w.minSeverity && phaseMatches(w.card.trigger.phase, state.phase) && conditionsHold(w.card, currentFacts()))
          raise(w.card, [spaceWeatherContext(storm)]);
  };

  const result = (): MissionResult => {
    const objectives = scenario.objectives.map((o) => {
      const pct = state.objectivePct?.[o.id] ?? 0;
      return { objectiveId: o.id, pct, metThreshold: pct >= o.thresholdPct };
    });
    const lost = !!state.lossCause;
    const sci = state.sciencePct;
    const outcome: Outcome = lost ? 'lost' : sci >= 90 ? 'exceeded' : sci >= 75 ? 'full' : objectives.every((o) => o.metThreshold) ? 'threshold' : 'partial';
    // The planned total already contains the whole reserve: unspent reserve is handed back, an overrun (negative) adds on top.
    const totalCostM = planned.cost.totalM - state.reserveRemainingM;
    const underBudget = totalCostM <= planned.cost.capM;
    const stars = ((sci >= 75 ? 1 : 0) + (underBudget ? 1 : 0) + (!lost ? 1 : 0)) as 0 | 1 | 2 | 3;
    return { outcome, sciencePct: sci, objectives, totalCostM, underBudget, stars, daysFlown: state.day, lossCause: state.lossCause, log, finalState: state };
  };

  const sim: Simulation = {
    get state() { return state; },
    get log() { return log; },
    get decisions() { return decisions; },
    advance(days: number): AdvanceResult {
      const start = log.length;
      if (state.day === 0 && log.length === 0) {
        push('milestone', `Launch on ${r.lv.name}`);
        if (rng.next('launch') >= r.lv.reliability) lose(`${r.lv.name} failed during launch`);
      }
      for (let i = 0; i < days && !state.ended && !state.pending; i++) stepDay();
      return { state, newLog: log.slice(start), pending: state.pending };
    },
    decide(optionId: string): AdvanceResult {
      const start = log.length;
      const pe = state.pending;
      if (pe) {
        const { card } = pe;
        const option = card.options.find((o) => o.id === optionId) ?? card.options.find((o) => o.id === card.defaultOptionId) ?? card.options[0];
        decisions[card.id] = option.id;
        push('decision', `${card.title}: ${option.label}`, { eventId: card.id, optionId: option.id });
        state.pending = undefined;
        let effects = option.effects;
        if (option.successProbability !== undefined) {
          const success = rng.next(`gamble:${card.id}`) < option.successProbability;
          push('event', success ? 'It worked.' : 'It did not work.', { eventId: card.id, optionId: option.id });
          if (!success) effects = option.failureEffects;
        }
        effects.forEach((e, n) => {
          if (state.ended) return;
          const text = applyEffect(e, card, n);
          if (text) push('event', text, { eventId: card.id, optionId: option.id });
        });
        updateScience();
        if (!state.ended && queue.length) state.pending = queue.shift();
      }
      return { state, newLog: log.slice(start), pending: state.pending };
    },
    result,
  };
  return sim;
}

/** Fly the whole mission without a player: recorded decisions where given, otherwise each card's default option (§5.5). */
export function runHeadless(catalog: Catalog, design: MissionDesign, seed: number, decisions: DecisionLog = {}): MissionResult {
  const sim = createSimulation(catalog, design, seed);
  for (let guard = 0; guard < 100000 && !sim.state.ended; guard++) {
    const res = sim.advance(36500);
    if (res.pending) sim.decide(decisions[res.pending.card.id] ?? res.pending.card.defaultOptionId);
  }
  return sim.result();
}
