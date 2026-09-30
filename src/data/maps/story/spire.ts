import { border, building, field, hRun, pts, put, rect, tiles, toRows, vRun } from '../compose';
import type { MapDef } from '../../trainingGrounds';

/**
 * Act 3, the Spire: Halcyon's old headquarters, and at the top of it the one room every switch in Ashport still
 * answers to. The last district, and the game's end. What it asks:
 *   1. Service Entrance (reach)        - in through the loading dock, under drones.
 *   2. Floor Forty      (defend)       - keep them off Abel while he opens the lift.
 *   3. The Cooling Plant (sabotage x3) - force Grid Control onto manual, in steam.
 *   4. Lockdown         (survive)      - the building fights back: six rounds until the fire doors cycle.
 *   5. Grid Control     (hold)         - take the room, hold it, and give it away.
 */

// ------------------------------------------------------------------------------------------------ 1
/**
 * Service Entrance - `reach` x3. 46x22, midnight, clear.
 *
 * The Spire's underground loading dock: truck bays along the north wall, a ramp down from the street in the
 * west, and the service lift at the east end, which is the zone. Two drones sweep the bays; a sentry covers
 * the lift lobby.
 *
 * Teaches: the drones' long sight at night. The squad sees four tiles in the dark; a drone sees nine and
 * brings everything else with it. The trucks are cover in single rows, the lift lobby a walled box with two
 * ways in.
 */
function serviceEntrance(): string[] {
  const g = field(46, 22);
  border(g);
  // truck bays: parked trailers, single east-west rows
  for (const x of [8, 17, 26]) { hRun(g, x, 4, 6, 'h'); hRun(g, x, 9, 6, 'h'); }
  for (const x of [12, 21, 30]) { hRun(g, x, 14, 5, 'h'); }
  pts(g, [[6, 12], [7, 12], [16, 17], [17, 17], [25, 11], [26, 11], [34, 17], [35, 17]], 'l');
  // the ramp in (west): a walled lane
  hRun(g, 1, 7, 4, '#'); hRun(g, 1, 16, 4, '#');
  // the lift lobby (east)
  building(g, 37, 5, 8, 12, [[37, 9], [37, 10], [40, 16], [41, 16]]);
  for (const [x, y] of tiles(42, 9, 2, 3)) put(g, x, y, 'O');
  pts(g, [[39, 7], [39, 13]], 'l');
  pts(g, [[1, 1], [2, 1], [1, 20], [2, 20]], 'b');
  return toRows(g);
}

export const SERVICE_ENTRANCE: MapDef = {
  name: 'Spire Loading Dock',
  rows: serviceEntrance(),
  spawns: {
    player: [['soldier', 2, 11], ['assault', 3, 11], ['medic', 2, 13], ['tank', 2, 9], ['sniper', 3, 13]],
    enemy: [['drone', 15, 7], ['drone', 24, 16], ['sentry', 43, 13], ['soldier', 32, 7, 'defend'], ['assault', 28, 18]],
  },
  searchPoints: {
    player: [[12, 11], [23, 7], [32, 12], [40, 10]],
    enemy: [[12, 11], [23, 11], [5, 11], [33, 12]],
  },
  startTimeOfDay: 'midnight',
  startWeather: 'clear',
  enemyProfile: 'standard',
  objective: { type: 'reach', unitsRequired: 3 },
  reinforcements: [{ turn: 5, spawns: [['drone', 44, 1], ['drone', 44, 20]] }],
  interactables: [
    { id: 1, type: 'door', x: 37, y: 9, active: true },
    { id: 2, type: 'door', x: 37, y: 10, active: true },
    { id: 3, type: 'door', x: 40, y: 16 },
    { id: 4, type: 'door', x: 41, y: 16 },
    { id: 20, type: 'chest', x: 14, y: 2 },
    { id: 21, type: 'chest', x: 32, y: 20 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 10, y: 7 },
    { id: 2, type: 'medkit', x: 19, y: 12 },
    { id: 3, type: 'ammo', x: 29, y: 7 },
    { id: 4, type: 'medkit', x: 34, y: 12 },
    { id: 5, type: 'gadget', x: 22, y: 19 },
  ],
};

// ------------------------------------------------------------------------------------------------ 2
/**
 * Floor Forty - `defend` x5. 34x30, midday, clear.
 *
 * The express lift to Grid Control stops at forty and goes no further without an engineer's override. Abel
 * Cortez - who climbed out of a basement in Lights Out, and has been the squad's hands ever since - is on the
 * lift panel. The zone is the panel; Halcyon security comes up both stairwells and across the sky bridge.
 *
 * Teaches: the defend, with no fence. An open-plan floor, three ways in, and the attackers on `rush` headed
 * for the panel whatever you do. Kill them or stand in the way - an attacker still on the panel when their
 * turn comes round takes it.
 */
