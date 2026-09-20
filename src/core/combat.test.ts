import { describe, expect, it } from 'vitest';
import { CLASSES } from '../data/units';
import { RULES } from '../data/rules';
import { damageAgainst, hitChance, coverAgainst } from './combat';
import { hasLos } from './grid';
import { act, blank, makeGame, rolls, unit } from './testkit';

// Soldier (accuracy 70) shoots a tank at (6,2) from (2,2).
const duel = (edits: [number, number, string][], from: [number, number] = [2, 2], to: [number, number] = [6, 2]) => {
  const s = makeGame(blank(14, 9, edits), { player: { soldier: from }, enemy: { tank: to } });
  return { s, a: unit(s, 'player', 'soldier'), t: unit(s, 'enemy', 'tank') };
};

describe('hit chance', () => {
  it('has no penalty in the open', () => {
    const { s, a, t } = duel([]);
    expect(coverAgainst(s, t, a).state).toBe('none');
    expect(hitChance(s, a, t)).toBe(70);
  });
  it('low cover -20, high cover -40', () => {
    let d = duel([[5, 2, 'l']]);
    expect(coverAgainst(d.s, d.t, d.a).state).toBe('low');
    expect(hitChance(d.s, d.a, d.t)).toBe(50);
    d = duel([[5, 2, 'h']]);
    expect(coverAgainst(d.s, d.t, d.a).state).toBe('high');
    expect(hitChance(d.s, d.a, d.t)).toBe(30);
  });
  it('cover on another side does not help: the target is flanked', () => {
    const d = duel([[7, 2, 'h']]); // cover behind the target, attacker in front
    expect(coverAgainst(d.s, d.t, d.a).state).toBe('flanked');
    expect(hitChance(d.s, d.a, d.t)).toBe(70);
    const side = duel([[6, 1, 'h']]);
    expect(hitChance(side.s, side.a, side.t)).toBe(70);
  });
  it('diagonal attacker: checks both facing neighbours and uses the better one', () => {
    // attacker north-west of target (6,6)
    let d = duel([[5, 6, 'l']], [2, 2], [6, 6]);
    expect(hitChance(d.s, d.a, d.t)).toBe(50);
    d = duel([[5, 6, 'l'], [6, 5, 'h']], [2, 2], [6, 6]);
    expect(hitChance(d.s, d.a, d.t)).toBe(30);
    d = duel([[7, 6, 'h'], [6, 7, 'h']], [2, 2], [6, 6]); // cover only on the far side
    expect(coverAgainst(d.s, d.t, d.a).state).toBe('flanked');
    expect(hitChance(d.s, d.a, d.t)).toBe(70);
  });
  it('a shallow angle only counts the neighbour on the attacker side', () => {
    const d = duel([[6, 2, 'h']], [0, 2], [6, 3]); // cover is north of target, attacker is west
    expect(coverAgainst(d.s, d.t, d.a).state).toBe('flanked');
  });
  it('is clamped to 5..95', () => {
    const { s, a, t } = duel([[5, 2, 'h']]);
    const w = CLASSES.soldier.weapon;
    const saved = w.accuracy;
    try {
      w.accuracy = 10;
      expect(hitChance(s, a, t)).toBe(5);
      w.accuracy = 200;
      expect(hitChance(duel([]).s, a, t)).toBe(95);
    } finally {
      w.accuracy = saved;
    }
  });
});

describe('damage', () => {
  it('is weapon damage minus armor, never below 1', () => {
    expect(damageAgainst(7, 0)).toBe(7);
    expect(damageAgainst(4, 1)).toBe(3);
    expect(damageAgainst(3, 3)).toBe(1);
    expect(damageAgainst(2, 3)).toBe(1);
  });
  it('applies the minimum to a real hit on the tank', () => {
    const s = makeGame(blank(10, 5), { player: { assault: [2, 2] }, enemy: { tank: [4, 2] } });
    rolls(s, 0);
    act(s, { type: 'attack', unit: unit(s, 'player', 'assault').id, target: unit(s, 'enemy', 'tank').id });
    expect(unit(s, 'enemy', 'tank').hp).toBe(24 - 3); // 3 shots x max(1, 2-3)
  });
});

