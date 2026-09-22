import { describe, expect, it } from 'vitest';
import { parseMap, serializeMap, TILE_CHARS, WALKABLE } from '../core/mapFormat';
import { ALL_AUTHORED_MAPS } from './maps';
import { TRAINING_GROUNDS, type MapDef } from './trainingGrounds';
import { CLASS_ORDER } from './units';

/**
 * One shared contract every hand-authored map has to satisfy. These are the mistakes that are invisible in a
 * text editor and obvious the moment you load the map: a row a character short, a spawn on a cover tile, a
 * switch behind a wall nobody can walk to. Cheap to check, so every map gets checked.
 */

const BLOCKED_FOR_WALKING = (ch: string) => !WALKABLE.includes(ch) && ch !== 'O';

/** Flood fill over walkable tiles. Doors sit on floor, so they are already open here - deliberately: a closed
 *  door is something the player opens, not a wall, so "reachable" has to mean "reachable once you open it". */
function floodFrom(map: MapDef, start: [number, number], objectiveWalkable: boolean): Set<string> {
  const h = map.rows.length, w = map.rows[0].length;
  const open = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const ch = map.rows[y][x];
    if (ch === 'O') return objectiveWalkable;
    return !BLOCKED_FOR_WALKING(ch);
  };
  const seen = new Set<string>();
  const queue: [number, number][] = [start];
  seen.add(`${start[0]},${start[1]}`);
  for (let head = 0; head < queue.length; head++) {
    const [x, y] = queue[head];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!open(nx, ny)) continue;
      // no corner-cutting, same as core/grid.ts's `steps`
      if (dx !== 0 && dy !== 0 && (!open(x + dx, y) || !open(x, y + dy))) continue;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

const neighbours = (x: number, y: number): [number, number][] =>
  [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].map(([dx, dy]) => [x + dx, y + dy] as [number, number]);

describe.each(ALL_AUTHORED_MAPS.map((m) => [m.name, m] as const))('map: %s', (_name, map) => {
  const width = map.rows[0].length;

  it('is a rectangle of known tile characters', () => {
    expect(map.rows.length).toBeGreaterThan(0);
    map.rows.forEach((row, y) => {
      expect.soft(row.length, `row ${y} width`).toBe(width);
      [...row].forEach((ch, x) => {
        expect.soft(TILE_CHARS.includes(ch), `tile "${ch}" at (${x},${y})`).toBe(true);
      });
    });
  });

  it('round-trips through the same validator the map builder and saved maps use', () => {
    expect(() => parseMap(JSON.parse(serializeMap(map)), map)).not.toThrow();
  });

  it('fields exactly one of every class for the player', () => {
    expect([...map.spawns.player.map((s) => s[0])].sort()).toEqual([...CLASS_ORDER].sort());
  });

  it('keeps every search waypoint on an open tile', () => {
    for (const team of ['player', 'enemy'] as const) {
      for (const [x, y] of map.searchPoints[team]) {
        expect.soft(WALKABLE.includes(map.rows[y]?.[x] ?? '#'), `${team} waypoint (${x},${y})`).toBe(true);
      }
    }
  });

  it('declares an objective its tiles actually support', () => {
    const objectiveTiles: [number, number][] = [];
    map.rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'O') objectiveTiles.push([x, y]); }));
    const def = map.objective;
    if (!def || def.type === 'hold') {
      expect(objectiveTiles.length, 'a hold objective needs exactly one terminal tile').toBe(1);
    } else if (def.type === 'reach') {
      expect(objectiveTiles.length).toBeGreaterThanOrEqual(def.unitsRequired);
    } else {
      expect(objectiveTiles.length, `${def.type} objectives use no 'O' tiles`).toBe(0);
    }
    if (def?.type === 'sabotage') {
      expect(def.interactableIds.length).toBeGreaterThan(0);
      for (const id of def.interactableIds) {
        const it = map.interactables?.find((i) => i.id === id);
        expect(it, `sabotage target ${id} exists`).toBeDefined();
        expect(it!.type, `sabotage target ${id} is flippable`).not.toBe('chest');
      }
    }
    if (def?.type === 'eliminateTarget') {
      expect(def.enemySpawnIndex).toBeGreaterThanOrEqual(0);
      expect(def.enemySpawnIndex).toBeLessThan(map.spawns.enemy.length);
    }
  });

  it('connects every spawn, objective, interactable and pickup to the player squad', () => {
    const reachObjective = map.objective?.type === 'reach';
    const [sx, sy] = [map.spawns.player[0][1], map.spawns.player[0][2]];
    const reach = floodFrom(map, [sx, sy], reachObjective);
    const reachable = (x: number, y: number) => reach.has(`${x},${y}`);

    for (const team of ['player', 'enemy'] as const) {
      for (const [cls, x, y] of map.spawns[team]) {
        expect.soft(reachable(x, y), `${team} ${cls} spawn (${x},${y}) is cut off`).toBe(true);
      }
    }
    for (const it of map.interactables ?? []) {
      expect.soft(reachable(it.x, it.y), `${it.type} ${it.id} at (${it.x},${it.y}) is cut off`).toBe(true);
    }
    for (const p of map.pickups ?? []) {
      expect.soft(reachable(p.x, p.y), `pickup ${p.id} at (${p.x},${p.y}) is cut off`).toBe(true);
    }
    map.rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== 'O') return;
      const ok = reachObjective ? reachable(x, y) : neighbours(x, y).some(([nx, ny]) => reachable(nx, ny));
      expect.soft(ok, `objective tile (${x},${y}) can't be worked from`).toBe(true);
    }));
  });
});

describe('training grounds', () => {
  it('still satisfies the same rectangle/validator contract', () => {
    const width = TRAINING_GROUNDS.rows[0].length;
    for (const row of TRAINING_GROUNDS.rows) expect(row.length).toBe(width);
    expect(() => parseMap(JSON.parse(serializeMap(TRAINING_GROUNDS)), TRAINING_GROUNDS)).not.toThrow();
  });
});