function floorForty(): string[] {
  const g = field(34, 30);
  border(g);
  // the lift core in the middle-west, the panel on its east face
  rect(g, 8, 11, 5, 8, '#');
  // the zone is the panel and the floor in front of it: twelve tiles, more than a squad can stand on
  for (const [x, y] of tiles(13, 13, 3, 4)) put(g, x, y, 'O');
  pts(g, [[17, 12], [17, 17], [18, 14], [18, 15]], 'l');
  // stairwells: north-east and south-east, each a walled box with a two-wide door facing the floor
  building(g, 25, 1, 8, 7, [[25, 4], [25, 5]]);
  building(g, 25, 22, 8, 7, [[25, 24], [25, 25]]);
  // the sky bridge: a corridor coming in from the east edge at mid-height
  hRun(g, 26, 12, 7, '#'); hRun(g, 26, 17, 7, '#');
  // the floor: desks and planters in rows
  for (const y of [5, 24]) { hRun(g, 6, y, 4, 'l'); hRun(g, 14, y, 4, 'l'); }
  for (const x of [20, 22]) { vRun(g, x, 9, 3, 'h'); vRun(g, x, 18, 3, 'h'); }
  pts(g, [[4, 14], [4, 15], [18, 2], [18, 27]], 'h');
  pts(g, [[2, 2], [2, 27], [30, 14], [30, 15]], 'b');
  return toRows(g);
}

export const FLOOR_FORTY: MapDef = {
  name: 'Spire, Floor 40',
  rows: floorForty(),
  spawns: {
    player: [['soldier', 16, 12], ['assault', 16, 17], ['medic', 11, 20], ['tank', 17, 14], ['sniper', 10, 9]],
    enemy: [['assault', 29, 4, 'rush'], ['soldier', 29, 25, 'rush'], ['drone', 31, 14], ['sniper', 28, 3, 'defend']],
  },
  searchPoints: {
    player: [[17, 15], [22, 6], [22, 23], [26, 14]],
    enemy: [[16, 14], [16, 15], [22, 6], [22, 23]],
  },
  startTimeOfDay: 'midday',
  startWeather: 'clear',
  enemyProfile: 'standard',
  objective: { type: 'defend', rounds: 5, label: 'the lift panel' },
  reinforcements: [
    { turn: 2, spawns: [['assault', 32, 14, 'rush'], ['soldier', 32, 15]] },
    { turn: 4, spawns: [['drone', 29, 5], ['assault', 29, 24, 'rush'], ['tank', 32, 13]] },
  ],
  interactables: [{ id: 20, type: 'chest', x: 2, y: 14 }],
  pickups: [
    { id: 1, type: 'ammo', x: 12, y: 9 },
    { id: 2, type: 'ammo', x: 12, y: 21 },
    { id: 3, type: 'medkit', x: 7, y: 9 },
    { id: 4, type: 'medkit', x: 7, y: 20 },
    { id: 5, type: 'gadget', x: 17, y: 11 },
  ],
};

// ------------------------------------------------------------------------------------------------ 3
/**
 * The Cooling Plant - `sabotage` x3. 40x34, afternoon, fog (steam).
 *
 * Grid Control can be locked from outside - but not if it thinks it is overheating. Close three coolant valves
 * in the plant on the Spire's mechanical floor and the room fails over to manual: whoever is inside has the
 * switches, and nobody outside can take them back.
 *
 * Teaches: pipes. The plant is a maze of pipe runs (walls in single lines with gaps, never slabs) and the
 * steam is fog: the squad walks into sentries it did not see. The valve rooms are at three corners.
 */
function coolingPlant(): string[] {
  const g = field(40, 34);
  border(g);
  // pipe runs: long walls with staggered gaps
  for (const [y, gaps] of [[8, [6, 7, 26, 27]], [14, [15, 16, 33, 34]], [20, [4, 5, 22, 23]], [26, [12, 13, 30, 31]]] as [number, number[]][]) {
    hRun(g, 1, y, 38, '#');
    for (const x of gaps) put(g, x, y, '.');
  }
  // chillers: high cover blocks in single rows between the runs
  for (const [x, y] of [[10, 11], [24, 11], [8, 17], [30, 17], [16, 23], [28, 23], [18, 5], [20, 29]] as [number, number][]) hRun(g, x, y, 3, 'h');
  // valve rooms: north-west, north-east, south-east
  building(g, 1, 1, 7, 6, [[4, 6], [5, 6]]);
  building(g, 31, 1, 8, 6, [[33, 6], [34, 6]]);
  building(g, 30, 27, 9, 6, [[30, 29], [30, 30]]);
  pts(g, [[12, 3], [25, 3], [4, 11], [36, 11], [11, 17], [22, 17], [8, 29], [15, 31]], 'l');
  return toRows(g);
}