describe('burst shots', () => {
  it('assault fires 3 independently rolled shots for 1 ammo', () => {
    const s = makeGame(blank(10, 5), { player: { assault: [2, 2] }, enemy: { sniper: [4, 2] } });
    const a = unit(s, 'player', 'assault'), t = unit(s, 'enemy', 'sniper');
    rolls(s, 0.1, 0.9, 0.5); // 60% chance: hit, miss, hit
    const events = act(s, { type: 'attack', unit: a.id, target: t.id });
    const shots = events.filter((e) => e.t === 'shot');
    expect(shots.map((e) => e.t === 'shot' && e.hit)).toEqual([true, false, true]);
    expect(shots.every((e) => e.t === 'shot' && e.chance === 60)).toBe(true);
    expect(a.ammo).toBe(3);
    expect(a.actions).toBe(1);
    expect(t.hp).toBe(8 - 4);
  });
  it('stops shooting once the target is dead', () => {
    const s = makeGame(blank(10, 5), { player: { assault: [2, 2] }, enemy: { sniper: [4, 2] } });
    const t = unit(s, 'enemy', 'sniper');
    t.hp = 2;
    rolls(s, 0);
    const events = act(s, { type: 'attack', unit: unit(s, 'player', 'assault').id, target: t.id });
    expect(events.filter((e) => e.t === 'shot')).toHaveLength(1);
    expect(t.alive).toBe(false);
  });
});

describe('attack rules', () => {
  it('cannot attack with an empty magazine or out of range, and a reload refills it', () => {
    const s = makeGame(blank(20, 5), { player: { soldier: [1, 2], sniper: [1, 4] }, enemy: { tank: [5, 2], soldier: [18, 2] } });
    const a = unit(s, 'player', 'soldier');
    const far = unit(s, 'enemy', 'soldier');
    expect(() => act(s, { type: 'attack', unit: a.id, target: far.id })).toThrow(/range|visible/i);
    a.ammo = 0;
    const tank = unit(s, 'enemy', 'tank');
    expect(() => act(s, { type: 'attack', unit: a.id, target: tank.id })).toThrow('Out of ammo');
    act(s, { type: 'reload', unit: a.id });
    expect(a.ammo).toBe(CLASSES.soldier.weapon.magazine);
    expect(a.actions).toBe(1);
    expect(() => act(s, { type: 'reload', unit: a.id })).toThrow('Magazine full');
  });
  it('a unit may attack twice in one turn if it has ammo', () => {
    const s = makeGame(blank(10, 5), { player: { soldier: [1, 2] }, enemy: { tank: [4, 2] } });
    const a = unit(s, 'player', 'soldier');
    rolls(s, 0.99);
    act(s, { type: 'attack', unit: a.id, target: unit(s, 'enemy', 'tank').id });
    act(s, { type: 'attack', unit: a.id, target: unit(s, 'enemy', 'tank').id });
    expect(a.ammo).toBe(4);
    expect(() => act(s, { type: 'attack', unit: a.id, target: unit(s, 'enemy', 'tank').id })).toThrow('No actions left');
  });
});

