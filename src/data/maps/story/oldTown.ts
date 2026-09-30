import { border, building, coverPairs, field, hRun, pts, put, rect, tiles, toRows, vRun } from '../compose';
import type { MapDef } from '../../trainingGrounds';

/**
 * Act 2, Old Town: narrow stone streets, the ammo economy at its tightest (every map here runs on a reduced
 * reserve for both sides, `reserveMult` < 1, and pays it back in ammo caches), and the ledger trail finally
 * naming Halcyon out loud. What the district teaches:
 *   1. Narrow Streets  (reach)           - alleys, ambushers who do not move until they see you.
 *   2. The Bell Tower  (eliminateTarget) - one sniper who can see the whole square.
 *   3. The Armoury     (retrieve)        - their ammunition, if you can carry it out.
 *   4. Saint Oriel's   (survive)         - hold a church for people who cannot fight.
 *   5. Warden Command  (eliminateTarget) - the Commander, the Guildhall, the contract.
 */

// ------------------------------------------------------------------------------------------------ 1
/**
 * Narrow Streets - `reach` x3. 50x20, morning fog, reserve x0.7.
 *
 * Three parallel streets running east, joined by short alleys, and a Warden patrol pattern that is mostly
 * people standing very still in doorways (`ambush`: they do not move until they see a target). The square at
 * the east end is where the resistance contact is waiting.
 *
 * Teaches: the ammo squeeze, and ambushers. Every alley mouth might have someone in it; the streets are too
 * narrow to go around. Scan (the sniper's gadget) is worth more here than anywhere so far.
 */
function narrowStreets(): string[] {
  const g = field(50, 20);
  border(g);
  // two terraces of houses split the map into three streets (y 1-4, 8-11, 15-18)
  rect(g, 4, 5, 40, 3, '#');
  rect(g, 4, 12, 40, 3, '#');
  // alleys through the terraces: two wide, staggered
  for (const x of [9, 22, 35]) for (const y of [5, 6, 7]) { put(g, x, y, '.'); put(g, x + 1, y, '.'); }
  for (const x of [15, 28, 40]) for (const y of [12, 13, 14]) { put(g, x, y, '.'); put(g, x + 1, y, '.'); }
  // street furniture: carts, steps, bollards
  coverPairs(g, 2, [7, 18, 30]); coverPairs(g, 17, [12, 25, 37]); coverPairs(g, 9, [13, 26]);
  pts(g, [[20, 10], [33, 10], [6, 10], [42, 3], [42, 16]], 'l');
  pts(g, [[18, 1], [31, 18], [24, 9]], 'b');
  // the square
  hRun(g, 45, 4, 3, 'h'); hRun(g, 45, 15, 3, 'h');
  for (const [x, y] of tiles(47, 8, 2, 4)) put(g, x, y, 'O');
  return toRows(g);
}

export const NARROW_STREETS: MapDef = {
  name: 'Cooper Lanes',
  rows: narrowStreets(),
  spawns: {
    player: [['soldier', 2, 9], ['assault', 2, 10], ['medic', 1, 8], ['tank', 1, 11], ['sniper', 2, 8]],
    enemy: [
      ['soldier', 11, 3, 'ambush'], ['assault', 17, 16, 'ambush'], ['sniper', 30, 10, 'ambush'],
      ['soldier', 36, 3, 'ambush'], ['assault', 41, 17], ['tank', 44, 10, 'defend'],
    ],
  },
  searchPoints: {
    player: [[10, 3], [16, 16], [23, 9], [36, 3], [41, 16], [46, 10]],
    enemy: [[23, 9], [10, 9], [36, 9], [45, 10]],
  },
  startTimeOfDay: 'morning',
  startWeather: 'fog',
  enemyProfile: 'standard',
  reserveMult: 0.7,
  objective: { type: 'reach', unitsRequired: 3 },
  interactables: [
    { id: 20, type: 'chest', x: 5, y: 1 },
    { id: 21, type: 'chest', x: 44, y: 18 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 9, y: 9 },
    { id: 2, type: 'ammo', x: 22, y: 2 },
    { id: 3, type: 'medkit', x: 16, y: 10 },
    { id: 4, type: 'ammo', x: 28, y: 17 },
    { id: 5, type: 'medkit', x: 35, y: 9 },
    { id: 6, type: 'ammo', x: 40, y: 9 },
    { id: 7, type: 'gadget', x: 29, y: 2 },
  ],
};

