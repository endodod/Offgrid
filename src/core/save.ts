import type { GameState } from './types';

/**
 * Mid-mission saves (10c). A `GameState` is plain data apart from two container types - `Set` (seenUnits) and
 * `Uint8Array` (visible) - and it carries its own RNG position, so a JSON round trip that restores those two is
 * a complete, deterministic snapshot: a resumed game plays out exactly as the original would have.
 *
 * `rollSource` (a test-only hook) and pending `events` are deliberately not saved.
 */
export const SAVE_VERSION = 1;

export function serializeGame(s: GameState): string {
  return JSON.stringify({ ...s, rollSource: undefined, events: [] }, (_k, v: unknown) => {
    if (v instanceof Set) return { __set: [...v] };
    if (v instanceof Uint8Array) return { __u8: Array.from(v) };
    return v;
  });
}

/** Throws on anything that isn't a serialized game - callers treat that as "no save". */
export function deserializeGame(json: string): GameState {
  const s = JSON.parse(json, (_k, v: unknown) => {
    if (v && typeof v === 'object') {
      const o = v as { __set?: unknown[]; __u8?: number[] };
      if (Array.isArray(o.__set)) return new Set(o.__set);
      if (Array.isArray(o.__u8)) return Uint8Array.from(o.__u8);
    }
    return v;
  }) as GameState;
  if (!s || !Array.isArray(s.units) || !Array.isArray(s.terrain) || typeof s.rng !== 'number' || !(s.seenUnits?.player instanceof Set)) {
    throw new Error('Not a saved game');
  }
  return s;
}
