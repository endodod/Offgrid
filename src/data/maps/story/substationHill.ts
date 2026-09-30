import { border, building, coverPairs, field, hRun, pts, put, rect, tiles, toRows, vRun } from '../compose';
import type { MapDef } from '../../trainingGrounds';

/**
 * Act 2, Substation Hill: the Wardens hold the high ground and the switchgear for half of Ashport - and they
 * are maintaining it, not stripping it. What the district teaches:
 *   1. The Switchback     (reach)            - uphill: every terrace is somebody else's high ground.
 *   2. Cold Feed          (defend)           - the first time the enemy has an objective, and it is yours.
 *   3. The Maintenance Log (retrieve)        - a hall full of switchgear, two things to take, a long way out.
 *   4. Breaker Yard       (sabotage x3)      - pens with one way in each, in fog.
 *   5. Hilltop Control    (eliminateTargets) - the superintendent and her deputy, and a garrison that is awake.
 */

// ------------------------------------------------------------------------------------------------ 1
/**
 * The Switchback - `reach` x3. 26x44 (tall), morning, cloudy.
 *
 * The only road up the hill is a switchback: five terraces, each a wall with a two-wide gap at alternating
 * ends, so the squad crosses every terrace side to side under the guns of the one above. The substation gate
 * is the zone at the top.
 *
 * Teaches: height, without a height system. Whoever is on the next terrace sees you coming the whole width
 * of the map; the gaps alternate so there is no straight run. Campers hold each terrace; the sniper at the top
 * sees half the hill.
 */
function switchback(): string[] {
  const g = field(26, 44);
  border(g);
  // terraces: a wall across with a two-wide gap, alternating east/west
  const terraces: [number, 'e' | 'w'][] = [[36, 'e'], [29, 'w'], [22, 'e'], [15, 'w'], [8, 'e']];
  for (const [y, side] of terraces) {
    hRun(g, 1, y, 24, '#');
    const gx = side === 'e' ? 21 : 3;
    put(g, gx, y, '.'); put(g, gx + 1, y, '.');
    // a second, narrower gap - a drainage culvert - at the other end, so no terrace is a single chokepoint
    const cx = side === 'e' ? 5 : 19;
    put(g, cx, y, '.'); put(g, cx + 1, y, '.');
  }
  // cover on each terrace: guard rails and boulders, in lines
  for (const y of [39, 32, 25, 18, 11]) {
    coverPairs(g, y, [4, 11, 18]);
    pts(g, [[8, y + 2], [15, y + 2]], 'l');
  }
  pts(g, [[12, 34], [13, 34], [12, 20], [13, 20], [12, 6], [13, 6]], 'h');
  pts(g, [[2, 41], [23, 41], [2, 27], [23, 13]], 'b');
  // the gate at the top
  rect(g, 1, 1, 24, 1, '#');
  for (const [x, y] of tiles(11, 3, 4, 1)) put(g, x, y, 'O');
  pts(g, [[9, 4], [16, 4]], 'l');
  return toRows(g);
}

export const SWITCHBACK: MapDef = {
  name: 'Hill Road',
  rows: switchback(),
  spawns: {
    player: [['soldier', 11, 41], ['assault', 13, 41], ['medic', 12, 42], ['tank', 10, 42], ['sniper', 14, 42]],
    enemy: [
      ['soldier', 8, 33, 'defend'], ['assault', 17, 27], ['soldier', 16, 19, 'defend'],
      ['sniper', 12, 5, 'defend'], ['assault', 8, 12, 'defend'],
    ],
  },
  searchPoints: {
    player: [[21, 35], [3, 28], [21, 21], [3, 14], [21, 7], [12, 4]],
    enemy: [[12, 33], [12, 26], [12, 19], [12, 12]],
  },
  startTimeOfDay: 'morning',
  startWeather: 'cloudy',
  enemyProfile: 'standard',
  objective: { type: 'reach', unitsRequired: 3 },
  interactables: [
    { id: 20, type: 'chest', x: 23, y: 38 },
    { id: 21, type: 'chest', x: 2, y: 17 },
    { id: 22, type: 'chest', x: 23, y: 2 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 20, y: 38 },
    { id: 2, type: 'medkit', x: 4, y: 31 },
    { id: 3, type: 'ammo', x: 21, y: 24 },
    { id: 4, type: 'medkit', x: 4, y: 17 },
    { id: 5, type: 'gadget', x: 20, y: 10 },
    { id: 6, type: 'ammo', x: 6, y: 4 },
  ],
};

