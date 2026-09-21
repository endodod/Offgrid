import { parseMap, serializeMap, withEdits, WALKABLE } from '../core/mapFormat';
import { distanceMap, idx } from '../core/grid';
import { createGame } from '../core/state';
import { refreshVision } from '../core/vision';
import type { Pos } from '../core/types';
import type { Mission } from '../data/missions';
import type { MapDef, Spawn } from '../data/trainingGrounds';
import { CLASSES, CLASS_ORDER, type ClassId } from '../data/units';
import { draw, TILE } from '../render/renderer';
import { clearCustom, saveCustom } from './mapStore';

type Tool = 'floor' | 'wall' | 'bush' | 'low' | 'high' | 'objective' | 'player' | 'enemy' | 'erase';
type Team = 'player' | 'enemy';

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'floor', label: 'Floor' }, { id: 'wall', label: 'Wall' }, { id: 'bush', label: 'Bush' },
  { id: 'low', label: 'Low cover' }, { id: 'high', label: 'High cover' }, { id: 'objective', label: 'Objective' },
  { id: 'player', label: 'Friendly unit' }, { id: 'enemy', label: 'Enemy unit' }, { id: 'erase', label: 'Erase' },
];
const TERRAIN_CHAR: Partial<Record<Tool, string>> = { floor: '.', wall: '#', bush: 'b', high: 'h', objective: 'O' };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface BuilderHooks {
  onPlay: (map: MapDef) => void; // playtest the working map
  onExit: () => void;
  onSaved: () => void;
}

/**
 * Debug-only map editor. It edits a character grid + spawn list in the same format as the map data files,
 * and renders it with the game's own renderer (a throwaway GameState with fog off).
 */
export class Builder {
  private mission!: Mission;
  private grid: string[][] = [];
  private spawns: Record<Team, Spawn[]> = { player: [], enemy: [] };
  private tool: Tool = 'wall';
  private cls: ClassId = 'soldier';
  private rot = 0;
  private hover: Pos | null = null;
  private stroke: Tool | null = null; // tool of the drag in progress
  private dirty = false;
  private canvas = $<HTMLCanvasElement>('bcanvas');
  private ctx = this.canvas.getContext('2d')!;

