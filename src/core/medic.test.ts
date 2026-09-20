import { describe, expect, it } from 'vitest';
import { CLASSES } from '../data/units';
import { act, blank, makeGame, place, unit } from './testkit';

describe('medic', () => {
  const setup = () =>
    makeGame(blank(16, 5), { player: { medic: [2, 2], tank: [4, 2], sniper: [2, 4], soldier: [12, 2] }, enemy: { tank: [15, 4] } });

  it('is a frailer soldier: less HP, no armor, same weapon, medkit gadget', () => {
    expect(CLASSES.medic.hp).toBeLessThan(CLASSES.soldier.hp);
    expect(CLASSES.medic.armor).toBeLessThan(CLASSES.soldier.armor);
    expect(CLASSES.medic.weapon).toEqual(CLASSES.soldier.weapon);
    expect(unit(setup(), 'player', 'medic').gadget!.id).toBe('medkit');
    expect(unit(setup(), 'player', 'soldier').gadget!.id).toBe('grenade');
  });

  it('heals a wounded friendly unit within 2 tiles all the way to full', () => {
    const s = setup();
    const m = unit(s, 'player', 'medic'), tank = unit(s, 'player', 'tank');
    tank.hp = 3;
    const events = act(s, { type: 'gadget', unit: m.id, target: { x: tank.x, y: tank.y } });
    expect(tank.hp).toBe(24);
    expect(events.some((e) => e.t === 'heal' && e.amount === 21)).toBe(true);
    expect(m.gadget!.uses).toBe(2);
    expect(m.medkits).toBe(2); // independent from the per-unit first-aid medkits
  });

  it('rejects targets that are out of range, at full HP, not friendly, or empty', () => {
    const s = setup();
    const m = unit(s, 'player', 'medic');
    const tank = unit(s, 'player', 'tank'), far = unit(s, 'player', 'soldier');
    const call = (x: number, y: number) => () => act(s, { type: 'gadget', unit: m.id, target: { x, y } });
    expect(call(tank.x, tank.y)).toThrow('full HP');
    far.hp = 1;
    expect(call(far.x, far.y)).toThrow(/range|visible/);
    expect(call(3, 2)).toThrow('friendly'); // empty tile
    const foe = unit(s, 'enemy', 'tank');
    foe.hp = 5;
    place(s, foe, 3, 3);
    expect(call(3, 3)).toThrow('friendly');
  });

  it('can heal itself', () => {
    const s = setup();
    const m = unit(s, 'player', 'medic');
    m.hp = 2;
    act(s, { type: 'gadget', unit: m.id, target: { x: m.x, y: m.y } });
    expect(m.hp).toBe(CLASSES.medic.hp);
  });
});

describe('cover rotation', () => {
  it('map characters 1/2/3 are low cover rotated by quarter turns', () => {
    const s = makeGame(blank(8, 3, [[1, 1, 'l'], [2, 1, '1'], [3, 1, '2'], [4, 1, '3'], [5, 1, 'h']]), {
      player: { soldier: [0, 0] }, enemy: { tank: [7, 2] },
    });
    const at = (x: number) => [s.cover[1 * 8 + x], s.coverRot[1 * 8 + x]];
    expect([1, 2, 3, 4].map(at)).toEqual([['low', 0], ['low', 1], ['low', 2], ['low', 3]]);
    expect(s.cover[1 * 8 + 5]).toBe('high');
  });

  it('the tank chooses the rotation of cover it places (visual only)', () => {
    const s = makeGame(blank(24, 9, [[5, 2, 'l']]), { player: { tank: [4, 3] }, enemy: { sniper: [22, 8] } });
    const t = unit(s, 'player', 'tank');
    act(s, { type: 'gadget', unit: t.id, target: { x: 5, y: 3 }, rotation: 3 }); // empty tile -> low
    expect([s.cover[3 * 24 + 5], s.coverRot[3 * 24 + 5]]).toEqual(['low', 3]);
    t.gadget!.cooldown = 0; t.actions = 2;
    act(s, { type: 'gadget', unit: t.id, target: { x: 5, y: 2 }, rotation: -1 }); // upgrade + rotate (-1 wraps to 3)
    expect([s.cover[2 * 24 + 5], s.coverRot[2 * 24 + 5]]).toEqual(['high', 3]);
    t.gadget!.cooldown = 0; t.actions = 2;
    act(s, { type: 'gadget', unit: t.id, target: { x: 3, y: 4 } }); // no rotation given
    expect(s.coverRot[4 * 24 + 3]).toBe(0);
  });

  it('a grenade downgrading high cover keeps its rotation', () => {
    const s = makeGame(blank(24, 9, [[5, 2, 'h']]), { player: { soldier: [1, 2] }, enemy: { sniper: [22, 8] } });
    s.coverRot[2 * 24 + 5] = 2;
    act(s, { type: 'gadget', unit: unit(s, 'player', 'soldier').id, target: { x: 5, y: 2 } });
    expect([s.cover[2 * 24 + 5], s.coverRot[2 * 24 + 5]]).toEqual(['low', 2]);
  });
});
