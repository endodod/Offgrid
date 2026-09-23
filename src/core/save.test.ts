import { describe, expect, it } from 'vitest';
import { TRAINING_GROUNDS } from '../data/trainingGrounds';
import { LIGHTS_OUT } from '../data/maps';
import { runAiTurn } from './ai';
import { deserializeGame, serializeGame } from './save';
import { createGame } from './state';
import type { GameState } from './types';

const play = (s: GameState, phases: number) => {
  for (let i = 0; i < phases && !s.winner; i++) { runAiTurn(s, s.phase); s.events.length = 0; }
};

describe('mid-mission save (10c)', () => {
  it('round-trips Sets and typed arrays', () => {
    const s = createGame(TRAINING_GROUNDS, 3);
    play(s, 3);
    const r = deserializeGame(serializeGame(s));
    expect(r.seenUnits.player).toBeInstanceOf(Set);
    expect([...r.seenUnits.player]).toEqual([...s.seenUnits.player]);
    expect(r.visible.enemy).toBeInstanceOf(Uint8Array);
    expect(Array.from(r.visible.enemy)).toEqual(Array.from(s.visible.enemy));
    expect(serializeGame(r)).toBe(serializeGame(s));
  });

  for (const [name, map] of [['Training Grounds', TRAINING_GROUNDS], ['Lights Out', LIGHTS_OUT]] as const) {
    it(`a resumed ${name} game plays out exactly like the original`, () => {
      const original = createGame(map, 11);
      play(original, 4);
      const resumed = deserializeGame(serializeGame(original));
      play(original, 30);
      play(resumed, 30);
      expect(serializeGame(resumed)).toBe(serializeGame(original));
      expect(resumed.winner).toBe(original.winner);
    });
  }

  it('rejects things that are not saves', () => {
    expect(() => deserializeGame('{}')).toThrow();
    expect(() => deserializeGame('not json')).toThrow();
    expect(() => deserializeGame('null')).toThrow();
  });

  it('does not save pending events or the test roll hook', () => {
    const s = createGame(TRAINING_GROUNDS, 1);
    s.rollSource = () => 0;
    s.events.push({ t: 'reload', unit: 0, seen: true });
    const r = deserializeGame(serializeGame(s));
    expect(r.rollSource).toBeUndefined();
    expect(r.events).toEqual([]);
  });
});
