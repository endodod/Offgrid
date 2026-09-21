import { CLASSES } from '../data/units';
import { GADGETS } from '../data/gadgets';
import { shelterAt } from '../core/combat';
import { hasLos, idx, dist } from '../core/grid';
import type { GameState, Pos, Unit } from '../core/types';

export const TILE = 36;

export interface Floater { x: number; y: number; text: string; color: string; born: number }

/** Everything the renderer needs. It only reads; all rules live in core. */
export interface View {
  s: GameState;
  selected: Unit | null;
  hover: Pos | null;
  mode: 'move' | 'attack' | 'gadget' | 'aid' | 'revive' | 'interact';
  reach: Set<number> | null; // tiles the selected unit can walk to (move mode)
  path: Pos[] | null; // walk path from the selected unit to the hovered tile, if reachable (move mode)
  ringed: Set<number>; // unit ids to ring (valid attack / aid targets)
  aimTiles: Set<number>; // valid gadget target tiles
  coverRot: number; // rotation the tank will give the cover piece it places
  overwatchView: boolean; // show the coverage of units that are on overwatch
  floaters: Floater[];
  now: number;
}

// Dark, desaturated palette. Yellow is reserved for the selected unit.
const C = {
  floorA: '#3a3f2e', floorB: '#3e4331', speck: '#2f3426',
  wall: '#2b2724', wallLine: '#403a33',
  bush: '#4c6a3a', bushDark: '#38512c',
  lowFill: '#8a7148', lowDark: '#5f4b2c', highFill: '#5d5346', highTop: '#8d8171', highDark: '#3a332b',
  player: '#5f8f6b', playerDark: '#3a5c45', enemy: '#a5482f', enemyDark: '#6b2c1b',
  objective: '#7fb7a4', accent: '#ffd23f', overwatch: '#d64533', ink: '#101410', text: '#d8d8c8',
};

const greyCache = new Map<string, string>();
function grey(hex: string): string {
  let g = greyCache.get(hex);
  if (!g) {
    const n = parseInt(hex.slice(1), 16);
    const l = Math.round(0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) * 0.8 | 0;
    g = `rgb(${l},${l},${l})`;
    greyCache.set(hex, g);
  }
  return g;
}

const hash = (x: number, y: number, k = 0) => ((x * 73856093) ^ (y * 19349663) ^ (k * 83492791)) >>> 0;

export function draw(ctx: CanvasRenderingContext2D, v: View) {
  const { s } = v;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0c0e0b';
  ctx.fillRect(0, 0, s.width * TILE, s.height * TILE);

  for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) drawTile(ctx, v, x, y);
  drawInteractables(ctx, v);
  drawShields(ctx, v);
  drawHighlights(ctx, v);
  drawScans(ctx, v);
  drawObjective(ctx, v);
  drawGhosts(ctx, v);
  for (const u of s.units) if (u.alive && (u.team === 'player' || s.seenUnits.player.has(u.id))) drawUnit(ctx, v, u);
  drawMovePath(ctx, v);
  drawPreview(ctx, v);
  drawFloaters(ctx, v);
}

const isVisible = (s: GameState, x: number, y: number) => s.visible.player[idx(s, x, y)] === 1;

function drawTile(ctx: CanvasRenderingContext2D, v: View, x: number, y: number) {
  const { s } = v;
  const i = idx(s, x, y);
  const c = isVisible(s, x, y) ? (h: string) => h : grey; // terrain is always drawn, greyed out when not visible
  const px = x * TILE, py = y * TILE;
  ctx.fillStyle = c((x + y) % 2 ? C.floorA : C.floorB);
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = c(C.speck);
  for (let k = 0; k < 3; k++) { const h = hash(x, y, k); ctx.fillRect(px + (h % 30) + 2, py + ((h >> 8) % 30) + 2, 2, 2); }

  if (s.terrain[i] === 'wall') {
    ctx.fillStyle = c(C.wall);
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = c(C.wallLine);
    for (let r = 0; r < 4; r++) {
      ctx.fillRect(px, py + r * 9, TILE, 1);
      ctx.fillRect(px + ((r + x) % 2 ? 9 : 18), py + r * 9, 1, 9);
      ctx.fillRect(px + ((r + x) % 2 ? 27 : 0), py + r * 9, 1, 9);
    }
  } else if (s.terrain[i] === 'bush') {
    for (let k = 0; k < 7; k++) {
      const h = hash(x, y, k + 10);
      ctx.fillStyle = c(k % 2 ? C.bush : C.bushDark);
      ctx.fillRect(px + (h % 26), py + ((h >> 6) % 26), 9, 9);
    }
  }

  const cover = s.cover[i];
  if (cover) drawCover(ctx, px, py, cover, s.coverRot[i], c);
}