// ------------------------------------------------------------------------------------------------ 2
/**
 * The Bell Tower - `eliminateTarget`, the marksman Oskar Brand. 36x36, midday, clear, reserve x0.7.
 *
 * Saint Anne's square is a killing ground: a church tower in the middle with the Wardens' best marksman in
 * the belfry (a sniper on `defend`, range 12, vision 8 - at midday he sees nearly the whole square). The
 * squad comes in from the south-west corner. Arcades on all four sides give a covered route round.
 *
 * Teaches: do not cross open ground under a sniper - go round. The arcades are single lines of pillars (high
 * cover in lines) with a wall behind them; the tower has one two-wide door, facing north, away from you.
 */
function bellTower(): string[] {
  const g = field(36, 36);
  border(g);
  // the buildings around the square, with arcades (pillars) in front of them
  rect(g, 1, 1, 34, 4, '#'); rect(g, 1, 31, 34, 4, '#'); rect(g, 1, 1, 4, 34, '#'); rect(g, 31, 1, 4, 34, '#');
  for (let i = 7; i <= 28; i += 3) { put(g, i, 6, 'h'); put(g, i, 29, 'h'); put(g, 6, i, 'h'); put(g, 29, i, 'h'); }
  // street openings in each side (the south-west one is where the squad arrives)
  for (const d of [17, 18]) { put(g, d, 1, '.'); put(g, d, 2, '.'); put(g, d, 3, '.'); put(g, d, 4, '.'); }
  for (const d of [5, 6]) for (let y = 31; y <= 34; y++) put(g, d, y, '.');
  for (const d of [17, 18]) for (let x = 31; x <= 34; x++) put(g, x, d, '.');
  // the tower: a walled square with a north door
  building(g, 15, 15, 6, 6, [[17, 15], [18, 15]]);
  // the square: market stalls and a fountain
  pts(g, [[10, 10], [11, 10], [24, 10], [25, 10], [10, 25], [11, 25], [24, 25], [25, 25]], 'l');
  pts(g, [[17, 11], [18, 11], [12, 18], [23, 17]], 'l');
  pts(g, [[13, 13], [22, 22], [13, 22], [22, 13]], 'b');
  return toRows(g);
}

export const BELL_TOWER: MapDef = {
  name: "Saint Anne's Square",
  rows: bellTower(),
  spawns: {
    player: [['soldier', 5, 33], ['assault', 6, 33], ['medic', 5, 34], ['tank', 6, 32], ['sniper', 6, 34]],
    enemy: [
      ['sniper', 18, 18, 'defend'], // Brand
      ['soldier', 17, 13, 'defend'], ['assault', 27, 9], ['soldier', 9, 8, 'defend'], ['assault', 26, 27],
      ['soldier', 27, 18, 'defend'],
    ],
  },
  searchPoints: {
    player: [[8, 27], [8, 8], [17, 8], [27, 8], [17, 14]],
    enemy: [[17, 13], [8, 27], [27, 27], [8, 8]],
  },
  startTimeOfDay: 'midday',
  startWeather: 'clear',
  enemyProfile: 'standard',
  reserveMult: 0.7,
  objective: { type: 'eliminateTarget', enemySpawnIndex: 0, label: 'Oskar Brand, the Warden marksman' },
  aiOpensDoors: false,
  interactables: [
    { id: 1, type: 'door', x: 17, y: 15 },
    { id: 2, type: 'door', x: 18, y: 15 },
    { id: 20, type: 'chest', x: 19, y: 19 },
    { id: 21, type: 'chest', x: 30, y: 30 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 7, y: 27 },
    { id: 2, type: 'ammo', x: 7, y: 9 },
    { id: 3, type: 'medkit', x: 16, y: 7 },
    { id: 4, type: 'ammo', x: 28, y: 12 },
    { id: 5, type: 'medkit', x: 28, y: 23 },
    { id: 6, type: 'gadget', x: 17, y: 28 },
  ],
};

