/**
 * Flight simulator tests (GAME_DESIGN §5): determinism, phase rules, hazards, event cards, every effect kind,
 * space-weather replay and outcome scoring. Owner: Track A.
 */
import { describe, expect, it } from 'vitest';
import { catalog } from '../data';
import { EffectKind, type Effect, type EventCard } from '../types/catalog';
import type { DecisionLog, MissionDesign } from '../types/design';
import type { Catalog, MissionResult } from '../types/engine';
import { computeBudgets, createSimulation, defaultDesign, runHeadless } from './index';
import { conditionHolds, facts, isKnownFact, phaseMatches, severityFromString, spaceWeatherCalendar, spaceWeatherContext } from './events';
import { referenceDesigns } from './reference-designs';

const refs = referenceDesigns(catalog);
const ref = (id: string) => refs.find((r) => r.id === id)!.design;
const mro = ref('mro-like');
const juno = ref('juno-like');

/** A catalog where nothing ever goes wrong: no failures, perfect rockets, empty event decks. */
function quiet(base: Catalog = catalog): Catalog {
  const c: Catalog = structuredClone(base);
  for (const p of c.parts) p.failureRatePerYear = 0;
  for (const i of c.instruments) i.failureRatePerYear = 0;
  for (const l of c.launchVehicles) l.reliability = 1;
  for (const s of c.scenarios) s.eventIds = [];
  return c;
}

/** A quiet catalog plus one synthetic card that fires on day `dayOffset` of the given phase in every scenario. */
function withCard(card: Partial<EventCard> & { options: EventCard['options'] }, phase: EventCard['trigger']['phase'] = 'science', dayOffset = 30): Catalog {
  const c = quiet();
  const full: EventCard = {
    id: 'ev-test', title: 'Test card', narrative: 'n', realStory: { mission: 'm', year: 2000, summary: 's', lesson: 'l' },
    trigger: { kind: 'scheduled', phase, dayOffset }, conditions: [], defaultOptionId: card.options[0].id, sources: [], confidence: 'game', ...card,
  };
  c.events.push(full);
  for (const s of c.scenarios) s.eventIds = ['ev-test'];
  return c;
}
const option = (effects: Effect[], extra: Partial<EventCard['options'][number]> = {}): EventCard['options'][number] =>
  ({ id: 'a', label: 'Do it', description: 'd', effects, failureEffects: [], ...extra });
const fx = (kind: Effect['kind'], value = 0, target?: string): Effect => ({ kind, value, target });

/** Play interactively in small steps, answering cards with `choose`, and return the result and the decisions made. */
function play(c: Catalog, d: MissionDesign, seed: number, choose: (card: EventCard) => string, stepDays = 7) {
  const sim = createSimulation(c, d, seed);
  for (let guard = 0; guard < 100000 && !sim.state.ended; guard++) {
    const res = sim.advance(stepDays);
    if (res.pending) sim.decide(choose(res.pending.card));
  }
  return { result: sim.result(), decisions: { ...sim.decisions }, sim };
}
const comparable = (r: MissionResult) => ({ ...r, finalState: { ...r.finalState } });

describe('determinism', () => {
  it('same design + seed + decisions → identical mission, log and all', () => {
    for (const d of [mro, juno, ref('lunar-prospector-like')])
      for (const seed of [1, 42, 20261114]) expect(comparable(runHeadless(catalog, d, seed))).toEqual(comparable(runHeadless(catalog, d, seed)));
  });

  it('different seeds give different missions', () => {
    const logs = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => JSON.stringify(runHeadless(catalog, mro, s).log)));
    expect(logs.size).toBeGreaterThan(4);
  });

  it('an interactive flight replays exactly from its recorded decisions (what the debrief relies on)', () => {
    for (const seed of [3, 11, 77, 2026]) {
      // pick the LAST option of every card — deliberately not the default
      const live = play(catalog, mro, seed, (card) => card.options[card.options.length - 1].id, 3);
      const replay = runHeadless(catalog, mro, seed, live.decisions);
      expect(comparable(replay)).toEqual(comparable(live.result));
    }
  });

  it('advance() stops at a pending card and at the end of the mission', () => {
    const sim = createSimulation(catalog, mro, 4242);
    const res = sim.advance(100000);
    expect(res.pending ?? sim.state.ended).toBeTruthy();
    if (res.pending) {
      const day = sim.state.day;
      expect(sim.advance(50).state.day).toBe(day); // time is frozen until the player decides
      expect(sim.decide('no-such-option').pending?.card.id).not.toBe(res.pending.card.id); // falls back to the default option
    }
  });
});

