import { building, coverPairs, field, pts, put, rect, toRows, vRun } from '../compose';
import type { MapDef } from '../../trainingGrounds';

/**
 * Riverside, mission 5 of 5 - "The Tollgate". Objective: `eliminateTarget`, Halloway (enemy spawn index 0).
 *
 * The district finale, and the only Riverside map with no flanks at all: the Kestrel Bridge approach is a
 * causeway with open water north and south, so the whole fight is sixteen rows wide and forty-six long. Three
 * barricade lines cross it, each with its gaps in a different place, so "advance" means committing to a lane
 * and then changing lanes under fire.
 *
 * Halloway sits in the toll house at the far end on the `camper` profile - he holds what he has rather than
 * coming to meet you, which on a map with no way around him means the mission ends where the map does.
 *
 * Fog is the counterweight to having no cover to flank through: vision cut by half means the barricades can
 * be crossed at all. A squad carrying `flashlight` halves that back again, which is the first time the
 * equipment screen visibly decides how a mission opens.
 */
function compose(): string[] {
  const g = field();
  // The river: everything outside the causeway is water.
  rect(g, 0, 0, 48, 8, '#');
  rect(g, 0, 24, 48, 8, '#');
  vRun(g, 0, 8, 16, '#');
  vRun(g, 47, 8, 16, '#');

  // Two half-collapsed piers reaching into the water - the only ground off the road.
  rect(g, 14, 5, 5, 3, '.');
  rect(g, 30, 24, 5, 3, '.');
  pts(g, [[15, 6], [16, 6], [31, 25], [32, 25]], 'l');

  // Barricade lines. Gaps stagger so no lane runs the length of the bridge.
  const barricade = (x: number, gaps: number[]) => {
    vRun(g, x, 8, 16, 'h');
    // three tiles wide: two is enough for the AI to jam on itself at a chokepoint (ASSUMPTIONS.md, Enemy AI)
    for (const y of gaps) for (let j = 0; j < 3; j++) put(g, x, y + j, '.');
  };
  barricade(12, [10, 19]);
  barricade(22, [14, 21]);
  barricade(31, [9, 17]);

  // Abandoned convoy along the road: soft cover between the hard lines.
  coverPairs(g, 11, [16, 26]);
  coverPairs(g, 16, [8, 18, 27]);
  coverPairs(g, 21, [16, 26]);
  pts(g, [[7, 13], [7, 14], [26, 12], [27, 12], [18, 20], [19, 20]], 'h');
  pts(g, [[9, 20], [10, 20], [25, 22], [26, 22]], 'b');

  // The toll house: one door, facing back down the bridge.
  building(g, 37, 9, 10, 14, [[37, 16]]);
  pts(g, [[40, 12], [41, 12], [40, 20], [41, 20], [44, 16]], 'l');
  rect(g, 34, 9, 3, 3, '#');      // sandbagged post: solid, not a room
  return toRows(g);
}

// Sim, 60 AI-vs-AI matches on this map's own profile (`npm run sim -- --map tollgate --objective player`):
// player 62% / enemy 2% / draw 37% - the draws are Halloway camping, which a human digs out.
export const TOLLGATE: MapDef = {
  name: 'Kestrel Bridge Tollgate',
  rows: compose(),
  spawns: {
    player: [['soldier', 2, 14], ['assault', 3, 14], ['medic', 2, 16], ['tank', 2, 18], ['sniper', 3, 18]],
    enemy: [
      ['tank', 42, 16, 'camper'],
      ['assault', 15, 12], ['soldier', 15, 20], ['sniper', 20, 16], ['assault', 26, 10],
    ],
  },
  searchPoints: {
    player: [[16, 16], [25, 16], [35, 16], [42, 12]],
    enemy: [[16, 16], [25, 16], [7, 16], [35, 16]],
  },
  startTimeOfDay: 'afternoon',
  startWeather: 'fog',
  enemyProfile: 'standard',
  objective: { type: 'eliminateTarget', enemySpawnIndex: 0, label: 'Halloway, who runs the tollgate' },
  interactables: [
    { id: 1, type: 'door', x: 37, y: 16, active: true },
    { id: 20, type: 'chest', x: 17, y: 6 },
    { id: 21, type: 'chest', x: 32, y: 26 },
    { id: 22, type: 'chest', x: 45, y: 21 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 9, y: 11 },
    { id: 2, type: 'medkit', x: 14, y: 16 },
    { id: 3, type: 'ammo', x: 21, y: 11 },
    { id: 4, type: 'gadget', x: 24, y: 16 },
    { id: 5, type: 'ammo', x: 29, y: 21 },
    { id: 6, type: 'medkit', x: 34, y: 16 },
  ],
};