export const COOLING_PLANT: MapDef = {
  name: 'Spire Mechanical Floor',
  rows: coolingPlant(),
  spawns: {
    player: [['soldier', 3, 29], ['assault', 4, 29], ['medic', 3, 31], ['tank', 2, 30], ['sniper', 5, 31]],
    enemy: [
      ['sentry', 18, 17], ['drone', 10, 23], ['sentry', 34, 4], ['soldier', 3, 3, 'defend'], ['assault', 34, 29, 'defend'],
      ['drone', 26, 12],
    ],
  },
  searchPoints: {
    player: [[5, 23], [14, 17], [5, 10], [20, 11], [34, 10], [34, 23]],
    enemy: [[14, 17], [5, 23], [26, 23], [20, 11]],
  },
  startTimeOfDay: 'afternoon',
  startWeather: 'fog',
  enemyProfile: 'standard',
  objective: { type: 'sabotage', interactableIds: [10, 11, 12] },
  interactables: [
    { id: 1, type: 'door', x: 4, y: 6 },
    { id: 2, type: 'door', x: 5, y: 6 },
    { id: 3, type: 'door', x: 30, y: 29 },
    { id: 4, type: 'door', x: 30, y: 30 },
    { id: 10, type: 'switch', x: 2, y: 2 },   // north-west valve
    { id: 11, type: 'switch', x: 37, y: 2 },  // north-east valve
    { id: 12, type: 'switch', x: 37, y: 31 }, // south-east valve
    { id: 20, type: 'chest', x: 21, y: 31 },
    { id: 21, type: 'chest', x: 38, y: 16 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 10, y: 29 },
    { id: 2, type: 'medkit', x: 25, y: 24 },
    { id: 3, type: 'ammo', x: 14, y: 11 },
    { id: 4, type: 'medkit', x: 30, y: 12 },
    { id: 5, type: 'ammo', x: 36, y: 22 },
    { id: 6, type: 'gadget', x: 20, y: 2 },
  ],
};

// ------------------------------------------------------------------------------------------------ 4
/**
 * Lockdown - `survive` x6. 32x32, midnight, clear.
 *
 * Halcyon's building system has noticed the plant, and it does what it was built to do: it seals the floor and
 * sends everything it has. The fire doors cycle in six rounds. Until then the squad is in the Spire's atrium
 * gallery - a ring corridor around a void, with nowhere to go and drones coming from every service hatch.
 *
 * Teaches: the last test of positioning before the finale. The gallery is a loop; there is no back wall to
 * put people against, only corners.
 */
function lockdown(): string[] {
  const g = field(32, 32);
  border(g);
  // the atrium void in the middle: a wall block the gallery runs around
  rect(g, 10, 10, 12, 12, '#');
  // gallery rooms off the outer wall, each with a two-wide opening
  building(g, 1, 1, 8, 8, [[8, 4], [8, 5], [4, 8], [5, 8]]);
  building(g, 23, 1, 8, 8, [[23, 4], [23, 5], [26, 8], [27, 8]]);
  building(g, 1, 23, 8, 8, [[8, 26], [8, 27], [4, 23], [5, 23]]);
  building(g, 23, 23, 8, 8, [[23, 26], [23, 27], [26, 23], [27, 23]]);
  // gallery furniture: benches and planters in single rows
  for (const x of [12, 18]) { hRun(g, x, 8, 2, 'l'); hRun(g, x, 23, 2, 'l'); }
  for (const y of [12, 18]) { vRun(g, 8, y, 2, 'l'); vRun(g, 23, y, 2, 'l'); }
  pts(g, [[15, 3], [16, 3], [15, 28], [16, 28], [3, 15], [3, 16], [28, 15], [28, 16]], 'h');
  return toRows(g);
}

export const LOCKDOWN: MapDef = {
  name: 'Spire Atrium Gallery',
  rows: lockdown(),
  spawns: {
    player: [['soldier', 14, 6], ['assault', 17, 6], ['medic', 15, 5], ['tank', 16, 7], ['sniper', 15, 7]],
    enemy: [['drone', 4, 27], ['drone', 27, 27], ['sentry', 27, 4], ['soldier', 15, 27]],
  },
  searchPoints: {
    player: [[15, 6], [6, 15], [25, 15], [15, 25]],
    enemy: [[15, 6], [6, 15], [25, 15], [15, 25]],
  },
  startTimeOfDay: 'midnight',
  startWeather: 'clear',
  enemyProfile: 'standard',
  objective: { type: 'survive', rounds: 6 },
  reinforcements: [
    { turn: 2, spawns: [['drone', 2, 2], ['drone', 29, 29]] },
    { turn: 4, spawns: [['assault', 2, 29], ['drone', 29, 2], ['soldier', 2, 15]] },
  ],
  interactables: [{ id: 20, type: 'chest', x: 2, y: 2 }],
  pickups: [
    { id: 1, type: 'ammo', x: 12, y: 5 },
    { id: 2, type: 'ammo', x: 19, y: 5 },
    { id: 3, type: 'medkit', x: 6, y: 13 },
    { id: 4, type: 'medkit', x: 25, y: 18 },
    { id: 5, type: 'gadget', x: 15, y: 25 },
    { id: 6, type: 'ammo', x: 25, y: 12 },
  ],
};

