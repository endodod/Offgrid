import type { MapDef } from '../trainingGrounds';
import { building, coverPairs, field, hRun, pts, put, rect, stamp, toRows, vRun } from './compose';

/**
 * The five hand-authored layouts a generated supply run (5) draws from. They are deliberately *not* variants
 * of one map: each has a different objective type, a different silhouette and a different fight shape, so two
 * supply runs in a row don't feel like the same job with a different name.
 *
 * Everything a generated mission varies on top of these - enemy AI profile, time of day, weather, ammo
 * scarcity - is layered on by `core/campaign.ts`'s `resolveSupplyRun`, never baked in here. The start
 * conditions below are each map's "house weather", used when a run rolls the `none` complication.
 */

/** Extraction from an open tank farm: almost no walls, so cover is everything and sightlines are brutal. */
export const FUEL_DEPOT: MapDef = {
  name: 'Ardent Fuel Depot',
  rows: [
    '....................OOOO',
    '..####.....####.....OOOO',
    '..####.....####.....OOOO',
    '..####.....####.........',
    '........................',
    '...ll.......ll.......ll.',
    '........................',
    '.####....####....####...',
    '.####....####....####...',
    '.####....####....####...',
    '........................',
    '...hh.......hh.......hh.',
    '........................',
    '..####.....####.....####',
    '..####.....####.....####',
    '........................',
  ],
  spawns: {
    player: [['soldier', 1, 15], ['assault', 3, 15], ['medic', 2, 12], ['tank', 0, 13], ['sniper', 1, 10]],
    enemy: [['assault', 16, 4], ['soldier', 21, 6], ['sniper', 16, 11], ['soldier', 8, 6], ['assault', 21, 10]],
  },
  searchPoints: {
    player: [[12, 10], [21, 4], [6, 4]],
    enemy: [[12, 10], [6, 15], [20, 3]],
  },
  startTimeOfDay: 'midday',
  startWeather: 'clear',
  objective: { type: 'reach', unitsRequired: 3 },
  pickups: [
    { id: 1, type: 'ammo', x: 12, y: 4 },
    { id: 2, type: 'medkit', x: 6, y: 10 },
    { id: 3, type: 'ammo', x: 18, y: 12 },
  ],
  interactables: [{ id: 20, type: 'chest', x: 11, y: 15 }],
};

/** A console to hold inside a gutted shop block: six shopfronts, a street between them, one terminal. */
export const PHARMACY_ROW: MapDef = {
  name: 'Pharmacy Row',
  rows: [
    '########################',
    '#......##......##......#',
    '#.ll...##...ll.##...ll.#',
    '#......##......##......#',
    '###.######.######.######',
    '........................',
    '..hh......hh......hh....',
    '...........O............',
    '..hh......hh......hh....',
    '........................',
    '######.######.######.###',
    '#......##......##......#',
    '#.ll...##...ll.##...ll.#',
    '#......##......##......#',
    '#......##......##......#',
    '########################',
  ],
  spawns: {
    player: [['soldier', 1, 5], ['assault', 2, 5], ['medic', 1, 9], ['tank', 2, 9], ['sniper', 0, 7]],
    enemy: [['assault', 21, 7], ['soldier', 19, 12], ['sniper', 18, 2], ['assault', 14, 5], ['soldier', 4, 12]],
  },
  searchPoints: {
    player: [[20, 7], [11, 12], [11, 2]],
    enemy: [[12, 7], [3, 7], [18, 12]],
  },
  startTimeOfDay: 'morning',
  startWeather: 'rain',
  objective: { type: 'hold' },
  pickups: [
    { id: 1, type: 'ammo', x: 5, y: 9 },
    { id: 2, type: 'medkit', x: 3, y: 1 },
    { id: 3, type: 'gadget', x: 21, y: 9 },
  ],
  interactables: [
    { id: 20, type: 'chest', x: 3, y: 13 },
    { id: 21, type: 'chest', x: 20, y: 1 },
  ],
};

/** Rolling stock parked in rows: long lanes between carriages, two couplings to cut, nowhere to flank wide. */
export const RAIL_YARD: MapDef = {
  name: 'Halstead Rail Yard',
  rows: [
    '........................',
    '.###.####..####.####....',
    '.###.####..####.####....',
    '........................',
    '..ll.......hh.......ll..',
    '........................',
    '####.#####..#####.######',
    '####.#####..#####.######',
    '........................',
    '...hh......bbb......hh..',
    '........................',
    '.####..####.####..####..',
    '.####..####.####..####..',
    '........................',
    '..ll..........hh........',
    '........................',
  ],
  spawns: {
    player: [['soldier', 1, 15], ['assault', 2, 15], ['medic', 0, 14], ['tank', 1, 13], ['sniper', 3, 13]],
    enemy: [['assault', 20, 3], ['soldier', 12, 8], ['sniper', 6, 0], ['assault', 22, 13], ['soldier', 15, 15]],
  },
  searchPoints: {
    player: [[12, 8], [20, 3], [4, 10]],
    enemy: [[12, 8], [3, 13], [20, 8]],
  },
  startTimeOfDay: 'afternoon',
  startWeather: 'cloudy',
  objective: { type: 'sabotage', interactableIds: [10, 11] },
  interactables: [
    { id: 10, type: 'switch', x: 4, y: 6 },
    { id: 11, type: 'switch', x: 11, y: 11 },
    { id: 20, type: 'chest', x: 21, y: 8 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 8, y: 3 },
    { id: 2, type: 'medkit', x: 17, y: 10 },
  ],
};

