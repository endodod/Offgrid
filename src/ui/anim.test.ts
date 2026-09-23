import { describe, expect, it } from 'vitest';
import { act, blank, makeGame, rolls, unit } from '../core/testkit';
import type { GameEvent, GameState, Pos } from '../core/types';
import { Animator, buildTracks, TIMING } from './anim';

const all = () => true;
const visibleTo = (s: GameState) => (p: Pos) => s.visible.player[p.y * s.width + p.x] === 1;

describe('event playback (10d)', () => {
  it('walks a unit along its path and hands back to the state position at the end', () => {
    const s = makeGame(blank(12, 3), { player: { soldier: [1, 1] }, enemy: { tank: [11, 1] } });
    const sol = unit(s, 'player', 'soldier');
    const events = act(s, { type: 'move', unit: sol.id, to: { x: 4, y: 1 } });
    const a = new Animator();
    a.push(events, s, 0, 1, all);
    expect(a.frame(0).pos.get(sol.id)).toEqual({ x: 1, y: 1 }); // starts where it was, not where the state has it
    const mid = a.frame(TIMING.step * 1.5).pos.get(sol.id)!;
    expect(mid.x).toBeCloseTo(2.5);
    expect(a.frame(TIMING.step * 3 + 1).pos.has(sol.id)).toBe(false); // done: the state position (4,1) takes over
    expect(a.remaining(0)).toBeGreaterThanOrEqual(TIMING.step * 3);
  });

  it('pauses a walk at the step an overwatch shot hit it, and holds the HP bar until the shot lands', () => {
    const s = makeGame(blank(20, 5), { player: { soldier: [2, 2] }, enemy: { tank: [12, 2], sniper: [19, 4] } });
    const sol = unit(s, 'player', 'soldier');
    const tank = unit(s, 'enemy', 'tank');
    act(s, { type: 'overwatch', unit: sol.id });
    act(s, { type: 'endTurn' });
    rolls(s, 0);
    const events = act(s, { type: 'move', unit: tank.id, to: { x: 8, y: 2 } }); // shot at x=9 (range 7)
    const b = buildTracks(events, s, 0, 1, all);
    const walks = b.tracks.filter((k) => k.k === 'walk');
    expect(walks).toHaveLength(2); // 12 -> 9, then 9 -> 8 after the shot
    const tracer = b.tracks.find((k) => k.k === 'tracer')!;
    expect(tracer.start).toBe(walks[0].end); // fired when the tank reached x=9
    expect(walks[1].start).toBeGreaterThanOrEqual(tracer.end);

    const a = new Animator();
    a.push(events, s, 0, 1, all);
    expect(a.frame(1).hpPending.get(tank.id)).toBe(1); // the 1 damage hasn't landed yet
    expect(a.frame(tracer.end + 1).hpPending.has(tank.id)).toBe(false);
    expect(a.frame(tracer.start + 5).pos.get(tank.id)).toEqual({ x: 9, y: 2 }); // waiting at the shot step
  });

  it('never draws an enemy on a tile the player cannot see', () => {
    // A wall splits the map; the enemy walks from behind it into view.
    const s = makeGame(blank(14, 3, [[6, 0, '#'], [6, 1, '#'], [6, 2, '#']]), { player: { soldier: [1, 1] }, enemy: { tank: [9, 1] } });
    const tank = unit(s, 'enemy', 'tank');
    act(s, { type: 'endTurn' });
    const events = act(s, { type: 'move', unit: tank.id, to: { x: 12, y: 1 } });
    const vis = visibleTo(s);
    const b = buildTracks(events, s, 0, 1, vis);
    for (const k of b.tracks) if (k.k === 'walk') for (const p of k.pts) expect(vis(p)).toBe(true);
  });

  it('skips events the player did not see, and speed 0 produces floaters but no tracks', () => {
    const hidden: GameEvent = { t: 'shot', attacker: 0, target: 1, shot: 1, shots: 1, chance: 50, roll: 0, hit: true, damage: 3, overwatch: false, finishing: false, at: { x: 1, y: 1 }, from: { x: 0, y: 0 }, seen: false };
    const s = makeGame(blank(4, 3), { player: { soldier: [0, 0] }, enemy: { tank: [1, 1] } });
    expect(buildTracks([hidden], s, 0, 1, all).tracks).toHaveLength(0);
    const a = new Animator();
    const { floaters } = a.push([{ ...hidden, seen: true }], s, 0, 0, all);
    expect(floaters).toHaveLength(1);
    expect(a.remaining(0)).toBe(0);
  });

  it('queues a second batch after the first instead of overlapping it', () => {
    const s = makeGame(blank(12, 3), { player: { soldier: [1, 1], assault: [1, 0] }, enemy: { tank: [11, 1] } });
    const a = new Animator();
    a.push(act(s, { type: 'move', unit: unit(s, 'player', 'soldier').id, to: { x: 3, y: 1 } }), s, 0, 1, all);
    const first = a.remaining(0);
    a.push(act(s, { type: 'move', unit: unit(s, 'player', 'assault').id, to: { x: 3, y: 0 } }), s, 0, 1, all);
    expect(a.remaining(0)).toBeGreaterThan(first);
    expect(a.frame(first - 10).pos.get(unit(s, 'player', 'assault').id)).toEqual({ x: 1, y: 0 }); // still waiting its turn
  });
});