describe('nominal flight (nothing goes wrong)', () => {
  const q = quiet();

  it('returns about the science the design-time budget promised', () => {
    for (const d of [mro, juno, ref('lunar-prospector-like'), ref('maven-like')]) {
      const res = runHeadless(q, { ...d, dsnHoursPerDay: Math.min(24, d.dsnHoursPerDay * 2) }, 1);
      const expected = computeBudgets(q, { ...d, dsnHoursPerDay: Math.min(24, d.dsnHoursPerDay * 2) }).science.expectedPct;
      expect(res.outcome).not.toBe('lost');
      expect(Math.abs(res.sciencePct - expected), d.missionName).toBeLessThan(6);
    }
  });

  it('sciencePct is the weighted sum of the objective percentages, and scoring follows §6.1', () => {
    const res = runHeadless(q, juno, 1);
    const scenario = q.scenarios.find((s) => s.id === juno.scenarioId)!;
    const sum = scenario.objectives.reduce((a, o) => a + (o.weight * res.objectives.find((x) => x.objectiveId === o.id)!.pct) / 100, 0);
    expect(res.sciencePct).toBeCloseTo(sum, 9);
    expect(res.sciencePct).toBeGreaterThanOrEqual(75);
    expect(['full', 'exceeded']).toContain(res.outcome);
    expect(res.stars).toBe(3);
    expect(res.underBudget).toBe(true);
    for (const o of res.objectives) expect(o.metThreshold).toBe(o.pct >= scenario.objectives.find((x) => x.id === o.objectiveId)!.thresholdPct);
  });

  it('walks the phases in order and uses propellant for every burn', () => {
    const { sim, result } = play(q, juno, 1, (c) => c.defaultOptionId, 30);
    const milestones = result.log.filter((l) => l.kind === 'milestone').map((l) => l.text);
    const order = ['Launch on', 'Cruise to', 'Deep-space manoeuvre', 'Arrived at', 'Primary science mission begins', 'Extended mission approved', 'Mission complete'];
    let at = -1;
    for (const m of order) {
      const i = milestones.findIndex((t, idx) => idx > at && t.startsWith(m));
      expect(i, m).toBeGreaterThan(at);
      at = i;
    }
    const b = computeBudgets(q, juno);
    expect(sim.state.propellantKg).toBeGreaterThan(0);
    expect(sim.state.propellantKg).toBeLessThan(b.mass.propellantKg * 0.15); // only margin + disposal left
    expect(sim.state.doseKrad).toBeGreaterThan(b.radiation.primaryDoseKrad); // extended mission keeps soaking
  });

  it('aerobraking eats into the primary mission instead of extending it', () => {
    const direct = runHeadless(q, { ...mro, orbitId: 'mars-low-circular', launchVehicleId: 'lv-falcon-heavy', parts: { ...mro.parts, propulsion: 'prop-biprop' } }, 1);
    const aero = runHeadless(q, mro, 1);
    const start = (r: MissionResult) => r.log.find((l) => l.text.startsWith('Primary science'))!.day;
    const ext = (r: MissionResult) => r.log.find((l) => l.text.startsWith('Extended mission') || l.text.startsWith('No extended'))!.day;
    expect(start(aero) - start(direct)).toBe(180);
    expect(ext(aero)).toBe(ext(direct));
  });

  it('no propellant to hold the orbit → no extended mission', () => {
    const d = ref('lunar-prospector-like'); // 50 km lunar orbit needs 120 m/s per year
    const low = runHeadless(q, d, 1);
    expect(low.log.some((l) => l.text.startsWith('No extended mission'))).toBe(true);
    const frozen = runHeadless(q, { ...d, orbitId: 'moon-frozen' }, 1);
    expect(frozen.log.some((l) => l.text.startsWith('Extended mission approved'))).toBe(true);
    expect(frozen.daysFlown).toBeGreaterThan(low.daysFlown);
  });

  it('Mars passes behind the Sun: solar conjunction interrupts the downlink', () => {
    const res = runHeadless(q, mro, 1);
    const starts = res.log.filter((l) => l.text.startsWith('Solar conjunction: '));
    expect(starts.length).toBeGreaterThanOrEqual(1);
    expect(res.log.filter((l) => l.text.startsWith('Solar conjunction is over')).length).toBe(starts.length);
  });

  it('a starved downlink fills the recorder and loses data', () => {
    const res = runHeadless(q, { ...mro, dsnHoursPerDay: 1 }, 1);
    expect(res.finalState.dataLostGb).toBeGreaterThan(100);
    expect(res.sciencePct).toBeLessThan(runHeadless(q, mro, 1).sciencePct);
  });

  it('a full Jupiter mission simulates in a few milliseconds', () => {
    runHeadless(catalog, juno, 1);
    const t0 = performance.now();
    for (let s = 0; s < 20; s++) runHeadless(catalog, juno, s);
    expect((performance.now() - t0) / 20).toBeLessThan(25);
  });
});