// ------------------------------------------------------------------------------------------------ 3
/**
 * The Armoury - `retrieve`, extract 2. 38x28, midnight, clear, reserve x0.7.
 *
 * The Old Town garrison's armoury: a walled yard, a magazine building with two rooms, and the only way out
 * the loading gate in the north-east. Take the munitions ledger and the key register, and take as much of
 * their ammunition as you can carry - the magazine is full of caches.
 *
 * Teaches: the economy, turned round. The squad arrives starved (x0.7 reserve) and the objective is sitting
 * in the middle of more ammunition than it has seen all act. Night means the magazine's interior is the
 * only lit place for fifty metres.
 */
function armoury(): string[] {
  const g = field(38, 28);
  border(g);
  // the yard wall: a breach in the south-west, the loading gate in the north-east
  rect(g, 5, 4, 29, 1, '#'); rect(g, 5, 23, 29, 1, '#'); rect(g, 5, 4, 1, 20, '#'); rect(g, 33, 4, 1, 20, '#');
  for (const [x, y] of [[5, 19], [5, 20], [10, 23], [11, 23], [33, 7], [33, 8]] as [number, number][]) put(g, x, y, '.');
  // the magazine: two rooms off a central passage
  building(g, 12, 8, 16, 12, [[12, 13], [12, 14], [27, 13], [27, 14]]);
  vRun(g, 19, 9, 10, '#'); put(g, 19, 13, '.'); put(g, 19, 14, '.');
  hRun(g, 14, 10, 3, 'h'); hRun(g, 22, 17, 3, 'h');
  pts(g, [[15, 16], [24, 11]], 'l');
  // yard: crates and a vehicle
  hRun(g, 8, 7, 3, 'h'); hRun(g, 29, 20, 3, 'h'); vRun(g, 30, 9, 3, 'h');
  pts(g, [[8, 15], [9, 15], [23, 21], [16, 6], [30, 15]], 'l');
  // outside
  pts(g, [[2, 10], [2, 25], [20, 2], [35, 20]], 'l');
  pts(g, [[1, 1], [2, 1], [1, 2]], 'b');
  for (const [x, y] of tiles(35, 2, 2, 3)) put(g, x, y, 'O');
  return toRows(g);
}

export const ARMOURY: MapDef = {
  name: 'Tanner Street Armoury',
  rows: armoury(),
  spawns: {
    player: [['soldier', 2, 20], ['assault', 3, 20], ['medic', 2, 22], ['tank', 2, 18], ['sniper', 3, 18]],
    enemy: [
      ['soldier', 16, 13, 'defend'], ['sniper', 24, 15, 'defend'], ['assault', 9, 11], ['soldier', 30, 6],
    ],
  },
  searchPoints: {
    player: [[9, 20], [14, 13], [23, 13], [30, 12], [34, 5]],
    enemy: [[9, 20], [20, 13], [30, 12], [20, 21]],
  },
  startTimeOfDay: 'midnight',
  startWeather: 'clear',
  enemyProfile: 'standard',
  reserveMult: 0.7,
  objective: { type: 'retrieve', interactableIds: [10, 11], unitsRequired: 2, label: 'the munitions ledger and the key register' },
  reinforcements: [{ turn: 6, spawns: [['assault', 36, 12], ['soldier', 36, 14]] }],
  interactables: [
    { id: 1, type: 'door', x: 12, y: 13, active: true },
    { id: 2, type: 'door', x: 12, y: 14, active: true },
    { id: 3, type: 'door', x: 27, y: 13 },
    { id: 4, type: 'door', x: 27, y: 14 },
    { id: 10, type: 'switch', x: 13, y: 18 }, // the munitions ledger
    { id: 11, type: 'switch', x: 26, y: 9 },  // the key register
    { id: 20, type: 'chest', x: 17, y: 9 },
    { id: 21, type: 'chest', x: 21, y: 18 },
    { id: 22, type: 'chest', x: 31, y: 22 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 14, y: 12 },
    { id: 2, type: 'ammo', x: 17, y: 17 },
    { id: 3, type: 'ammo', x: 21, y: 10 },
    { id: 4, type: 'ammo', x: 25, y: 16 },
    { id: 5, type: 'ammo', x: 20, y: 13, amount: 6 },
    { id: 6, type: 'medkit', x: 8, y: 20 },
    { id: 7, type: 'medkit', x: 29, y: 12 },
    { id: 8, type: 'gadget', x: 22, y: 12 },
    { id: 9, type: 'equipment', x: 18, y: 9, itemId: 'bandolier' },
  ],
};

