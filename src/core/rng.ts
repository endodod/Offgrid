import type { GameState } from './types';

/** mulberry32. The generator state lives in `GameState.rng`, so a match is fully reproducible from its seed. */
export function nextRandom(s: { rng: number }): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Roll in [0, 100). A shot hits when roll < hit chance. */
export function rollPercent(s: GameState): number {
  return (s.rollSource ? s.rollSource() : nextRandom(s)) * 100;
}