describe('losing the mission', () => {
  it('a launch failure ends it on day 0 with no science', () => {
    const c = quiet();
    c.launchVehicles.find((l) => l.id === mro.launchVehicleId)!.reliability = 0;
    const res = runHeadless(c, mro, 5);
    expect(res.outcome).toBe('lost');
    expect(res.daysFlown).toBe(0);
    expect(res.lossCause).toContain('failed during launch');
    expect(res.sciencePct).toBe(0);
    expect(res.stars).toBeLessThanOrEqual(1); // only the budget star is still possible
  });

  it('a failed insertion burn loses a mission with no event card for it', () => {
    const c = quiet();
    c.parts.find((p) => p.id === 'prop-mono')!.failureRatePerYear = 50;
    const res = runHeadless(c, mro, 5);
    expect(res.outcome).toBe('lost');
    expect(res.lossCause).toContain('Orbit insertion burn failed');
    expect(res.daysFlown).toBe(220);
  });

  it('a mission lost mid-science keeps the science already returned', () => {
    const c = withCard({ options: [option([fx('mission_loss', 0, 'Test loss')])] }, 'science', 400);
    const res = runHeadless(c, mro, 5);
    expect(res.outcome).toBe('lost');
    expect(res.lossCause).toBe('Test loss');
    expect(res.sciencePct).toBeGreaterThan(10);
    expect(res.sciencePct).toBeLessThan(runHeadless(quiet(), mro, 5).sciencePct);
  });

  it('a failure after the primary mission ends the flight but is not a loss', () => {
    const c = withCard({ options: [option([fx('mission_loss', 0, 'Late failure')])] }, 'extended', 50);
    const res = runHeadless(c, mro, 5);
    expect(res.outcome).not.toBe('lost');
    expect(res.lossCause).toBeUndefined();
    expect(res.log.some((l) => l.text === 'End of mission: Late failure')).toBe(true);
  });

  it('single-string failures are reported as such, and overdosed avionics die at Jupiter', () => {
    let lost = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const res = runHeadless(catalog, ref('juno-no-vault'), seed);
      if (res.outcome === 'lost') lost++;
    }
    expect(lost).toBeGreaterThan(18); // GAME_DESIGN §7: success < 40% without a vault
  });
});