/** Low cover is a sandbag bar that can be rotated by quarter turns (the end cap shows which way). High cover is a block. */
function drawCover(ctx: CanvasRenderingContext2D, px: number, py: number, cover: 'low' | 'high', rot: number, c: (hex: string) => string) {
  if (cover === 'low') {
    ctx.save();
    ctx.translate(px + TILE / 2, py + TILE / 2);
    ctx.rotate((rot * Math.PI) / 2);
    ctx.fillStyle = c(C.lowDark);
    ctx.fillRect(-15, -8, 30, 16);
    ctx.fillStyle = c(C.lowFill);
    ctx.fillRect(-14, -7, 28, 6);
    ctx.fillRect(-14, 1, 28, 6);
    ctx.fillStyle = c(C.highTop);
    ctx.fillRect(-15, -8, 4, 16);
    ctx.restore();
  } else {
    ctx.fillStyle = c(C.highDark);
    ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = c(C.highFill);
    ctx.fillRect(px + 5, py + 8, TILE - 10, TILE - 13);
    ctx.fillStyle = c(C.highTop);
    ctx.fillRect(px + 5, py + 5, TILE - 10, 4);
  }
}

/** Shield icons on tile edges that face adjacent cover. Shown where they matter: units, reachable tiles, hover. */
function drawShields(ctx: CanvasRenderingContext2D, v: View) {
  const { s } = v;
  const tiles = new Map<number, Pos>();
  const add = (p: Pos) => { if (isVisible(s, p.x, p.y)) tiles.set(idx(s, p.x, p.y), p); };
  for (const u of s.units) if (u.alive && (u.team === 'player' || s.seenUnits.player.has(u.id))) add(u);
  if (v.hover) add(v.hover);
  if (v.reach) for (const i of v.reach) add({ x: i % s.width, y: Math.floor(i / s.width) });
  for (const p of tiles.values()) {
    if (s.cover[idx(s, p.x, p.y)] || s.terrain[idx(s, p.x, p.y)] === 'wall') continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = p.x + dx, ny = p.y + dy;
      if (nx < 0 || ny < 0 || nx >= s.width || ny >= s.height) continue;
      const cv = shelterAt(s, nx, ny); // cover objects and walls
      if (cv) shield(ctx, p.x * TILE + TILE / 2 + dx * (TILE / 2 - 5), p.y * TILE + TILE / 2 + dy * (TILE / 2 - 5), cv === 'high');
    }
  }
}

function shield(ctx: CanvasRenderingContext2D, cx: number, cy: number, full: boolean) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.moveTo(-4, -4); ctx.lineTo(4, -4); ctx.lineTo(4, 1); ctx.quadraticCurveTo(4, 5, 0, 6); ctx.quadraticCurveTo(-4, 5, -4, 1); ctx.closePath();
  ctx.fillStyle = C.ink;
  ctx.fill();
  ctx.strokeStyle = '#b8c4cc';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#b8c4cc';
  if (full) ctx.fill();
  else ctx.fillRect(-3, 0, 6, 3); // half-filled = low cover
  ctx.restore();
}

function fillTiles(ctx: CanvasRenderingContext2D, s: GameState, tiles: Iterable<number>, color: string) {
  ctx.fillStyle = color;
  for (const i of tiles) ctx.fillRect((i % s.width) * TILE, Math.floor(i / s.width) * TILE, TILE, TILE);
}

function ring(ctx: CanvasRenderingContext2D, p: Pos, color: string, inset = 2, width = 2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.strokeRect(p.x * TILE + inset, p.y * TILE + inset, TILE - inset * 2, TILE - inset * 2);
}

function coveredTiles(s: GameState, u: Unit): number[] {
  const r = CLASSES[u.cls].weapon.range;
  const out: number[] = [];
  for (let y = Math.max(0, u.y - r); y <= Math.min(s.height - 1, u.y + r); y++)
    for (let x = Math.max(0, u.x - r); x <= Math.min(s.width - 1, u.x + r); x++)
      if ((x !== u.x || y !== u.y) && dist(u, { x, y }) <= r && hasLos(s, u, { x, y })) out.push(idx(s, x, y));
  return out;
}

