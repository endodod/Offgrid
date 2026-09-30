import { border, building, field, hRun, pts, put, rect, tiles, toRows, vRun } from '../compose';
import type { MapDef } from '../../trainingGrounds';

/**
 * Act 3, Uptown: what is left of corporate Ashport, and Halcyon Systems' own security - which is not people.
 * Two new enemies arrive here (data/units.ts): the sentry, a bolted-down gun that never moves and sees far,
 * and the drone, fast and fragile. The Wardens that remain are the ones posted inside Halcyon property.
 * What the district teaches:
 *   1. Glass Canyon        (reach)           - sentries: walls are the only answer to a gun that cannot move.
 *   2. The Contract Office (retrieve)        - a floor of cubicles, the original contract in the legal archive.
 *   3. The Blackout Archive (hold)           - pull eleven minutes of logs while the drones find you.
 *   4. Security Perimeter  (sabotage x3)     - switch the sentry grid off, node by node, in fog.
 *   5. The Director        (eliminateTarget) - the regional director on his terrace, in a storm.
 *
 * Act 3 assumes a squad of level 4 (npm run sim -- ... --player-level 4).
 */

// ------------------------------------------------------------------------------------------------ 1
/**
 * Glass Canyon - `reach` x3. 48x24, midday, clear.
 *
 * Halcyon Plaza: a canyon of tower lobbies either side of a wide boulevard, with two sentries on plinths
 * sweeping the open middle and a drone flight overhead. The Halcyon service gate at the east end is the zone.
 *
 * Teaches: sentries. They never move and they never stop looking, so the question is never "where is it" but
 * "what is between it and me". The lobbies either side are the covered route; the boulevard is the fast one.
 */
function glassCanyon(): string[] {
  const g = field(48, 24);
  border(g);
  // tower lobbies north and south: walled, with two-wide doors on the boulevard side and the far ends
  building(g, 6, 1, 14, 7, [[11, 7], [12, 7], [6, 4], [19, 4]]);
  building(g, 26, 1, 14, 7, [[31, 7], [32, 7], [26, 4], [39, 4]]);
  building(g, 6, 16, 14, 7, [[11, 16], [12, 16], [6, 19], [19, 19]]);
  building(g, 26, 16, 14, 7, [[31, 16], [32, 16], [26, 19], [39, 19]]);
  // lobby furniture
  for (const x of [9, 29]) { hRun(g, x, 3, 3, 'l'); hRun(g, x, 20, 3, 'l'); }
  for (const x of [15, 35]) { put(g, x, 5, 'h'); put(g, x, 18, 'h'); }
  // the boulevard: planters in single rows, the sentry plinths
  for (const x of [8, 16, 24, 32, 40]) { put(g, x, 10, 'l'); put(g, x + 1, 10, 'l'); put(g, x, 13, 'l'); put(g, x + 1, 13, 'l'); }
  hRun(g, 21, 11, 3, 'h'); hRun(g, 21, 12, 1, 'h');
  pts(g, [[23, 4], [23, 19], [44, 5], [44, 18]], 'b');
  // the service gate
  rect(g, 43, 9, 1, 6, '#'); put(g, 43, 11, '.'); put(g, 43, 12, '.');
  for (const [x, y] of tiles(45, 10, 2, 4)) put(g, x, y, 'O');
  return toRows(g);
}

export const GLASS_CANYON: MapDef = {
  name: 'Halcyon Plaza',
  rows: glassCanyon(),
  spawns: {
    player: [['soldier', 2, 11], ['assault', 3, 11], ['medic', 2, 13], ['tank', 2, 9], ['sniper', 3, 12]],
    enemy: [['sentry', 22, 12], ['sentry', 41, 8], ['drone', 30, 11], ['drone', 36, 14], ['soldier', 33, 4, 'defend']],
  },
  searchPoints: {
    player: [[12, 4], [12, 19], [32, 4], [32, 19], [44, 12]],
    enemy: [[12, 11], [30, 12], [12, 4], [12, 19]],
  },
  startTimeOfDay: 'midday',
  startWeather: 'clear',
  enemyProfile: 'standard',
  objective: { type: 'reach', unitsRequired: 3 },
  interactables: [
    { id: 20, type: 'chest', x: 18, y: 2 },
    { id: 21, type: 'chest', x: 38, y: 21 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 13, y: 3 },
    { id: 2, type: 'medkit', x: 13, y: 20 },
    { id: 3, type: 'ammo', x: 33, y: 20 },
    { id: 4, type: 'medkit', x: 29, y: 5 },
    { id: 5, type: 'gadget', x: 20, y: 11 },
  ],
};