describe('hazards & redundancy', () => {
  const fragile = () => {
    const c = quiet();
    c.parts.find((p) => p.id === 'avi-radtol')!.failureRatePerYear = 0.8;
    return c;
  };

  it('redundancy absorbs the first failure — on the very day the single-string twin is lost', () => {
    const c = fragile();
    let checked = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const single = runHeadless(c, mro, seed);
      if (single.outcome !== 'lost') continue;
      expect(single.lossCause).toContain('Single-string');
      const dual = runHeadless(c, { ...mro, redundant: ['avionics'] }, seed);
      const saved = dual.log.find((l) => l.text.includes('redundancy paid off'));
      expect(saved?.day, `seed ${seed}`).toBe(single.daysFlown); // same dice, different outcome
      expect(dual.daysFlown).toBeGreaterThan(single.daysFlown);
      checked++;
    }
    expect(checked).toBeGreaterThan(5);
  });

  it('rigorous assurance means fewer losses than lean, on the same dice', () => {
    const c = fragile();
    const lost = (assurance: MissionDesign['assurance']) =>
      Array.from({ length: 40 }, (_, s) => runHeadless(c, { ...mro, assurance }, s + 1)).filter((r) => r.outcome === 'lost').length;
    expect(lost('rigorous')).toBeLessThan(lost('lean'));
  });

  it('an instrument failure switches that instrument off, and a non-critical subsystem failure only degrades', () => {
    const c = quiet();
    c.instruments.find((i) => i.id === 'ins-radar')!.failureRatePerYear = 40;
    c.parts.find((p) => p.id === 'ant-hga-30')!.failureRatePerYear = 40;
    const res = runHeadless(c, mro, 9);
    expect(res.outcome).not.toBe('lost');
    expect(res.finalState.health['ins-radar']).toBe('failed');
    expect(res.finalState.health.antenna).toBe('degraded');
    expect(res.objectives.find((o) => o.objectiveId === 'mars-ice')!.pct).toBeLessThan(20);
  });
});

describe('event cards', () => {
  it('every condition in the data uses a fact the engine provides', () => {
    for (const card of catalog.events) for (const cond of card.conditions) expect(isKnownFact(cond.fact), `${card.id}: ${cond.fact}`).toBe(true);
    const sim = createSimulation(catalog, mro, 1);
    const f = facts(catalog, mro, sim.state);
    for (const key of ['design.assurance', 'design.commsBand', 'design.dsnAperture', 'redundant.adcs', 'parts.antenna', 'power.kind', 'orbit.id',
      'orbit.aerobraking', 'destination.id', 'mission.class', 'phase', 'state.batterySoc', 'state.storageFrac', 'state.propellantKg', 'instrument.ins-hires'])
      expect(f[key], key).not.toBeUndefined();
    expect(f['power.kind']).toBe('solar');
    expect(f['orbit.aerobraking']).toBe(true);
    expect(f['instrument.ins-mwr']).toBe(false);
  });

  it('evaluates every condition operator', () => {
    const f = { a: 5, s: 'lean', b: true };
    const c = (fact: string, op: string, value: unknown) => conditionHolds({ fact, op, value } as never, f);
    expect(c('a', 'gt', 4) && c('a', 'gte', 5) && c('a', 'lt', 6) && c('a', 'lte', 5)).toBe(true);
    expect(c('a', 'gt', 5) || c('a', 'lt', 5)).toBe(false);
    expect(c('s', 'eq', 'lean') && c('s', 'neq', 'standard') && c('s', 'in', ['lean', 'standard']) && c('b', 'eq', true)).toBe(true);
    expect(c('missing', 'eq', 1)).toBe(false);
    expect(c('redundant.adcs', 'eq', false)).toBe(true); // absent redundancy / instrument facts read as false
    expect(phaseMatches('arrival', 'aerobraking') && phaseMatches('any', 'cruise') && !phaseMatches('science', 'extended') && !phaseMatches('any', 'ended')).toBe(true);
  });

  // Table-driven: every card in the data must be reachable in some realistic setup, and every option must play out.
  const stress = (card: EventCard): Catalog => {
    const c: Catalog = structuredClone(catalog);
    for (const l of c.launchVehicles) l.reliability = 1;
    for (const p of c.parts) p.failureRatePerYear = 0;
    for (const i of c.instruments) i.failureRatePerYear = 0;
    if (card.trigger.kind === 'hazard')
      for (const p of c.parts) if (p.slot === card.trigger.subsystem) p.failureRatePerYear = 1.5;
    if (card.trigger.kind === 'hazard' && card.trigger.subsystem === 'instrument') for (const i of c.instruments) i.failureRatePerYear = 1.5;
    return c;
  };
  const variants = (scenarioId: string): MissionDesign[] => {
    const base = scenarioId === 'mars-climate' ? mro : scenarioId === 'jupiter-interior' ? juno : ref('lunar-prospector-like');
    return [base, { ...base, assurance: 'lean' }, { ...base, orbitId: catalog.destinations.find((d) => d.id === catalog.scenarios.find((s) => s.id === scenarioId)!.destinationId)!.orbits[0].id }];
  };
  for (const card of catalog.events) {
    it(`"${card.id}" can fire, and each of its ${card.options.length} options plays out`, () => {
      const c = stress(card);
      let found: { d: MissionDesign; seed: number } | undefined;
      const designs = c.scenarios.filter((x) => x.eventIds.includes(card.id)).flatMap((s) => variants(s.id));
      search: for (let seed = 1; seed <= 150; seed++)
        for (const d of designs)
          if (runHeadless(c, d, seed).log.some((l) => l.kind === 'decision' && l.eventId === card.id)) { found = { d, seed }; break search; }
      expect(found, `${card.id} never fired`).toBeDefined();
      for (const o of card.options) {
        const res = runHeadless(c, found!.d, found!.seed, { [card.id]: o.id });
        expect(res.log.some((l) => l.kind === 'decision' && l.eventId === card.id && l.optionId === o.id)).toBe(true);
        expect(res.finalState.ended).toBe(true);
        expect(Number.isFinite(res.sciencePct) && Number.isFinite(res.totalCostM)).toBe(true);
        expect(res.log.filter((l) => l.kind === 'decision' && l.eventId === card.id).length).toBe(1); // at most once per mission
      }
    }, 30000);
  }

  it('a card whose conditions do not hold never fires', () => {
    const c = withCard({ conditions: [{ fact: 'design.assurance', op: 'eq', value: 'lean' }], options: [option([fx('cost_m', 5)])] });
    expect(runHeadless(c, mro, 1).log.some((l) => l.eventId === 'ev-test')).toBe(false);
    expect(runHeadless(c, { ...mro, assurance: 'lean' }, 1).log.some((l) => l.eventId === 'ev-test')).toBe(true);
  });

  it('gambles roll on their own stream: about successProbability of them succeed', () => {
    const c = withCard({ options: [option([], { successProbability: 0.7, failureEffects: [fx('mission_loss', 0, 'Gamble lost')] })] });
    const lost = Array.from({ length: 200 }, (_, s) => runHeadless(c, mro, s + 1)).filter((r) => r.outcome === 'lost').length;
    expect(lost).toBeGreaterThan(40);
    expect(lost).toBeLessThan(80);
  });
});

