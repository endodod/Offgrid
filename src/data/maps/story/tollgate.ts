import { building, coverPairs, field, pts, put, rect, toRows, vRun } from '../compose';
import type { MapDef } from '../../trainingGrounds';

/**
 * Riverside, mission 5 of 5 - "The Tollgate". Objective: `eliminateTarget`, Halloway (enemy spawn index 0).
 * 62x16 (19: the longest, narrowest map in the act - a bridge has no way round).
 *
 * The district finale, and the only Riverside map with no flanks at all: the Kestrel Bridge causeway is ten
 * rows wide with open water north and south, and sixty long. Three barricade lines cross it, each with its
 * gaps in a different place, so "advance" means committing to a lane and then changing lanes under fire.
 *
 * Halloway sits in the toll house at the far end on the `camper` profile - he holds what he has rather than
 * coming to meet you, which on a map with no way around him means the mission ends where the map does.
 *
 * Fog is the counterweight to having no cover to flank through: vision cut by half means the barricades can
 * be crossed at all. A squad carrying `flashlight` halves that back again, which is the first time the
 * equipment screen visibly decides how a mission opens.
 */
function compose(): string[] {
  const W = 62, H = 16;
  const g = field(W, H);
  // The river: everything outside the causeway is water.
  rect(g, 0, 0, W, 3, '#');
  rect(g, 0, 13, W, 3, '#');
  vRun(g, 0, 3, 10, '#');
  vRun(g, W - 1, 3, 10, '#');

  // Two half-collapsed piers reaching into the water - the only ground off the road.
  rect(g, 20, 1, 5, 2, '.');
  rect(g, 42, 13, 5, 2, '.');

  // Barricade lines. Gaps stagger so no lane runs the length of the bridge.
  const barricade = (x: number, gaps: number[]) => {
    vRun(g, x, 3, 10, 'h');
    // three tiles wide: two is enough for the AI to jam on itself at a chokepoint (ASSUMPTIONS.md, Enemy AI)
    for (const y of gaps) for (let j = 0; j < 3; j++) put(g, x, y + j, '.');
  };
  barricade(14, [3, 9]);
  barricade(26, [6, 10]);
  barricade(38, [3, 8]);

  // Abandoned convoy along the road: soft cover between the hard lines.
  coverPairs(g, 5, [18, 31, 44]);
  coverPairs(g, 8, [9, 21, 33]);
  coverPairs(g, 11, [18, 31]);
  pts(g, [[8, 4], [8, 5], [32, 11], [33, 11]], 'h');
  pts(g, [[11, 11], [12, 11], [45, 4]], 'b');

  // The toll house: one door, facing back down the bridge.
  building(g, 50, 3, 11, 10, [[50, 8]]);
  pts(g, [[53, 5], [54, 5], [53, 10], [54, 10], [58, 8]], 'l');
  rect(g, 46, 3, 3, 3, '#');      // sandbagged post: solid, not a room
  return toRows(g);
}

export const TOLLGATE: MapDef = {
  name: 'Kestrel Bridge Tollgate',
  rows: compose(),
  spawns: {
    player: [['soldier', 2, 6], ['assault', 3, 6], ['medic', 2, 8], ['tank', 2, 10], ['sniper', 3, 10]],
    enemy: [
      ['tank', 57, 8, 'camper'],
      ['assault', 18, 4], ['soldier', 18, 10], ['sniper', 24, 7], ['assault', 34, 4],
    ],
  },
  searchPoints: {
    player: [[20, 8], [32, 8], [44, 8], [55, 6]],
    enemy: [[20, 8], [32, 8], [8, 8], [44, 8]],
  },
  startTimeOfDay: 'afternoon',
  startWeather: 'fog',
  enemyProfile: 'standard',
  objective: { type: 'eliminateTarget', enemySpawnIndex: 0, label: 'Halloway, who runs the tollgate' },
  // 10j: the boss room is sealed on purpose - the squad breaches it, the boss never walks out.
  aiOpensDoors: false,
  interactables: [
    { id: 1, type: 'door', x: 50, y: 8, active: true },
    { id: 20, type: 'chest', x: 22, y: 1 },
    { id: 21, type: 'chest', x: 44, y: 14 },
    { id: 22, type: 'chest', x: 59, y: 11 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 10, y: 4 },
    { id: 2, type: 'medkit', x: 16, y: 7 },
    { id: 3, type: 'ammo', x: 28, y: 4 },
    { id: 4, type: 'gadget', x: 30, y: 8 },
    { id: 5, type: 'ammo', x: 40, y: 11 },
    { id: 6, type: 'medkit', x: 45, y: 8 },
  ],
};
