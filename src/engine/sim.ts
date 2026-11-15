/**
 * Flight simulator — daily time step, deterministic given (design, seed, decisions).
 *
 * v0 (kickoff): NOMINAL flight only — phases, positions, power, data downlink, storage overflow and science
 * accumulation work; NO hazards, events or decisions yet. Track A replaces the TODO(Track A) blocks
 * following docs/GAME_DESIGN.md §5. The public shape (createSimulation / runHeadless) is the contract.
 */
import { getEvent } from '../data';
import type { DecisionLog, MissionDesign } from '../types/design';
import type { AdvanceResult, Catalog, LogEntry, MissionResult, Outcome, SimPhase, SimState, Simulation, Vec2 } from '../types/engine';
import { computeBudgets, instrumentQuality, resolveDesign } from './budgets';
import { realizedBudgets } from './growth';
import { addDays, planetPositionAU } from './orbits';
import { Rng } from './rng';

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

export function createSimulation(catalog: Catalog, design: MissionDesign, seed: number): Simulation {
  // Fly the spacecraft as built: the Reality Check growth for this seed (§4.7) sets the propellant load and what is left in reserve.
  const { reveal, actual: budgets } = realizedBudgets(catalog, design, seed);
  const r = resolveDesign(catalog, design);
  const { scenario, dest, traj } = r;
  const rng = new Rng(seed);
  void rng; // TODO(Track A): hazards & events draw from named streams: rng.next(`hazard:${slot}`), rng.next(`event:${id}`)
  void getEvent;

  const earthEl = catalog.planetaryElements.find((p) => p.bodyId === 'earth')!;
  const targetEl = catalog.planetaryElements.find((p) => p.bodyId === dest.elementsBodyId);
  const launchDate = addDays(traj.launchDate, design.launchOffsetDays);
  const arrivalDay = traj.tofDays;
  const scienceStart = arrivalDay + r.aerobrakingDays;
  const primaryEnd = scienceStart + scenario.primaryMissionYears * 365;
  const extendedEnd = primaryEnd + scenario.extendedMissionYears * 365;

  // Per-day data generation by measurement type (Gb/day at full science), and best quality per objective measurement.
  const dutyMult = r.orbit.dutyCycleMultiplier ?? 1;
  const genByType: Record<string, number> = {};
  for (const ins of r.instruments)
    for (const m of ins.measures)
      genByType[m.type] = (genByType[m.type] ?? 0) + (ins.dataRateKbps * 1000 * ins.dutyCycle * dutyMult * 86400) / 1e9;
  const totalGen = r.instruments.reduce((a, i) => a + (i.dataRateKbps * 1000 * i.dutyCycle * dutyMult * 86400) / 1e9, 0);
  const meanDist = dest.earthDistanceAU.mean;
  const rateAtMeanBps = budgets.comms.rateKbpsAtMean * 1000;

  const earthAt = (iso: string) => planetPositionAU(earthEl, iso);
  const targetAt = (iso: string): Vec2 => {
    if (dest.kind === 'moon' || !targetEl) {
      const e = earthAt(iso);
      return { x: e.x + 0.0026, y: e.y }; // the Moon sits on top of Earth at solar-system scale
    }
    return planetPositionAU(targetEl, iso);
  };
  const e0 = earthAt(launchDate);
  const tArr = targetAt(addDays(launchDate, arrivalDay));

  /** Cruise path: prograde spiral from Earth@launch to target@arrival (visual only; physics uses the trajectory table). */
  const cruisePos = (day: number): Vec2 => {
    const t = Math.min(1, day / arrivalDay);
    const r0 = Math.hypot(e0.x, e0.y), r1 = Math.hypot(tArr.x, tArr.y);
    const a0 = Math.atan2(e0.y, e0.x);
    let a1 = Math.atan2(tArr.y, tArr.x);
    while (a1 < a0) a1 += 2 * Math.PI;
    if (traj.kind === 'gravity_assist') a1 += 2 * Math.PI; // extra loop for the Earth flyby
    const rr = r0 + (r1 - r0) * (1 - Math.cos(Math.PI * t)) / 2;
    const ang = a0 + (a1 - a0) * t;
    return { x: rr * Math.cos(ang), y: rr * Math.sin(ang) };
  };

  const byType: Record<string, number> = {};
  const log: LogEntry[] = [];
  const decisions: DecisionLog = {};
  const scienceRateFactor = 1; // TODO(Track A): modified by 'science_rate_factor' effects

  const state: SimState = {
    day: 0, date: launchDate, phase: 'launch', spacecraft: { x: e0.x, y: e0.y }, earth: { x: e0.x, y: e0.y }, target: targetAt(launchDate),
    sunDistanceAU: 1, earthDistanceAU: 0, powerW: budgets.power.generatedBolW, batterySoc: 1, storageUsedGb: 0,
    propellantKg: budgets.mass.propellantKg, doseKrad: 0, reserveRemainingM: reveal.reserveRemainingM, health: {},
    safeModeDaysLeft: 0, downlinkedGbByObjective: {}, dataLostGb: 0, sciencePct: 0, ended: false,
  };

  const push = (kind: LogEntry['kind'], text: string, extra: Partial<LogEntry> = {}) => {
    const entry: LogEntry = { day: state.day, date: state.date, kind, text, ...extra };
    log.push(entry);
    return entry;
  };

  const computeSciencePct = () => {
    let total = 0;
    for (const o of scenario.objectives) {
      const credits = o.measurements.map((m) => {
        const q = Math.max(0, ...r.instruments.filter((i) => i.measures.some((x) => x.type === m.type)).map((i) => instrumentQuality(r, design, i, m.type, o.maxGsdM)));
        return q >= m.minQuality ? q * Math.min(1, (byType[m.type] ?? 0) / m.requiredGb) : 0;
      });
      const credit = o.combine === 'any' ? Math.max(...credits) : Math.min(...credits);
      state.downlinkedGbByObjective[o.id] = o.measurements.reduce((a, m) => a + (byType[m.type] ?? 0), 0);
      total += o.weight * credit;
    }
    return total; // weights sum to 100
  };

  const phaseFor = (day: number): SimPhase => {
    if (day === 0) return 'launch';
    if (day < arrivalDay) return 'cruise';
    if (day < scienceStart) return r.aerobrakingDays > 0 ? 'aerobraking' : 'arrival';
    if (day < primaryEnd) return 'science';
    if (day < extendedEnd) return 'extended';
    return 'ended';
  };

  const stepDay = () => {
    state.day += 1;
    state.date = addDays(launchDate, state.day);
    const prev = state.phase;
    state.phase = phaseFor(state.day);
    state.earth = earthAt(state.date);
    state.target = targetAt(state.date);
    state.spacecraft = state.day < arrivalDay ? cruisePos(state.day) : state.target;
    state.sunDistanceAU = Math.hypot(state.spacecraft.x, state.spacecraft.y);
    state.earthDistanceAU = dest.kind === 'moon' ? meanDist : Math.max(0.01, dist(state.spacecraft, state.earth));

    if (prev !== state.phase) {
      const label: Record<SimPhase, string> = {
        launch: 'Launch', cruise: `Cruise to ${dest.name}`, arrival: `Arrived at ${dest.name} — orbit insertion`, aerobraking: 'Aerobraking begins',
        science: 'Primary science mission begins', extended: 'Extended mission approved', ended: 'Mission complete',
      };
      push('milestone', label[state.phase]);
    }
    // TODO(Track A): hazards per subsystem (λ_eff/365 per day), scheduled/random/space-weather events → state.pending; return early if pending.

    if (state.phase === 'science' || state.phase === 'extended') {
      const science = state.safeModeDaysLeft > 0 ? 0 : scienceRateFactor;
      const rate = rateAtMeanBps * (meanDist / state.earthDistanceAU) ** 2;
      const capacity = (rate * design.dsnHoursPerDay * 3600) / 1e9;
      const generated = totalGen * science;
      state.storageUsedGb += generated;
      const sent = Math.min(state.storageUsedGb, capacity);
      const share = state.storageUsedGb > 0 ? sent / state.storageUsedGb : 0;
      // attribute downlinked volume to measurement types in proportion to generation
      if (totalGen > 0) for (const [type, g] of Object.entries(genByType)) byType[type] = (byType[type] ?? 0) + (g / totalGen) * share * state.storageUsedGb;
      state.storageUsedGb -= sent;
      const cap = budgets.comms.storageGb;
      if (state.storageUsedGb > cap) {
        state.dataLostGb += state.storageUsedGb - cap;
        state.storageUsedGb = cap;
      }
      state.sciencePct = computeSciencePct();
    }
    if (state.phase === 'ended') state.ended = true;
  };

  const sim: Simulation = {
    get state() { return state; },
    get log() { return log; },
    get decisions() { return decisions; },
    advance(days: number): AdvanceResult {
      const start = log.length;
      if (state.day === 0 && log.length === 0) push('milestone', `Launch on ${r.lv.name}`);
      for (let i = 0; i < days && !state.ended && !state.pending; i++) stepDay();
      return { state, newLog: log.slice(start), pending: state.pending };
    },
    decide(optionId: string): AdvanceResult {
      const start = log.length;
      if (state.pending) {
        decisions[state.pending.card.id] = optionId;
        push('decision', `${state.pending.card.title}: ${state.pending.card.options.find((o) => o.id === optionId)?.label ?? optionId}`, { eventId: state.pending.card.id, optionId });
        // TODO(Track A): apply option effects / gamble with rng.next(`gamble:${card.id}`).
        state.pending = undefined;
      }
      return { state, newLog: log.slice(start) };
    },
  };
  return sim;
}

