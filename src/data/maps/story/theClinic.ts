import { building, coverPairs, field, hRun, pts, put, toRows, vRun } from '../compose';
import type { MapDef } from '../../trainingGrounds';

/**
 * Market Row, mission 2 of 5 - "The Clinic". Objective: `hold`, 3 rounds.
 *
 * The inverse of "Signal Fire". There the squad started on the objective and had to survive; here the
 * dispensary console is in the far corner of a building the Jackals already hold, and the squad has to fight
 * all the way in before the hold can even start. Same objective type, opposite mission.
 *
 * 32x26 (19: a compact building - close quarters after the long street).
 *
 * Saint Brigid's is five wards and a dispensary off one long corridor. Every ward is a closed room with
 * one door, which does two things: it stops the clinic being one big room with pillars, and it means a ward
 * the squad has not opened is a ward that cannot shoot them. Three ward doors start open and two shut, so
 * some of the building is already awake and some of it is a decision.
 *
 * Three rounds rather than four: by the time the hold starts the squad has usually spent half its ammunition
 * and at least one medkit getting here, and the Jackals left alive are behind them, not in front.
 */
function compose(): string[] {
  const W = 32, H = 26;
  const g = field(W, H);
  hRun(g, 0, 0, W, '#');
  hRun(g, 0, H - 1, W, '#');
  vRun(g, 0, 0, H, '#');
  vRun(g, W - 1, 0, H, '#');

  // Ambulance yard, west.
  coverPairs(g, 6, [2]);
  coverPairs(g, 19, [2]);
  pts(g, [[4, 10], [5, 10], [4, 15], [5, 15]], 'h');
  pts(g, [[3, 2], [3, 23]], 'b');

  // The clinic shell: three ways in.
  building(g, 7, 1, 24, 24, [[7, 7], [7, 17], [19, 1]]);

  // Wards off the corridor. Interior walls, so the corridor is what is left over.
  building(g, 9, 3, 6, 8, [[12, 10]]);
  building(g, 16, 3, 6, 8, [[19, 10]]);
  building(g, 23, 3, 7, 8, [[26, 10]]);
  building(g, 9, 15, 6, 8, [[12, 15]]);
  building(g, 16, 15, 6, 8, [[19, 15]]);
  building(g, 23, 14, 7, 10, [[26, 14]]);   // the dispensary

  // The console, and the counter it sits behind.
  put(g, 27, 19, 'O');
  pts(g, [[25, 17], [26, 17], [27, 17], [28, 21]], 'l');

  // Corridor furniture: gurneys and cabinets, enough that the corridor is not a shooting gallery.
  coverPairs(g, 12, [10, 17]);
  pts(g, [[23, 12], [8, 12]], 'l');
  return toRows(g);
}

export const THE_CLINIC: MapDef = {
  name: "Saint Brigid's Clinic",
  rows: compose(),
  spawns: {
    player: [['soldier', 2, 11], ['assault', 3, 11], ['medic', 2, 13], ['tank', 2, 9], ['sniper', 3, 9]],
    enemy: [['assault', 13, 12], ['soldier', 20, 12, 'easy'], ['sniper', 29, 13], ['sniper', 12, 6], ['assault', 28, 22]],
  },
  searchPoints: {
    player: [[14, 12], [21, 12], [26, 12], [25, 21]],
    enemy: [[14, 12], [21, 12], [4, 12], [26, 12]],
  },
  startTimeOfDay: 'afternoon',
  startWeather: 'clear',
  enemyProfile: 'standard',
  objective: { type: 'hold', holdRounds: 3 },
  interactables: [
    { id: 1, type: 'door', x: 7, y: 7, active: true },
    { id: 2, type: 'door', x: 7, y: 17, active: true },
    { id: 3, type: 'door', x: 19, y: 1 },
    { id: 4, type: 'door', x: 12, y: 10, active: true },
    { id: 5, type: 'door', x: 12, y: 15 },
    { id: 6, type: 'door', x: 19, y: 10, active: true },
    { id: 7, type: 'door', x: 19, y: 15 },
    { id: 8, type: 'door', x: 26, y: 10, active: true },
    { id: 9, type: 'door', x: 26, y: 14, active: true },
    { id: 20, type: 'chest', x: 11, y: 5 },
    { id: 21, type: 'chest', x: 20, y: 20 },
    { id: 22, type: 'chest', x: 25, y: 5 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 5, y: 12 },
    { id: 2, type: 'medkit', x: 9, y: 13 },
    { id: 3, type: 'ammo', x: 15, y: 12 },
    { id: 4, type: 'medkit', x: 21, y: 13 },
    { id: 5, type: 'gadget', x: 24, y: 21 },
    { id: 6, type: 'ammo', x: 29, y: 12 },
    { id: 7, type: 'medkit', x: 24, y: 22 },
  ],
};
