import { describe, expect, it } from 'vitest';
import { TRAINING_GROUNDS } from '../data/trainingGrounds';
import { parseMap, serializeMap, withEdits } from './mapFormat';

const base = TRAINING_GROUNDS;
const clone = () => JSON.parse(JSON.stringify({ rows: base.rows, spawns: base.spawns }));
const setTile = (rows: string[], x: number, y: number, ch: string) => {
  rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1);
};

describe('map format', () => {
  it('round-trips the default map through serialize -> parse', () => {
    const back = parseMap(JSON.parse(serializeMap(base)), base);
    expect(back.rows).toEqual(base.rows);
    expect(back.spawns).toEqual(base.spawns);
    expect(back.searchPoints).toEqual(base.searchPoints);
  });

  it('rejects wrong sizes, unknown tiles and a second objective', () => {
    const wrongRows = clone(); wrongRows.rows.pop();
    expect(() => parseMap(wrongRows, base)).toThrow('16 strings');
    const wrongWidth = clone(); wrongWidth.rows[3] += '.';
    expect(() => parseMap(wrongWidth, base)).toThrow('Row 3');
    const badTile = clone(); setTile(badTile.rows, 0, 0, 'Z');
    expect(() => parseMap(badTile, base)).toThrow('Unknown tile "Z"');
    const twoObj = clone(); setTile(twoObj.rows, 0, 0, 'O');
    expect(() => parseMap(twoObj, base)).toThrow('At most one objective');
    expect(() => parseMap(null, base)).toThrow();
  });

  it('validates spawns: class, open tile, no overlap, both teams present', () => {
    const onWall = clone(); onWall.spawns.player[0] = ['sniper', 8, 0];
    expect(() => parseMap(onWall, base)).toThrow('not on an open tile');
    const badClass = clone(); badClass.spawns.enemy[0] = ['wizard', 18, 2];
    expect(() => parseMap(badClass, base)).toThrow('Unknown unit class');
    const overlap = clone(); overlap.spawns.enemy[1] = overlap.spawns.enemy[0];
    expect(() => parseMap(overlap, base)).toThrow('share tile');
    const noEnemy = clone(); noEnemy.spawns.enemy = [];
    expect(() => parseMap(noEnemy, base)).toThrow('at least one enemy');
  });

  it('allows several units of one class and units in bushes', () => {
    const m = clone();
    m.spawns.player.push(['soldier', 8, 1]); // (8,1) is a bush
    expect(parseMap(m, base).spawns.player).toHaveLength(base.spawns.player.length + 1);
  });

  it('validates and round-trips an optional per-unit AI profile override', () => {
    const bad = clone();
    bad.spawns.enemy[0] = ['soldier', 8, 1, 'not-a-profile'];
    expect(() => parseMap(bad, base)).toThrow('Unknown AI profile');
    const good = clone();
    good.spawns.enemy[0] = ['soldier', 8, 1, 'camper'];
    expect(parseMap(good, base).spawns.enemy[0]).toEqual(['soldier', 8, 1, 'camper']);
    const back = parseMap(JSON.parse(serializeMap(withEdits(base, base.rows, good.spawns))), base);
    expect(back.spawns.enemy[0]).toEqual(['soldier', 8, 1, 'camper']);
  });

  it('drops search waypoints that end up inside an obstacle', () => {
    const rows = [...base.rows];
    const [wx, wy] = base.searchPoints.enemy[0];
    setTile(rows, wx, wy, '#');
    const m = withEdits(base, rows, base.spawns);
    expect(m.searchPoints.enemy).toHaveLength(base.searchPoints.enemy.length - 1);
    expect(m.searchPoints.player).toHaveLength(base.searchPoints.player.length - 1);
  });
});

describe('objective tile count (feature 3): a reach objective relaxes the "at most one" rule', () => {
  const reachBase = { ...base, objective: { type: 'reach' as const, unitsRequired: 1 } };

  it('a reach mission requires at least one objective tile', () => {
    const m = clone();
    setTile(m.rows, 12, 7, '.'); // remove Training Grounds' one 'O'
    expect(() => parseMap(m, reachBase)).toThrow('at least one objective tile');
  });

  it('a reach mission allows more than one objective tile', () => {
    const m = clone();
    setTile(m.rows, 0, 0, 'O'); // a second 'O', alongside the existing one at (12,7)
    expect(parseMap(m, reachBase).rows).toEqual(m.rows);
  });

  it('every other objective type (including the undefined/legacy default) still allows at most one', () => {
    const m = clone();
    setTile(m.rows, 0, 0, 'O');
    expect(() => parseMap(m, base)).toThrow('At most one objective');
  });
});