describe('effects interpreter', () => {
  const base = runHeadless(quiet(), mro, 1);
  const after = (effects: Effect[], phase: EventCard['trigger']['phase'] = 'science', d: MissionDesign = mro) =>
    runHeadless(withCard({ options: [option(effects)] }, phase), d, 1);
  // A data-starved mission with no extended phase to catch up in: every lost day and lost bit shows in the score.
  const noExtended = (c: Catalog) => { for (const s of c.scenarios) s.extendedMissionYears = 0; return c; };
  const starved: MissionDesign = { ...mro, dsnHoursPerDay: 1 };
  const starvedBase = runHeadless(noExtended(quiet()), starved, 1);
  const starvedAfter = (effects: Effect[]) => runHeadless(noExtended(withCard({ options: [option(effects)] })), starved, 1);

  it('handles every EffectKind without crashing', () => {
    for (const kind of EffectKind.options) {
      const target = kind === 'subsystem_fail' || kind === 'subsystem_degrade' ? 'adcs' : kind === 'mission_loss' ? 'Test' : kind === 'science_bonus_pct' ? 'all' : undefined;
      const res = after([fx(kind, 0.5, target)]);
      expect(res.finalState.ended, kind).toBe(true);
      expect(Number.isFinite(res.sciencePct), kind).toBe(true);
      expect(res.log.some((l) => l.kind === 'decision' && l.eventId === 'ev-test'), kind).toBe(true);
    }
  });

  it('cost_m is paid from reserves; an overrun costs the budget star', () => {
    const small = after([fx('cost_m', 10)]);
    expect(small.totalCostM).toBeCloseTo(base.totalCostM + 10, 6);
    expect(small.underBudget).toBe(true);
    const huge = after([fx('cost_m', 400)]);
    expect(huge.finalState.reserveRemainingM).toBeLessThan(0);
    expect(huge.underBudget).toBe(false);
    expect(huge.stars).toBe(base.stars - 1);
    expect(huge.log.some((l) => l.text.startsWith('No extended mission: the project is over budget'))).toBe(true);
  });

  it('science_pause_days / safe_mode_days cost science; a pause during aerobraking delays the start instead', () => {
    // A pause only stops collection (the recorder keeps emptying); safe mode also stops the downlink, so it costs more.
    const quick = { ...mro, dsnHoursPerDay: 24, dsnAperture: '70m' as const }; // downlink keeps up, so collection time is what counts
    const quickBase = runHeadless(noExtended(quiet()), quick, 1).sciencePct;
    expect(runHeadless(noExtended(withCard({ options: [option([fx('science_pause_days', 300)])] })), quick, 1).sciencePct).toBeLessThan(quickBase - 1);
    expect(starvedAfter([fx('safe_mode_days', 200)]).sciencePct).toBeLessThan(starvedBase.sciencePct - 1);
    const delayed = after([fx('science_pause_days', 100)], 'arrival');
    const start = (r: MissionResult) => r.log.find((l) => l.text.startsWith('Primary science'))!.day;
    expect(start(delayed) - start(base)).toBe(100);
  });

  it('instrument_disable / instrument_degrade hit the named instrument', () => {
    const off = after([fx('instrument_disable', 0, 'ins-hires')]);
    expect(off.finalState.health['ins-hires']).toBe('failed');
    expect(off.objectives.find((o) => o.objectiveId === 'mars-hires')!.pct).toBeLessThan(base.objectives.find((o) => o.objectiveId === 'mars-hires')!.pct);
    const worse = after([fx('instrument_degrade', 0.5, 'ins-hires')]);
    expect(worse.finalState.health['ins-hires']).toBe('degraded');
    const random = after([fx('instrument_disable', 0, 'random')]);
    expect(mro.instrumentIds.filter((id) => random.finalState.health[id] === 'failed').length).toBe(1);
  });

  it('subsystem_fail respects redundancy; subsystem_degrade lowers performance', () => {
    expect(after([fx('subsystem_fail', 0, 'transmitter')]).outcome).toBe('lost');
    const saved = after([fx('subsystem_fail', 0, 'transmitter')], 'science', { ...mro, redundant: ['transmitter'] });
    expect(saved.outcome).not.toBe('lost');
    expect(saved.log.some((l) => l.text.includes('redundancy paid off'))).toBe(true);
    const dim = after([fx('subsystem_degrade', 0.02, 'power')]);
    expect(dim.finalState.health.power).toBe('degraded');
    expect(dim.sciencePct).toBeLessThan(base.sciencePct - 5);
    const blurry = after([fx('subsystem_degrade', 0.1, 'adcs')]); // 10× coarser pointing ruins the telescope
    expect(blurry.objectives.find((o) => o.objectiveId === 'mars-hires')!.pct).toBeLessThan(base.objectives.find((o) => o.objectiveId === 'mars-hires')!.pct);
  });

  it('propellant_use_kg, dose_krad and lose_data_gb change the state they name', () => {
    expect(after([fx('propellant_use_kg', 20)]).finalState.propellantKg).toBeLessThan(base.finalState.propellantKg - 15);
    expect(after([fx('propellant_use_kg', 5000)]).log.some((l) => l.text.startsWith('No extended mission'))).toBe(true);
    expect(after([fx('dose_krad', 7)]).finalState.doseKrad).toBeCloseTo(base.finalState.doseKrad + 7, 6);
    const wiped = starvedAfter([fx('lose_data_gb', 50)]);
    expect(wiped.log.some((l) => l.text === '50 Gb of stored data lost.')).toBe(true);
    expect(wiped.sciencePct).toBeLessThanOrEqual(starvedBase.sciencePct); // a full recorder was overflowing anyway
  });

  it('data_rate_factor: timed windows run back to back, untimed ones are permanent', () => {
    const blackout = starvedAfter([fx('data_rate_factor', 0, 'days:100')]).sciencePct;
    expect(blackout).toBeLessThan(starvedBase.sciencePct);
    expect(starvedAfter([fx('data_rate_factor', 0.2)]).sciencePct).toBeLessThan(blackout);
    // blackout THEN boost (not a boost cancelled out by the blackout): better than the blackout alone
    expect(starvedAfter([fx('data_rate_factor', 0, 'days:100'), fx('data_rate_factor', 3, 'days:100')]).sciencePct).toBeGreaterThan(blackout);
  });

  it('science_rate_factor, science_bonus_pct and mission_years_delta move the science and the calendar', () => {
    expect(after([fx('science_rate_factor', 0.02)]).sciencePct).toBeLessThan(base.sciencePct);
    const bonus = after([fx('science_bonus_pct', 5, 'mars-weather')]);
    const w = (r: MissionResult) => r.objectives.find((o) => o.objectiveId === 'mars-weather')!.pct;
    expect(w(bonus)).toBeCloseTo(w(base) + 5, 6);
    const none = after([fx('science_bonus_pct', 5, 'mars-escape')]); // no instrument for it: a bonus cannot conjure science
    expect(none.objectives.find((o) => o.objectiveId === 'mars-escape')!.pct).toBe(0);
    expect(after([fx('mission_years_delta', -1)]).daysFlown).toBe(base.daysFlown - 365);
  });
});

