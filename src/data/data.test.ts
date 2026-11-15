/**
 * Data integrity tests — run by `npm test` and in CI. Track B owns this file; add a check whenever
 * you find a class of data bug. Schema validation itself happens in loadCatalog().
 */
import { describe, expect, it } from 'vitest';
import { loadCatalog } from './index';

const c = loadCatalog();
const ids = <T extends { id: string }>(xs: T[]) => new Set(xs.map((x) => x.id));

describe('catalog', () => {
  it('loads and validates every JSON file', () => {
    expect(c.scenarios.length).toBeGreaterThan(0);
  });

  it('has unique ids per table', () => {
    for (const [name, list] of Object.entries({
      sources: c.sources, destinations: c.destinations, trajectories: c.trajectories, launchVehicles: c.launchVehicles,
      parts: c.parts, instruments: c.instruments, scenarios: c.scenarios, events: c.events, history: c.history, reviewRules: c.reviewRules,
    })) {
      expect(ids(list as { id: string }[]).size, name).toBe((list as unknown[]).length);
    }
  });

  it('every record cites known sources', () => {
    const known = ids(c.sources);
    const all = [c.constants, ...c.missionClasses, ...c.destinations, ...c.destinations.flatMap((d) => d.orbits), ...c.trajectories,
      ...c.launchVehicles, ...c.parts, ...c.instruments, ...c.scenarios, ...c.events, ...c.history, ...c.reviewRules];
    for (const rec of all) for (const s of rec.sources) expect(known.has(s), `unknown source "${s}"`).toBe(true);
  });

  it('scenarios reference existing things and weights sum to 100', () => {
    const dest = ids(c.destinations), traj = ids(c.trajectories), lv = ids(c.launchVehicles);
    const ins = ids(c.instruments), ev = ids(c.events), hist = ids(c.history);
    for (const s of c.scenarios) {
      expect(dest.has(s.destinationId), s.id).toBe(true);
      s.trajectoryIds.forEach((t) => expect(traj.has(t), `${s.id} → ${t}`).toBe(true));
      s.launchVehicleIds.forEach((l) => expect(lv.has(l), `${s.id} → ${l}`).toBe(true));
      s.instrumentIds.forEach((i) => expect(ins.has(i), `${s.id} → ${i}`).toBe(true));
      s.eventIds.forEach((e) => expect(ev.has(e), `${s.id} → ${e}`).toBe(true));
      expect(hist.has(s.historicalMissionId), s.id).toBe(true);
      expect(s.objectives.reduce((a, o) => a + o.weight, 0), `${s.id} weights`).toBe(100);
      for (const t of s.trajectoryIds) expect(c.trajectories.find((x) => x.id === t)!.destinationId).toBe(s.destinationId);
    }
  });

  it('every objective measurement is offered by at least one instrument on the scenario shelf', () => {
    for (const s of c.scenarios) {
      const shelf = c.instruments.filter((i) => s.instrumentIds.includes(i.id));
      for (const o of s.objectives)
        for (const m of o.measurements)
          expect(shelf.some((i) => i.measures.some((x) => x.type === m.type)), `${s.id}/${o.id} needs ${m.type}`).toBe(true);
    }
  });

  it('every slot has at least one part, and the shielding slot has a "none" option', () => {
    for (const slot of ['power', 'battery', 'propulsion', 'antenna', 'transmitter', 'adcs', 'avionics', 'thermal', 'shielding'])
      expect(c.parts.some((p) => p.slot === slot), slot).toBe(true);
    expect(c.parts.some((p) => p.slot === 'shielding' && (p.specs.doseFactor ?? 1) === 1)).toBe(true);
  });

  it('launch vehicle curves are sorted by C3 and non-increasing in mass', () => {
    for (const lv of c.launchVehicles)
      for (let i = 1; i < lv.performance.length; i++) {
        expect(lv.performance[i].c3Km2s2, lv.id).toBeGreaterThan(lv.performance[i - 1].c3Km2s2);
        expect(lv.performance[i].massKg, lv.id).toBeLessThanOrEqual(lv.performance[i - 1].massKg);
      }
  });

  it('event cards are internally consistent', () => {
    for (const e of c.events) {
      expect(e.options.some((o) => o.id === e.defaultOptionId), `${e.id} default option`).toBe(true);
      if (e.trigger.kind === 'hazard') expect(e.trigger.subsystem, `${e.id} hazard needs subsystem`).toBeDefined();
      if (e.trigger.kind === 'random') expect(e.trigger.probabilityPerYear, `${e.id} needs probabilityPerYear`).toBeDefined();
    }
  });

  it('transmitter DC power matches RF power / efficiency (±10%)', () => {
    for (const p of c.parts.filter((x) => x.slot === 'transmitter')) {
      const expected = p.specs.rfPowerW! / p.specs.dcEfficiency!;
      expect(Math.abs(p.powerW - expected) / expected, p.id).toBeLessThan(0.1);
    }
  });

  it('every source has a working-looking https URL and NASA sources exist', () => {
    for (const s of c.sources) expect(s.url.startsWith('https://'), s.id).toBe(true);
    expect(c.sources.filter((s) => s.isNasa).length).toBeGreaterThanOrEqual(8);
  });
});