// ------------------------------------------------------------------------------------------------ 2
/**
 * Cold Feed - `defend` x5. 32x28, midnight, clear.
 *
 * The first thing on the hill the squad can take is the transformer that feeds the Riverside clinic line -
 * and the Wardens want it back. They will not destroy it (they never destroy anything); they will walk up to
 * it and switch it off. If one of them reaches the transformer, the clinic goes dark and the mission is lost.
 *
 * Teaches: the enemy has an objective, and it is yours. The attackers know where the transformer is from the
 * first turn and come for it (several on the `rush` profile), so killing them matters less than standing in
 * their way. The yard fence has four two-wide gates; the transformer pad has its own low wall.
 */
function coldFeed(): string[] {
  const g = field(32, 28);
  border(g);
  // the yard fence, with a gate on each side
  rect(g, 7, 6, 18, 1, '#'); rect(g, 7, 21, 18, 1, '#'); rect(g, 7, 6, 1, 16, '#'); rect(g, 24, 6, 1, 16, '#');
  for (const [x, y] of [[15, 6], [16, 6], [15, 21], [16, 21], [7, 13], [7, 14], [24, 13], [24, 14]] as [number, number][]) put(g, x, y, '.');
  // the transformer pad
  for (const [x, y] of tiles(15, 13, 2, 2)) put(g, x, y, 'O');
  pts(g, [[13, 12], [18, 12], [13, 15], [18, 15]], 'l');
  hRun(g, 14, 11, 4, 'h'); hRun(g, 14, 16, 4, 'h');
  // yard furniture
  pts(g, [[10, 9], [21, 9], [10, 18], [21, 18]], 'h');
  pts(g, [[11, 13], [20, 14]], 'l');
  // outside the fence
  hRun(g, 3, 3, 3, 'h'); hRun(g, 26, 3, 3, 'h'); hRun(g, 3, 24, 3, 'h'); hRun(g, 26, 24, 3, 'h');
  pts(g, [[15, 3], [16, 24], [3, 13], [28, 14]], 'l');
  pts(g, [[1, 1], [30, 1], [1, 26], [30, 26]], 'b');
  return toRows(g);
}

export const COLD_FEED: MapDef = {
  name: 'Feeder Yard Seven',
  rows: coldFeed(),
  spawns: {
    player: [['soldier', 13, 13], ['assault', 18, 14], ['medic', 14, 17], ['tank', 17, 10], ['sniper', 12, 17]],
    enemy: [['assault', 15, 1, 'rush'], ['soldier', 29, 9], ['sniper', 2, 20], ['assault', 29, 22, 'rush']],
  },
  searchPoints: {
    player: [[15, 8], [9, 13], [22, 14], [16, 19]],
    enemy: [[15, 12], [16, 15], [15, 8], [22, 14]],
  },
  startTimeOfDay: 'midnight',
  startWeather: 'clear',
  enemyProfile: 'standard',
  objective: { type: 'defend', rounds: 5, label: 'the transformer' },
  reinforcements: [
    { turn: 2, spawns: [['assault', 1, 13, 'rush'], ['soldier', 30, 13]] },
    { turn: 4, spawns: [['assault', 16, 26, 'rush'], ['tank', 15, 1], ['soldier', 30, 2]] },
  ],
  interactables: [{ id: 20, type: 'chest', x: 30, y: 26 }],
  pickups: [
    { id: 1, type: 'ammo', x: 12, y: 10 },
    { id: 2, type: 'ammo', x: 19, y: 17 },
    { id: 3, type: 'medkit', x: 19, y: 10 },
    { id: 4, type: 'medkit', x: 12, y: 16 },
    { id: 5, type: 'gadget', x: 9, y: 19 },
  ],
};