// ------------------------------------------------------------------------------------------------ 2
/**
 * The Contract Office - `retrieve`, extract 3. 40x30, midnight, clear.
 *
 * Halcyon's legal floor: open-plan cubicles (low cover in rows), glass-walled meeting rooms, and the archive
 * at the north-east corner where the original enforcement contract - HS-114 - is kept, with the signing
 * partner's authorisation keys in a safe in the managing partner's office. The stairwell at the south-east is
 * the way out.
 *
 * Teaches: a drone at night sees further than you do (vision 9 against the squad's halved vision), so it is
 * the drones that find you, and the sentry in the archive that punishes it.
 */
function contractOffice(): string[] {
  const g = field(40, 30);
  border(g);
  // cubicle farm: rows of low partitions
  for (const y of [5, 9, 13, 17, 21]) { hRun(g, 4, y, 5, 'l'); hRun(g, 12, y, 5, 'l'); hRun(g, 20, y, 5, 'l'); }
  // the archive (north-east) and the partner's office (south-west)
  building(g, 28, 1, 11, 9, [[28, 5], [28, 6], [33, 9], [34, 9]]);
  vRun(g, 31, 2, 3, 'h'); vRun(g, 35, 5, 3, 'h');
  building(g, 1, 23, 10, 6, [[5, 23], [6, 23]]);
  pts(g, [[3, 26], [8, 26]], 'l');
  // meeting rooms along the east side
  building(g, 28, 12, 11, 6, [[28, 14], [28, 15]]);
  hRun(g, 31, 14, 5, 'h');
  // the stairwell
  building(g, 30, 21, 9, 8, [[30, 24], [30, 25]]);
  for (const [x, y] of tiles(34, 23, 3, 3)) put(g, x, y, 'O');
  pts(g, [[26, 3], [26, 25], [14, 26], [19, 26]], 'h');
  return toRows(g);
}

export const CONTRACT_OFFICE: MapDef = {
  name: 'Halcyon Legal, Floor 12',
  rows: contractOffice(),
  spawns: {
    player: [['soldier', 2, 11], ['assault', 3, 11], ['medic', 2, 13], ['tank', 2, 9], ['sniper', 3, 7]],
    enemy: [
      ['sentry', 37, 2], ['drone', 20, 11], ['drone', 14, 19], ['soldier', 32, 16, 'defend'], ['assault', 22, 24],
    ],
  },
  searchPoints: {
    player: [[10, 11], [22, 7], [33, 5], [5, 25], [33, 24]],
    enemy: [[10, 11], [22, 15], [5, 6], [26, 20]],
  },
  startTimeOfDay: 'midnight',
  startWeather: 'clear',
  enemyProfile: 'standard',
  objective: { type: 'retrieve', interactableIds: [10, 11], unitsRequired: 3, label: 'contract HS-114 and the signing keys' },
  reinforcements: [{ turn: 6, spawns: [['drone', 38, 19], ['drone', 38, 20]] }],
  interactables: [
    { id: 1, type: 'door', x: 28, y: 5, active: true },
    { id: 2, type: 'door', x: 28, y: 6, active: true },
    { id: 3, type: 'door', x: 33, y: 9 },
    { id: 4, type: 'door', x: 34, y: 9 },
    { id: 5, type: 'door', x: 5, y: 23 },
    { id: 6, type: 'door', x: 6, y: 23 },
    { id: 10, type: 'switch', x: 36, y: 7 }, // contract HS-114
    { id: 11, type: 'switch', x: 2, y: 27 }, // the signing keys
    { id: 20, type: 'chest', x: 37, y: 16 },
    { id: 21, type: 'chest', x: 9, y: 27 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 10, y: 7 },
    { id: 2, type: 'medkit', x: 18, y: 11 },
    { id: 3, type: 'ammo', x: 25, y: 19 },
    { id: 4, type: 'medkit', x: 29, y: 3 },
    { id: 5, type: 'gadget', x: 17, y: 3 },
    { id: 6, type: 'equipment', x: 3, y: 25, itemId: 'nvg' },
  ],
};