// ------------------------------------------------------------------------------------------------ 5
/**
 * Grid Control - `hold` x4. 44x36, afternoon, clear. The last mission.
 *
 * The room at the top of the Spire: a control floor under a glass roof, the master console on a dais at the
 * east end, and every remaining Halcyon asset in the building converging on it. Take the console and hold it
 * for four rounds while the manual failover completes - two waves on the way (rounds 4 and 5).
 *
 * Teaches: nothing new, on purpose. Every earlier map is in here somewhere: pick your entry (three ways onto
 * the floor), hold a line (the dais has a low wall and two gaps), sentries (two), drones, a sealed door you
 * open yourself, and a clock.
 */
function gridControl(): string[] {
  const g = field(44, 36);
  border(g);
  // the approach: a lobby at the west end and a wall with three openings onto the control floor
  vRun(g, 12, 1, 34, '#');
  for (const y of [5, 6, 17, 18, 29, 30]) put(g, 12, y, '.');
  hRun(g, 3, 10, 5, 'h'); hRun(g, 3, 25, 5, 'h'); pts(g, [[8, 17], [8, 18]], 'l');
  // the control floor: operator desks in single rows
  for (const x of [16, 21, 26]) { vRun(g, x, 5, 5, 'l'); vRun(g, x, 26, 5, 'l'); }
  for (const x of [18, 24]) vRun(g, x, 14, 8, 'h');
  // the dais: a low wall around the master console with two gaps
  rect(g, 31, 12, 1, 12, 'l'); rect(g, 31, 12, 8, 1, 'l'); rect(g, 31, 23, 8, 1, 'l');
  for (const y of [15, 20]) put(g, 31, y, '.');
  put(g, 36, 17, 'O');
  pts(g, [[34, 15], [34, 20]], 'h');
  // the east plant rooms, where the waves come in
  building(g, 40, 2, 3, 8, [[40, 5]]);
  building(g, 40, 26, 3, 8, [[40, 30]]);
  pts(g, [[29, 3], [30, 3], [29, 32], [30, 32]], 'b');
  return toRows(g);
}

export const GRID_CONTROL: MapDef = {
  name: 'Grid Control',
  rows: gridControl(),
  spawns: {
    player: [['soldier', 4, 17], ['assault', 5, 17], ['medic', 4, 19], ['tank', 4, 15], ['sniper', 5, 19]],
    enemy: [
      ['sentry', 37, 13], ['sentry', 37, 22], ['soldier', 28, 17, 'defend'], ['drone', 20, 8],
    ],
  },
  searchPoints: {
    player: [[14, 17], [22, 7], [22, 28], [30, 17], [35, 17]],
    enemy: [[35, 17], [22, 17], [14, 6], [14, 29]],
  },
  startTimeOfDay: 'afternoon',
  startWeather: 'clear',
  enemyProfile: 'standard',
  objective: { type: 'hold', holdRounds: 4 },
  reinforcements: [
    { turn: 4, spawns: [['drone', 41, 4], ['soldier', 41, 31]] },
    { turn: 5, spawns: [['assault', 41, 5], ['drone', 41, 30]] },
  ],
  interactables: [
    { id: 1, type: 'door', x: 12, y: 17, active: true },
    { id: 2, type: 'door', x: 12, y: 18, active: true },
    { id: 3, type: 'door', x: 40, y: 5 },
    { id: 4, type: 'door', x: 40, y: 30 },
    { id: 20, type: 'chest', x: 2, y: 2 },
    { id: 21, type: 'chest', x: 2, y: 33 },
    { id: 22, type: 'chest', x: 38, y: 13 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 10, y: 17 },
    { id: 2, type: 'medkit', x: 14, y: 6 },
    { id: 3, type: 'medkit', x: 14, y: 29 },
    { id: 4, type: 'ammo', x: 22, y: 17 },
    { id: 5, type: 'ammo', x: 29, y: 10 },
    { id: 6, type: 'ammo', x: 29, y: 25 },
    { id: 7, type: 'gadget', x: 33, y: 17 },
    { id: 8, type: 'medkit', x: 35, y: 21 },
  ],
};
