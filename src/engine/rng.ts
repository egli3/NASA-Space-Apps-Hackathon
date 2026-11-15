/**
 * Deterministic randomness. RULE: the engine never calls Math.random().
 *
 * Every random draw comes from a *named stream* derived from (seed, streamName). Changing one decision
 * (e.g. a different antenna) must not reshuffle the dice for unrelated systems — this "common random
 * numbers" trick is what makes Hindsight replays and Monte Carlo comparisons fair.
 */

/** mulberry32 — tiny, fast, good enough for games. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a string hash → 32-bit int. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export class Rng {
  private streams = new Map<string, () => number>();
  constructor(readonly seed: number) {}
  /** Uniform [0,1) from the named stream, e.g. rng.next('hazard:adcs'), rng.next('event:ev-sep-storm'). */
  next(stream: string): number {
    let s = this.streams.get(stream);
    if (!s) {
      s = mulberry32(this.seed ^ hashString(stream));
      this.streams.set(stream, s);
    }
    return s();
  }
  chance(stream: string, p: number): boolean {
    return this.next(stream) < p;
  }
}
