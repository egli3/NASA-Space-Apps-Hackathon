/**
 * Engine public API. The UI imports ONLY from here (never from engine internals).
 * Contract: src/types/engine.ts → EngineApi. Owner: Track A.
 */
import type { EngineApi } from '../types/engine';
import { buildDebriefAsync, runReviewAsync } from './async';
import { computeBudgets } from './budgets';
import { buildDebrief } from './debrief';
import { defaultDesign } from './design';
import { revealGrowth } from './growth';
import { runReview } from './review';
import { createSimulation, runHeadless } from './sim';

export const engine: EngineApi & Required<Pick<EngineApi, 'buildDebriefAsync' | 'runReviewAsync'>> = {
  defaultDesign,
  computeBudgets,
  runReview,
  revealGrowth,
  createSimulation,
  runHeadless,
  buildDebrief,
  buildDebriefAsync,
  runReviewAsync,
};

export { computeBudgets, runReview, createSimulation, runHeadless, buildDebrief, defaultDesign, revealGrowth, buildDebriefAsync, runReviewAsync };