// ------------------------------------------------------------------------------------------------ 4
/**
 * Saint Oriel's - `survive` x7. 34x30, afternoon storm, reserve x0.75.
 *
 * Forty people who would not pay the Old Town tithe are sheltering in Saint Oriel's, and the Wardens have
 * come to collect. Hold the church for seven rounds until the rest of the resistance can get them out the
 * crypt. The nave has a west door and two side doors; the bell tower (north-east) overlooks the churchyard.
 *
 * Teaches: a long survive against a clock, with the ammo squeeze on: the caches are inside, and there are
 * only so many. Storm hits everyone's aim, which is why seven rounds is survivable at all.
 */
function saintOriels(): string[] {
  const g = field(34, 30);
  border(g);
  // the church: nave with pews (low cover in rows), a chancel at the east end
  building(g, 8, 8, 20, 13, [[8, 13], [8, 14], [16, 8], [17, 8], [16, 20], [17, 20]]);
  for (const y of [10, 12, 16, 18]) { hRun(g, 11, y, 4, 'l'); hRun(g, 19, y, 4, 'l'); }
  vRun(g, 24, 10, 3, 'h'); vRun(g, 24, 16, 3, 'h');
  // the bell tower
  building(g, 27, 3, 5, 6, [[29, 8]]);
  // the churchyard: headstones and yews
  for (const x of [4, 12, 21]) { pts(g, [[x, 4], [x + 2, 4], [x, 25], [x + 2, 25]], 'l'); }
  pts(g, [[3, 10], [3, 17], [30, 14], [30, 19]], 'l');
  pts(g, [[5, 2], [6, 2], [27, 26], [28, 26], [2, 14]], 'b');
  hRun(g, 1, 22, 5, '#'); hRun(g, 28, 11, 5, '#');
  return toRows(g);
}

export const SAINT_ORIELS: MapDef = {
  name: "Saint Oriel's Church",
  rows: saintOriels(),
  spawns: {
    player: [['soldier', 12, 14], ['assault', 18, 14], ['medic', 21, 14], ['tank', 10, 14], ['sniper', 25, 14]],
    enemy: [['soldier', 2, 5], ['assault', 2, 26], ['soldier', 31, 25], ['sniper', 30, 5, 'defend']],
  },
  searchPoints: {
    player: [[9, 13], [16, 9], [16, 19], [26, 14]],
    enemy: [[16, 14], [7, 13], [16, 7], [16, 21]],
  },
  startTimeOfDay: 'afternoon',
  startWeather: 'stormy',
  enemyProfile: 'standard',
  reserveMult: 0.75,
  objective: { type: 'survive', rounds: 7 },
  reinforcements: [
    { turn: 3, spawns: [['assault', 1, 13], ['soldier', 1, 15]] },
    { turn: 5, spawns: [['tank', 16, 1], ['assault', 17, 28]] },
  ],
  interactables: [
    { id: 1, type: 'door', x: 8, y: 13, active: true },
    { id: 2, type: 'door', x: 8, y: 14, active: true },
    { id: 3, type: 'door', x: 16, y: 8 },
    { id: 4, type: 'door', x: 17, y: 8 },
    { id: 5, type: 'door', x: 16, y: 20 },
    { id: 6, type: 'door', x: 17, y: 20 },
    { id: 7, type: 'door', x: 29, y: 8 },
    { id: 20, type: 'chest', x: 26, y: 11 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 13, y: 11 },
    { id: 2, type: 'ammo', x: 21, y: 17 },
    { id: 3, type: 'medkit', x: 13, y: 17 },
    { id: 4, type: 'medkit', x: 21, y: 11 },
    { id: 5, type: 'ammo', x: 26, y: 17 },
    { id: 6, type: 'gadget', x: 16, y: 14 },
  ],
};

// ------------------------------------------------------------------------------------------------ 5
/**
 * Warden Command - `eliminateTarget`, Commander Idris Vane. 52x34, afternoon, cloudy, reserve x0.75. The Act 2
 * finale.
 *
 * The Guildhall: a forecourt, a colonnade, a great hall with two galleries, and the Commander's chamber at the
 * back behind a sealed door. Six Wardens, a relief force on round 7, and the commander a tank on `defend`.
 *
 * Teaches: all of Act 2 at once - campers and ambushers, a sniper on a gallery, the ammo squeeze, and a
 * reinforcement wave you have to have finished the fight before.
 */