// ------------------------------------------------------------------------------------------------ 3
/**
 * The Blackout Archive - `hold` x4. 36x28, afternoon, rain.
 *
 * The incident records for the night of the Blackout are on one server in Halcyon's operations archive, and
 * they take four rounds to pull. The console is in the middle of the machine hall - rows of server racks
 * (high cover, single rows, a clear aisle behind each) - and the building's drones are recalled to it the
 * moment the download starts (reinforcements on rounds 3 and 5).
 *
 * Teaches: a hold in the middle of a room rather than a corner. There is no wall at your back; the racks run
 * east-west, so the attackers come down the aisles from both ends.
 */
function blackoutArchive(): string[] {
  const g = field(36, 28);
  border(g);
  building(g, 6, 4, 24, 20, [[6, 9], [6, 10], [29, 17], [29, 18], [17, 4], [18, 4], [17, 23], [18, 23]]);
  // server racks: single east-west rows with gaps
  for (const y of [7, 11, 16, 20]) { hRun(g, 9, y, 7, 'h'); hRun(g, 20, y, 7, 'h'); }
  put(g, 17, 13, 'O');
  pts(g, [[15, 13], [19, 14], [17, 15]], 'l');
  // outside: loading area and parked vans
  hRun(g, 2, 2, 3, 'h'); hRun(g, 31, 25, 3, 'h'); vRun(g, 32, 5, 3, 'h'); vRun(g, 2, 20, 3, 'h');
  pts(g, [[12, 2], [23, 2], [12, 25], [23, 25]], 'l');
  return toRows(g);
}

export const BLACKOUT_ARCHIVE: MapDef = {
  name: 'Halcyon Operations Archive',
  rows: blackoutArchive(),
  spawns: {
    player: [['soldier', 2, 9], ['assault', 3, 9], ['medic', 2, 11], ['tank', 2, 7], ['sniper', 3, 11]],
    enemy: [['sentry', 26, 13], ['drone', 17, 9], ['soldier', 12, 18], ['drone', 24, 22]],
  },
  searchPoints: {
    player: [[8, 10], [16, 13], [22, 14], [28, 17]],
    enemy: [[16, 13], [8, 10], [18, 5], [18, 22]],
  },
  startTimeOfDay: 'afternoon',
  startWeather: 'rain',
  enemyProfile: 'standard',
  objective: { type: 'hold', holdRounds: 4 },
  reinforcements: [
    { turn: 3, spawns: [['drone', 34, 17], ['drone', 18, 26]] },
    { turn: 5, spawns: [['assault', 34, 18], ['drone', 18, 1]] },
  ],
  interactables: [
    { id: 1, type: 'door', x: 6, y: 9, active: true },
    { id: 2, type: 'door', x: 6, y: 10, active: true },
    { id: 3, type: 'door', x: 29, y: 17 },
    { id: 4, type: 'door', x: 29, y: 18 },
    { id: 5, type: 'door', x: 17, y: 4 },
    { id: 6, type: 'door', x: 18, y: 4 },
    { id: 7, type: 'door', x: 17, y: 23 },
    { id: 8, type: 'door', x: 18, y: 23 },
    { id: 20, type: 'chest', x: 27, y: 5 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 8, y: 13 },
    { id: 2, type: 'medkit', x: 16, y: 9 },
    { id: 3, type: 'ammo', x: 19, y: 18 },
    { id: 4, type: 'medkit', x: 27, y: 14 },
    { id: 5, type: 'gadget', x: 12, y: 13 },
    { id: 6, type: 'ammo', x: 22, y: 9 },
  ],
};

