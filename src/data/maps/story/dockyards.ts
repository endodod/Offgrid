import { border, building, coverPairs, field, hRun, pts, put, rect, tiles, toRows, vRun } from '../compose';
import type { MapDef } from '../../trainingGrounds';

/**
 * Act 2, the Dockyards: first contact with the Cinder Wardens. Five maps, one file (Act 1 keeps one file per
 * map; from Act 2 on a district's five live together, since they share a vocabulary - containers, quays, water
 * as the wall you cannot cross).
 *
 * The Wardens are not the Jackals. They fortify, they post campers on the approaches, and from here on they
 * bring reinforcements. What the district teaches, in order:
 *   1. The Checkpoint   (retrieve)          - take something and get out: the objective is two places.
 *   2. Low Tide         (survive)           - no objective to rush: outlast waves with your back to the water.
 *   3. The Harbourmasters (eliminateTargets) - three targets in one yard, and a garrison that is not awake yet.
 *   4. The Coded Signal (hold)              - the Signal Fire, inverted: hold a radio in their tower.
 *   5. Dry Dock         (eliminateTarget)   - the finale: a sunken basin between you and the captain.
 *
 * Balance (npm run sim -- --map <id> --objective player --player-profile friendly --player-level 3, 60
 * matches, each map's own conditions): see each map's header. Act 2 assumes a squad of level 3.
 */

// ------------------------------------------------------------------------------------------------ 1
/**
 * The Checkpoint - `retrieve`. 40x24, morning fog.
 *
 * A Warden checkpoint at the dock gate, run like a customs post. The tithe ledger is in the office, the
 * manifest board in the weigh station; take both, then get three people onto the quay where the boat is.
 * The checkpoint wall has three ways through: the vehicle gate (open, watched by two campers), a pedestrian
 * gate (shut - two doors side by side, so it is two tiles wide when open), and a breach in the south fence.
 *
 * Teaches: the objective is two places, and the second is further in. Fog means the campers on the gate see
 * about as far as you do.
 */
function checkpoint(): string[] {
  const g = field(40, 24);
  border(g);
  // west yard: container rows, parked trucks
  hRun(g, 5, 4, 4, 'h'); hRun(g, 5, 19, 4, 'h');
  vRun(g, 10, 7, 3, 'h'); vRun(g, 10, 14, 3, 'h');
  coverPairs(g, 11, [6]); coverPairs(g, 13, [13]);
  pts(g, [[14, 6], [14, 17], [3, 16]], 'l');
  // the checkpoint wall
  vRun(g, 17, 1, 22, '#');
  for (const y of [3, 4, 10, 11, 12, 13, 19, 20]) put(g, 17, y, '.'); // the vehicle gate is four wide
  pts(g, [[15, 10], [15, 13], [19, 10], [19, 13]], 'l'); // jersey barriers either side of the gate
  // the office (tithe ledger) - a two-wide door on its south side
  building(g, 22, 2, 10, 8, [[26, 9], [27, 9]]);
  pts(g, [[24, 5], [25, 5], [29, 6]], 'l');
  // the weigh station (manifest board) - open to the west
  building(g, 23, 15, 7, 6, [[23, 17], [23, 18]]);
  pts(g, [[26, 19]], 'l');
  // the quay: container stacks and bollards
  vRun(g, 33, 3, 4, 'h'); vRun(g, 33, 16, 4, 'h');
  pts(g, [[35, 8], [35, 15], [31, 12]], 'l');
  hRun(g, 20, 13, 3, 'h');
  for (const [x, y] of tiles(37, 11, 2, 2)) put(g, x, y, 'O');
  return toRows(g);
}