function drawHighlights(ctx: CanvasRenderingContext2D, v: View) {
  const { s } = v;
  if (v.mode === 'move' && v.reach) fillTiles(ctx, s, v.reach, 'rgba(176,214,176,0.16)');
  if (v.mode === 'gadget' || v.mode === 'interact') fillTiles(ctx, s, v.aimTiles, 'rgba(176,214,176,0.14)');
  // Overwatch coverage (weapon range + LOS) is only drawn in the overwatch view, and only for units that are actually
  // on overwatch: friendly green, enemy red (enemies only if we can see them). Overlaps stack darker.
  // Outside the view, an active overwatch is just the eye icon on the unit.
  if (v.overwatchView) {
    for (const u of s.units) {
      if (!u.alive || !u.overwatch || (u.team === 'enemy' && !s.seenUnits.player.has(u.id))) continue;
      const tiles = coveredTiles(s, u).filter((i) => u.team === 'player' || s.visible.player[i]);
      fillTiles(ctx, s, tiles, u.team === 'player' ? 'rgba(95,160,120,0.22)' : 'rgba(214,69,51,0.22)');
    }
  }
  // Attack mode: the tiles the selected unit can actually shoot at (range and line of sight), not a circle.
  if (v.selected && v.mode === 'attack') fillTiles(ctx, s, coveredTiles(s, v.selected), 'rgba(224,130,90,0.18)');
  for (const id of v.ringed) {
    const u = s.units[id];
    ring(ctx, u, u.team === 'enemy' ? '#e0553f' : '#8fd19a', 1, 2);
  }
}

function drawScans(ctx: CanvasRenderingContext2D, v: View) {
  for (const sc of v.s.scans) if (sc.team === 'player') fillTiles(ctx, v.s, tilesWithin(v.s, sc, sc.radius), 'rgba(127,183,164,0.17)');
}

/** Indices of all tiles whose centre is within `r` (Euclidean) of `c`. */
function tilesWithin(s: GameState, c: Pos, r: number): number[] {
  const out: number[] = [];
  for (let y = Math.max(0, c.y - r); y <= Math.min(s.height - 1, c.y + r); y++)
    for (let x = Math.max(0, c.x - r); x <= Math.min(s.width - 1, c.x + r); x++)
      if (dist(c, { x, y }) <= r) out.push(idx(s, x, y));
  return out;
}

function drawObjective(ctx: CanvasRenderingContext2D, v: View) {
  const { s } = v;
  if (!s.objective || !(s.memory.player.objectiveSeen || !s.fogEnabled)) return; // once seen, it stays marked
  const seen = isVisible(s, s.objective.x, s.objective.y);
  const px = s.objective.x * TILE, py = s.objective.y * TILE;
  ctx.fillStyle = seen ? C.objective : grey(C.objective);
  ctx.fillRect(px + 8, py + 6, TILE - 16, TILE - 12);
  ctx.fillStyle = C.ink;
  ctx.fillRect(px + 11, py + 9, TILE - 22, 8);
  ctx.fillStyle = seen ? '#cfe8dd' : '#888';
  ctx.fillRect(px + 13, py + 11, TILE - 26, 4);
  ctx.strokeStyle = seen ? C.objective : '#777';
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
  if (s.capture) { // hold in progress: rounds left, and a link to the unit that has to stay put
    const u = s.units[s.capture.unit];
    ctx.strokeStyle = C.objective;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(px + TILE / 2, py + TILE / 2);
    ctx.lineTo(u.x * TILE + TILE / 2, u.y * TILE + TILE / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = C.ink;
    ctx.fillText(`HOLD ${s.capture.roundsLeft}`, px + TILE / 2 + 1, py - 3);
    ctx.fillStyle = C.objective;
    ctx.fillText(`HOLD ${s.capture.roundsLeft}`, px + TILE / 2, py - 4);
  }
}

/**
 * Doors and switches (2). Fog-fair: never drawn until the player's memory has seen that tile at least once
 * (or fog is off in debug), then drawn using the *remembered* state while out of sight - a door seen closed
 * but opened later behind your back should show closed until you look again, not silently update off-screen.
 */
function drawInteractables(ctx: CanvasRenderingContext2D, v: View) {
  const { s } = v;
  const mem = s.memory.player;
  for (const it of s.interactables) {
    const nowVisible = isVisible(s, it.x, it.y);
    const known = !s.fogEnabled || nowVisible || it.id in mem.doors;
    if (!known) continue;
    const active = !s.fogEnabled || nowVisible ? it.active : mem.doors[it.id];
    const c = !s.fogEnabled || nowVisible ? (h: string) => h : grey;
    const px = it.x * TILE, py = it.y * TILE;
    if (it.type === 'door') drawDoor(ctx, px, py, active, c);
    else drawSwitch(ctx, px, py, active, c);
  }
}

function drawDoor(ctx: CanvasRenderingContext2D, px: number, py: number, open: boolean, c: (hex: string) => string) {
  if (!open) {
    ctx.fillStyle = c('#6b4a2a');
    ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = c('#8a6438');
    ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
    ctx.fillStyle = c('#e0c88a'); // handle
    ctx.fillRect(px + TILE - 12, py + TILE / 2 - 2, 4, 4);
  } else {
    ctx.strokeStyle = c('#8a6438');
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 2, py + 2, TILE - 4, TILE - 4);
    ctx.fillStyle = c('#6b4a2a'); // door swung open, hugging one edge
    ctx.fillRect(px + 2, py + 2, 4, TILE - 4);
  }
}

