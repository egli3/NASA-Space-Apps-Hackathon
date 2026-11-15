/**
 * Web Worker entry point: runs the heavy engine calls (Hindsight replays, Monte Carlo) off the main thread.
 * Started only by async.ts. Uses the baked catalog, so only the design and the flight record cross the boundary.
 * Owner: Track A. This file and async.ts are the only engine files that touch a browser API; the models stay pure.
 */
import { catalog } from '../data';
import { buildDebrief } from './debrief';
import { runReview } from './review';

export type WorkerRequest =
  | { id: number; fn: 'buildDebrief'; args: [Parameters<typeof buildDebrief>[1], number, Parameters<typeof buildDebrief>[3], Parameters<typeof buildDebrief>[4], Parameters<typeof buildDebrief>[5]] }
  | { id: number; fn: 'runReview'; args: [Parameters<typeof runReview>[1], Parameters<typeof runReview>[2]] };
export type WorkerResponse = { id: number; ok: true; value: unknown } | { id: number; ok: false; error: string };

const scope = self as unknown as { onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null; postMessage: (m: WorkerResponse) => void };

scope.onmessage = (e) => {
  const req = e.data;
  try {
    const value = req.fn === 'buildDebrief' ? buildDebrief(catalog, ...req.args) : runReview(catalog, ...req.args);
    scope.postMessage({ id: req.id, ok: true, value });
  } catch (err) {
    scope.postMessage({ id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