export const CHECKPOINT: MapDef = {
  name: 'Gate Four Checkpoint',
  rows: checkpoint(),
  spawns: {
    player: [['soldier', 2, 11], ['assault', 3, 11], ['medic', 2, 13], ['tank', 2, 9], ['sniper', 3, 9]],
    enemy: [
      ['soldier', 20, 11, 'easy'], ['sniper', 29, 7, 'defend'], ['assault', 25, 12],
      ['tank', 27, 18, 'defend'], ['soldier', 35, 5],
    ],
  },
  searchPoints: {
    player: [[20, 12], [27, 6], [26, 17], [36, 12]],
    enemy: [[12, 12], [20, 12], [27, 12], [6, 12]],
  },
  startTimeOfDay: 'morning',
  startWeather: 'fog',
  enemyProfile: 'standard',
  enemyPods: true, // a customs post at dawn, in fog: nobody is expecting anything
  objective: { type: 'retrieve', interactableIds: [10, 11], unitsRequired: 3, label: 'the tithe ledger and the manifest' },
  interactables: [
    { id: 1, type: 'door', x: 17, y: 3 },
    { id: 2, type: 'door', x: 17, y: 4 },
    { id: 10, type: 'switch', x: 29, y: 4 },  // the ledger
    { id: 11, type: 'switch', x: 27, y: 17 }, // the manifest board
    { id: 20, type: 'chest', x: 2, y: 2 },
    { id: 21, type: 'chest', x: 30, y: 20 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 12, y: 11 },
    { id: 2, type: 'medkit', x: 8, y: 16 },
    { id: 3, type: 'ammo', x: 21, y: 16 },
    { id: 4, type: 'medkit', x: 23, y: 4 },
    { id: 5, type: 'gadget', x: 31, y: 16 },
    { id: 6, type: 'ammo', x: 34, y: 12 },
  ],
};

// ------------------------------------------------------------------------------------------------ 2
/**
 * Low Tide - `survive` x6. 30x30, midnight rain.
 *
 * The squad came off the checkpoint with the ledger and nowhere to go: the boat cannot come in until the tide
 * does. Six rounds in a ring of stacked containers on the end of a pier, water on the west, and the Wardens
 * coming down the pier from the north, east and south in waves (rounds 2 and 4).
 *
 * Teaches: there is nothing to rush. The fort has four two-wide gaps; pick which ones you watch, and move the
 * watch as the waves arrive from different sides. Rain and night blunt the attackers crossing the open pier
 * more than the defenders behind the containers.
 */
function lowTide(): string[] {
  const g = field(30, 30);
  border(g);
  rect(g, 1, 1, 3, 28, '#'); // the water
  // the fort: a ring of containers with a two-wide gap on each side
  for (let i = 10; i <= 20; i++) { put(g, i, 10, 'h'); put(g, i, 20, 'h'); put(g, 10, i, 'h'); put(g, 20, i, 'h'); }
  for (const d of [14, 15]) { put(g, d, 10, '.'); put(g, d, 20, '.'); put(g, 10, d, '.'); put(g, 20, d, '.'); }
  pts(g, [[13, 13], [17, 17], [16, 13], [13, 17]], 'l'); // crates inside
  // the pier outside: loose containers and bollards
  hRun(g, 6, 5, 3, 'h'); hRun(g, 17, 4, 4, 'h'); hRun(g, 6, 25, 3, 'h'); hRun(g, 17, 25, 4, 'h');
  vRun(g, 25, 8, 3, 'h'); vRun(g, 25, 19, 3, 'h');
  pts(g, [[12, 6], [23, 14], [23, 16], [12, 24], [6, 14], [6, 16], [27, 3], [27, 26]], 'l');
  return toRows(g);
}

export const LOW_TIDE: MapDef = {
  name: 'Pier Nine',
  rows: lowTide(),
  spawns: {
    player: [['soldier', 14, 14], ['assault', 16, 15], ['medic', 15, 16], ['tank', 14, 16], ['sniper', 16, 14]],
    enemy: [['soldier', 15, 2], ['assault', 27, 12], ['soldier', 15, 27], ['sniper', 27, 20], ['assault', 27, 16]],
  },
  searchPoints: {
    player: [[15, 11], [19, 15], [15, 19], [11, 15]],
    enemy: [[15, 11], [19, 15], [15, 19], [15, 15]],
  },
  startTimeOfDay: 'midnight',
  startWeather: 'rain',
  enemyProfile: 'standard',
  objective: { type: 'survive', rounds: 6 },
  reinforcements: [
    { turn: 2, spawns: [['assault', 22, 1], ['soldier', 28, 5], ['sniper', 9, 1]] },
    { turn: 4, spawns: [['tank', 22, 28], ['soldier', 28, 24], ['assault', 9, 28]] },
  ],
  interactables: [{ id: 20, type: 'chest', x: 7, y: 27 }],
  pickups: [
    { id: 1, type: 'ammo', x: 12, y: 12 },
    { id: 2, type: 'ammo', x: 18, y: 18 },
    { id: 3, type: 'medkit', x: 18, y: 12 },
    { id: 4, type: 'medkit', x: 12, y: 18 },
    { id: 5, type: 'gadget', x: 15, y: 15 },
    { id: 6, type: 'ammo', x: 7, y: 8 },
  ],
};