function drawSwitch(ctx: CanvasRenderingContext2D, px: number, py: number, on: boolean, c: (hex: string) => string) {
  ctx.fillStyle = c('#3a332b');
  ctx.fillRect(px + TILE / 2 - 6, py + TILE / 2 - 8, 12, 16);
  ctx.fillStyle = c(on ? '#8fd19a' : '#6b6656');
  ctx.fillRect(px + TILE / 2 - 4, py + (on ? TILE / 2 - 6 : TILE / 2), 8, 6); // lever position shows on/off
}

function drawGhosts(ctx: CanvasRenderingContext2D, v: View) {
  const { s } = v;
  for (const [id, g] of Object.entries(s.memory.player.lastSeen)) {
    const u = s.units[Number(id)];
    if (!u.alive || s.seenUnits.player.has(u.id)) continue;
    const px = g.x * TILE, py = g.y * TILE;
    ctx.strokeStyle = 'rgba(165,72,47,0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(px + 6, py + 6, TILE - 12, TILE - 12);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(190,120,100,0.9)';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${CLASSES[u.cls].letter}?`, px + TILE / 2, py + TILE / 2 + 4);
  }
}

function drawUnit(ctx: CanvasRenderingContext2D, v: View, u: Unit) {
  const px = u.x * TILE, py = u.y * TILE;
  const player = u.team === 'player';
  // Downed: desaturated fill regardless of team, and a prone (squat) body instead of the standing square.
  ctx.fillStyle = u.downed ? '#4a4638' : player ? C.playerDark : C.enemyDark;
  ctx.fillRect(px + 5, py + 5, TILE - 10, TILE - 10);
  ctx.fillStyle = u.downed ? '#6b6656' : player ? C.player : C.enemy;
  if (u.downed) ctx.fillRect(px + 7, py + TILE / 2 - 4, TILE - 14, 8);
  else ctx.fillRect(px + 7, py + 7, TILE - 14, TILE - 14);
  ctx.fillStyle = C.text;
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(CLASSES[u.cls].letter, px + TILE / 2, py + TILE / 2 + 5);

  // hp bar
  const max = CLASSES[u.cls].hp;
  ctx.fillStyle = C.ink;
  ctx.fillRect(px + 5, py + 2, TILE - 10, 4);
  ctx.fillStyle = u.hp / max > 0.5 ? '#6fa06b' : u.hp / max > 0.25 ? '#c09a45' : '#b5473a';
  ctx.fillRect(px + 6, py + 3, Math.round(((TILE - 12) * u.hp) / max), 2);

  if (u.downed) { // dashed red outline + bleed-out countdown, instead of action pips (it can't act)
    ctx.strokeStyle = '#d64533';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 2]);
    ctx.strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
    ctx.setLineDash([]);
    ctx.fillStyle = '#e6a23a';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`DOWN ${u.bleedOut}`, px + TILE / 2, py + TILE - 4);
  } else if (player && v.s.phase === 'player') { // action pips
    const slots = Math.max(2, u.actions); // adrenaline can push a unit above the usual 2
    for (let k = 0; k < slots; k++) {
      ctx.fillStyle = k < u.actions ? '#d8d8c8' : '#2a2f26';
      ctx.fillRect(px + TILE / 2 - slots * 4 + 1 + k * 8, py + TILE - 6, 5, 4);
    }
  }
  if (u.overwatch) eye(ctx, px + TILE - 10, py + 10);

  if (v.s.capture?.unit === u.id) { // this unit is holding the objective
    ctx.strokeStyle = C.objective;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
  }
  if (v.selected === u) { // yellow corner brackets
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 3;
    const a = 1, b = TILE - 1, l = 9;
    for (const [cx, cy, sx, sy] of [[a, a, 1, 1], [b, a, -1, 1], [a, b, 1, -1], [b, b, -1, -1]]) {
      ctx.beginPath();
      ctx.moveTo(px + cx + sx * l, py + cy);
      ctx.lineTo(px + cx, py + cy);
      ctx.lineTo(px + cx, py + cy + sy * l);
      ctx.stroke();
    }
  }
  if (v.s.terrain[idx(v.s, u.x, u.y)] === 'bush') {
    if (u.exposed) { // acted from the bush: visible until its team's next phase
      ctx.fillStyle = C.ink;
      ctx.fillRect(px + 2, py + 8, 10, 13);
      ctx.fillStyle = '#e0a03a';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!', px + 7, py + 19);
    } else { // concealment leaves
      ctx.fillStyle = 'rgba(76,106,58,0.55)';
      ctx.fillRect(px + 4, py + TILE / 2, TILE - 8, TILE / 2 - 4);
    }
  }
}

function eye(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.fillStyle = C.ink;
  ctx.beginPath(); ctx.ellipse(cx, cy, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = C.overwatch;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(cx, cy, 7, 4, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = C.overwatch;
  ctx.beginPath(); ctx.arc(cx, cy, 2.4, 0, Math.PI * 2); ctx.fill();
}

/** Move mode: a breadcrumb line + arrowhead from the selected unit to the hovered (reachable) tile. */
function drawMovePath(ctx: CanvasRenderingContext2D, v: View) {
  if (!v.selected || !v.path || v.path.length === 0) return;
  const pts = [{ x: v.selected.x, y: v.selected.y }, ...v.path];
  const center = (p: Pos) => ({ x: p.x * TILE + TILE / 2, y: p.y * TILE + TILE / 2 });
  ctx.save();
  ctx.strokeStyle = 'rgba(232,216,130,0.9)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  const c0 = center(pts[0]);
  ctx.moveTo(c0.x, c0.y);
  for (let i = 1; i < pts.length; i++) { const c = center(pts[i]); ctx.lineTo(c.x, c.y); }
  ctx.stroke();
  ctx.setLineDash([]);

  const end = center(pts[pts.length - 1]), prev = center(pts[pts.length - 2]);
  const angle = Math.atan2(end.y - prev.y, end.x - prev.x);
  const size = 7;
  ctx.fillStyle = 'rgba(232,216,130,0.95)';
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - size * Math.cos(angle - Math.PI / 6), end.y - size * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(end.x - size * Math.cos(angle + Math.PI / 6), end.y - size * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Hover feedback: tile outline plus gadget area previews. */
function drawPreview(ctx: CanvasRenderingContext2D, v: View) {
  const { hover, selected } = v;
  if (!hover) return;
  ring(ctx, hover, 'rgba(216,216,200,0.7)', 1, 1);
  if (v.mode !== 'gadget' || !selected?.gadget) return;
  const g = GADGETS[selected.gadget.id];
  if (selected.gadget.id === 'cover' && v.aimTiles.has(idx(v.s, hover.x, hover.y))) { // ghost of the piece about to be placed
    const existing = v.s.cover[idx(v.s, hover.x, hover.y)];
    ctx.globalAlpha = 0.65;
    drawCover(ctx, hover.x * TILE, hover.y * TILE, existing === 'low' ? 'high' : 'low', v.coverRot, (h) => h);
    ctx.globalAlpha = 1;
  }
  if (g.radius && g.target === 'any') { // scan: the tiles it would reveal
    fillTiles(ctx, v.s, tilesWithin(v.s, hover, g.radius), 'rgba(200,190,120,0.2)');
  } else if (g.radius) { // grenade: 3x3 blast square
    const x0 = (hover.x - g.radius) * TILE, y0 = (hover.y - g.radius) * TILE, size = (2 * g.radius + 1) * TILE;
    ctx.fillStyle = 'rgba(214,69,51,0.15)';
    ctx.fillRect(x0, y0, size, size);
    ctx.strokeStyle = 'rgba(200,190,120,0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, size, size);
  }
}

function drawFloaters(ctx: CanvasRenderingContext2D, v: View) {
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  for (const f of v.floaters) {
    const t = (v.now - f.born) / 1400;
    if (t < 0 || t > 1) continue;
    ctx.globalAlpha = 1 - t * t;
    const x = f.x * TILE + TILE / 2, y = f.y * TILE - t * 22;
    ctx.fillStyle = C.ink;
    ctx.fillText(f.text, x + 1, y + 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, x, y);
  }
  ctx.globalAlpha = 1;
}
