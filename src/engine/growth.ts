/**
 * Reality Check — between the Review Board and launch, the hardware comes in heavier and costlier than the
 * catalogue said. How much depends on technology readiness (TRL): proven parts barely move, new ones can blow up.
 * GAME_DESIGN §4.7. Owner: Track A.
 *
 * Fairness rule (common random numbers): every part and instrument draws from its own named stream
 * (`growth:<id>`, `growth-cost:<id>`), so dropping an instrument to descope never re-rolls the growth of
 * everything else, and Hindsight replays compare like with like.
 */
import type { MissionDesign } from '../types/design';
import type { BudgetReport, Catalog, GrowthReveal } from '../types/engine';
import { computeBudgets, growthFractionForTrl, hardwareItems } from './budgets';
import { Rng } from './rng';

/** Actual growth = U(min, max) × the TRL allowance: usually a little under the allowance, sometimes 50% over it. */
const GROWTH_FACTOR_MIN = 0.3;
const GROWTH_FACTOR_MAX = 1.5;
/** Cost grows faster than mass: 1.2 × the TRL mass-growth fraction. */
const COST_GROWTH_VS_MASS = 1.2;

export interface RealizedBudgets {
  reveal: GrowthReveal;
  /** The budget as designed (carries the TRL allowance). */
  planned: BudgetReport;
  /** The budget as built (actual mass growth instead of the allowance). The flight sim starts from this. */
  actual: BudgetReport;
}

export function realizedBudgets(catalog: Catalog, design: MissionDesign, seed: number): RealizedBudgets {
  const rng = new Rng(seed);
  const factor = (stream: string) => GROWTH_FACTOR_MIN + (GROWTH_FACTOR_MAX - GROWTH_FACTOR_MIN) * rng.next(stream);

  const lines: GrowthReveal['lines'] = [];
  for (const it of hardwareItems(catalog, design)) {
    if (it.massKg <= 0 && it.costM <= 0) continue; // e.g. "no shielding"
    const f = growthFractionForTrl(catalog, it.trl);
    lines.push({
      id: it.id,
      label: it.label,
      massKg: it.massKg * f * factor(`growth:${it.id}`),
      costM: it.costM * f * COST_GROWTH_VS_MASS * factor(`growth-cost:${it.id}`),
    });
  }
  const massGrowthKg = lines.reduce((a, l) => a + l.massKg, 0);
  const costGrowthM = lines.reduce((a, l) => a + l.costM, 0);

  const planned = computeBudgets(catalog, design);
  // Mass growth is paid first from the allowance already in the budget: swap the allowance for the real number and
  // let structure, harness, tanks and propellant follow (the mass spiral applies to growth too).
  const actual = computeBudgets(catalog, design, { massGrowthKg });
  const reserveRemainingM = planned.cost.reserveM - costGrowthM; // cost growth is paid from reserves; negative = overrun

  const reveal: GrowthReveal = {
    massGrowthKg,
    costGrowthM,
    newMassMarginPct: actual.mass.marginPct,
    reserveRemainingM,
    mustDescope: !actual.mass.converged || actual.mass.wetKg > actual.mass.lvCapacityKg || costGrowthM > planned.cost.reserveM,
    lines,
    massAllowanceKg: planned.mass.growthAllowanceKg,
    newWetKg: actual.mass.wetKg,
    lvCapacityKg: actual.mass.lvCapacityKg,
  };
  return { reveal, planned, actual };
}

export function revealGrowth(catalog: Catalog, design: MissionDesign, seed: number): GrowthReveal {
  return realizedBudgets(catalog, design, seed).reveal;
}