// ------------------------------------------------------------------------------------------------ 3
/**
 * The Harbourmasters - `eliminateTargets` x3. 44x28, afternoon, clear. Enemy pods.
 *
 * The ledger names three tithe collectors who run the container yard, each from their own post: the tally
 * hut in the middle, the crane cab in the north-east, the gatehouse in the south-east. Kill all three and the
 * Wardens lose the Dockyards' books.
 *
 * Teaches: order matters. The garrison starts asleep in pods (10j) around each post; a pod wakes when it
 * sees you or is hurt, so a quiet first kill buys time and a loud one brings the yard. The container maze has
 * long east-west lanes and short north-south cut-throughs, so a pod that wakes can reach you faster than you
 * can reach the next target.
 */
function harbourmasters(): string[] {
  const g = field(44, 28);
  border(g);
  // container lanes: long east-west rows with gaps
  for (const y of [5, 11, 16, 22]) {
    hRun(g, 6, y, 8, 'h');
    hRun(g, 17, y, 8, 'h');
    hRun(g, 28, y, 7, 'h');
  }
  for (const y of [11, 16]) { put(g, 20, y, '.'); put(g, 21, y, '.'); } // cut-throughs to the tally hut
  // the tally hut, middle
  building(g, 18, 12, 6, 4, [[20, 12], [21, 15]]);
  // the crane cab, north-east
  building(g, 36, 1, 7, 6, [[38, 6], [39, 6]]);
  // the gatehouse, south-east
  building(g, 36, 20, 7, 7, [[36, 23], [36, 24]]);
  pts(g, [[3, 8], [3, 19], [15, 8], [15, 19], [26, 8], [26, 19], [33, 13], [33, 14], [40, 13]], 'l');
  pts(g, [[1, 1], [2, 1], [1, 26], [2, 26]], 'b');
  return toRows(g);
}

export const HARBOURMASTERS: MapDef = {
  name: 'Container Yard',
  rows: harbourmasters(),
  spawns: {
    player: [['soldier', 2, 13], ['assault', 3, 13], ['medic', 2, 15], ['tank', 2, 11], ['sniper', 3, 11]],
    enemy: [
      ['soldier', 21, 14, 'defend'], // collector: the tally hut
      ['sniper', 40, 3, 'defend'],   // collector: the crane cab
      ['soldier', 40, 23, 'defend'], // collector: the gatehouse
      ['assault', 23, 9], ['tank', 38, 9], ['assault', 38, 18],
    ],
  },
  searchPoints: {
    player: [[21, 13], [39, 4], [39, 23], [30, 13]],
    enemy: [[21, 13], [10, 13], [30, 8], [30, 19]],
  },
  startTimeOfDay: 'afternoon',
  startWeather: 'clear',
  enemyProfile: 'standard',
  enemyPods: true,
  objective: { type: 'eliminateTargets', enemySpawnIndices: [0, 1, 2], label: 'the three tithe collectors' },
  interactables: [
    { id: 1, type: 'door', x: 20, y: 12, active: true },
    { id: 2, type: 'door', x: 21, y: 15 },
    { id: 20, type: 'chest', x: 37, y: 2 },
    { id: 21, type: 'chest', x: 41, y: 25 },
    { id: 22, type: 'chest', x: 13, y: 26 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 15, y: 13 },
    { id: 2, type: 'medkit', x: 10, y: 8 },
    { id: 3, type: 'ammo', x: 26, y: 13 },
    { id: 4, type: 'medkit', x: 30, y: 19 },
    { id: 5, type: 'gadget', x: 21, y: 25 },
    { id: 6, type: 'ammo', x: 34, y: 3 },
    { id: 7, type: 'armor', x: 22, y: 13, itemId: 'lightVest' },
  ],
};