function wardenCommand(): string[] {
  const g = field(52, 34);
  border(g);
  // the forecourt wall and gates
  vRun(g, 12, 1, 32, '#');
  for (const y of [8, 9, 24, 25]) put(g, 12, y, '.');
  // the colonnade: a line of pillars
  for (let y = 4; y <= 29; y += 3) put(g, 15, y, 'h');
  // the guildhall
  building(g, 18, 3, 26, 28, [[18, 15], [18, 16], [30, 3], [31, 3]]);
  // the galleries: walled mezzanines along the north and south walls, open to the hall through gaps
  hRun(g, 19, 9, 18, '#'); hRun(g, 19, 24, 18, '#');
  for (const x of [22, 23, 32, 33]) { put(g, x, 9, '.'); put(g, x, 24, '.'); }
  // the hall floor: benches in rows
  for (const x of [22, 27, 32]) { vRun(g, x, 12, 3, 'l'); vRun(g, x, 18, 3, 'l'); }
  // the commander's chamber
  building(g, 37, 10, 7, 14, [[37, 16], [37, 17]]);
  pts(g, [[40, 13], [40, 20]], 'l');
  // forecourt cover
  hRun(g, 4, 5, 4, 'h'); hRun(g, 4, 28, 4, 'h'); coverPairs(g, 16, [5]); pts(g, [[9, 12], [9, 20]], 'l');
  pts(g, [[46, 3], [47, 3], [46, 30], [47, 30], [48, 16]], 'l');
  pts(g, [[1, 1], [2, 1], [1, 32], [2, 32]], 'b');
  return toRows(g);
}

export const WARDEN_COMMAND: MapDef = {
  name: 'The Guildhall',
  rows: wardenCommand(),
  spawns: {
    player: [['soldier', 2, 16], ['assault', 3, 16], ['medic', 2, 18], ['tank', 2, 14], ['sniper', 3, 14]],
    enemy: [
      ['tank', 41, 16, 'defend'], // Commander Vane
      ['sniper', 28, 6, 'defend'], ['soldier', 25, 16], ['assault', 14, 20, 'ambush'],
      ['soldier', 34, 18, 'defend'], ['assault', 47, 10],
    ],
  },
  searchPoints: {
    player: [[14, 16], [25, 15], [30, 7], [30, 26], [40, 17]],
    enemy: [[25, 16], [14, 16], [8, 16], [30, 16]],
  },
  startTimeOfDay: 'afternoon',
  startWeather: 'cloudy',
  enemyProfile: 'standard',
  reserveMult: 0.75,
  objective: { type: 'eliminateTarget', enemySpawnIndex: 0, label: 'Commander Idris Vane' },
  aiOpensDoors: false,
  reinforcements: [{ turn: 7, spawns: [['assault', 49, 16], ['soldier', 49, 17]] }],
  interactables: [
    { id: 1, type: 'door', x: 18, y: 15, active: true },
    { id: 2, type: 'door', x: 18, y: 16, active: true },
    { id: 3, type: 'door', x: 37, y: 16 },
    { id: 4, type: 'door', x: 37, y: 17 },
    { id: 5, type: 'door', x: 30, y: 3 },
    { id: 6, type: 'door', x: 31, y: 3 },
    { id: 20, type: 'chest', x: 20, y: 5 },
    { id: 21, type: 'chest', x: 20, y: 28 },
    { id: 22, type: 'chest', x: 42, y: 22 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 9, y: 16 },
    { id: 2, type: 'medkit', x: 14, y: 12 },
    { id: 3, type: 'ammo', x: 20, y: 12 },
    { id: 4, type: 'ammo', x: 20, y: 21 },
    { id: 5, type: 'medkit', x: 30, y: 16 },
    { id: 6, type: 'ammo', x: 35, y: 6 },
    { id: 7, type: 'gadget', x: 35, y: 27 },
    { id: 8, type: 'armor', x: 26, y: 16, itemId: 'heavyPlate' },
  ],
};