// ------------------------------------------------------------------------------------------------ 3
/**
 * The Maintenance Log - `retrieve`. 44x26, afternoon, rain.
 *
 * The switchgear hall: six bays of breakers in single rows, a control booth at the north end and a records
 * room at the south. The maintenance log is in the booth, the work orders in the records room, and the way
 * out is the loading door at the far east end.
 *
 * Teaches: the objective pulls you apart. The two intel points are at opposite ends of the hall's width;
 * splitting is fast and dangerous, staying together is slow and safe. The breaker rows run north-south, so
 * sightlines along the hall are long and across it short.
 */
function maintenanceLog(): string[] {
  const g = field(44, 26);
  border(g);
  // the hall shell, entered from the west through two doors
  building(g, 6, 2, 30, 22, [[6, 7], [6, 8], [6, 17], [6, 18], [35, 12], [35, 13]]);
  // breaker bays: single north-south rows, each with a gap in the middle
  for (const x of [11, 16, 21, 26, 31]) { vRun(g, x, 5, 6, 'h'); vRun(g, x, 15, 6, 'h'); }
  // the control booth (north) and records room (south)
  building(g, 13, 2, 8, 4, [[16, 5], [17, 5]]);
  building(g, 23, 20, 8, 4, [[26, 20], [27, 20]]);
  pts(g, [[9, 12], [9, 13], [29, 12], [14, 12], [24, 13]], 'l');
  // west yard and east loading bay
  pts(g, [[3, 5], [3, 20], [2, 12]], 'l');
  hRun(g, 37, 6, 4, 'h'); hRun(g, 37, 19, 4, 'h');
  for (const [x, y] of tiles(41, 11, 2, 4)) put(g, x, y, 'O');
  return toRows(g);
}

export const MAINTENANCE_LOG: MapDef = {
  name: 'Switchgear Hall',
  rows: maintenanceLog(),
  spawns: {
    player: [['soldier', 2, 13], ['assault', 3, 13], ['medic', 2, 15], ['tank', 2, 10], ['sniper', 3, 10]],
    enemy: [
      ['soldier', 18, 3, 'defend'], ['sniper', 28, 22, 'defend'], ['assault', 18, 12], ['soldier', 28, 8],
      ['tank', 38, 12, 'defend'],
    ],
  },
  searchPoints: {
    player: [[9, 8], [17, 4], [27, 21], [33, 12], [40, 12]],
    enemy: [[8, 12], [20, 12], [30, 12], [3, 12]],
  },
  startTimeOfDay: 'afternoon',
  startWeather: 'rain',
  enemyProfile: 'standard',
  objective: { type: 'retrieve', interactableIds: [10, 11], unitsRequired: 3, label: 'the maintenance log and the work orders' },
  reinforcements: [{ turn: 7, spawns: [['assault', 42, 2], ['soldier', 42, 23]] }],
  interactables: [
    { id: 1, type: 'door', x: 6, y: 7, active: true },
    { id: 2, type: 'door', x: 6, y: 8, active: true },
    { id: 3, type: 'door', x: 6, y: 17 },
    { id: 4, type: 'door', x: 6, y: 18 },
    { id: 10, type: 'switch', x: 15, y: 3 }, // the log
    { id: 11, type: 'switch', x: 29, y: 22 }, // the work orders
    { id: 20, type: 'chest', x: 19, y: 3 },
    { id: 21, type: 'chest', x: 24, y: 22 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 8, y: 4 },
    { id: 2, type: 'medkit', x: 8, y: 21 },
    { id: 3, type: 'ammo', x: 19, y: 12 },
    { id: 4, type: 'medkit', x: 24, y: 12 },
    { id: 5, type: 'gadget', x: 33, y: 5 },
    { id: 6, type: 'ammo', x: 33, y: 20 },
    { id: 7, type: 'armor', x: 13, y: 12, itemId: 'ceramicPlate' },
  ],
};

// ------------------------------------------------------------------------------------------------ 4
/**
 * Breaker Yard - `sabotage` x3. 40x32, morning fog.
 *
 * The Wardens' own searchlights and fence alarms run off three isolators in the breaker yard, each at the back
 * of a transformer pen. Throw all three and the hill goes dark for the push on the control building.
 *
 * Teaches: three pens, three different ways in. The west pen is open along one side; the north pen has a
 * door; the east pen is behind a fence the master switch in the relay hut lowers (Pumphouse's lesson, turned
 * round: here the switch opens the only route rather than a shortcut). Fog, so the pens are found, not seen.
 */
