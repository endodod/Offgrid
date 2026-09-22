import { building, coverPairs, field, hRun, pts, put, toRows, vRun } from '../compose';
import type { MapDef } from '../../trainingGrounds';

/**
 * Market Row, mission 2 of 5 - "The Clinic". Objective: `hold`, 3 rounds.
 *
 * The inverse of "Signal Fire". There the squad started on the objective and had to survive; here the
 * dispensary console is in the far corner of a building the Jackals already hold, and the squad has to fight
 * all the way in before the hold can even start. Same objective type, opposite mission.
 *
 * Saint Brigid's is five wards and a dispensary off two crossing corridors. Every ward is a closed room with
 * one door, which does two things: it stops the clinic being one big room with pillars, and it means a ward
 * the squad has not opened is a ward that cannot shoot them. Three ward doors start open and two shut, so
 * some of the building is already awake and some of it is a decision.
 *
 * Three rounds rather than four: by the time the hold starts the squad has usually spent half its ammunition
 * and at least one medkit getting here, and the Jackals left alive are behind them, not in front.
 */
function compose(): string[] {
  const g = field();
  hRun(g, 0, 0, 48, '#');
  hRun(g, 0, 31, 48, '#');
  vRun(g, 0, 0, 32, '#');
  vRun(g, 47, 0, 32, '#');

  // Ambulance yard, west.
  coverPairs(g, 8, [2, 6]);
  coverPairs(g, 22, [2, 6]);
  pts(g, [[4, 12], [5, 12], [4, 19], [5, 19]], 'h');
  pts(g, [[7, 3], [8, 3], [7, 28], [8, 28]], 'b');

  // The clinic shell: three ways in.
  building(g, 10, 2, 37, 28, [[10, 9], [10, 22], [28, 2]]);

  // Wards off the corridors. Interior walls, so the corridors are what is left over.
  building(g, 12, 4, 8, 9, [[15, 12]]);
  building(g, 12, 19, 8, 9, [[15, 19]]);
  building(g, 22, 4, 8, 9, [[25, 12]]);
  building(g, 22, 19, 8, 9, [[25, 19]]);
  building(g, 33, 4, 9, 9, [[37, 12]]);
  building(g, 33, 19, 12, 10, [[37, 19]]);   // the dispensary

  // The console, and the counter it sits behind.
  put(g, 39, 24, 'O');
  pts(g, [[38, 22], [39, 22], [40, 22], [41, 25], [42, 25]], 'l');

  // Corridor furniture: gurneys and cabinets, enough that a corridor is not a shooting gallery.
  coverPairs(g, 15, [13, 23, 34]);
  coverPairs(g, 17, [18, 28, 39]);
  pts(g, [[20, 6], [21, 6], [30, 9], [31, 9], [20, 25], [21, 25], [31, 22], [32, 22]], 'h');
  pts(g, [[44, 6], [45, 6], [44, 15], [45, 15], [11, 16], [11, 17]], 'l');
  pts(g, [[43, 10], [43, 11], [26, 3], [27, 3]], 'b'); // not on y=2: that is the clinic's outer wall
  return toRows(g);
}

// Sim, 60 AI-vs-AI matches on this map's own profile (`npm run sim -- --map clinic --objective player`):
// player 78% / enemy 8% / draw 13%, ~15 turns.
export const THE_CLINIC: MapDef = {
  name: "Saint Brigid's Clinic",
  rows: compose(),
  spawns: {
    player: [['soldier', 2, 15], ['assault', 3, 15], ['medic', 2, 17], ['tank', 2, 13], ['sniper', 3, 13]],
    enemy: [
      ['assault', 16, 16], ['soldier', 26, 16], ['sniper', 16, 8],
      ['soldier', 37, 16], ['assault', 43, 21],
    ],
  },
  searchPoints: {
    player: [[16, 16], [26, 16], [37, 16], [43, 25]],
    enemy: [[16, 16], [26, 16], [5, 16], [37, 16]],
  },
  startTimeOfDay: 'afternoon',
  startWeather: 'clear',
  enemyProfile: 'standard',
  objective: { type: 'hold', holdRounds: 3 },
  interactables: [
    { id: 1, type: 'door', x: 10, y: 9, active: true },
    { id: 2, type: 'door', x: 10, y: 22, active: true },
    { id: 3, type: 'door', x: 28, y: 2 },
    { id: 4, type: 'door', x: 15, y: 12, active: true },
    { id: 5, type: 'door', x: 15, y: 19 },
    { id: 6, type: 'door', x: 25, y: 12, active: true },
    { id: 7, type: 'door', x: 25, y: 19 },
    { id: 8, type: 'door', x: 37, y: 12, active: true },
    { id: 9, type: 'door', x: 37, y: 19, active: true },
    { id: 20, type: 'chest', x: 17, y: 6 },
    { id: 21, type: 'chest', x: 27, y: 25 },
    { id: 22, type: 'chest', x: 35, y: 6 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 7, y: 16 },
    { id: 2, type: 'medkit', x: 13, y: 16 },
    { id: 3, type: 'ammo', x: 21, y: 16 },
    { id: 4, type: 'medkit', x: 31, y: 16 },
    { id: 5, type: 'gadget', x: 31, y: 26 },
    { id: 6, type: 'ammo', x: 43, y: 16 },
    { id: 7, type: 'medkit', x: 35, y: 27 },
  ],
};
