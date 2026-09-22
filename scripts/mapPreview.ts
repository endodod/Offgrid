// Prints an authored map as ASCII with everything on it overlaid, and flags anything standing on a tile it
// cannot stand on. The fast loop for authoring a 48x32 level: compose, print, look at it, fix, repeat.
//
//   npm run map -- LIGHTS_OUT
//
// Legend: uppercase = player spawn (by class initial), lowercase = enemy spawn, D door, X switch, C chest,
// + pickup, * player search waypoint, ~ enemy search waypoint.
import * as maps from '../src/data/maps';
import type { MapDef } from '../src/data/trainingGrounds';
import { WALKABLE } from '../src/core/mapFormat';

const name = process.argv[2];
const map = (maps as unknown as Record<string, MapDef>)[name];
if (!map) { console.error(`Unknown map "${name}". Known: ${Object.keys(maps).filter((k) => k !== 'ALL_AUTHORED_MAPS').join(', ')}`);
  process.exit(1); }

const grid = map.rows.map((r) => [...r]);
const marks: [number, number, string][] = [];
for (const [cls, x, y] of map.spawns.player) marks.push([x, y, cls[0].toUpperCase()]);
for (const [cls, x, y] of map.spawns.enemy) marks.push([x, y, cls[0].toLowerCase()]);
for (const it of map.interactables ?? []) marks.push([it.x, it.y, it.type === 'door' ? 'D' : it.type === 'switch' ? 'X' : 'C']);
for (const p of map.pickups ?? []) marks.push([p.x, p.y, '+']);
for (const team of ['player', 'enemy'] as const) for (const [x, y] of map.searchPoints[team]) marks.push([x, y, team === 'player' ? '*' : '~']);

const problems: string[] = [];
for (const [x, y, ch] of marks) {
  const t = map.rows[y]?.[x];
  if (t === undefined) problems.push(`${ch} at (${x},${y}) is off the map`);
  else if (!WALKABLE.includes(t) && t !== 'O') problems.push(`${ch} at (${x},${y}) is on "${t}"`);
  if (t !== undefined) grid[y][x] = ch;
}

console.log(`${map.name}  ${map.rows[0].length} x ${map.rows.length}`);
console.log('    ' + Array.from({ length: map.rows[0].length }, (_, i) => String(Math.floor(i / 10) || ' ')).join(''));
console.log('    ' + Array.from({ length: map.rows[0].length }, (_, i) => String(i % 10)).join(''));
grid.forEach((row, y) => console.log(String(y).padStart(3) + ' ' + row.join('')));
console.log(problems.length ? `\nPROBLEMS:\n  ${problems.join('\n  ')}` : '\nno placement problems');