/** Two sealed halves joined by two one-tile gaps. Whoever holds a gap holds the mission. */
export const UNDERPASS: MapDef = {
  name: 'Vance Street Underpass',
  rows: [
    '########################',
    '#......................#',
    '#.hh................hh.#',
    '#......................#',
    '#.####..####..####..##.#',
    '#.####..####..####..##.#',
    '#......................#',
    '###.################.###',
    '#......................#',
    '#..ll...........ll.....#',
    '#......................#',
    '#.##..####..####..####.#',
    '#.##..####..####..####.#',
    '#......................#',
    '#.................OOOO.#',
    '########################',
  ],
  spawns: {
    player: [['soldier', 1, 1], ['assault', 2, 1], ['medic', 3, 1], ['tank', 1, 3], ['sniper', 2, 3]],
    enemy: [['soldier', 18, 10], ['sniper', 20, 6], ['assault', 6, 13], ['soldier', 14, 13]], // 19: one fewer - it was 52% at tier 0
  },
  searchPoints: {
    player: [[3, 8], [20, 8], [20, 13]],
    enemy: [[3, 6], [20, 6], [5, 2]],
  },
  startTimeOfDay: 'midnight',
  startWeather: 'clear',
  objective: { type: 'reach', unitsRequired: 3 },
  pickups: [
    { id: 1, type: 'ammo', x: 11, y: 6 },
    { id: 2, type: 'medkit', x: 11, y: 10 },
    { id: 3, type: 'ammo', x: 21, y: 1 },
  ],
  interactables: [{ id: 20, type: 'chest', x: 2, y: 13 }],
};

/** Settling tanks with one way into each: a named quartermaster sits in one of them and has to be dug out. */
export const WATERWORKS: MapDef = {
  name: 'Cold Creek Waterworks',
  rows: [
    '........................',
    '.######......######.....',
    '.#....#......#....#.....',
    '.#....#......#....#.....',
    '.###.##......###.##.....',
    '........................',
    '...ll.....hh.....ll.....',
    '........................',
    '........................',
    '...hh.....bb.....hh.....',
    '........................',
    '.###.##......###.##.....',
    '.#....#......#....#.....',
    '.#....#......#....#.....',
    '.######......######.....',
    '........................',
  ],
  spawns: {
    player: [['soldier', 22, 15], ['assault', 21, 15], ['medic', 23, 14], ['tank', 22, 13], ['sniper', 21, 10]],
    enemy: [
      ['soldier', 3, 12, 'camper'],
      ['assault', 10, 7], ['sniper', 20, 3], ['assault', 15, 13], ['soldier', 21, 9],
    ],
  },
  searchPoints: {
    player: [[12, 8], [3, 13], [20, 3]],
    enemy: [[12, 8], [20, 10], [4, 5]],
  },
  startTimeOfDay: 'morning',
  startWeather: 'cloudy',
  objective: { type: 'eliminateTarget', enemySpawnIndex: 0, label: 'the Jackal quartermaster' },
  pickups: [
    { id: 1, type: 'ammo', x: 12, y: 5 },
    { id: 2, type: 'medkit', x: 7, y: 10 },
  ],
  interactables: [
    { id: 20, type: 'chest', x: 3, y: 2 },
    { id: 21, type: 'chest', x: 15, y: 3 },
  ],
};

// ---------- 19: three more layouts, each a different size from the 24x16 originals ----------

/** 18x14 - the smallest job on the board: a corner shop with its till still wired, held for two rounds. */
export const CORNER_STORE: MapDef = {
  name: 'Hollis Corner Store',
  rows: (() => {
    const W = 18, H = 14;
    const g = field(W, H);
    hRun(g, 0, 0, W, '#'); hRun(g, 0, H - 1, W, '#'); vRun(g, 0, 0, H, '#'); vRun(g, W - 1, 0, H, '#');
    building(g, 6, 3, 9, 8, [[6, 7], [10, 10]]);       // the shop: side door and front door
    pts(g, [[9, 5], [10, 5], [11, 5], [8, 8], [9, 8]], 'l'); // counter and shelving
    put(g, 12, 7, 'O');                               // the till
    coverPairs(g, 4, [2]); coverPairs(g, 10, [2]);
    pts(g, [[2, 7], [15, 11], [16, 11]], 'b');
    return toRows(g);
  })(),
  spawns: {
    player: [['soldier', 2, 11], ['assault', 3, 11], ['medic', 4, 11], ['tank', 2, 12], ['sniper', 3, 12]],
    enemy: [['soldier', 9, 6], ['assault', 13, 9], ['sniper', 16, 2], ['assault', 12, 12]],
  },
  searchPoints: {
    player: [[5, 7], [10, 11], [15, 5]],
    enemy: [[5, 7], [10, 11], [3, 3]],
  },
  startTimeOfDay: 'afternoon',
  startWeather: 'cloudy',
  objective: { type: 'hold' },
  pickups: [
    { id: 1, type: 'ammo', x: 4, y: 4 },
    { id: 2, type: 'medkit', x: 15, y: 10 },
  ],
  interactables: [
    { id: 1, type: 'door', x: 6, y: 7 },
    { id: 2, type: 'door', x: 10, y: 10, active: true },
    { id: 20, type: 'chest', x: 13, y: 4 },
  ],
};