describe('interactables (doors/switches, feature 2)', () => {
  // (0,0) and (0,15) are both open floor, unoccupied by any spawn or the objective.
  const door = { id: 1, type: 'door' as const, x: 0, y: 0 };
  const sw = { id: 2, type: 'switch' as const, x: 0, y: 15, links: [1] };
  const cloneWith = (interactables: unknown[]) => JSON.parse(serializeMap(withEdits(base, base.rows, base.spawns, interactables as never)));

  it('round-trips through serialize -> parse, including links', () => {
    const back = parseMap(cloneWith([door, sw]), base);
    expect(back.interactables).toEqual([door, sw]);
  });

  it('builder round-trip: withEdits -> serializeMap -> parseMap preserves an edited interactable list', () => {
    const edited = withEdits(base, base.rows, base.spawns, [door]);
    const back = parseMap(JSON.parse(serializeMap(edited)), base);
    expect(back.interactables).toEqual([door]);
  });

  it('rejects an unknown interactable type', () => {
    const raw = cloneWith([door]);
    raw.interactables[0].type = 'nope';
    expect(() => parseMap(raw, base)).toThrow('Unknown interactable type');
  });

  it('rejects a door/switch not on an open tile', () => {
    expect(() => parseMap(cloneWith([{ id: 1, type: 'door', x: 5, y: 0 }]), base)).toThrow('not on an open tile'); // (5,0) is a wall
  });

  it('rejects two interactables sharing an id', () => {
    expect(() => parseMap(cloneWith([door, { id: 1, type: 'door', x: 0, y: 15 }]), base)).toThrow('share id');
  });

  it('rejects an interactable sharing a tile with a unit spawn', () => {
    const [, x, y] = base.spawns.player[0];
    expect(() => parseMap(cloneWith([{ id: 1, type: 'door', x, y }]), base)).toThrow('shares a tile with a unit');
  });

  it('rejects two interactables sharing a tile with each other', () => {
    expect(() => parseMap(cloneWith([door, { id: 2, type: 'switch', x: 0, y: 0 }]), base)).toThrow('share tile');
  });

  it("rejects a switch linking to an id that isn't a door", () => {
    expect(() => parseMap(cloneWith([{ id: 1, type: 'switch', x: 0, y: 0, links: [99] }]), base)).toThrow('non-door id');
  });
});

describe('pickups (feature 4)', () => {
  // (0,0) and (0,15) are both open floor, unoccupied by any spawn, interactable or objective.
  const ammo = { id: 1, type: 'ammo' as const, x: 0, y: 0, amount: 6 };
  const medkit = { id: 2, type: 'medkit' as const, x: 0, y: 15 };
  const cloneWith = (pickups: unknown[]) => JSON.parse(serializeMap(withEdits(base, base.rows, base.spawns, [], pickups as never)));

  it('round-trips through serialize -> parse, including an explicit amount', () => {
    const back = parseMap(cloneWith([ammo, medkit]), base);
    expect(back.pickups).toEqual([ammo, medkit]);
  });

  it('builder round-trip: withEdits -> serializeMap -> parseMap preserves an edited pickup list', () => {
    const edited = withEdits(base, base.rows, base.spawns, [], [ammo]);
    const back = parseMap(JSON.parse(serializeMap(edited)), base);
    expect(back.pickups).toEqual([ammo]);
  });

  it('rejects an unknown pickup type', () => {
    const raw = cloneWith([ammo]);
    raw.pickups[0].type = 'nope';
    expect(() => parseMap(raw, base)).toThrow('Unknown pickup type');
  });

  it('rejects a pickup not on an open tile', () => {
    expect(() => parseMap(cloneWith([{ id: 1, type: 'ammo', x: 5, y: 0 }]), base)).toThrow('not on an open tile'); // (5,0) is a wall
  });

  it('rejects two pickups sharing an id', () => {
    expect(() => parseMap(cloneWith([ammo, { id: 1, type: 'medkit', x: 0, y: 15 }]), base)).toThrow('share id');
  });

  it('rejects a pickup sharing a tile with a unit spawn', () => {
    const [, x, y] = base.spawns.player[0];
    expect(() => parseMap(cloneWith([{ id: 1, type: 'ammo', x, y }]), base)).toThrow('shares a tile with something already there');
  });

  it('rejects two pickups sharing a tile with each other', () => {
    expect(() => parseMap(cloneWith([ammo, { id: 2, type: 'medkit', x: 0, y: 0 }]), base)).toThrow('shares a tile with something already there');
  });

  it('rejects a pickup sharing a tile with a door/switch', () => {
    const edited = { ...JSON.parse(serializeMap(base)), interactables: [{ id: 1, type: 'door', x: 0, y: 0 }], pickups: [{ id: 2, type: 'ammo', x: 0, y: 0 }] };
    expect(() => parseMap(edited, base)).toThrow('shares a tile with something already there');
  });

  it('rejects a bad "amount"', () => {
    expect(() => parseMap(cloneWith([{ id: 1, type: 'ammo', x: 0, y: 0, amount: 0 }]), base)).toThrow('Bad "amount"');
    expect(() => parseMap(cloneWith([{ id: 1, type: 'ammo', x: 0, y: 0, amount: -3 }]), base)).toThrow('Bad "amount"');
  });

  it('defaults to the item\'s default amount when omitted (applied at createGame, not at parse time)', () => {
    const back = parseMap(cloneWith([medkit]), base);
    expect(back.pickups![0].amount).toBeUndefined(); // parseMap preserves "omitted"; createGame fills the default
  });
});
