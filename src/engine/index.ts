/**
 * Engine public API. The UI imports ONLY from here (never from engine internals).
 * Contract: src/types/engine.ts → EngineApi. Owner: Track A.
 */
import type { EngineApi, GrowthReveal } from '../types/engine';
import type { MissionDesign } from '../types/design';
import type { Catalog } from '../types/engine';
import { computeBudgets } from './budgets';
import { buildDebrief } from './debrief';
import { defaultDesign } from './design';
import { runReview } from './review';
import { createSimulation, runHeadless } from './sim';

function revealGrowth(catalog: Catalog, design: MissionDesign, _seed: number): GrowthReveal {
  // TODO(Track A, P0): seeded mass & cost growth per part/instrument scaled by TRL (GAME_DESIGN §4.7).
  const b = computeBudgets(catalog, design);
  return { massGrowthKg: 0, costGrowthM: 0, newMassMarginPct: b.mass.marginPct, reserveRemainingM: b.cost.reserveM, mustDescope: false, lines: [] };
}

export const engine: EngineApi = {
  defaultDesign,
  computeBudgets,
  runReview,
  revealGrowth,
  createSimulation,
  runHeadless,
  buildDebrief,
};

export { computeBudgets, runReview, createSimulation, runHeadless, buildDebrief, defaultDesign, revealGrowth };