/** 44x14 - a long walk along the canal: the water on one side, warehouses on the other, the boat at the end. */
export const CANAL_TOWPATH: MapDef = {
  name: 'Grey Canal Towpath',
  rows: (() => {
    const W = 44, H = 14;
    const g = field(W, H);
    rect(g, 0, 0, W, 3, '#'); hRun(g, 0, H - 1, W, '#'); vRun(g, 0, 0, H, '#'); vRun(g, W - 1, 0, H, '#');
    building(g, 8, 8, 7, 5, [[11, 8]]);
    building(g, 22, 9, 8, 4, [[26, 9]]);
    building(g, 34, 8, 6, 5, [[36, 8]]);
    coverPairs(g, 4, [5, 15, 27]);
    coverPairs(g, 6, [10, 20, 31]);
    pts(g, [[17, 5], [17, 6], [30, 4]], 'h');
    pts(g, [[3, 7], [40, 9]], 'b');
    stamp(g, 40, 4, ['OOO', 'OOO']);                   // the narrowboat's gangway
    return toRows(g);
  })(),
  spawns: {
    player: [['soldier', 1, 4], ['assault', 2, 4], ['medic', 1, 5], ['tank', 1, 7], ['sniper', 2, 6]],
    enemy: [['assault', 12, 5], ['soldier', 19, 7], ['sniper', 29, 5], ['assault', 33, 6], ['soldier', 38, 5]],
  },
  searchPoints: {
    player: [[12, 6], [24, 6], [36, 6]],
    enemy: [[12, 6], [24, 6], [5, 6]],
  },
  startTimeOfDay: 'morning',
  startWeather: 'fog',
  objective: { type: 'reach', unitsRequired: 3 },
  pickups: [
    { id: 1, type: 'ammo', x: 8, y: 5 },
    { id: 2, type: 'medkit', x: 24, y: 5 },
    { id: 3, type: 'ammo', x: 35, y: 4 },
  ],
  interactables: [
    { id: 1, type: 'door', x: 11, y: 8 },
    { id: 2, type: 'door', x: 26, y: 9 },
    { id: 20, type: 'chest', x: 12, y: 10 },
  ],
};

/** 24x32 - three levels of a parking structure, ramps at alternating ends; two gate controls to cut. */
export const PARKING_DECK: MapDef = {
  name: 'Vance Street Parking Deck',
  rows: (() => {
    const W = 24, H = 32;
    const g = field(W, H);
    hRun(g, 0, 0, W, '#'); hRun(g, 0, H - 1, W, '#'); vRun(g, 0, 0, H, '#'); vRun(g, W - 1, 0, H, '#');
    hRun(g, 1, 10, W - 2, '#'); for (const x of [3, 4, 19, 20]) put(g, x, 10, '.');   // ramps at both ends
    hRun(g, 1, 21, W - 2, '#'); for (const x of [11, 12]) put(g, x, 21, '.');         // one ramp in the middle
    for (const x of [6, 12, 17]) for (const y of [4, 7, 14, 17, 25, 28]) put(g, x, y, 'h'); // pillars
    coverPairs(g, 5, [8, 14]); coverPairs(g, 15, [2, 20]); coverPairs(g, 26, [3, 19]);
    pts(g, [[9, 12], [15, 23]], 'b');
    return toRows(g);
  })(),
  spawns: {
    player: [['soldier', 10, 30], ['assault', 12, 30], ['medic', 14, 30], ['tank', 11, 29], ['sniper', 13, 29]],
    enemy: [['sniper', 4, 2], ['soldier', 12, 6], ['assault', 18, 14], ['soldier', 6, 24], ['assault', 21, 27]],
  },
  searchPoints: {
    player: [[12, 16], [20, 4], [3, 16]],
    enemy: [[12, 16], [12, 26], [4, 4]],
  },
  startTimeOfDay: 'midnight',
  startWeather: 'clear',
  objective: { type: 'sabotage', interactableIds: [10, 11] },
  pickups: [
    { id: 1, type: 'ammo', x: 8, y: 27 },
    { id: 2, type: 'medkit', x: 15, y: 13 },
    { id: 3, type: 'ammo', x: 3, y: 6 },
  ],
  interactables: [
    { id: 10, type: 'switch', x: 21, y: 2 },   // top-level gate control
    { id: 11, type: 'switch', x: 2, y: 18 },   // mid-level gate control
    { id: 20, type: 'chest', x: 21, y: 12 },
  ],
};
