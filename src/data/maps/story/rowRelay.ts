import { building, coverPairs, field, hRun, pts, put, rect, toRows, vRun } from '../compose';
import type { MapDef } from '../../trainingGrounds';

/**
 * Market Row, mission 3 of 5 - "The Row Relay". Objective: `sabotage`, both transmitters.
 *
 * The Jackals have their own relay, and this is the mission about taking it off the air. Two transmitter
 * cabinets sit in two separate rooms of a tower block; both have to be pulled.
 *
 * The new idea here is a switch that *closes* doors rather than opening them. The two dock shutters (doors 1
 * and 2) start **open** - they are how the Jackals feed reinforcements from the yard into the tower - and the
 * breaker board at (13,16), right beside the squad's approach, is linked to both. Throwing it drops both
 * shutters and cuts the tower off from the yard. Throwing it again raises them. Nothing in the objective
 * requires it; it is purely the option to decide which half of the map the fight happens in.
 *
 * Midnight and clear: dark enough that the tower's interior is fought at short range, clear enough that the
 * yard outside is still a place a sniper can work.
 */
function compose(): string[] {
  const g = field();
  hRun(g, 0, 0, 48, '#');
  hRun(g, 0, 31, 48, '#');
  vRun(g, 0, 0, 32, '#');
  vRun(g, 47, 0, 32, '#');

  // --- west: the yard, and the breaker board on a post by the gate ---
  building(g, 2, 2, 8, 7, [[5, 8]]);           // guard hut
  coverPairs(g, 12, [3, 8]);
  coverPairs(g, 21, [5, 9]);
  pts(g, [[6, 16], [7, 16], [2, 25], [3, 25], [11, 5], [11, 6]], 'h');
  pts(g, [[8, 27], [9, 27], [4, 18], [5, 18]], 'b');

  // --- the dock wall, with two shutters that start open ---
  vRun(g, 16, 1, 30, '#');
  put(g, 16, 8, '.');    // shutter 1
  put(g, 16, 23, '.');   // shutter 2

  // --- east: the tower block. Two transmitter rooms, a stairwell core, and a loop around it. ---
  building(g, 18, 2, 28, 28, [[18, 11], [18, 20], [31, 2], [45, 15]]);
  rect(g, 27, 12, 8, 7, '#');                   // the core: solid, everything goes around it
  building(g, 20, 4, 9, 7, [[24, 10]]);         // transmitter room A
  building(g, 36, 20, 9, 8, [[40, 20]]);        // transmitter room B
  building(g, 36, 4, 9, 7, [[40, 10]]);         // plant room
  building(g, 20, 21, 9, 7, [[24, 21]]);        // store room

  pts(g, [[22, 6], [23, 6], [42, 24], [43, 24], [38, 6], [39, 6], [22, 25], [23, 25]], 'l');
  coverPairs(g, 16, [21, 38]);
  coverPairs(g, 12, [21, 38]);
  pts(g, [[31, 8], [32, 8], [31, 23], [32, 23], [25, 16], [26, 16], [35, 16], [36, 16]], 'h');
  pts(g, [[33, 28], [34, 28], [20, 16], [43, 12]], 'b');
  return toRows(g);
}

// Sim, 60 AI-vs-AI matches on this map's own profile (`npm run sim -- --map row-relay --objective player`):
// player 67% / enemy 10% / draw 23%, ~22 turns.
export const ROW_RELAY: MapDef = {
  name: 'The Row Relay',
  rows: compose(),
  spawns: {
    player: [['soldier', 2, 15], ['assault', 3, 15], ['medic', 2, 17], ['tank', 2, 20], ['sniper', 3, 20]],
    enemy: [
      ['assault', 22, 15], ['sniper', 24, 7], ['soldier', 31, 25],
      ['soldier', 40, 15], ['sniper', 42, 22],
    ],
  },
  searchPoints: {
    player: [[22, 11], [31, 10], [40, 16], [31, 21]],
    enemy: [[23, 16], [31, 21], [8, 16], [40, 12]],
  },
  startTimeOfDay: 'midnight',
  startWeather: 'clear',
  enemyProfile: 'standard',
  objective: { type: 'sabotage', interactableIds: [10, 11] },
  interactables: [
    { id: 1, type: 'door', x: 16, y: 8, active: true },   // dock shutter, open
    { id: 2, type: 'door', x: 16, y: 23, active: true },  // dock shutter, open
    { id: 3, type: 'door', x: 18, y: 11, active: true },
    { id: 4, type: 'door', x: 18, y: 20 },
    { id: 5, type: 'door', x: 31, y: 2 },
    { id: 6, type: 'door', x: 24, y: 10, active: true },
    { id: 7, type: 'door', x: 40, y: 20, active: true },
    { id: 8, type: 'door', x: 5, y: 8, active: true },
    { id: 10, type: 'switch', x: 22, y: 8 },              // transmitter A
    { id: 11, type: 'switch', x: 42, y: 26 },             // transmitter B
    { id: 12, type: 'switch', x: 13, y: 16, links: [1, 2] }, // the breaker board
    { id: 20, type: 'chest', x: 4, y: 4 },
    { id: 21, type: 'chest', x: 26, y: 26 },
    { id: 22, type: 'chest', x: 43, y: 6 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 10, y: 16 },
    { id: 2, type: 'medkit', x: 20, y: 12 },
    { id: 3, type: 'ammo', x: 24, y: 19 },
    { id: 4, type: 'gadget', x: 24, y: 16 },
    { id: 5, type: 'ammo', x: 37, y: 16 },
    { id: 6, type: 'medkit', x: 43, y: 19 },
  ],
};
