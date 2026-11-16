/**
 * Debrief tests (GAME_DESIGN §6): Hindsight, best decision, Monte Carlo, You vs History, and the "Why?" explanations.
 * Owner: Track A.
 */
import { describe, expect, it } from 'vitest';
import { catalog } from '../data';
import type { MissionDesign } from '../types/design';
import type { Catalog } from '../types/engine';
import { buildDebrief, buildDebriefAsync, computeBudgets, defaultDesign, runHeadless, runReview, runReviewAsync } from './index';
import { alternatives, buildHindsight } from './hindsight';
import { monteCarlo, monteCarloSeeds, percentile } from './montecarlo';
import { referenceDesigns } from './reference-designs';

const refs = referenceDesigns(catalog);
const ref = (id: string) => refs.find((r) => r.id === id)!.design;
const mro = ref('mro-like');
const juno = ref('juno-like');

/** Nothing breaks and no cards fire, so a replay differs from the flight only through the changed decision. */
function quiet(): Catalog {
  const c: Catalog = structuredClone(catalog);
  for (const p of c.parts) p.failureRatePerYear = 0;
  for (const i of c.instruments) i.failureRatePerYear = 0;
  for (const l of c.launchVehicles) l.reliability = 1;
  for (const s of c.scenarios) s.eventIds = [];
  return c;
}

describe('hindsight: alternatives', () => {
  it('changes exactly one decision per alternative and covers every decision of §6.2', () => {
    const alts = alternatives(catalog, mro);
    const kinds = new Set(alts.map((a) => a.kind));
    for (const k of ['slot', 'solar', 'reserve', 'dsnHours', 'dsnAperture', 'band', 'orbit', 'trajectory', 'launchVehicle', 'assurance', 'instrumentRemove', 'instrumentAdd', 'redundancy'])
      expect(kinds.has(k as never), k).toBe(true);
    for (const a of alts) {
      const changed = (Object.keys(mro) as (keyof MissionDesign)[]).filter((k) => JSON.stringify(mro[k]) !== JSON.stringify(a.design[k]));
      expect(changed.length, `${a.dimension}: ${a.toLabel}`).toBe(1);
      expect(a.fromLabel).not.toBe(a.toLabel);
    }
    expect(alts.length).toBeLessThanOrEqual(60); // the replay budget
    // every other allowed antenna, no part reserved for another mission class
    expect(alts.filter((a) => a.slot === 'antenna' && a.kind === 'slot').length).toBe(catalog.parts.filter((p) => p.slot === 'antenna').length - 1);
    expect(alts.some((a) => a.design.parts.power === 'pwr-rtg-mmrtg')).toBe(false); // RTGs are Large-class only
    expect(alternatives(catalog, juno).some((a) => a.design.parts.power === 'pwr-rtg-mmrtg')).toBe(true);
  });

  it('removes each instrument on board and offers each one left on the shelf', () => {
    const alts = alternatives(catalog, mro);
    const shelf = catalog.scenarios.find((s) => s.id === mro.scenarioId)!.instrumentIds;
    expect(alts.filter((a) => a.kind === 'instrumentRemove').length).toBe(mro.instrumentIds.length);
    expect(alts.filter((a) => a.kind === 'instrumentAdd').length).toBe(shelf.length - mro.instrumentIds.length);
  });
});