export function runHeadless(catalog: Catalog, design: MissionDesign, seed: number, decisions: DecisionLog = {}): MissionResult {
  const sim = createSimulation(catalog, design, seed);
  for (let guard = 0; guard < 100000 && !sim.state.ended; guard++) {
    const res = sim.advance(36500);
    if (res.pending) sim.decide(decisions[res.pending.card.id] ?? res.pending.card.defaultOptionId);
  }
  return summarize(catalog, design, sim);
}

export function summarize(catalog: Catalog, design: MissionDesign, sim: Simulation): MissionResult {
  const r = resolveDesign(catalog, design);
  const budgets = computeBudgets(catalog, design);
  const s = sim.state;
  const objectives = r.scenario.objectives.map((o) => {
    const pct = Math.min(100, ((s.downlinkedGbByObjective[o.id] ?? 0) / o.measurements.reduce((a, m) => a + m.requiredGb, 0)) * 100);
    return { objectiveId: o.id, pct, metThreshold: pct >= o.thresholdPct };
  });
  const lost = !!s.lossCause;
  const outcome: Outcome = lost
    ? 'lost'
    : s.sciencePct >= 90 ? 'exceeded' : s.sciencePct >= 75 ? 'full' : objectives.every((o) => o.metThreshold) ? 'threshold' : 'partial';
  // Budget total already includes the full reserve; whatever reserve is left unspent is money returned.
  const totalCost = budgets.cost.totalM - s.reserveRemainingM; // TODO(Track A): event costs beyond reserves
  const stars = ((s.sciencePct >= 75 ? 1 : 0) + (totalCost <= budgets.cost.capM ? 1 : 0) + (!lost ? 1 : 0)) as 0 | 1 | 2 | 3;
  return {
    outcome, sciencePct: s.sciencePct, objectives, totalCostM: totalCost, underBudget: totalCost <= budgets.cost.capM, stars,
    daysFlown: s.day, lossCause: s.lossCause, log: sim.log, finalState: s,
  };
}
