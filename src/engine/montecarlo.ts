/**
 * Monte Carlo (GAME_DESIGN §6.3): fly the same design in N alternate universes (N different seeds) with the
 * auto-policy and report how often it works. Powers the Review Board prediction and the Debrief strip. Owner: Track A.
 */
import type { DecisionLog, MissionDesign } from '../types/design';
import type { Catalog, Debrief } from '../types/engine';
import { hashString, mulberry32 } from './rng';
import { runHeadless } from './sim';

export type MonteCarloResult = NonNullable<Debrief['monteCarlo']> & {
  /** Science % of every run, ascending (for a histogram). */
  sciencePcts: number[];
  lostPct: number;
};

/** Linear-interpolated percentile of an ascending array. */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const x = (sorted.length - 1) * p;
  const lo = Math.floor(x), hi = Math.ceil(x);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (x - lo);
}

/** The seeds used for `runs` universes derived from `baseSeed` — deterministic, and independent of the flight's own seed. */
export function monteCarloSeeds(baseSeed: number, runs: number): number[] {
  const next = mulberry32((baseSeed ^ hashString('montecarlo')) >>> 0);
  return Array.from({ length: runs }, () => Math.floor(next() * 2 ** 31));
}

/**
 * Success = the mission was not lost AND reached at least the threshold mission (outcome threshold, full or exceeded).
 * `decisions` are replayed where their card comes up; every other card takes its default option (§5.5).
 */
export function monteCarlo(catalog: Catalog, design: MissionDesign, runs: number, baseSeed: number, decisions: DecisionLog = {}): MonteCarloResult {
  const n = Math.max(1, Math.round(runs));
  let success = 0, lost = 0;
  const sciencePcts: number[] = [];
  for (const seed of monteCarloSeeds(baseSeed, n)) {
    const res = runHeadless(catalog, design, seed, decisions);
    if (res.outcome === 'lost') lost++;
    else if (res.outcome !== 'partial') success++;
    sciencePcts.push(res.sciencePct);
  }
  sciencePcts.sort((a, b) => a - b);
  return {
    runs: n,
    successRatePct: (success / n) * 100,
    lostPct: (lost / n) * 100,
    scienceP10: percentile(sciencePcts, 0.1),
    scienceP50: percentile(sciencePcts, 0.5),
    scienceP90: percentile(sciencePcts, 0.9),
    sciencePcts,
  };
}