describe('hindsight: replays', () => {
  const q = quiet();

  it('is deterministic and every replayed delta is exactly what a fresh flight of that design gives', () => {
    const seed = 77;
    const actual = runHeadless(catalog, mro, seed);
    const a = buildHindsight(catalog, mro, seed, {}, actual);
    const b = buildHindsight(catalog, mro, seed, {}, actual);
    expect(a).toEqual(b);
    expect(a.replays).toBeLessThanOrEqual(60);
    const alts = alternatives(catalog, mro);
    for (const item of a.explored.filter((x) => x.feasible).slice(0, 12)) {
      const alt = alts.find((x) => x.dimension === item.dimension && x.toLabel === item.toLabel && x.fromLabel === item.fromLabel)!;
      const replay = runHeadless(catalog, alt.design, seed);
      expect(item.deltaSciencePct).toBeCloseTo(replay.sciencePct - actual.sciencePct, 9);
      expect(item.deltaCostM).toBeCloseTo(replay.totalCostM - actual.totalCostM, 9);
      expect(item.replay).toMatchObject({
        sciencePct: replay.sciencePct, totalCostM: replay.totalCostM, outcome: replay.outcome,
      });
    }
  });

  it('a data-starved mission is told to fix its downlink, with the numbers', () => {
    const starved: MissionDesign = { ...mro, parts: { ...mro.parts, antenna: 'ant-hga-05', transmitter: 'tx-sspa-5' } };
    const actual = runHeadless(q, starved, 5);
    const { hindsight } = buildHindsight(q, starved, 5, {}, actual);
    expect(hindsight.length).toBeGreaterThan(0);
    expect(hindsight.length).toBeLessThanOrEqual(3);
    expect(['Antenna', 'Transmitter', 'Radio band', 'DSN antenna', 'DSN time']).toContain(hindsight[0].dimension);
    expect(hindsight[0].explanation).toMatch(/would have downlinked .* more data from Mars \(\+\d/);
    for (let i = 1; i < hindsight.length; i++) expect(hindsight[i].deltaSciencePct).toBeLessThanOrEqual(hindsight[i - 1].deltaSciencePct);
    for (const h of hindsight) {
      expect(h.feasible).toBe(true);
      expect(h.deltaSciencePct).toBeGreaterThan(0);
    }
    expect(new Set(hindsight.map((h) => h.dimension + h.fromLabel)).size).toBe(hindsight.length); // one lesson per decision
  });

  it('a missing instrument is the lesson when an objective is uncovered', () => {
    const d: MissionDesign = { ...mro, instrumentIds: ['ins-hires', 'ins-ctx', 'ins-visir', 'ins-uvs'] }; // isolate the missing buried-ice measurement
    const actual = runHeadless(q, d, 5);
    const { hindsight } = buildHindsight(q, d, 5, {}, actual);
    expect(hindsight[0].dimension).toBe('Instrument');
    expect(hindsight[0].explanation).toMatch(/^Adding the .* would have raised "Map buried ice" from 0% to \d+%/);
  });

  it('redundancy is the lesson when a single-string failure killed the mission', () => {
    const fragile = quiet();
    fragile.parts.find((p) => p.id === 'avi-radtol')!.failureRatePerYear = 0.3;
    const dual: MissionDesign = { ...mro, redundant: ['avionics'] };
    let seed = 1; // a universe where the single computer dies but a pair would have made it
    while (runHeadless(fragile, mro, seed).outcome !== 'lost' || runHeadless(fragile, dual, seed).outcome === 'lost') seed++;
    const actual = runHeadless(fragile, mro, seed);
    const { hindsight, explored } = buildHindsight(fragile, mro, seed, {}, actual);
    const backup = explored.find((x) => x.dimension === 'Redundancy' && x.toLabel.startsWith('a backup Radiation-tolerant'))!;
    expect(backup.deltaSciencePct).toBeGreaterThan(0);
    expect(backup.explanation).toContain('and the mission would have survived');
    expect(hindsight.some((h) => h.explanation.includes('the mission would have survived'))).toBe(true);
  });

  it('infeasible alternatives are reported with the reason and never simulated', () => {
    const actual = runHeadless(q, mro, 5);
    const { explored, replays } = buildHindsight(q, mro, 5, {}, actual);
    const impossible = explored.filter((x) => !x.feasible);
    expect(impossible.length).toBeGreaterThan(0);
    for (const x of impossible) {
      expect(x.explanation).toMatch(/^Not possible with the rest of your design: /);
      expect(x.replay).toBeUndefined();
    }
    expect(replays).toBe(explored.length - impossible.length);
    expect(explored.findIndex((x) => !x.feasible)).toBe(explored.length - impossible.length); // listed last
  });

  it('bestDecision names a choice whose every alternative scores worse', () => {
    const actual = runHeadless(q, mro, 5);
    const { bestDecision, explored } = buildHindsight(q, mro, 5, {}, actual);
    expect(bestDecision).toBeDefined();
    expect(bestDecision!.deltaSciencePct).toBeLessThan(0);
    expect(bestDecision!.explanation).toMatch(/^Your best call: /);
    const same = explored.filter((x) => x.feasible && x.dimension === bestDecision!.dimension && x.fromLabel === bestDecision!.fromLabel);
    for (const x of same) expect(x.deltaSciencePct).toBeLessThan(0);
    // and it is the closest of them: the loss you were guaranteed to avoid
    expect(Math.max(...same.map((x) => x.deltaSciencePct))).toBeCloseTo(bestDecision!.deltaSciencePct, 9);
  });

  it('respects the in-flight decisions of the actual mission', () => {
    const seed = 2026;
    const choose = { 'ev-aerobraking-panel': 'push', 'ev-sep-storm': 'observe', 'ev-dsn-conflict': 'buy' };
    const actual = runHeadless(catalog, mro, seed, choose);
    const withChoices = buildHindsight(catalog, mro, seed, choose, actual);
    const alt = alternatives(catalog, mro).find((a) => a.kind === 'band')!;
    const item = withChoices.explored.find((x) => x.dimension === 'Radio band')!;
    expect(item.deltaSciencePct).toBeCloseTo(runHeadless(catalog, alt.design, seed, choose).sciencePct - actual.sciencePct, 9);
  });
});

describe('monte carlo', () => {
  it('percentile interpolates and the seed list is deterministic', () => {
    expect(percentile([0, 10, 20, 30, 40], 0.5)).toBe(20);
    expect(percentile([0, 10], 0.1)).toBeCloseTo(1, 9);
    expect(percentile([], 0.5)).toBe(0);
    expect(monteCarloSeeds(7, 20)).toEqual(monteCarloSeeds(7, 20));
    expect(new Set(monteCarloSeeds(7, 20)).size).toBe(20);
    expect(monteCarloSeeds(7, 5)).not.toEqual(monteCarloSeeds(8, 5));
  });

  it('reports a success rate and ordered science percentiles', () => {
    const mc = monteCarlo(catalog, juno, 40, 1);
    expect(mc.runs).toBe(40);
    expect(mc.sciencePcts.length).toBe(40);
    expect(mc.scienceP10).toBeLessThanOrEqual(mc.scienceP50);
    expect(mc.scienceP50).toBeLessThanOrEqual(mc.scienceP90);
    expect(mc.successRatePct + mc.lostPct).toBeLessThanOrEqual(100);
    expect(mc.successRatePct).toBeGreaterThan(50); // a Juno-like design usually works
    expect(monteCarlo(catalog, juno, 40, 1)).toEqual(mc);
  });

  it('GAME_DESIGN §7: no radiation vault at Jupiter succeeds in fewer than 40% of universes', () => {
    const bare = monteCarlo(catalog, ref('juno-no-vault'), 40, 1);
    expect(bare.successRatePct).toBeLessThan(40);
    expect(bare.successRatePct).toBeLessThan(monteCarlo(catalog, juno, 40, 1).successRatePct);
  });

  it('the Review Board prediction appears only when asked for, is stable, and is skipped for infeasible designs', () => {
    expect(runReview(catalog, juno).predictedSuccessPct).toBeUndefined();
    const r = runReview(catalog, juno, { monteCarloRuns: 30 });
    expect(r.predictedSuccessPct).toBeGreaterThan(50);
    expect(r.predictedSurvivalPct).toBeGreaterThanOrEqual(r.predictedSuccessPct!); // surviving is necessary, not sufficient
    expect(r.predictedSciencePct!.p10).toBeLessThanOrEqual(r.predictedSciencePct!.p90);
    expect(runReview(catalog, juno, { monteCarloRuns: 30 }).predictedSuccessPct).toBe(r.predictedSuccessPct);
    expect(runReview(catalog, defaultDesign(catalog, 'jupiter-interior'), { monteCarloRuns: 30 }).predictedSuccessPct).toBeUndefined();
  });

  it('reports the science range of the flights that survive, so lost flights do not read as "0% science"', () => {
    const r = runReview(catalog, juno, { monteCarloRuns: 50 });
    expect(r.predictedSurvivalPct).toBeLessThan(100); // some flights are lost…
    expect(r.predictedSciencePct!.p10).toBe(0); // …which drags the all-flights range down to 0%
    expect(r.predictedSurvivorSciencePct!.p10).toBeGreaterThan(50); // the survivors' range is the useful one
    expect(r.predictedSurvivorSciencePct!.p10).toBeLessThanOrEqual(r.predictedSurvivorSciencePct!.p90);
    const mc = monteCarlo(catalog, juno, 50, 1);
    expect(mc.survivorScienceP10).toBeGreaterThan(mc.scienceP10);
  });
});

describe('hindsight explanations name what actually changed in the flight', () => {
  it('more testing that keeps an instrument alive longer says so, instead of quoting survival odds', () => {
    // Guided Jupiter demo flight: the Ka-band radio science package fails in the real flight and later with rigorous testing.
    const result = runHeadless(catalog, juno, 2030);
    const { explored } = buildHindsight(catalog, juno, 2030, {}, result);
    const rigorous = explored.find((x) => x.dimension === 'Testing & assurance' && x.toLabel === 'rigorous testing')!;
    expect(rigorous.deltaSciencePct).toBeGreaterThan(0);
    expect(rigorous.explanation).toMatch(/kept the Ka-band radio science package working \d[\d,]* days longer/);
    expect(rigorous.explanation).not.toContain('odds of surviving');
  });

  it('a failure is never credited as "avoided" just because the replay ended before it happened', () => {
    const d = ref('juno-no-vault');
    const alts = alternatives(catalog, d);
    let checked = 0;
    for (const seed of [3, 11, 77]) {
      const result = runHeadless(catalog, d, seed);
      for (const x of buildHindsight(catalog, d, seed, {}, result).explored.filter((e) => e.feasible)) {
        const m = /kept the (.+?) working(?: and| \(|,)/.exec(x.explanation);
        if (!m) continue;
        const alt = alts.find((a) => a.dimension === x.dimension && a.toLabel === x.toLabel && a.fromLabel === x.fromLabel)!;
        const replay = runHeadless(catalog, alt.design, seed);
        const failedOn = result.log.find((l) => l.kind === 'anomaly' && l.text.startsWith(m[1]))!.day;
        expect(replay.daysFlown, x.explanation).toBeGreaterThan(failedOn); // the replay was still flying when it failed for real
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('buildDebrief', () => {
  it('headline, hindsight, best call, You vs History and optional Monte Carlo', () => {
    const seed = 4242;
    const result = runHeadless(catalog, mro, seed);
    const d = buildDebrief(catalog, mro, seed, {}, result, { monteCarloRuns: 20 });
    expect(d.result).toBe(result);
    expect(d.headline).toContain(`${Math.round(result.sciencePct)}% of baseline science`);
    expect(d.hindsight.length).toBeLessThanOrEqual(3);
    expect(d.replays).toBeGreaterThan(20);
    expect(d.explored!.length).toBeGreaterThanOrEqual(d.replays!);
    expect(d.monteCarlo!.runs).toBe(20);
    expect(d.comparison.mission.id).toBe('hist-mro');
    const labels = d.comparison.rows.map((r) => r.label);
    for (const l of ['Launch mass', 'Dry mass', 'Power at target, before ageing', 'Cost', 'Instruments', 'Launch vehicle']) expect(labels).toContain(l);
    expect(d.comparison.rows.find((r) => r.label === 'Cost')!.note).toContain('For scale only');
    expect(buildDebrief(catalog, mro, seed, {}, result).monteCarlo).toBeUndefined();
  });

  it('a lost mission says so in the headline and still gets its lessons', () => {
    let seed = 1;
    while (runHeadless(catalog, ref('juno-no-vault'), seed).outcome !== 'lost') seed++;
    const result = runHeadless(catalog, ref('juno-no-vault'), seed);
    const d = buildDebrief(catalog, ref('juno-no-vault'), seed, {}, result);
    expect(d.headline).toMatch(/^Mission lost on day \d+/);
    expect(d.explored!.some((x) => x.deltaSciencePct > 0)).toBe(true);
  });

  it('the async versions give the same answers (worker in the browser, direct call elsewhere)', async () => {
    const seed = 9;
    const result = runHeadless(catalog, mro, seed);
    const d = await buildDebriefAsync(catalog, mro, seed, {}, result);
    expect(d).toEqual(buildDebrief(catalog, mro, seed, {}, result));
    expect(await runReviewAsync(catalog, mro, { monteCarloRuns: 10 })).toEqual(runReview(catalog, mro, { monteCarloRuns: 10 }));
  });

  it('every sentence shown to the player is free of NaN, undefined and unformatted numbers', () => {
    for (const r of refs) {
      if (!computeBudgets(catalog, r.design).feasible) continue;
      const result = runHeadless(catalog, r.design, 31);
      const d = buildDebrief(catalog, r.design, 31, {}, result);
      for (const text of [d.headline, d.bestDecision?.explanation ?? '', ...d.explored!.map((x) => x.explanation), ...d.comparison.rows.flatMap((x) => [x.yours, x.theirs])]) {
        expect(text, r.id).not.toMatch(/NaN|undefined|Infinity|\d\.\d{3,}/);
      }
    }
  });
});

describe('"Why?" explanations', () => {
  const gauges = ['mass.marginPct', 'power.marginPct', 'power.batteryMarginPct', 'deltaV.totalMs', 'comms.dataMarginPct', 'cost.marginPct', 'radiation.doseMarginPct', 'risk.reliabilityPct', 'science.expectedPct'];
  const sourceIds = new Set(catalog.sources.map((s) => s.id));

  it('every gauge has one explanation with a formula and real sources, for every reference design', () => {
    for (const r of refs) {
      const b = computeBudgets(catalog, r.design);
      for (const g of gauges) {
        const e = b.explain.filter((x) => x.metric === g);
        expect(e.length, `${r.id} ${g}`).toBe(1);
        expect(e[0].text.length).toBeGreaterThan(20);
        expect(e[0].text, `${r.id} ${g}`).not.toMatch(/NaN|undefined|Infinity/);
        expect(e[0].formula).toBeTruthy();
        expect(e[0].sourceIds!.length).toBeGreaterThan(0);
        for (const id of e[0].sourceIds!) expect(sourceIds.has(id), `${g}: ${id}`).toBe(true);
      }
      for (const key of Object.keys(b.metrics)) if (key !== 'cost.reservePct') expect(gauges, key).toContain(key);
    }
  });

  it('the review rules only use metrics the engine reports', () => {
    const b = computeBudgets(catalog, mro);
    for (const rule of catalog.reviewRules) expect(Number.isFinite(b.metrics[rule.metric]), rule.metric).toBe(true);
  });
});

describe('performance', () => {
  it('a full Jupiter debrief with Hindsight stays interactive', () => {
    const result = runHeadless(catalog, juno, 3);
    buildDebrief(catalog, juno, 3, {}, result); // warm up
    const t0 = performance.now();
    const d = buildDebrief(catalog, juno, 3, {}, result);
    const ms = performance.now() - t0;
    expect(d.replays).toBeGreaterThan(30);
    expect(ms).toBeLessThan(1500); // target 300–500 ms on an idle laptop (GAME_DESIGN §6.2); generous here so a busy CI box does not flake
  });
});
