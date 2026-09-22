import { building, field, hRun, pts, put, rect, toRows, vRun } from '../compose';
import type { MapDef } from '../../trainingGrounds';

/**
 * Market Row, mission 4 of 5 - "The Night Market". Objective: `eliminateTarget`, Sable (enemy spawn index 0).
 *
 * The concealment mission. The night market is tarpaulin after tarpaulin - a grid of bush tiles, which are
 * walkable, do not block line of sight, and hide whoever is standing in them until an observer gets within
 * two tiles (ASSUMPTIONS.md, Fog of war). At midnight, with vision halved, that turns the whole middle of the
 * map into a place where both sides are somewhere nearby and neither knows where.
 *
 * It is also the mission where bush *exposure* bites: anything but moving while standing in a tarpaulin
 * reveals the unit until its own next phase. Shooting from concealment here costs the concealment, and with
 * nine Jackals on the map that is usually the whole trade.
 *
 * Sable, the Jackals' quartermaster, sits in the counting house on the `camper` profile and does not wander
 * into the tarpaulins - so this is a hunt through cover toward a fixed point, not a hunt for a moving target.
 */
function compose(): string[] {
  const g = field();
  hRun(g, 0, 0, 48, '#');
  hRun(g, 0, 31, 48, '#');
  vRun(g, 0, 0, 32, '#');
  vRun(g, 47, 0, 32, '#');

  // Lock-ups around the edge of the square.
  building(g, 1, 1, 7, 6, [[4, 6]]);
  building(g, 1, 25, 7, 6, [[4, 25]]);
  building(g, 40, 1, 7, 6, [[43, 6]]);
  building(g, 14, 1, 6, 5, [[16, 5]]);
  building(g, 28, 27, 7, 4, [[31, 27]]);

  // The stall grid: 3x2 blocks of tarpaulin with one-tile lanes between them.
  for (let bx = 0; bx < 6; bx++) {
    for (let by = 0; by < 4; by++) {
      const x = 5 + bx * 6;
      const y = 8 + by * 5;
      rect(g, x, y, 3, 2, 'b');
      pts(g, [[x + 4, y], [x + 4, y + 1]], 'l'); // the stall's own counter, hard cover beside soft
    }
  }
  // A cross-lane through the middle so the grid is not perfectly regular.
  rect(g, 5, 18, 34, 1, '.');
  pts(g, [[12, 18], [13, 18], [26, 18], [27, 18]], 'h');

  // The counting house: a walled box at the east end of the square, one door facing the stalls.
  building(g, 39, 12, 8, 11, [[39, 17]]);
  pts(g, [[42, 14], [43, 14], [42, 21], [43, 21]], 'l');
  put(g, 41, 17, 'l');
  return toRows(g);
}

// Sim, 60 AI-vs-AI matches on this map's own profile (`npm run sim -- --map night-market --objective player`):
// player 43% / enemy 53% - the hardest fight before the finale, on purpose.
export const NIGHT_MARKET: MapDef = {
  name: 'The Night Market',
  rows: compose(),
  spawns: {
    player: [['soldier', 2, 15], ['assault', 3, 15], ['medic', 2, 17], ['tank', 2, 20], ['sniper', 3, 20]],
    enemy: [
      ['soldier', 44, 17, 'camper'],
      ['assault', 12, 13], ['sniper', 18, 7], ['assault', 24, 22], ['soldier', 30, 13], ['sniper', 36, 25],
    ],
  },
  searchPoints: {
    player: [[16, 18], [28, 18], [37, 18], [43, 24]],
    enemy: [[16, 18], [28, 18], [6, 18], [37, 18]],
  },
  startTimeOfDay: 'midnight',
  startWeather: 'cloudy',
  enemyProfile: 'standard',
  objective: { type: 'eliminateTarget', enemySpawnIndex: 0, label: 'Sable, the Jackals quartermaster' },
  interactables: [
    { id: 1, type: 'door', x: 39, y: 17, active: true },
    { id: 2, type: 'door', x: 4, y: 6, active: true },
    { id: 3, type: 'door', x: 43, y: 6 },
    { id: 4, type: 'door', x: 31, y: 27 },
    { id: 20, type: 'chest', x: 4, y: 3 },
    { id: 21, type: 'chest', x: 43, y: 3 },
    { id: 22, type: 'chest', x: 31, y: 29 },
    { id: 23, type: 'chest', x: 4, y: 27 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 10, y: 18 },
    { id: 2, type: 'medkit', x: 16, y: 12 },
    { id: 3, type: 'ammo', x: 22, y: 18 },
    { id: 4, type: 'gadget', x: 28, y: 12 },
    { id: 5, type: 'ammo', x: 34, y: 18 },
    { id: 6, type: 'medkit', x: 22, y: 27 },
  ],
};