describe('line of sight', () => {
  const rows = blank(12, 5, [[5, 2, 'h'], [5, 0, 'l'], [8, 1, '#']]);
  const s = makeGame(rows, { player: { soldier: [0, 2] }, enemy: { tank: [11, 2] } });
  it('only walls block: units see and shoot over both low and high cover', () => {
    expect(hasLos(s, { x: 0, y: 2 }, { x: 11, y: 2 })).toBe(true); // high cover at (5,2)
    expect(hasLos(s, { x: 0, y: 0 }, { x: 11, y: 0 })).toBe(true); // low cover at (5,0)
    expect(hasLos(s, { x: 0, y: 1 }, { x: 11, y: 1 })).toBe(false); // wall at (8,1)
  });
  it('high cover blocks again if RULES.highCoverBlocksLos is switched on', () => {
    RULES.highCoverBlocksLos = true;
    try {
      expect(hasLos(s, { x: 0, y: 2 }, { x: 11, y: 2 })).toBe(false);
      expect(hasLos(s, { x: 0, y: 0 }, { x: 11, y: 0 })).toBe(true); // low cover still never blocks
    } finally {
      RULES.highCoverBlocksLos = false;
    }
  });
  it('is symmetric and never blocked by its own endpoints', () => {
    expect(hasLos(s, { x: 11, y: 0 }, { x: 0, y: 0 })).toBe(true);
    expect(hasLos(s, { x: 4, y: 2 }, { x: 5, y: 2 })).toBe(true); // looking at the cover tile itself
    expect(hasLos(s, { x: 4, y: 1 }, { x: 8, y: 1 })).toBe(true); // looking at a wall face
  });
  it('does not squeeze diagonally between two blockers', () => {
    const d = makeGame(blank(6, 6, [[2, 1, '#'], [1, 2, '#']]), { player: { soldier: [0, 3] }, enemy: { tank: [5, 5] } });
    expect(hasLos(d, { x: 1, y: 1 }, { x: 2, y: 2 })).toBe(false);
  });
  it('blocks attacks through a wall', () => {
    const w = makeGame(blank(12, 5, [[5, 2, '#']]), { player: { soldier: [2, 2] }, enemy: { tank: [8, 2] } });
    expect(() => act(w, { type: 'attack', unit: unit(w, 'player', 'soldier').id, target: unit(w, 'enemy', 'tank').id })).toThrow();
  });
  it('lets attacks through high cover, which then gives its -40 even head-on', () => {
    const c = makeGame(blank(12, 5, [[5, 2, 'h']]), { player: { soldier: [2, 2] }, enemy: { tank: [6, 2] } });
    const shooter = unit(c, 'player', 'soldier'), tank = unit(c, 'enemy', 'tank');
    rolls(c, 0);
    const events = act(c, { type: 'attack', unit: shooter.id, target: tank.id });
    const shot = events.find((e) => e.t === 'shot');
    expect(shot && shot.t === 'shot' && shot.chance).toBe(30);
  });
});

describe('walls as cover', () => {
  it('a wall on the edge facing the attacker counts as high cover (-40)', () => {
    const d = duel([[5, 2, '#']]);
    expect(coverAgainst(d.s, d.t, d.a).state).toBe('high');
    expect(hitChance(d.s, d.a, d.t)).toBe(30);
  });
  it('a diagonal shot past a wall corner uses the wall on either facing edge', () => {
    // attacker north-west of the target at (6,6); the line of sight runs along the diagonal and never touches the wall
    const d = duel([[5, 6, '#']], [2, 2], [6, 6]);
    expect(hasLos(d.s, d.a, d.t)).toBe(true);
    expect(coverAgainst(d.s, d.t, d.a).state).toBe('high');
    expect(hitChance(d.s, d.a, d.t)).toBe(30);
  });
  it('the better of wall and low cover wins, and a wall behind the target only flanks', () => {
    const better = duel([[5, 6, '#'], [6, 5, 'l']], [2, 2], [6, 6]);
    expect(hitChance(better.s, better.a, better.t)).toBe(30); // wall (high) beats low, no stacking
    const behind = duel([[7, 2, '#']]);
    expect(coverAgainst(behind.s, behind.t, behind.a).state).toBe('flanked');
    expect(hitChance(behind.s, behind.a, behind.t)).toBe(70);
  });
  it('the map edge is not cover', () => {
    const s = makeGame(blank(8, 5), { player: { soldier: [4, 2] }, enemy: { tank: [0, 2] } });
    const t = unit(s, 'enemy', 'tank'), a = unit(s, 'player', 'soldier');
    expect(coverAgainst(s, t, a).state).toBe('none');
  });
  it('gadgets still treat walls as walls: a grenade does not turn one into cover', () => {
    const s = makeGame(blank(24, 9, [[5, 2, '#']]), { player: { soldier: [1, 2] }, enemy: { sniper: [9, 4] } });
    act(s, { type: 'gadget', unit: unit(s, 'player', 'soldier').id, target: { x: 4, y: 2 } });
    expect(s.terrain[2 * 24 + 5]).toBe('wall');
    expect(s.cover[2 * 24 + 5]).toBeNull();
  });
});
