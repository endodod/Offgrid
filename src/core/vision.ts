import { CLASSES } from '../data/units';
import { RULES } from '../data/rules';
import { dist, hasLos, idx, inBounds } from './grid';
import type { GameState, Team, Unit } from './types';

const TEAMS: Team[] = ['player', 'enemy'];

/**
 * Recomputes what each team sees: union of every living unit's (range + LOS) plus active scans.
 * Called after every action (and every step of a move). Also updates each team's memory.
 * Fog is symmetric: the enemy AI reads `visible.enemy` / `seenUnits.enemy`, computed by the same rules.
 */
export function refreshVision(s: GameState) {
  for (const team of TEAMS) {
    const vis = new Uint8Array(s.width * s.height);
    for (const u of s.units) {
      if (!u.alive || u.team !== team) continue;
      const r = CLASSES[u.cls].vision;
      for (let y = u.y - r; y <= u.y + r; y++) {
        for (let x = u.x - r; x <= u.x + r; x++) {
          if (!inBounds(s, x, y) || vis[idx(s, x, y)] || dist(u, { x, y }) > r) continue;
          if (hasLos(s, u, { x, y })) vis[idx(s, x, y)] = 1;
        }
      }
    }
    for (const sc of s.scans) {
      if (sc.team !== team) continue;
      for (let y = sc.y - sc.radius; y <= sc.y + sc.radius; y++)
        for (let x = sc.x - sc.radius; x <= sc.x + sc.radius; x++)
          if (inBounds(s, x, y) && dist(sc, { x, y }) <= sc.radius) vis[idx(s, x, y)] = 1;
    }

    const seen = new Set<number>();
    for (const e of s.units) {
      if (!e.alive || e.team === team) continue;
      if (vis[idx(s, e.x, e.y)] && !isHiddenInBush(s, team, e)) seen.add(e.id);
    }
    if (team === 'player' && !s.fogEnabled) { // debug: reveal everything to the human
      vis.fill(1);
      for (const e of s.units) if (e.alive && e.team !== team) seen.add(e.id);
    }
    s.visible[team] = vis;
    s.seenUnits[team] = seen;
    updateMemory(s, team);
  }
}

/**
 * A unit standing in a bush is hidden unless an observer is within range, a scan covers its tile, or it is exposed
 * (it acted from the bush this round). The tile itself still has to be in view.
 */
function isHiddenInBush(s: GameState, observerTeam: Team, target: Unit): boolean {
  if (s.terrain[idx(s, target.x, target.y)] !== 'bush' || target.exposed) return false;
  const near = s.units.some((o) => o.alive && o.team === observerTeam && dist(o, target) <= RULES.bushRevealRange);
  const scanned = s.scans.some((sc) => sc.team === observerTeam && dist(sc, target) <= sc.radius);
  return !(near || scanned);
}

/**
 * Ghost markers: remember where enemies were last seen. A ghost is cleared when the enemy dies, when a friendly
 * unit reaches it, or when its tile is looked at again (after having been out of sight) and found empty.
 */
function updateMemory(s: GameState, team: Team) {
  if (team === 'player' && !s.fogEnabled) return; // debug reveal-all must not leak into what the player "remembers"
  const mem = s.memory[team];
  for (const e of s.units) {
    if (e.team === team) continue;
    if (!e.alive) { delete mem.lastSeen[e.id]; continue; }
    if (s.seenUnits[team].has(e.id)) { mem.lastSeen[e.id] = { x: e.x, y: e.y, hidden: false }; continue; }
    const g = mem.lastSeen[e.id];
    if (!g) continue;
    if (!s.visible[team][idx(s, g.x, g.y)]) g.hidden = true;
    else if (g.hidden || s.units.some((o) => o.alive && o.team === team && dist(o, g) <= 1)) delete mem.lastSeen[e.id];
  }
  if (s.objective && s.visible[team][idx(s, s.objective.x, s.objective.y)]) mem.objectiveSeen = true;
}
