import { border, building, coverPairs, field, hRun, pts, put, toRows, vRun, type Grid } from './compose';
import type { MapDef, Spawn } from '../trainingGrounds';
import type { ClassId } from '../units';

/**
 * Versus arenas (hotseat PvP). Every one is mirror-symmetric east to west, so neither side has the better
 * ground: the west half is drawn and `mirror` copies it across. Side 1 deploys west, side 2 east. No objective
 * - last squad standing - and no dormant pods or reinforcements.
 */

/** Copies the west half of `g` onto the east half, mirrored. */
function mirror(g: Grid): Grid {
  const w = g[0].length;
  for (const row of g) for (let x = 0; x < Math.floor(w / 2); x++) row[w - 1 - x] = row[x];
  return g;
}

const SQUAD: ClassId[] = ['soldier', 'assault', 'medic', 'tank', 'sniper'];

/** Side 1's spawns as given; side 2's mirrored across the map. */
function spawns(w: number, west: [number, number][]): MapDef['spawns'] {
  const player: Spawn[] = west.map(([x, y], i) => [SQUAD[i], x, y]);
  const enemy: Spawn[] = west.map(([x, y], i) => [SQUAD[i], w - 1 - x, y]);
  return { player, enemy };
}

// ------------------------------------------------------------------------------------------------ Crossroads
/** Crossroads - 30x20, midday. Two blocks of houses each side of a crossroads; the square in the middle is the
 *  fast way and the alleys are the safe one. The simplest arena, for a first game. */
function crossroads(): string[] {
  const g = field(30, 20);
  border(g);
  building(g, 5, 2, 7, 6, [[8, 7], [11, 4]]);
  building(g, 5, 12, 7, 6, [[8, 12], [11, 15]]);
  coverPairs(g, 10, [2]);
  pts(g, [[13, 5], [13, 14], [14, 9], [14, 10]], 'l');
  pts(g, [[3, 5], [3, 14]], 'h');
  pts(g, [[14, 1], [14, 18]], 'b');
  return toRows(mirror(g));
}

export const PVP_CROSSROADS: MapDef = {
  name: 'Crossroads',
  rows: crossroads(),
  spawns: spawns(30, [[2, 8], [2, 9], [1, 10], [1, 11], [2, 12]]),
  searchPoints: { player: [[14, 8], [8, 4], [8, 15]], enemy: [[15, 8], [21, 4], [21, 15]] },
  startTimeOfDay: 'midday',
  startWeather: 'clear',
  pickups: [
    { id: 1, type: 'ammo', x: 8, y: 9 }, { id: 2, type: 'ammo', x: 21, y: 9 },
    { id: 3, type: 'medkit', x: 14, y: 2 }, { id: 4, type: 'medkit', x: 15, y: 17 },
  ],
};

// ------------------------------------------------------------------------------------------------ Substation
/** Substation Yard - 36x24, midnight. Transformer pens in lines, a control hut on each side and a cable trench
 *  down the middle with three crossings. Night halves vision, so scouting wins it. */
function substation(): string[] {
  const g = field(36, 24);
  border(g);
  building(g, 3, 9, 6, 6, [[8, 11], [8, 12]]);
  for (const y of [3, 7, 16, 20]) hRun(g, 10, y, 5, 'h');
  vRun(g, 17, 1, 22, '#');
  for (const y of [4, 5, 11, 12, 18, 19]) put(g, 17, y, '.');
  pts(g, [[13, 11], [13, 12], [11, 5], [11, 18], [5, 4], [5, 19]], 'l');
  pts(g, [[1, 1], [2, 1], [1, 22], [2, 22]], 'b');
  return toRows(mirror(g));
}

export const PVP_SUBSTATION: MapDef = {
  name: 'Substation Yard',
  rows: substation(),
  spawns: spawns(36, [[4, 11], [5, 12], [4, 13], [6, 11], [6, 13]]),
  searchPoints: { player: [[16, 11], [16, 4], [16, 19]], enemy: [[19, 11], [19, 4], [19, 19]] },
  startTimeOfDay: 'midnight',
  startWeather: 'clear',
  interactables: [
    { id: 1, type: 'door', x: 8, y: 11, active: true }, { id: 2, type: 'door', x: 8, y: 12, active: true },
    { id: 3, type: 'door', x: 27, y: 11, active: true }, { id: 4, type: 'door', x: 27, y: 12, active: true },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 13, y: 2 }, { id: 2, type: 'ammo', x: 22, y: 21 },
    { id: 3, type: 'medkit', x: 12, y: 21 }, { id: 4, type: 'medkit', x: 23, y: 2 },
    { id: 5, type: 'gadget', x: 15, y: 11 }, { id: 6, type: 'gadget', x: 20, y: 12 },
  ],
};

// ------------------------------------------------------------------------------------------------ Night market
/** Tarpaulin Row - 32x22, afternoon, fog. The Night Market's tarpaulins (bush: hides whoever stands in it until
 *  an enemy is within two tiles) in rows across the middle, stalls for cover. A hide-and-seek arena. */
function tarpaulins(): string[] {
  const g = field(32, 22);
  border(g);
  for (const x of [8, 12]) for (const y of [3, 4, 5, 9, 10, 11, 12, 16, 17, 18]) put(g, x, y, 'b');
  for (const y of [6, 15]) hRun(g, 9, y, 3, 'l');
  pts(g, [[14, 7], [14, 8], [14, 13], [14, 14]], 'b');
  building(g, 2, 2, 4, 4, [[5, 3]]);
  building(g, 2, 16, 4, 4, [[5, 18]]);
  pts(g, [[10, 1], [10, 20], [4, 10], [4, 11]], 'h');
  return toRows(mirror(g));
}

export const PVP_TARPAULINS: MapDef = {
  name: 'Tarpaulin Row',
  rows: tarpaulins(),
  spawns: spawns(32, [[2, 9], [2, 10], [1, 11], [2, 12], [1, 8]]),
  searchPoints: { player: [[15, 10], [10, 4], [10, 17]], enemy: [[16, 10], [21, 4], [21, 17]] },
  startTimeOfDay: 'afternoon',
  startWeather: 'fog',
  pickups: [
    { id: 1, type: 'ammo', x: 3, y: 3 }, { id: 2, type: 'ammo', x: 28, y: 18 },
    { id: 3, type: 'medkit', x: 3, y: 18 }, { id: 4, type: 'medkit', x: 28, y: 3 },
  ],
};

export const PVP_MAPS: { id: string; map: MapDef; blurb: string }[] = [
  { id: 'crossroads', map: PVP_CROSSROADS, blurb: 'Two blocks of houses around a crossroads. Midday, clear. The one to start with.' },
  { id: 'substation', map: PVP_SUBSTATION, blurb: 'Transformer pens and a cable trench with three crossings. Midnight: whoever scouts, wins.' },
  { id: 'tarpaulins', map: PVP_TARPAULINS, blurb: 'Rows of tarpaulins you can hide in, in fog. Get close to see anything at all.' },
];
