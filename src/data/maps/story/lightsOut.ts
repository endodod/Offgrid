import { building, coverPairs, field, hRun, pts, put, toRows, vRun } from '../compose';
import type { MapDef } from '../../trainingGrounds';

/**
 * Riverside, mission 1 of 5 - "Lights Out". Objective: `sabotage`, both breakers. 34x24 (19: the Act 1 rework
 * gave every mission its own size; the first one is small on purpose - a first mission should fit the eye).
 *
 * The map is cut in half by a chain-link fence at x=12 with two ways through: a gate at (12,11) that starts
 * closed, and a torn breach at (12,18)-(12,19) that never does. That is the first thing the mission teaches -
 * not "walk forward", but "pick your entry". The gate is the short, exposed route straight into the yard; the
 * breach is a longer walk that puts you behind the transformer pens.
 *
 * The two breakers are at opposite ends of the compound: Breaker A inside the control building in the north-east,
 * Breaker B at the back of the easternmost transformer pen, open only along its south side. Splitting or
 * committing is the second thing it teaches.
 *
 * The control building's door starts *open*: the mandatory room is never behind a door on mission 1.
 */
function compose(): string[] {
  const W = 34, H = 24;
  const g = field(W, H);
  hRun(g, 0, 0, W, '#');
  hRun(g, 0, H - 1, W, '#');
  vRun(g, 0, 0, H, '#');
  vRun(g, W - 1, 0, H, '#');

  // --- west: the street the squad comes up ---
  building(g, 1, 1, 8, 6, [[5, 6]]);            // tenement, one way in off the street
  building(g, 1, 14, 7, 6, [[7, 17]]);          // garage, door onto the fence road
  coverPairs(g, 9, [3, 7]);                     // dead cars along the kerb
  pts(g, [[9, 4], [10, 4], [9, 5]], 'h');       // skip bin
  pts(g, [[9, 13], [10, 14], [9, 15], [10, 20], [9, 21]], 'b'); // overgrown lot

  // --- the fence ---
  vRun(g, 12, 1, H - 2, '#');
  put(g, 12, 11, '.');                          // gate (door 2), closed at start
  put(g, 12, 18, '.'); put(g, 12, 19, '.');     // torn breach, always open

  // --- east: the substation compound ---
  building(g, 23, 1, 10, 7, [[27, 7]]);         // control building; Breaker A lives in here
  pts(g, [[29, 3], [30, 3]], 'l');              // cabinets inside
  // Transformer pens: three walled bays, each open along its south side only.
  const pen = (x: number, y: number, w: number, h: number) => {
    hRun(g, x, y, w, '#'); vRun(g, x, y, h, '#'); vRun(g, x + w - 1, y, h, '#');
  };
  pen(15, 13, 5, 6);
  pen(21, 13, 5, 6);
  pen(27, 13, 5, 6);

  // Yard clutter: enough cover to cross, not enough to cross safely.
  pts(g, [[15, 4], [16, 4], [19, 8], [20, 8]], 'h');
  coverPairs(g, 10, [15, 24, 29]);
  pts(g, [[16, 21], [22, 21], [23, 21], [29, 21]], 'l');
  pts(g, [[31, 10], [31, 11], [14, 16]], 'b');
  return toRows(g);
}

export const LIGHTS_OUT: MapDef = {
  name: 'Riverside Substation',
  rows: compose(),
  spawns: {
    player: [['soldier', 2, 21], ['assault', 4, 21], ['medic', 6, 21], ['tank', 3, 22], ['sniper', 5, 22]],
    enemy: [['assault', 20, 9], ['soldier', 23, 20], ['sniper', 26, 4], ['assault', 30, 20]],
  },
  searchPoints: {
    player: [[20, 10], [27, 9], [24, 20], [5, 3]],
    enemy: [[6, 11], [17, 11], [10, 20], [28, 21]],
  },
  startTimeOfDay: 'afternoon',
  startWeather: 'clear',
  enemyProfile: 'easy',
  objective: { type: 'sabotage', interactableIds: [10, 11] },
  interactables: [
    { id: 1, type: 'door', x: 27, y: 7, active: true }, // control building - deliberately open, see above
    { id: 2, type: 'door', x: 12, y: 11 },              // the gate
    { id: 3, type: 'door', x: 5, y: 6 },                // tenement
    { id: 4, type: 'door', x: 7, y: 17 },               // garage
    { id: 10, type: 'switch', x: 25, y: 3 },            // Breaker A
    { id: 11, type: 'switch', x: 29, y: 14 },           // Breaker B
    { id: 20, type: 'chest', x: 3, y: 3 },
    { id: 21, type: 'chest', x: 3, y: 18 },
    { id: 22, type: 'chest', x: 23, y: 15 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 9, y: 11 },
    { id: 2, type: 'medkit', x: 10, y: 21 },
    { id: 3, type: 'ammo', x: 18, y: 20 },
    { id: 4, type: 'gadget', x: 20, y: 3 },
    { id: 5, type: 'medkit', x: 31, y: 9 },
  ],
};
