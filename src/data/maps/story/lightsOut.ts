import { building, coverPairs, field, hRun, pts, put, stamp, toRows, vRun } from '../compose';
import type { MapDef } from '../../trainingGrounds';

/**
 * Riverside, mission 1 of 5 - "Lights Out". Objective: `sabotage`, both breakers.
 *
 * The map is cut in half by a chain-link fence at x=16 with exactly three ways through: a gate at (16,16)
 * that starts closed, and a torn breach at (16,24)-(16,25). That is the first thing the mission teaches -
 * not "walk forward", but "pick your entry". The gate is the short, exposed route straight into the yard;
 * the breach is a long walk that puts you behind the transformer pens.
 *
 * The two breakers are at opposite corners of the compound: Breaker A is inside the control building in the
 * north-east, Breaker B is at the back of the southern transformer pen, which is open only along one side.
 * Splitting or committing is the second thing it teaches.
 *
 * The control building's door starts *open*. An earlier draft sealed a sniper in with Breaker A, which was
 * atmospheric and wrong: the AI does not open doors, so it also made "eliminate every enemy" unreachable
 * until the player breached. The optional route is the closed door here; the mandatory room is not.
 */
function compose(): string[] {
  const g = field();
  // River to the north, collapsed embankment south: the block is a closed box.
  hRun(g, 0, 0, 48, '#');
  hRun(g, 0, 31, 48, '#');
  vRun(g, 0, 0, 32, '#');
  vRun(g, 47, 0, 32, '#');

  // --- west: the street the squad comes up ---
  building(g, 1, 1, 12, 8, [[6, 8]]);          // tenement row, one way in off the street
  building(g, 1, 11, 7, 7, [[4, 17]]);         // corner shop
  building(g, 1, 21, 9, 7, [[9, 24]]);         // garage, door onto the fence road
  coverPairs(g, 10, [9, 13]);                  // dead cars along the kerb
  coverPairs(g, 19, [10, 13]);
  pts(g, [[10, 14], [11, 14], [10, 15], [11, 15]], 'h'); // skip bin
  pts(g, [[11, 22], [12, 22], [13, 23], [11, 24], [12, 25], [13, 25]], 'b'); // overgrown lot
  pts(g, [[4, 19], [5, 19], [6, 26], [7, 26]], 'h');

  // --- the fence ---
  vRun(g, 16, 1, 30, '#');
  put(g, 16, 16, '.');                          // gate (door 2), closed at start
  put(g, 16, 24, '.'); put(g, 16, 25, '.');     // torn breach, always open

  // --- east: the substation compound ---
  building(g, 34, 2, 12, 9, [[39, 10]]);        // control building; Breaker A lives in here
  pts(g, [[38, 6], [39, 6], [43, 4], [43, 5]], 'l'); // cabinets inside, so the room is not a bare box

  // Transformer pens: three walled bays, each open along its south side only.
  const pen = (x: number, y: number, w: number, h: number) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(g, i, j, '.');
    hRun(g, x, y, w, '#'); vRun(g, x, y, h, '#'); vRun(g, x + w - 1, y, h, '#');
  };
  pen(20, 18, 6, 8);
  pen(28, 18, 6, 8);
  pen(36, 18, 6, 8);

  // Yard clutter: enough cover to cross, not enough to cross safely.
  stamp(g, 19, 5, [
    'hh...  ..hh',
    '     ..    ',
  ]);
  pts(g, [[24, 12], [25, 12], [30, 12], [31, 12], [36, 13], [37, 13]], 'h');
  coverPairs(g, 15, [21, 29, 42]);
  pts(g, [[43, 19], [44, 19], [43, 20], [26, 29], [27, 29], [34, 29]], 'b');
  coverPairs(g, 28, [19, 44]);
  return toRows(g);
}

// Sim, 60 AI-vs-AI matches on this map's own profile (`npm run sim -- --map lights-out --objective player`):
// player 92% / enemy 2% / draw 7%, ~16 turns.
export const LIGHTS_OUT: MapDef = {
  name: 'Riverside Substation',
  rows: compose(),
  spawns: {
    player: [['soldier', 2, 28], ['assault', 4, 28], ['medic', 6, 28], ['tank', 2, 30], ['sniper', 4, 30]],
    enemy: [
      ['assault', 22, 14], ['soldier', 24, 28], ['sniper', 36, 4], ['assault', 43, 23], ['soldier', 20, 8],
    ],
  },
  searchPoints: {
    player: [[30, 16], [39, 8], [22, 24], [14, 5]],
    enemy: [[8, 20], [24, 16], [14, 5], [38, 27]],
  },
  startTimeOfDay: 'afternoon',
  startWeather: 'clear',
  enemyProfile: 'easy',
  objective: { type: 'sabotage', interactableIds: [10, 11] },
  interactables: [
    { id: 1, type: 'door', x: 39, y: 10, active: true }, // control building - deliberately open, see above
    { id: 2, type: 'door', x: 16, y: 16 },               // the gate
    { id: 3, type: 'door', x: 6, y: 8 },                 // tenement
    { id: 4, type: 'door', x: 9, y: 24 },                // garage
    { id: 10, type: 'switch', x: 37, y: 4 },             // Breaker A
    { id: 11, type: 'switch', x: 38, y: 20 },            // Breaker B
    { id: 20, type: 'chest', x: 4, y: 4 },
    { id: 21, type: 'chest', x: 3, y: 24 },
    { id: 22, type: 'chest', x: 30, y: 21 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 9, y: 17 },
    { id: 2, type: 'medkit', x: 13, y: 28 },
    { id: 3, type: 'ammo', x: 22, y: 22 },
    { id: 4, type: 'gadget', x: 30, y: 6 },
    { id: 5, type: 'medkit', x: 44, y: 14 },
    { id: 6, type: 'ammo', x: 19, y: 2 },
  ],
};
