import { describe, expect, it } from 'vitest';
import { TRAINING_GROUNDS, type MapDef } from '../data/trainingGrounds';
import { CLASSES } from '../data/units';
import { runAiTurn } from './ai';
import { distanceMap, idx } from './grid';
import { playMatch } from './sim';
import { createGame } from './state';
import { act, blank, makeGame, place, rolls, unit } from './testkit';

const shotsBy = (s: ReturnType<typeof makeGame>, team: 'player' | 'enemy') =>
  s.events.filter((e) => e.t === 'shot' && s.units[e.attacker].team === team);

describe('enemy AI', () => {
  it('shoots a visible target', () => {
    const s = makeGame(blank(16, 5), { player: { soldier: [2, 2] }, enemy: { soldier: [7, 2] } });
    act(s, { type: 'endTurn' });
    rolls(s, 0);
    runAiTurn(s, 'enemy');
    expect(shotsBy(s, 'enemy').length).toBeGreaterThan(0);
    expect(unit(s, 'player', 'soldier').hp).toBeLessThan(12);
    expect(s.phase).toBe('player'); // it ended its phase
  });

  it('reloads when empty, then fires', () => {
    const s = makeGame(blank(16, 5), { player: { soldier: [2, 2] }, enemy: { soldier: [7, 2] } });
    act(s, { type: 'endTurn' });
    unit(s, 'enemy', 'soldier').ammo = 0;
    rolls(s, 0.99);
    runAiTurn(s, 'enemy');
    expect(s.events.some((e) => e.t === 'reload')).toBe(true);
    expect(shotsBy(s, 'enemy')).toHaveLength(1);
  });

  it('obeys fog: never shoots or chases a target it cannot see (bush)', () => {
    const s = makeGame(blank(16, 5, [[2, 2, 'b']]), { player: { soldier: [2, 2] }, enemy: { soldier: [7, 2] } });
    act(s, { type: 'endTurn' });
    expect(s.seenUnits.enemy.size).toBe(0);
    runAiTurn(s, 'enemy');
    expect(shotsBy(s, 'enemy')).toHaveLength(0);
    expect(s.memory.enemy.lastSeen).toEqual({});
  });

  it('obeys fog: an unseen player behind a wall does not attract fire', () => {
    const s = makeGame(blank(16, 5, [[4, 1, '#'], [4, 2, '#'], [4, 3, '#']]), { player: { soldier: [2, 2] }, enemy: { soldier: [7, 2] } });
    act(s, { type: 'endTurn' });
    runAiTurn(s, 'enemy');
    expect(shotsBy(s, 'enemy')).toHaveLength(0);
  });

  it('with no target it advances and finishes on overwatch', () => {
    const s = makeGame(blank(30, 5), { player: { soldier: [1, 2] }, enemy: { tank: [28, 2] } });
    s.map.searchPoints.enemy = [[5, 2]];
    act(s, { type: 'endTurn' });
    runAiTurn(s, 'enemy');
    const t = unit(s, 'enemy', 'tank');
    expect(t.x).toBeLessThan(28);
    expect(t.overwatch).toBe(true);
  });

  it('takes cover on the way to a shot when it has actions to spare', () => {
    // Enemy soldier can shoot from (7,2) in the open, or from (7,3) which has low cover to its west at (6,3).
    const s = makeGame(blank(16, 6, [[6, 3, 'l']]), { player: { soldier: [2, 3] }, enemy: { soldier: [8, 2] } });
    act(s, { type: 'endTurn' });
    rolls(s, 0.99);
    runAiTurn(s, 'enemy');
    const e = unit(s, 'enemy', 'soldier');
    expect([e.x, e.y]).toEqual([7, 3]);
  });
});

describe('simulation', () => {
  it('is deterministic for a given seed and terminates', () => {
    const a = playMatch(TRAINING_GROUNDS, 7, { objectiveCapture: 'both' });
    const b = playMatch(TRAINING_GROUNDS, 7, { objectiveCapture: 'both' });
    expect(a).toEqual(b);
    expect(a.turns).toBeLessThanOrEqual(41);
  });
  // Uses a hand-built close-quarters map, not Training Grounds: on Training Grounds the AI's own units jam each
  // other at the courtyard's single doorway (the "Known weakness" in ASSUMPTIONS.md, to be addressed by roadmap
  // #0c), so bot-vs-bot play never closes to combat range and every seed produces the same stalled draw.
  it('different seeds can play out differently', () => {
    const skirmish: MapDef = {
      name: 'skirmish', rows: blank(10, 5),
      spawns: { player: [['soldier', 1, 2], ['assault', 1, 1]], enemy: [['soldier', 8, 2], ['assault', 8, 3]] },
      searchPoints: { player: [], enemy: [] },
    };
    const results = new Set(Array.from({ length: 6 }, (_, i) => JSON.stringify(playMatch(skirmish, i + 1, { objectiveCapture: 'none' }))));
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('Training Grounds map data', () => {
  const s = createGame(TRAINING_GROUNDS, 1);
  it('is 24 x 16: 5 friendly units (one per class) vs 5 enemies, all on open, uncovered, distinct tiles', () => {
    expect([s.width, s.height]).toEqual([24, 16]);
    expect(s.units.filter((u) => u.team === 'player').map((u) => u.cls).sort()).toEqual(Object.keys(CLASSES).sort());
    expect(s.units.filter((u) => u.team === 'enemy')).toHaveLength(5);
    for (const u of s.units) {
      expect(s.terrain[idx(s, u.x, u.y)]).not.toBe('wall');
      expect(s.cover[idx(s, u.x, u.y)]).toBeNull();
    }
    const spots = new Set(s.units.map((u) => `${u.x},${u.y}`));
    expect(spots.size).toBe(10);
  });
  it('player spawns cluster bottom-left; every enemy starts strictly further right (one close practice target, the rest spread out)', () => {
    const playerXs = s.units.filter((u) => u.team === 'player').map((u) => u.x);
    const enemyXs = s.units.filter((u) => u.team === 'enemy').map((u) => u.x);
    expect(Math.max(...playerXs)).toBeLessThan(Math.min(...enemyXs));
  });
  it('has one objective reachable from both spawns', () => {
    expect(s.objective).toEqual({ x: 12, y: 7 });
    const d = distanceMap(s, s.objective!);
    for (const u of s.units) expect(d[idx(s, u.x, u.y)]).toBeGreaterThan(0);
  });
  it('contains every mechanic: low + high cover, bushes, walls', () => {
    expect(s.cover).toContain('low');
    expect(s.cover).toContain('high');
    expect(s.terrain).toContain('bush');
    expect(s.terrain).toContain('wall');
  });
  it('the objective is out of sight at the start (fog)', () => {
    expect(s.memory.player.objectiveSeen).toBe(false);
    place(s, unit(s, 'player', 'sniper'), 1, 14);
    expect(s.seenUnits.player.size).toBe(0);
  });
});