  constructor(private hooks: BuilderHooks) {
    $('b-tools').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tool]');
      if (b) { this.tool = b.dataset.tool as Tool; this.refresh(); }
    });
    const select = $<HTMLSelectElement>('b-class');
    select.innerHTML = CLASS_ORDER.map((c) => `<option value="${c}">${CLASSES[c].name}</option>`).join('');
    select.value = this.cls;
    select.addEventListener('change', () => { this.cls = select.value as ClassId; });
    $('b-rot').addEventListener('click', () => this.rotate(1));

    const tileAt = (ev: MouseEvent): Pos => {
      const r = this.canvas.getBoundingClientRect();
      const k = this.canvas.width / TILE / r.width;
      return { x: Math.floor((ev.clientX - r.left) * k), y: Math.floor((ev.clientY - r.top) * k) };
    };
    this.canvas.addEventListener('mousedown', (ev) => {
      this.stroke = ev.button === 2 ? 'erase' : this.tool; // right button always erases
      this.paint(tileAt(ev));
    });
    this.canvas.addEventListener('mousemove', (ev) => {
      this.hover = tileAt(ev);
      if (this.stroke) this.paint(this.hover);
      else this.render();
    });
    window.addEventListener('mouseup', () => { this.stroke = null; });
    this.canvas.addEventListener('mouseleave', () => { this.hover = null; this.render(); });
    this.canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
    this.canvas.addEventListener('wheel', (ev) => {
      if (this.tool !== 'low') return;
      ev.preventDefault();
      this.rotate(ev.deltaY > 0 ? 1 : -1);
    }, { passive: false });
    window.addEventListener('keydown', (ev) => {
      if ($('builder').hidden || (ev.target as HTMLElement).tagName === 'TEXTAREA' || (ev.target as HTMLElement).tagName === 'SELECT') return;
      if (ev.key.toLowerCase() === 'q') this.rotate(ev.shiftKey ? -1 : 1);
    });

    $('b-play').addEventListener('click', () => { if (!this.errors().length) this.hooks.onPlay(this.toMap()); });
    $('b-save').addEventListener('click', () => this.save());
    $('b-default').addEventListener('click', () => this.resetToDefault());
    $('b-back').addEventListener('click', () => {
      if (this.dirty && !confirm('Discard your unsaved changes to this map?')) return;
      this.dirty = false;
      this.hooks.onExit();
    });
    $('b-export').addEventListener('click', () => { $<HTMLTextAreaElement>('b-json').value = serializeMap(this.toMap()); this.note('Exported to the text box.'); });
    $('b-import').addEventListener('click', () => this.importJson());
  }

  // ---------- lifecycle ----------
  /** Start editing `map` (the saved custom map, or the mission's default). */
  open(mission: Mission, map: MapDef) {
    this.mission = mission;
    this.load(map);
    this.dirty = false;
    this.resume();
  }

  /** Come back from a playtest with the working map untouched. */
  resume() {
    $('b-title').textContent = `Map builder - ${this.mission.name}`;
    this.note('');
    this.refresh();
  }

  private load(map: MapDef) {
    this.grid = map.rows.map((r) => [...r]);
    this.spawns = { player: map.spawns.player.map((s) => [...s] as Spawn), enemy: map.spawns.enemy.map((s) => [...s] as Spawn) };
  }

  private toMap(): MapDef {
    return withEdits(this.mission.map, this.grid.map((r) => r.join('')), this.spawns);
  }

  // ---------- editing ----------
  private spawnAt(x: number, y: number): { team: Team; i: number } | null {
    for (const team of ['player', 'enemy'] as Team[]) {
      const i = this.spawns[team].findIndex(([, sx, sy]) => sx === x && sy === y);
      if (i >= 0) return { team, i };
    }
    return null;
  }

  private paint({ x, y }: Pos) {
    const tool = this.stroke;
    if (!tool || y < 0 || x < 0 || y >= this.grid.length || x >= this.grid[0].length) return;
    const before = this.grid[y][x];
    const sp = this.spawnAt(x, y);
    const dropSpawn = () => { if (sp) this.spawns[sp.team].splice(sp.i, 1); };
    let changed = true;
    if (tool === 'erase') {
      if (sp) dropSpawn(); else this.grid[y][x] = '.';
    } else if (tool === 'player' || tool === 'enemy') {
      if (!WALKABLE.includes(before)) { this.note('Units need an open floor or bush tile.'); return; }
      const dup = sp && sp.team === tool && this.spawns[tool][sp.i][0] === this.cls;
      dropSpawn();
      if (!dup) this.spawns[tool].push([this.cls, x, y]); // painting the same unit again removes it
    } else {
      const ch = tool === 'low' ? (this.rot === 0 ? 'l' : String(this.rot)) : TERRAIN_CHAR[tool]!;
      const keepsUnit = WALKABLE.includes(ch); // floor and bush can hold a unit; walls, cover and the terminal can't
      changed = before !== ch || (!keepsUnit && !!sp);
      if (!keepsUnit) dropSpawn();
      if (ch === 'O') for (const row of this.grid) row.forEach((c, i) => { if (c === 'O') row[i] = '.'; }); // only one objective
      this.grid[y][x] = ch;
    }
    if (changed) { this.dirty = true; this.note(''); this.refresh(); }
  }

  private rotate(dir: 1 | -1) {
    this.rot = (this.rot + dir + 4) % 4;
    this.refresh();
  }

  // ---------- persistence ----------
  private save() {
    if (this.errors().length) return;
    if (saveCustom(this.mission.id, this.toMap())) { this.dirty = false; this.note('Saved. This map now replaces the default in debug mode.'); this.hooks.onSaved(); }
    else this.note('Could not save (browser storage unavailable).');
    this.refresh();
  }

  private resetToDefault() {
    if (!confirm('Delete the saved map and go back to the default layout?')) return;
    clearCustom(this.mission.id);
    this.load(this.mission.map);
    this.dirty = false;
    this.hooks.onSaved();
    this.note('Reset to the default map.');
    this.refresh();
  }

  private importJson() {
    try {
      this.load(parseMap(JSON.parse($<HTMLTextAreaElement>('b-json').value), this.mission.map));
      this.dirty = true;
      this.note('Imported.');
    } catch (e) {
      this.note(`Import failed: ${(e as Error).message}`);
    }
    this.refresh();
  }

  // ---------- checks + drawing ----------
  private state() {
    const s = createGame(this.toMap(), 1);
    s.fogEnabled = false; // show everything
    refreshVision(s);
    return s;
  }

  /** Problems that block saving/playing. */
  private errors(): string[] {
    const out: string[] = [];
    if (!this.spawns.player.length) out.push('Place at least one friendly unit.');
    if (!this.spawns.enemy.length) out.push('Place at least one enemy unit.');
    return out;
  }

  private warnings(): string[] {
    const s = this.state();
    const out: string[] = [];
    if (!s.objective) out.push('No objective: the mission can only be won by eliminating all enemies.');
    else {
      const d = distanceMap(s, s.objective);
      for (const u of s.units) if (d[idx(s, u.x, u.y)] < 0) out.push(`${u.team === 'player' ? 'Friendly' : 'Enemy'} ${CLASSES[u.cls].name} at (${u.x},${u.y}) cannot reach the objective.`);
    }
    const first = s.units.find((u) => u.team === 'player');
    if (first) {
      const d = distanceMap(s, first);
      for (const u of s.units) if (u.team === 'enemy' && d[idx(s, u.x, u.y)] < 0) out.push(`Enemy at (${u.x},${u.y}) is walled off from the friendly squad.`);
    }
    return out;
  }

  private note(text: string) {
    $('b-msg').textContent = text;
  }

  private refresh() {
    $('b-tools').innerHTML = TOOLS.map((t) => `<button data-tool="${t.id}" class="${t.id === this.tool ? 'active' : ''}">${t.label}</button>`).join('');
    $('b-rotlabel').textContent = `${this.rot * 90}°`;
    const errors = this.errors();
    const warnings = this.warnings();
    const items = [...errors.map((e) => `<li class="err">${e}</li>`), ...warnings.map((w) => `<li class="warn">${w}</li>`)];
    $('b-checks').innerHTML = items.length ? items.join('') : '<li class="ok">Map looks playable.</li>';
    ($('b-play') as HTMLButtonElement).disabled = errors.length > 0;
    ($('b-save') as HTMLButtonElement).disabled = errors.length > 0;
    $('b-title').textContent = `Map builder - ${this.mission.name}${this.dirty ? ' *' : ''}`;
    this.render();
  }

  private render() {
    const s = this.state();
    if (this.canvas.width !== s.width * TILE) { this.canvas.width = s.width * TILE; this.canvas.height = s.height * TILE; }
    draw(this.ctx, {
      s, selected: null, hover: this.hover, mode: 'move', reach: null, path: null, ringed: new Set(), aimTiles: new Set(),
      coverRot: this.rot, overwatchView: false, floaters: [], now: 0,
    });
  }
}
