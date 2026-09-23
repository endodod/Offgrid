import { RULES } from '../data/rules';
import type { GameState, Pos, Unit } from './types';

export const idx = (s: GameState, x: number, y: number) => y * s.width + x;
export const inBounds = (s: GameState, x: number, y: number) => x >= 0 && y >= 0 && x < s.width && y < s.height;
export const dist = (a: Pos, b: Pos) => Math.hypot(a.x - b.x, a.y - b.y); // range metric (Euclidean)
export const cheb = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** A closed door at (x,y), if any (2). Switches never block anything. */
export function closedDoorAt(s: GameState, x: number, y: number) {
  return s.interactables.find((it) => it.type === 'door' && !it.active && it.x === x && it.y === y);
}

/**
 * Static obstacles: walls, cover objects, a closed door (2), and - only for a 'hold' objective (3) - the
 * terminal tile itself, which is a physical console a unit stands *next to*, not on. Other objective types
 * (e.g. 'reach') put units on their 'O' tile(s) on purpose, so those stay open floor.
 */
export function blocksMove(s: GameState, x: number, y: number, throughDoors = false): boolean {
  if (!inBounds(s, x, y)) return true;
  const i = idx(s, x, y);
  const onTerminal = s.objectiveDef?.type === 'hold' && s.objective?.x === x && s.objective.y === y;
  return s.terrain[i] === 'wall' || s.cover[i] !== null || onTerminal || (!throughDoors && !!closedDoorAt(s, x, y));
}

/** Walls and a closed door (2) block sight. High cover does only if RULES.highCoverBlocksLos is set; low cover and bushes never do. */
export function blocksLos(s: GameState, x: number, y: number): boolean {
  if (!inBounds(s, x, y)) return true;
  const i = idx(s, x, y);
  return s.terrain[i] === 'wall' || (RULES.highCoverBlocksLos && s.cover[i] === 'high') || !!closedDoorAt(s, x, y);
}

export function unitAt(s: GameState, x: number, y: number): Unit | undefined {
  return s.units.find((u) => u.alive && u.x === x && u.y === y);
}

/** Bresenham line of sight between tile centres. Endpoints never block. Symmetric (a<->b give the same answer). */
export function hasLos(s: GameState, a: Pos, b: Pos): boolean {
  if (a.y > b.y || (a.y === b.y && a.x > b.x)) [a, b] = [b, a];
  let x = a.x, y = a.y;
  const dx = Math.abs(b.x - a.x), dy = -Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1, sy = a.y < b.y ? 1 : -1;
  let err = dx + dy;
  while (x !== b.x || y !== b.y) {
    const e2 = 2 * err;
    let nx = x, ny = y;
    if (e2 >= dy) { err += dy; nx += sx; }
    if (e2 <= dx) { err += dx; ny += sy; }
    // a diagonal step squeezing between two blockers is not a gap
    if (nx !== x && ny !== y && blocksLos(s, nx, y) && blocksLos(s, x, ny)) return false;
    x = nx; y = ny;
    if ((x !== b.x || y !== b.y) && blocksLos(s, x, y)) return false;
  }
  return true;
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Neighbours a walker may step to; diagonals may not cut a blocked corner. */
function* steps(s: GameState, x: number, y: number, throughDoors = false): Generator<Pos> {
  for (const [dx, dy] of DIRS) {
    const nx = x + dx, ny = y + dy;
    if (blocksMove(s, nx, ny, throughDoors)) continue;
    if (dx !== 0 && dy !== 0 && (blocksMove(s, x + dx, y, throughDoors) || blocksMove(s, x, y + dy, throughDoors))) continue;
    yield { x: nx, y: ny };
  }
}

export interface Reach { cost: number; prev: number }

/** Every tile the unit can reach within `maxCost` steps (1 per step, diagonals included). Units block. */
export function reachable(s: GameState, u: Unit, maxCost: number): Map<number, Reach> {
  const out = new Map<number, Reach>([[idx(s, u.x, u.y), { cost: 0, prev: -1 }]]);
  const queue: Pos[] = [{ x: u.x, y: u.y }];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const cost = out.get(idx(s, cur.x, cur.y))!.cost;
    if (cost >= maxCost) continue;
    for (const n of steps(s, cur.x, cur.y)) {
      const i = idx(s, n.x, n.y);
      if (out.has(i) || unitAt(s, n.x, n.y)) continue;
      out.set(i, { cost: cost + 1, prev: idx(s, cur.x, cur.y) });
      queue.push(n);
    }
  }
  return out;
}

export function findPath(s: GameState, u: Unit, to: Pos, maxCost: number): Pos[] | null {
  const reach = reachable(s, u, maxCost);
  let i = idx(s, to.x, to.y);
  if (!reach.has(i)) return null;
  const path: Pos[] = [];
  while (i !== idx(s, u.x, u.y)) {
    path.push({ x: i % s.width, y: Math.floor(i / s.width) });
    i = reach.get(i)!.prev;
  }
  return path.reverse();
}

/** BFS distance from `goal` to every tile, ignoring units. The goal itself may be a blocked tile (objective).
 *  `throughDoors` treats closed doors as open - the route a unit that can open them would take (10j). */
export function distanceMap(s: GameState, goal: Pos, throughDoors = false): Int16Array {
  const d = new Int16Array(s.width * s.height).fill(-1);
  d[idx(s, goal.x, goal.y)] = 0;
  const queue: Pos[] = [goal];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    for (const n of steps(s, cur.x, cur.y, throughDoors)) {
      const i = idx(s, n.x, n.y);
      if (d[i] >= 0) continue;
      d[i] = d[idx(s, cur.x, cur.y)] + 1;
      queue.push(n);
    }
  }
  return d;
}
