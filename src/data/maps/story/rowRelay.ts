import { building, coverPairs, field, hRun, pts, put, rect, toRows, vRun } from '../compose';
import type { MapDef } from '../../trainingGrounds';

/**
 * Market Row, mission 3 of 5 - "The Row Relay". Objective: `sabotage`, both transmitters.
 *
 * 40x36 (19: turned upright - the yard is south, the tower north, the dock wall between them).
 *
 * The Jackals have their own relay, and this is the mission about taking it off the air. Two transmitter
 * cabinets sit in two separate rooms of a tower block; both have to be pulled.
 *
 * The new idea here is a switch that *closes* doors rather than opening them. The two dock shutters (doors 1
 * and 2) start **open** - they are how the Jackals feed reinforcements from the yard into the tower - and the
 * breaker board at (12,28), right beside the squad's approach, is linked to both. Throwing it drops both
 * shutters and cuts the tower off from the yard. Throwing it again raises them. Nothing in the objective
 * requires it; it is purely the option to decide which half of the map the fight happens in.
 *
 * Midnight and clear: dark enough that the tower's interior is fought at short range, clear enough that the
 * yard outside is still a place a sniper can work.
 */
function compose(): string[] {
  const W = 40, H = 36;
  const g = field(W, H);
  hRun(g, 0, 0, W, '#');
  hRun(g, 0, H - 1, W, '#');
  vRun(g, 0, 0, H, '#');
  vRun(g, W - 1, 0, H, '#');

  // --- south: the yard, and the breaker board on a post by the gate ---
  building(g, 2, 28, 7, 6, [[5, 28]]);          // guard hut
  coverPairs(g, 30, [14, 24]);
  pts(g, [[20, 32], [21, 32], [33, 29], [34, 29]], 'h');
  pts(g, [[16, 27], [26, 33]], 'b');

  // --- the dock wall, with two shutters that start open ---
  hRun(g, 1, 25, W - 2, '#');
  put(g, 8, 25, '.');    // shutter 1
  put(g, 30, 25, '.');   // shutter 2
  put(g, 19, 25, '.'); put(g, 20, 25, '.'); // a collapsed stretch the Jackals never fixed: always open

  // --- north: the tower block. Two transmitter rooms, a stairwell core, and a loop around it. ---
  building(g, 2, 2, 36, 21, [[12, 22], [28, 22], [2, 12], [37, 12]]);
  put(g, 20, 22, '.'); put(g, 21, 22, '.');    // blast hole in the tower's south wall
  rect(g, 16, 9, 8, 7, '#');                    // the core: solid, everything goes around it
  building(g, 4, 4, 9, 7, [[8, 10]]);           // transmitter room A
  building(g, 27, 14, 9, 7, [[31, 14]]);        // transmitter room B
  building(g, 27, 4, 9, 7, [[31, 10]]);         // plant room
  building(g, 4, 14, 9, 7, [[8, 14]]);          // store room
  pts(g, [[6, 6], [7, 6], [32, 18], [31, 18], [29, 6], [30, 6], [6, 18], [7, 18]], 'l');
  coverPairs(g, 12, [14, 25]);
  pts(g, [[19, 5], [20, 5], [19, 19], [20, 19]], 'h');
  pts(g, [[15, 17], [25, 7]], 'b');
  return toRows(g);
}

export const ROW_RELAY: MapDef = {
  name: 'The Row Relay',
  rows: compose(),
  spawns: {
    player: [['soldier', 17, 33], ['assault', 19, 33], ['medic', 21, 33], ['tank', 18, 34], ['sniper', 20, 34]],
    enemy: [['assault', 13, 13], ['sniper', 10, 7], ['soldier', 20, 20], ['soldier', 32, 12], ['sniper', 33, 17]],
  },
  searchPoints: {
    player: [[10, 12], [20, 7], [26, 13], [20, 20]],
    enemy: [[13, 17], [20, 20], [20, 30], [26, 13]],
  },
  startTimeOfDay: 'midnight',
  startWeather: 'clear',
  enemyProfile: 'easy',
  objective: { type: 'sabotage', interactableIds: [10, 11] },
  interactables: [
    { id: 1, type: 'door', x: 8, y: 25, active: true },   // dock shutter, open
    { id: 2, type: 'door', x: 30, y: 25, active: true },  // dock shutter, open
    { id: 3, type: 'door', x: 12, y: 22, active: true },
    { id: 4, type: 'door', x: 28, y: 22 },
    { id: 5, type: 'door', x: 2, y: 12 },
    { id: 6, type: 'door', x: 8, y: 10, active: true },
    { id: 7, type: 'door', x: 31, y: 14, active: true },
    { id: 8, type: 'door', x: 5, y: 28, active: true },
    { id: 10, type: 'switch', x: 5, y: 5 },               // transmitter A
    { id: 11, type: 'switch', x: 33, y: 19 },             // transmitter B
    { id: 12, type: 'switch', x: 12, y: 28, links: [1, 2] }, // the breaker board
    { id: 20, type: 'chest', x: 4, y: 31 },
    { id: 21, type: 'chest', x: 6, y: 16 },
    { id: 22, type: 'chest', x: 33, y: 6 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 16, y: 30 },
    { id: 2, type: 'medkit', x: 14, y: 21 },
    { id: 3, type: 'ammo', x: 24, y: 17 },
    { id: 4, type: 'gadget', x: 20, y: 17 },
    { id: 5, type: 'ammo', x: 26, y: 13 },
    { id: 6, type: 'medkit', x: 36, y: 20 },
  ],
};
