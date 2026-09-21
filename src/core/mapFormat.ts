import type { MapDef, Spawn } from '../data/trainingGrounds';
import { CLASSES, type ClassId } from '../data/units';
import { AI_PROFILES, type AiProfileId } from '../data/aiProfiles';

/** Tile characters a map may contain (see MapDef.rows). */
export const TILE_CHARS = '.#bl123hO';
/** Tiles a unit may stand on. */
export const WALKABLE = '.b';

type Spawns = MapDef['spawns'];

/** Builds a map from edited rows/spawns. Search waypoints that ended up inside an obstacle are dropped. */
export function withEdits(base: MapDef, rows: string[], spawns: Spawns): MapDef {
  const open = ([x, y]: [number, number]) => WALKABLE.includes(rows[y]?.[x] ?? '#');
  return {
    ...base,
    rows,
    spawns,
    searchPoints: { player: base.searchPoints.player.filter(open), enemy: base.searchPoints.enemy.filter(open) },
  };
}

/** Validates untrusted map data (an import or a saved map). Throws an Error with a readable message. */
export function parseMap(raw: unknown, base: MapDef): MapDef {
  if (typeof raw !== 'object' || raw === null) throw new Error('Expected a JSON object with "rows" and "spawns".');
  const { rows, spawns } = raw as { rows?: unknown; spawns?: Record<string, unknown> };
  const h = base.rows.length, w = base.rows[0].length;
  if (!Array.isArray(rows) || rows.length !== h) throw new Error(`"rows" must be a list of ${h} strings.`);
  let objectives = 0;
  rows.forEach((row, y) => {
    if (typeof row !== 'string' || row.length !== w) throw new Error(`Row ${y} must be a string of ${w} characters.`);
    [...row].forEach((ch, x) => {
      if (!TILE_CHARS.includes(ch)) throw new Error(`Unknown tile "${ch}" at (${x},${y}).`);
      if (ch === 'O') objectives++;
    });
  });
  if (objectives > 1) throw new Error('At most one objective tile is allowed.');

  const taken = new Set<string>();
  const parseTeam = (team: 'player' | 'enemy'): Spawn[] => {
    const list = spawns?.[team];
    if (!Array.isArray(list) || list.length === 0) throw new Error(`Need at least one ${team} unit.`);
    return list.map((s) => {
      const [cls, x, y, profile] = s as [unknown, unknown, unknown, unknown];
      if (typeof cls !== 'string' || !(cls in CLASSES)) throw new Error(`Unknown unit class "${String(cls)}".`);
      if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Error(`Bad spawn position for ${cls}.`);
      if (profile !== undefined && (typeof profile !== 'string' || !(profile in AI_PROFILES))) throw new Error(`Unknown AI profile "${String(profile)}".`);
      const [px, py] = [x as number, y as number];
      if (!WALKABLE.includes((rows[py] as string | undefined)?.[px] ?? '#')) throw new Error(`${team} ${cls} at (${px},${py}) is not on an open tile.`);
      if (taken.has(`${px},${py}`)) throw new Error(`Two units share tile (${px},${py}).`);
      taken.add(`${px},${py}`);
      return profile !== undefined ? [cls as ClassId, px, py, profile as AiProfileId] : [cls as ClassId, px, py];
    });
  };
  return withEdits(base, rows as string[], { player: parseTeam('player'), enemy: parseTeam('enemy') });
}

/** JSON text for export/import and storage: one row per line so it stays readable and diff-able. */
export function serializeMap(map: MapDef): string {
  const rows = map.rows.map((r) => `  ${JSON.stringify(r)}`).join(',\n');
  const team = (t: 'player' | 'enemy') => map.spawns[t].map((s) => JSON.stringify(s)).join(', ');
  return `{\n "rows": [\n${rows}\n ],\n "spawns": {\n  "player": [${team('player')}],\n  "enemy": [${team('enemy')}]\n }\n}`;
}
