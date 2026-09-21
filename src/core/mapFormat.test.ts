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

  it('drops search waypoints that end up inside an obstacle', () => {
    const rows = [...base.rows];
    const [wx, wy] = base.searchPoints.enemy[0];
    setTile(rows, wx, wy, '#');
    const m = withEdits(base, rows, base.spawns);
    expect(m.searchPoints.enemy).toHaveLength(base.searchPoints.enemy.length - 1);
    expect(m.searchPoints.player).toHaveLength(base.searchPoints.player.length - 1);
  });
});
