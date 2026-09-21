import { describe, expect, it } from 'vitest';
import type { MapDef } from '../data/trainingGrounds';
import { moveRange } from './actions';
import { hitChance } from './combat';
import { envMods, scaledMove, scaledVision } from './environment';
import { idx } from './grid';
import { createGame } from './state';
import { act, blank, makeGame, unit } from './testkit';

describe('time of day and weather', () => {
  it('defaults to midday and clear (no modifiers) when not specified', () => {
    const s = makeGame(blank(10, 5), { player: { soldier: [2, 2] }, enemy: { tank: [7, 2] } });
    expect(s.timeOfDay).toBe('midday');
    expect(s.weather).toBe('clear');
    expect(envMods(s)).toEqual({ visionMult: 1, accuracyMod: 0, moveMult: 1 });
  });

  it('createGame options override the defaults', () => {
    const s = makeGame(blank(10, 5), { player: { soldier: [2, 2] }, enemy: { tank: [7, 2] } }, { timeOfDay: 'midnight', weather: 'stormy' });
    expect(s.timeOfDay).toBe('midnight');
    expect(s.weather).toBe('stormy');
  });

  it('a map can set its own starting conditions, which options still override', () => {
    const map: MapDef = {
      name: 'test', rows: blank(6, 4), searchPoints: { player: [], enemy: [] },
      spawns: { player: [['soldier', 1, 1]], enemy: [['tank', 4, 1]] },
      startTimeOfDay: 'midnight', startWeather: 'fog',
    };
    const s = createGame(map, 1);
    expect(s.timeOfDay).toBe('midnight');
    expect(s.weather).toBe('fog');
    const s2 = createGame(map, 1, { weather: 'clear' });
    expect(s2.timeOfDay).toBe('midnight'); // still from the map
    expect(s2.weather).toBe('clear'); // options win
  });

  it('vision and move multipliers stack by multiplying, accuracy modifiers stack by adding', () => {
    const s = makeGame(blank(10, 5), { player: { soldier: [2, 2] }, enemy: { tank: [7, 2] } }, { timeOfDay: 'midnight', weather: 'stormy' });
    const mods = envMods(s);
    expect(mods.visionMult).toBeCloseTo(0.5 * 0.65);
    expect(mods.accuracyMod).toBe(-20 + -20);
    expect(mods.moveMult).toBeCloseTo(0.85 * 0.75);
  });

  it('scaledVision and scaledMove never drop below 1 tile', () => {
    const s = makeGame(blank(10, 5), { player: { soldier: [2, 2] }, enemy: { tank: [7, 2] } }, { timeOfDay: 'midnight', weather: 'stormy' });
    expect(scaledVision(s, 1)).toBe(1);
    expect(scaledMove(s, 1)).toBe(1);
  });

  it('refreshVision uses the shrunk radius', () => {
    // sniper vision 8, midnight+stormy visionMult 0.325 -> round(8 * 0.325) = 3
    const s = makeGame(blank(24, 5), { player: { sniper: [2, 2] } }, { timeOfDay: 'midnight', weather: 'stormy' });
    expect(s.visible.player[idx(s, 5, 2)]).toBe(1); // dist 3: still in range
    expect(s.visible.player[idx(s, 6, 2)]).toBe(0); // dist 4: shrunk out of range
  });

  it('hit chance adds the combined modifier and still clamps to 5..95', () => {
    const s = makeGame(blank(14, 5, [[5, 2, 'h']]), { player: { assault: [2, 2] }, enemy: { tank: [6, 2] } }, { timeOfDay: 'midnight', weather: 'stormy' });
    const a = unit(s, 'player', 'assault'); // accuracy 60
    const t = unit(s, 'enemy', 'tank');
    // 60 - 40 (high cover) - 40 (env) = -20 -> clamped to 5
    expect(hitChance(s, a, t)).toBe(5);
  });

  it('move range shrinks under weather and is enforced by pathing', () => {
    const s = makeGame(blank(24, 5), { player: { tank: [2, 2] } }, { weather: 'stormy' }); // move 4 * 0.75 -> 3
    const u = unit(s, 'player', 'tank');
    expect(moveRange(s, u)).toBe(3);
    expect(() => act(s, { type: 'move', unit: u.id, to: { x: 6, y: 2 } })).toThrow(); // 4 tiles: now out of reach
    act(s, { type: 'move', unit: u.id, to: { x: 5, y: 2 } }); // 3 tiles: still reachable
    expect(u.x).toBe(5);
  });

  it('scans ignore weather and time of day', () => {
    const s = makeGame(blank(24, 5, [[15, 2, '#']]), { player: { sniper: [2, 2] } }, { timeOfDay: 'midnight', weather: 'stormy' });
    act(s, { type: 'gadget', unit: unit(s, 'player', 'sniper').id, target: { x: 20, y: 2 } });
    expect(s.visible.player[idx(s, 20, 2)]).toBe(1);
  });
});
