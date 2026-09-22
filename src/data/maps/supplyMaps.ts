import type { MapDef } from '../trainingGrounds';

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
    enemy: [['assault', 10, 8], ['soldier', 18, 10], ['sniper', 20, 6], ['assault', 6, 13], ['soldier', 14, 13]],
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