// ------------------------------------------------------------------------------------------------ 4
/**
 * Security Perimeter - `sabotage` x3. 44x32, morning, fog.
 *
 * The approach to the Director's tower is covered by a sentry grid: three control nodes, each in its own
 * walled substation, each watched by a sentry. Throw all three and the grid is down.
 *
 * Teaches: fog against sentries. Fog cuts vision hard for everyone - including a sentry that relies on seeing
 * nine tiles - so this is the one map where the squad can walk up to a gun that cannot walk away.
 */
function securityPerimeter(): string[] {
  const g = field(44, 32);
  border(g);
  // three node substations: west, north, east. Each is walled with a two-wide door.
  building(g, 3, 4, 9, 8, [[7, 11], [8, 11]]);
  building(g, 18, 2, 9, 8, [[18, 5], [18, 6]]);
  building(g, 32, 4, 9, 8, [[32, 8], [33, 8]]);
  // the lawns: hedges (bush) and low walls
  for (const x of [6, 16, 26, 36]) { hRun(g, x, 16, 3, 'l'); }
  for (const x of [11, 21, 31]) { vRun(g, x, 19, 3, 'h'); }
  pts(g, [[4, 14], [5, 14], [14, 13], [15, 13], [28, 13], [29, 13], [39, 14], [40, 14], [20, 24], [21, 24], [22, 24]], 'b');
  pts(g, [[8, 24], [9, 24], [34, 24], [35, 24], [14, 8], [30, 16]], 'l');
  // the guardhouse at the south
  building(g, 17, 26, 10, 5, [[21, 26], [22, 26]]);
  return toRows(g);
}

export const SECURITY_PERIMETER: MapDef = {
  name: 'Halcyon Tower Grounds',
  rows: securityPerimeter(),
  spawns: {
    player: [['soldier', 20, 22], ['assault', 22, 22], ['medic', 21, 23], ['tank', 19, 23], ['sniper', 23, 23]],
    enemy: [
      ['sentry', 7, 14], ['sentry', 16, 5], ['sentry', 35, 13], ['drone', 21, 12], ['soldier', 37, 6, 'defend'],
    ],
  },
  searchPoints: {
    player: [[7, 13], [16, 6], [33, 10], [21, 15]],
    enemy: [[21, 15], [7, 15], [36, 15], [21, 22]],
  },
  startTimeOfDay: 'morning',
  startWeather: 'fog',
  enemyProfile: 'standard',
  objective: { type: 'sabotage', interactableIds: [10, 11, 12] },
  reinforcements: [{ turn: 5, spawns: [['drone', 1, 30], ['drone', 42, 30]] }],
  interactables: [
    { id: 1, type: 'door', x: 7, y: 11 },
    { id: 2, type: 'door', x: 8, y: 11 },
    { id: 3, type: 'door', x: 18, y: 5, active: true },
    { id: 4, type: 'door', x: 18, y: 6, active: true },
    { id: 5, type: 'door', x: 32, y: 8 },
    { id: 6, type: 'door', x: 33, y: 8 },
    { id: 10, type: 'switch', x: 4, y: 5 },   // west node
    { id: 11, type: 'switch', x: 25, y: 3 },  // north node
    { id: 12, type: 'switch', x: 39, y: 5 },  // east node
    { id: 20, type: 'chest', x: 18, y: 29 },
    { id: 21, type: 'chest', x: 25, y: 8 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 12, y: 18 },
    { id: 2, type: 'medkit', x: 31, y: 18 },
    { id: 3, type: 'ammo', x: 10, y: 5 },
    { id: 4, type: 'ammo', x: 34, y: 10 },
    { id: 5, type: 'medkit', x: 20, y: 8 },
    { id: 6, type: 'gadget', x: 21, y: 18 },
  ],
};