// ------------------------------------------------------------------------------------------------ 4
/**
 * The Coded Signal - `hold` x3. 32x32, midnight storm.
 *
 * The transmission that answered the Signal Fire came from the harbour master's radio tower, and it is still
 * going out on the hour. Get to the console on the tower's top floor and hold it long enough to trace where
 * it is being relayed from.
 *
 * Teaches: Signal Fire, inverted. There the squad started on the roof and the Jackals came to it; here the
 * Wardens have the tower and the squad has to take it, then hold it while the second shift (round 4) arrives.
 * The tower is a building inside a walled compound; both have two ways in.
 */
function codedSignal(): string[] {
  const g = field(32, 32);
  border(g);
  // compound wall with a gate north-west and a gap south-east
  rect(g, 6, 6, 20, 1, '#'); rect(g, 6, 25, 20, 1, '#'); rect(g, 6, 6, 1, 20, '#'); rect(g, 25, 6, 1, 20, '#');
  for (const [x, y] of [[6, 10], [6, 11], [25, 20], [25, 21], [15, 25], [16, 25]] as [number, number][]) put(g, x, y, '.');
  // the tower: a walled room with a two-wide door on the west and one on the east
  building(g, 11, 11, 10, 10, [[11, 15], [11, 16], [20, 15], [20, 16]]);
  put(g, 16, 13, 'O');
  pts(g, [[14, 13], [18, 13], [14, 18], [18, 18]], 'l');
  hRun(g, 14, 16, 2, 'h');
  // compound yard
  pts(g, [[9, 9], [22, 9], [9, 22], [22, 22], [9, 16], [23, 12]], 'l');
  // outside: sheds and stacks
  hRun(g, 2, 3, 3, 'h'); hRun(g, 27, 28, 3, 'h'); vRun(g, 3, 20, 3, 'h'); vRun(g, 28, 4, 3, 'h');
  pts(g, [[12, 3], [19, 3], [12, 28], [19, 28]], 'l');
  return toRows(g);
}

export const CODED_SIGNAL: MapDef = {
  name: "Harbour Master's Tower",
  rows: codedSignal(),
  spawns: {
    player: [['soldier', 2, 10], ['assault', 3, 10], ['medic', 2, 12], ['tank', 2, 8], ['sniper', 3, 8]],
    enemy: [['soldier', 13, 14, 'camper'], ['sniper', 19, 19, 'camper'], ['assault', 9, 12], ['soldier', 22, 20]],
  },
  searchPoints: {
    player: [[8, 11], [14, 15], [16, 14], [23, 20]],
    enemy: [[8, 11], [16, 15], [23, 20], [4, 10]],
  },
  startTimeOfDay: 'midnight',
  startWeather: 'stormy',
  enemyProfile: 'standard',
  objective: { type: 'hold', holdRounds: 3 },
  reinforcements: [{ turn: 4, spawns: [['assault', 29, 29], ['soldier', 16, 29], ['tank', 29, 16]] }],
  interactables: [
    { id: 1, type: 'door', x: 11, y: 15, active: true },
    { id: 2, type: 'door', x: 11, y: 16, active: true },
    { id: 3, type: 'door', x: 20, y: 15 },
    { id: 4, type: 'door', x: 20, y: 16 },
    { id: 20, type: 'chest', x: 13, y: 19 },
    { id: 21, type: 'chest', x: 29, y: 2 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 8, y: 14 },
    { id: 2, type: 'medkit', x: 12, y: 12 },
    { id: 3, type: 'ammo', x: 19, y: 12 },
    { id: 4, type: 'medkit', x: 17, y: 19 },
    { id: 5, type: 'gadget', x: 4, y: 28 },
    { id: 6, type: 'equipment', x: 23, y: 8, itemId: 'nvg' },
  ],
};

// ------------------------------------------------------------------------------------------------ 5
/**
 * Dry Dock - `eliminateTarget`, Captain Ansel Marrow. 54x30, afternoon, cloudy. The district finale.
 *
 * The traced signal leads to the Warden captain of the Dockyards, who runs the harbour out of the pump house
 * at the head of the old dry dock. Between the gate and the pump house is the dock itself: a sunken basin
 * with walls on both sides and two ramps down, and a gantry bridge across the middle.
 *
 * Teaches: everything the district taught, plus one new question - go through the basin (cover, but low
 * ground and two ramps to be caught on) or across the gantry (fast, open). Marrow is a tank on camper
 * behind a sealed door (10j `aiOpensDoors: false`), and a relief squad comes through the east gate on round 6.
 */
