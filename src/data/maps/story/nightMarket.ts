import { building, field, hRun, pts, put, rect, toRows, vRun } from '../compose';
import type { MapDef } from '../../trainingGrounds';

/**
 * Market Row, mission 4 of 5 - "The Night Market". Objective: `eliminateTarget`, Sable (enemy spawn index 0).
 *
 * 36x36 (19: a square - the stalls fill it edge to edge, and the counting house faces down through them).
 *
 * The concealment mission. The night market is tarpaulin after tarpaulin - a grid of bush tiles, which are
 * walkable, do not block line of sight, and hide whoever is standing in them until an observer gets within
 * two tiles (ASSUMPTIONS.md, Fog of war). At midnight, with vision halved, that turns the whole middle of the
 * map into a place where both sides are somewhere nearby and neither knows where.
 *
 * It is also the mission where bush *exposure* bites: anything but moving while standing in a tarpaulin
 * reveals the unit until its own next phase. Shooting from concealment here costs the concealment, and with
 * six Jackals on the map that is usually the whole trade.
 *
 * Sable, the Jackals' quartermaster, sits in the counting house on the `camper` profile and does not wander
 * into the tarpaulins - so this is a hunt through cover toward a fixed point, not a hunt for a moving target.
 */
function compose(): string[] {
  const W = 36, H = 36;
  const g = field(W, H);
  hRun(g, 0, 0, W, '#');
  hRun(g, 0, H - 1, W, '#');
  vRun(g, 0, 0, H, '#');
  vRun(g, W - 1, 0, H, '#');

  // Lock-ups in the corners of the square.
  building(g, 1, 1, 6, 5, [[3, 5]]);
  building(g, 29, 1, 6, 5, [[31, 5]]);
  building(g, 1, 30, 6, 5, [[3, 30]]);
  building(g, 29, 30, 6, 5, [[31, 30]]);

  // The stall grid: 3x2 blocks of tarpaulin with lanes between them.
  for (let bx = 0; bx < 5; bx++) {
    for (let by = 0; by < 4; by++) {
      const x = 4 + bx * 6;
      const y = 10 + by * 5;
      rect(g, x, y, 3, 2, 'b');
      pts(g, [[x + 4, y], [x + 4, y + 1]], 'l'); // the stall's own counter, hard cover beside soft
    }
  }
  pts(g, [[13, 18], [14, 18], [25, 18], [26, 18]], 'h');

  // The counting house: a walled box at the north end of the square, one door facing the stalls.
  building(g, 12, 1, 12, 7, [[17, 7]]);
  pts(g, [[14, 3], [15, 3], [20, 3], [21, 3], [18, 5]], 'l');
  return toRows(g);
}

export const NIGHT_MARKET: MapDef = {
  name: 'The Night Market',
  rows: compose(),
  spawns: {
    player: [['soldier', 15, 33], ['assault', 17, 33], ['medic', 19, 33], ['tank', 16, 34], ['sniper', 18, 34]],
    enemy: [
      ['soldier', 17, 3, 'camper'],
      ['assault', 10, 13], ['sniper', 5, 8], ['assault', 24, 23], ['soldier', 28, 13], ['sniper', 31, 8],
    ],
  },
  searchPoints: {
    player: [[17, 18], [10, 13], [26, 13], [17, 9]],
    enemy: [[17, 18], [8, 23], [26, 23], [17, 30]],
  },
  startTimeOfDay: 'midnight',
  startWeather: 'cloudy',
  enemyProfile: 'standard',
  objective: { type: 'eliminateTarget', enemySpawnIndex: 0, label: 'Sable, the Jackals quartermaster' },
  interactables: [
    { id: 1, type: 'door', x: 17, y: 7, active: true },
    { id: 2, type: 'door', x: 3, y: 5, active: true },
    { id: 3, type: 'door', x: 31, y: 5 },
    { id: 4, type: 'door', x: 31, y: 30 },
    { id: 5, type: 'door', x: 3, y: 30 },
    { id: 20, type: 'chest', x: 3, y: 2 },
    { id: 21, type: 'chest', x: 32, y: 2 },
    { id: 22, type: 'chest', x: 32, y: 32 },
    { id: 23, type: 'chest', x: 3, y: 32 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 8, y: 18 },
    { id: 2, type: 'medkit', x: 14, y: 13 },
    { id: 3, type: 'ammo', x: 22, y: 18 },
    { id: 4, type: 'gadget', x: 26, y: 13 },
    { id: 5, type: 'ammo', x: 32, y: 18 },
    { id: 6, type: 'medkit', x: 20, y: 28 },
  ],
};