// ------------------------------------------------------------------------------------------------ 5
/**
 * The Director - `eliminateTarget`, Regional Director Harlan Crane. 50x30, afternoon, storm. The Uptown finale.
 *
 * The top of Halcyon Tower: the executive lift lobby, a boardroom, and the Director's terrace garden at the
 * east end, where Crane is waiting for a helicopter that is not coming. His guard is Halcyon's own - two
 * sentries, drones - and the last Wardens still on a Halcyon payroll.
 *
 * Teaches: everything in Uptown at once, in a storm (heavy accuracy and movement penalty for everyone). The
 * boardroom is the covered route; the atrium balcony is the fast one; the terrace has a low wall and nothing
 * else.
 */
function director(): string[] {
  const g = field(50, 30);
  border(g);
  // lift lobby (west)
  building(g, 1, 8, 9, 14, [[9, 12], [9, 13], [9, 17], [9, 18]]);
  // the boardroom (north) and the atrium balcony (south)
  building(g, 12, 2, 20, 11, [[12, 7], [12, 8], [31, 5], [31, 6], [21, 12], [22, 12]]);
  hRun(g, 15, 7, 12, 'l');
  pts(g, [[15, 4], [28, 4], [15, 10], [28, 10]], 'h');
  rect(g, 14, 19, 16, 1, '#'); // the atrium rail, with four ways down to the balcony
  for (const x of [18, 19, 25, 26]) put(g, x, 19, '.');
  pts(g, [[13, 15], [16, 16], [22, 15], [27, 16], [16, 23], [22, 24], [28, 23]], 'l');
  // the terrace
  vRun(g, 35, 1, 28, '#');
  for (const y of [5, 6, 14, 15, 24, 25]) put(g, 35, y, '.');
  for (const y of [4, 10, 19, 25]) hRun(g, 39, y, 5, 'l');
  pts(g, [[38, 13], [38, 16], [46, 13], [46, 16]], 'h');
  pts(g, [[44, 2], [45, 2], [44, 27], [45, 27], [48, 14], [48, 15]], 'b');
  return toRows(g);
}

export const DIRECTOR: MapDef = {
  name: 'Halcyon Tower, Level 60',
  rows: director(),
  spawns: {
    player: [['soldier', 4, 14], ['assault', 5, 14], ['medic', 4, 16], ['tank', 4, 12], ['sniper', 5, 16]],
    enemy: [
      ['soldier', 45, 15, 'defend'], // Director Crane
      ['sentry', 38, 14], ['sentry', 30, 22], ['drone', 22, 8], ['drone', 24, 25], ['tank', 33, 10, 'defend'],
    ],
  },
  searchPoints: {
    player: [[20, 6], [22, 22], [33, 15], [42, 15]],
    enemy: [[20, 6], [22, 22], [10, 15], [33, 15]],
  },
  startTimeOfDay: 'afternoon',
  startWeather: 'stormy',
  enemyProfile: 'standard',
  objective: { type: 'eliminateTarget', enemySpawnIndex: 0, label: 'Regional Director Harlan Crane' },
  reinforcements: [{ turn: 6, spawns: [['drone', 48, 2], ['drone', 48, 27]] }],
  interactables: [
    { id: 1, type: 'door', x: 9, y: 12, active: true },
    { id: 2, type: 'door', x: 9, y: 13, active: true },
    { id: 3, type: 'door', x: 12, y: 7 },
    { id: 4, type: 'door', x: 12, y: 8 },
    { id: 5, type: 'door', x: 31, y: 5 },
    { id: 6, type: 'door', x: 31, y: 6 },
    { id: 20, type: 'chest', x: 2, y: 9 },
    { id: 21, type: 'chest', x: 30, y: 3 },
    { id: 22, type: 'chest', x: 47, y: 22 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 11, y: 15 },
    { id: 2, type: 'medkit', x: 19, y: 5 },
    { id: 3, type: 'ammo', x: 20, y: 23 },
    { id: 4, type: 'medkit', x: 33, y: 20 },
    { id: 5, type: 'ammo', x: 37, y: 7 },
    { id: 6, type: 'gadget', x: 26, y: 9 },
    { id: 7, type: 'armor', x: 23, y: 5, itemId: 'ceramicPlate' },
  ],
};