function dryDock(): string[] {
  const g = field(54, 30);
  border(g);
  // west: the dock gate yard
  hRun(g, 4, 5, 4, 'h'); hRun(g, 4, 24, 4, 'h');
  coverPairs(g, 11, [5]); coverPairs(g, 18, [5]);
  pts(g, [[10, 8], [10, 21]], 'l');
  // the basin: walls along the quay edges, x 14..38, with ramps down at each end and a gantry across
  hRun(g, 14, 8, 25, '#'); hRun(g, 14, 21, 25, '#');
  for (const x of [14, 15, 37, 38]) { put(g, x, 8, '.'); put(g, x, 21, '.'); } // ramps down (two-wide)
  for (const x of [25, 26]) { put(g, x, 8, '.'); put(g, x, 21, '.'); } // the gantry's stairs
  // in the basin: keel blocks (single rows) and scaffold
  for (const x of [18, 23, 29, 34]) vRun(g, x, 11, 3, 'h');
  for (const x of [20, 31]) vRun(g, x, 16, 3, 'h');
  pts(g, [[16, 15], [27, 12], [27, 18], [36, 15]], 'l');
  // north and south quays
  pts(g, [[18, 4], [19, 4], [30, 4], [31, 4], [18, 25], [19, 25], [30, 25], [31, 25], [24, 3], [24, 26]], 'l');
  hRun(g, 21, 2, 3, 'h'); hRun(g, 33, 27, 3, 'h');
  // east: the pump house (Marrow) and the east gate
  building(g, 42, 9, 10, 12, [[42, 14], [42, 15]]);
  pts(g, [[45, 11], [48, 11], [45, 18], [48, 18]], 'l');
  building(g, 42, 1, 10, 6, [[44, 6], [45, 6]]); // the tally office
  pts(g, [[40, 24], [41, 24], [46, 25], [47, 25]], 'l');
  return toRows(g);
}

export const DRY_DOCK: MapDef = {
  name: 'Number Two Dry Dock',
  rows: dryDock(),
  spawns: {
    player: [['soldier', 2, 14], ['assault', 3, 14], ['medic', 2, 16], ['tank', 2, 12], ['sniper', 3, 12]],
    enemy: [
      ['tank', 48, 15, 'defend'], // Captain Marrow
      ['soldier', 21, 5], ['sniper', 31, 3, 'camper'], ['assault', 27, 15], ['soldier', 32, 24, 'camper'],
      ['sniper', 47, 3, 'defend'],
    ],
  },
  searchPoints: {
    player: [[25, 15], [25, 5], [25, 24], [40, 15], [47, 15]],
    enemy: [[25, 15], [12, 15], [25, 5], [25, 24]],
  },
  startTimeOfDay: 'afternoon',
  startWeather: 'cloudy',
  enemyProfile: 'standard',
  objective: { type: 'eliminateTarget', enemySpawnIndex: 0, label: 'Captain Ansel Marrow' },
  aiOpensDoors: false,
  reinforcements: [{ turn: 6, spawns: [['assault', 50, 27], ['soldier', 48, 27]] }],
  interactables: [
    { id: 1, type: 'door', x: 42, y: 14 },
    { id: 2, type: 'door', x: 42, y: 15 },
    { id: 3, type: 'door', x: 44, y: 6, active: true },
    { id: 4, type: 'door', x: 45, y: 6, active: true },
    { id: 20, type: 'chest', x: 2, y: 2 },
    { id: 21, type: 'chest', x: 26, y: 15 },
    { id: 22, type: 'chest', x: 50, y: 2 },
    { id: 23, type: 'chest', x: 50, y: 19 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 11, y: 14 },
    { id: 2, type: 'medkit', x: 16, y: 12 },
    { id: 3, type: 'ammo', x: 25, y: 11 },
    { id: 4, type: 'medkit', x: 25, y: 19 },
    { id: 5, type: 'ammo', x: 36, y: 12 },
    { id: 6, type: 'gadget', x: 36, y: 18 },
    { id: 7, type: 'ammo', x: 40, y: 4 },
    { id: 8, type: 'medkit', x: 40, y: 26 },
  ],
};