function breakerYard(): string[] {
  const g = field(40, 32);
  border(g);
  // west pen: open along its east side
  rect(g, 4, 18, 9, 1, '#'); rect(g, 4, 27, 9, 1, '#'); rect(g, 4, 18, 1, 10, '#');
  vRun(g, 8, 20, 3, 'h'); vRun(g, 8, 24, 2, 'h');
  // north pen: walled, a two-wide door on its south side
  building(g, 16, 2, 10, 8, [[20, 9], [21, 9]]);
  vRun(g, 19, 4, 3, 'h'); vRun(g, 23, 4, 3, 'h');
  // east pen: walled, its west side is two fence gates the relay hut opens
  building(g, 29, 16, 9, 11, [[29, 20], [29, 21]]);
  hRun(g, 32, 19, 3, 'h'); hRun(g, 32, 23, 3, 'h');
  // the relay hut, mid-yard
  building(g, 17, 20, 6, 5, [[19, 20], [20, 20]]);
  // yard cover: single rows of cable drums and transformers
  hRun(g, 6, 7, 5, 'h'); hRun(g, 29, 7, 5, 'h'); hRun(g, 14, 14, 4, 'h'); hRun(g, 23, 14, 4, 'h');
  pts(g, [[4, 12], [12, 12], [27, 11], [36, 12], [15, 28], [25, 28], [26, 18]], 'l');
  pts(g, [[1, 30], [2, 30], [37, 1], [38, 1], [14, 5], [27, 5]], 'b');
  return toRows(g);
}

export const BREAKER_YARD: MapDef = {
  name: 'Breaker Yard',
  rows: breakerYard(),
  spawns: {
    player: [['soldier', 18, 29], ['assault', 20, 29], ['medic', 19, 30], ['tank', 17, 30], ['sniper', 21, 30]],
    enemy: [
      ['soldier', 6, 23, 'defend'], ['sniper', 21, 4, 'defend'], ['assault', 33, 21, 'defend'], ['soldier', 30, 10],
      ['assault', 10, 10],
    ],
  },
  searchPoints: {
    player: [[10, 22], [20, 11], [27, 20], [33, 21], [20, 22]],
    enemy: [[20, 16], [10, 14], [30, 14], [20, 27]],
  },
  startTimeOfDay: 'morning',
  startWeather: 'fog',
  enemyProfile: 'standard',
  objective: { type: 'sabotage', interactableIds: [10, 11, 12] },
  interactables: [
    { id: 1, type: 'door', x: 20, y: 9 },
    { id: 2, type: 'door', x: 21, y: 9 },
    { id: 3, type: 'door', x: 29, y: 20 },
    { id: 4, type: 'door', x: 29, y: 21 },
    { id: 5, type: 'door', x: 19, y: 20, active: true },
    { id: 6, type: 'door', x: 20, y: 20, active: true },
    { id: 10, type: 'switch', x: 5, y: 22 },  // west isolator
    { id: 11, type: 'switch', x: 21, y: 3 },  // north isolator
    { id: 12, type: 'switch', x: 36, y: 21 }, // east isolator
    { id: 13, type: 'switch', x: 20, y: 22, links: [3, 4] }, // relay hut: the east pen's fence gates
    { id: 20, type: 'chest', x: 5, y: 26 },
    { id: 21, type: 'chest', x: 36, y: 17 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 13, y: 22 },
    { id: 2, type: 'medkit', x: 10, y: 16 },
    { id: 3, type: 'ammo', x: 25, y: 11 },
    { id: 4, type: 'medkit', x: 27, y: 24 },
    { id: 5, type: 'gadget', x: 15, y: 22 },
    { id: 6, type: 'ammo', x: 34, y: 4 },
    { id: 7, type: 'equipment', x: 3, y: 3, itemId: 'flashlight' },
  ],
};

