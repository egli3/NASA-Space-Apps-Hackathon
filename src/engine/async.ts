/**
 * Off-main-thread versions of the two heavy engine calls. Owner: Track A.
 *
 * buildDebrief flies ~50 alternate missions for Hindsight (plus 50 more with Monte Carlo) and runReview with
 * Monte Carlo flies 50. That is 0.1–1 s depending on the laptop: fine for a spinner, bad for a frozen page.
 * These wrappers run the same pure functions in a Web Worker and resolve with the identical result.
 * Where a Worker cannot be used (tests, old browsers, a non-baked catalog) they fall back to the synchronous call.
 */
import { catalog as bakedCatalog } from '../data';
import type { DecisionLog, MissionDesign } from '../types/design';
import type { Catalog, Debrief, MissionResult, ReviewResult } from '../types/engine';
import { buildDebrief } from './debrief';
import { runReview } from './review';
import type { WorkerRequest, WorkerResponse } from './worker';

let nextId = 1;

function inWorker<T>(request: Omit<WorkerRequest, 'id'>, fallback: () => T): Promise<T> {
  if (typeof Worker === 'undefined') return Promise.resolve().then(fallback);
  return new Promise<T>((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    } catch {
      resolve(fallback());
      return;
    }
    const id = nextId++;
    const finish = (value: T) => {
      worker.terminate();
      resolve(value);
    };
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.id !== id) return;
      finish(e.data.ok ? (e.data.value as T) : fallback());
    };
    worker.onerror = () => finish(fallback());
    worker.postMessage({ ...request, id });
  });
}

export function buildDebriefAsync(
  catalog: Catalog,
  design: MissionDesign,
  seed: number,
  decisions: DecisionLog,
  result: MissionResult,
  opts?: { monteCarloRuns?: number },
): Promise<Debrief> {
  const sync = () => buildDebrief(catalog, design, seed, decisions, result, opts);
  // The worker only knows the baked catalog; anything else (tests, modded data) is computed right here.
  if (catalog !== bakedCatalog) return Promise.resolve().then(sync);
  // finalState may carry a pending card and other live objects; send a plain copy the worker can clone.
  const plain = JSON.parse(JSON.stringify(result)) as MissionResult;
  return inWorker<Debrief>({ fn: 'buildDebrief', args: [design, seed, decisions, plain, opts] }, sync).then((d) => ({ ...d, result }));
}

export function runReviewAsync(catalog: Catalog, design: MissionDesign, opts?: { monteCarloRuns?: number }): Promise<ReviewResult> {
  const sync = () => runReview(catalog, design, opts);
  if (catalog !== bakedCatalog) return Promise.resolve().then(sync);
  return inWorker<ReviewResult>({ fn: 'runReview', args: [design, opts] }, sync);
}