describe('space-weather replay (NASA DONKI)', () => {
  it('maps flare classes to severity as in GAME_DESIGN §5.6', () => {
    expect(severityFromString('M1')).toBeCloseTo(0.3, 6);
    expect(severityFromString('M9.9')).toBeCloseTo(0.55, 6);
    expect(severityFromString('X1')).toBeCloseTo(0.6, 6);
    expect(severityFromString('X10')).toBeCloseTo(1, 6);
    expect(severityFromString('X28')).toBe(1);
    expect(severityFromString('SEP')).toBe(0.8);
    expect(severityFromString('0.6')).toBe(0.6);
    expect(severityFromString(undefined)).toBe(0);
  });

  it('replays the real record on a seed-shifted calendar and names the real event', () => {
    const real = catalog.spaceWeather.reduce((a, b) => (b.severity > a.severity ? b : a));
    const snapshotDay = Math.floor((Date.parse(real.time) - Date.UTC(2014, 0, 1)) / 86400000);
    for (const seed of [0, 100, 364, 1000]) {
      const cal = spaceWeatherCalendar(catalog.spaceWeather, seed);
      expect(cal.eventOn(snapshotDay - (seed % 365))?.id).toBe(real.id);
      expect(cal.eventOn(snapshotDay - (seed % 365) + 2191)?.id).toBe(real.id); // the snapshot loops
    }
    expect(spaceWeatherContext({ id: 'x', kind: 'FLR', time: '2017-09-06T12:02Z', classType: 'X9.3', severity: 0.97 }))
      .toBe('Based on a real X9.3 flare, 6 Sep 2017 (NASA DONKI)');
  });

  it('a real storm triggers the storm card with its source line as context', () => {
    const real = catalog.spaceWeather.reduce((a, b) => (b.severity > a.severity ? b : a));
    const snapshotDay = Math.floor((Date.parse(real.time) - Date.UTC(2014, 0, 1)) / 86400000);
    const c: Catalog = quiet();
    for (const s of c.scenarios) s.eventIds = ['ev-sep-storm'];
    const seed = 300; // storm lands on mission day snapshotDay − 300
    const sim = createSimulation(c, mro, seed);
    const res = sim.advance(100000);
    expect(res.pending?.card.id).toBe('ev-sep-storm');
    expect(res.pending?.day).toBe(snapshotDay - seed);
    expect(res.pending?.context.some((line) => line.includes('NASA DONKI') && line.includes(real.classType ?? ''))).toBe(true);
    const decisions: DecisionLog = { 'ev-sep-storm': 'safe' };
    expect(runHeadless(c, mro, seed, decisions).finalState.doseKrad).toBeGreaterThan(runHeadless(quiet(), mro, seed).finalState.doseKrad);
  });
});

describe('default designs fly', () => {
  for (const s of catalog.scenarios)
    it(`${s.id}: the default design completes or is lost cleanly on 25 seeds`, () => {
      const d = defaultDesign(catalog, s.id);
      for (let seed = 1; seed <= 25; seed++) {
        const res = runHeadless(catalog, d, seed);
        expect(res.finalState.ended).toBe(true);
        expect(res.finalState.pending).toBeUndefined();
        expect(res.sciencePct).toBeGreaterThanOrEqual(0);
        expect(res.sciencePct).toBeLessThanOrEqual(100);
        if (res.outcome === 'lost') expect(res.lossCause).toBeTruthy();
      }
    });
});