// ------------------------------------------------------------------------------------------------ 5
/**
 * Hilltop Control - `eliminateTargets` x2. 48x34, afternoon, cloudy. The district finale.
 *
 * The control building on the crown of the hill, where Superintendent Rhea Hale keeps the grid alive and off.
 * She and her deputy, the engineer Colm Dray, are the only two people on the hill who know the switching
 * orders; both are in the building, at opposite ends, and neither comes out (10j: sealed doors).
 *
 * Teaches: a finale with two ends. The building has a west wing (Hale, a tank, camped in the switch room) and
 * an east wing (Dray, a sniper, in the gallery); the courtyard between them is where the garrison lives. A
 * relief column comes up the hill road (south) on round 7.
 */
function hilltopControl(): string[] {
  const g = field(48, 34);
  border(g);
  // the control building: two wings joined by a north corridor, a courtyard between
  building(g, 5, 3, 14, 14, [[11, 16], [12, 16]]);  // west wing, door to the courtyard
  building(g, 29, 3, 14, 14, [[35, 16], [36, 16]]); // east wing
  building(g, 18, 3, 12, 5, [[18, 5], [29, 5], [23, 7], [24, 7]]); // the corridor block
  // interior: Hale's switch room (west) and Dray's gallery (east)
  vRun(g, 11, 4, 5, 'h'); vRun(g, 37, 4, 5, 'h');
  pts(g, [[8, 12], [15, 12], [32, 12], [39, 12]], 'l');
  // the courtyard
  hRun(g, 20, 12, 3, 'h'); hRun(g, 26, 12, 3, 'h');
  pts(g, [[23, 16], [24, 16], [21, 19], [27, 19]], 'l');
  // the outer wall and the hill road
  hRun(g, 1, 22, 46, '#');
  for (const x of [8, 9, 23, 24, 39, 40]) put(g, x, 22, '.');
  hRun(g, 5, 26, 4, 'h'); hRun(g, 20, 27, 8, 'h'); hRun(g, 39, 26, 4, 'h');
  pts(g, [[13, 25], [14, 25], [33, 25], [34, 25], [3, 29], [44, 29]], 'l');
  pts(g, [[1, 31], [2, 31], [45, 31], [46, 31]], 'b');
  return toRows(g);
}

export const HILLTOP_CONTROL: MapDef = {
  name: 'Hilltop Control',
  rows: hilltopControl(),
  spawns: {
    player: [['soldier', 22, 30], ['assault', 24, 30], ['medic', 23, 31], ['tank', 21, 31], ['sniper', 25, 31]],
    enemy: [
      ['tank', 8, 6, 'defend'],    // Superintendent Hale
      ['sniper', 39, 6, 'defend'], // Engineer Dray
      ['soldier', 23, 14], ['assault', 25, 18], ['soldier', 10, 24, 'defend'],
    ],
  },
  searchPoints: {
    player: [[23, 17], [11, 14], [36, 14], [8, 7], [39, 7]],
    enemy: [[23, 17], [23, 25], [9, 25], [39, 25]],
  },
  startTimeOfDay: 'afternoon',
  startWeather: 'cloudy',
  enemyProfile: 'standard',
  objective: { type: 'eliminateTargets', enemySpawnIndices: [0, 1], label: 'Superintendent Hale and Engineer Dray' },
  aiOpensDoors: false,
  reinforcements: [{ turn: 7, spawns: [['assault', 2, 32], ['soldier', 45, 32]] }],
  interactables: [
    { id: 1, type: 'door', x: 11, y: 16 },
    { id: 2, type: 'door', x: 12, y: 16 },
    { id: 3, type: 'door', x: 35, y: 16 },
    { id: 4, type: 'door', x: 36, y: 16 },
    { id: 5, type: 'door', x: 23, y: 7, active: true },
    { id: 6, type: 'door', x: 24, y: 7, active: true },
    { id: 20, type: 'chest', x: 6, y: 15 },
    { id: 21, type: 'chest', x: 41, y: 15 },
    { id: 22, type: 'chest', x: 27, y: 5 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 12, y: 28 },
    { id: 2, type: 'medkit', x: 35, y: 28 },
    { id: 3, type: 'ammo', x: 22, y: 20 },
    { id: 4, type: 'medkit', x: 26, y: 20 },
    { id: 5, type: 'gadget', x: 23, y: 11 },
    { id: 6, type: 'ammo', x: 16, y: 14 },
    { id: 7, type: 'ammo', x: 31, y: 14 },
  ],
};
