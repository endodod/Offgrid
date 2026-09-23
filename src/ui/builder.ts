import { parseMap, serializeMap, withEdits, WALKABLE } from '../core/mapFormat';
import { distanceMap, idx } from '../core/grid';
import { createGame } from '../core/state';
import { refreshVision } from '../core/vision';
import type { Pos } from '../core/types';
import { AI_PROFILES, PROFILE_ORDER, type AiProfileId } from '../data/aiProfiles';
import { ITEMS, type ItemType } from '../data/items';
import type { Mission } from '../data/missions';
import type { InteractableDef, MapDef, PickupDef, Spawn } from '../data/trainingGrounds';
import { CLASSES, CLASS_ORDER, type ClassId } from '../data/units';
import { draw, RES, TILE } from '../render/renderer';
import { clearCustom, saveCustom } from './mapStore';
import { confirmModal } from './modal';
import { emptyFrame } from './anim';
import { seg } from './seg';

type Tool = 'floor' | 'wall' | 'bush' | 'low' | 'high' | 'objective' | 'door' | 'switch' | 'chest' | 'link'
  | 'pickup-ammo' | 'pickup-medkit' | 'pickup-gadget' | 'player' | 'enemy' | 'erase';
type Team = 'player' | 'enemy';

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'floor', label: 'Floor' }, { id: 'wall', label: 'Wall' }, { id: 'bush', label: 'Bush' },
  { id: 'low', label: 'Low cover' }, { id: 'high', label: 'High cover' }, { id: 'objective', label: 'Objective' },
  { id: 'door', label: 'Door' }, { id: 'switch', label: 'Switch' }, { id: 'chest', label: 'Chest' }, { id: 'link', label: 'Link switch↔door' },
  { id: 'pickup-ammo', label: 'Ammo pickup' }, { id: 'pickup-medkit', label: 'Medkit pickup' }, { id: 'pickup-gadget', label: 'Gadget pickup' },
  { id: 'player', label: 'Friendly unit' }, { id: 'enemy', label: 'Enemy unit' }, { id: 'erase', label: 'Erase' },
];
const TERRAIN_CHAR: Partial<Record<Tool, string>> = { floor: '.', wall: '#', bush: 'b', high: 'h', objective: 'O' };
/** The item each pickup tool paints (4). */
const PICKUP_TOOL_TYPE: Partial<Record<Tool, ItemType>> = { 'pickup-ammo': 'ammo', 'pickup-medkit': 'medkit', 'pickup-gadget': 'gadget' };

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
  private interactables: InteractableDef[] = [];
  private pickups: PickupDef[] = [];
  private tool: Tool = 'wall';
  private cls: ClassId = 'soldier';
  private profile: AiProfileId = 'standard'; // AI habitat/difficulty for the next enemy unit painted
  private rot = 0;
  private hover: Pos | null = null;
  private stroke: Tool | null = null; // tool of the drag in progress
  private linkFrom: number | null = null; // switch id waiting for a door click, while the link tool is active
  private dirty = false;
  private canvas = $<HTMLCanvasElement>('bcanvas');
  private ctx = this.canvas.getContext('2d')!;

  constructor(private hooks: BuilderHooks) {
    $('b-tools').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tool]');
      if (b) { this.tool = b.dataset.tool as Tool; this.linkFrom = null; this.note(''); this.refresh(); }
    });
    seg($('b-class'), CLASS_ORDER.map((c) => ({ value: c, label: CLASSES[c].name })), this.cls,
      (v) => { this.cls = v as ClassId; });
    seg($('b-profile'), PROFILE_ORDER.map((p) => ({ value: p, label: AI_PROFILES[p].name, title: AI_PROFILES[p].blurb })), this.profile,
      (v) => { this.profile = v as AiProfileId; });
    $('b-rot').addEventListener('click', () => this.rotate(1));

    const tileAt = (ev: MouseEvent): Pos => {
      const r = this.canvas.getBoundingClientRect();
      const k = this.canvas.width / RES / TILE / r.width;
      return { x: Math.floor((ev.clientX - r.left) * k), y: Math.floor((ev.clientY - r.top) * k) };
    };
    this.canvas.addEventListener('mousedown', (ev) => {
      const tool = ev.button === 2 ? 'erase' : this.tool; // right button always erases
      if (tool === 'link') { const { x, y } = tileAt(ev); this.link(x, y); return; } // click, not drag
      this.stroke = tool;
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
    $('b-default').addEventListener('click', () => void this.resetToDefault());
    $('b-back').addEventListener('click', async () => {
      if (this.dirty && !(await confirmModal({ title: 'Discard changes?', body: ['Your unsaved changes to this map will be lost.'], cta: 'Discard', danger: true }))) return;
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
    this.interactables = (map.interactables ?? []).map((it) => ({ ...it, links: it.links ? [...it.links] : undefined }));
    this.pickups = (map.pickups ?? []).map((p) => ({ ...p }));
    this.linkFrom = null;
  }

  private toMap(): MapDef {
    return withEdits(this.mission.map, this.grid.map((r) => r.join('')), this.spawns, this.interactables, this.pickups);
  }

  // ---------- editing ----------
  private spawnAt(x: number, y: number): { team: Team; i: number } | null {
    for (const team of ['player', 'enemy'] as Team[]) {
      const i = this.spawns[team].findIndex(([, sx, sy]) => sx === x && sy === y);
      if (i >= 0) return { team, i };
    }
    return null;
  }

  private interactableAt(x: number, y: number): InteractableDef | null {
    return this.interactables.find((it) => it.x === x && it.y === y) ?? null;
  }

  private nextInteractableId(): number {
    return this.interactables.reduce((m, it) => Math.max(m, it.id), 0) + 1;
  }

  /** Removes an interactable and, if it was a door, scrubs it out of every switch's links. */
  private removeInteractable(id: number) {
    const i = this.interactables.findIndex((it) => it.id === id);
    if (i < 0) return;
    const removed = this.interactables[i];
    this.interactables.splice(i, 1);
    if (removed.type === 'door') for (const it of this.interactables) if (it.links) it.links = it.links.filter((l) => l !== id);
    if (this.linkFrom === id) this.linkFrom = null;
  }

  private pickupAt(x: number, y: number): PickupDef | null {
    return this.pickups.find((p) => p.x === x && p.y === y) ?? null;
  }

  private nextPickupId(): number {
    return this.pickups.reduce((m, p) => Math.max(m, p.id), 0) + 1;
  }

  private removePickup(id: number) {
    const i = this.pickups.findIndex((p) => p.id === id);
    if (i >= 0) this.pickups.splice(i, 1);
  }

  /** Link tool: click a switch, then click a door to toggle it on/off that switch's link list. */
  private link(x: number, y: number) {
    const it = this.interactableAt(x, y);
    if (this.linkFrom === null) {
      if (!it || it.type !== 'switch') { this.note('Click a switch, then click a door, to link or unlink them.'); return; }
      this.linkFrom = it.id;
      this.note(`Switch ${it.id} selected - click a door to link/unlink it, or click the switch again to cancel.`);
      this.render();
      return;
    }
    if (it && it.id === this.linkFrom) { this.linkFrom = null; this.note(''); this.render(); return; }
    if (!it || it.type !== 'door') { this.note('Click a door to link it to the selected switch.'); return; }
    const sw = this.interactables.find((s) => s.id === this.linkFrom)!;
    const links = sw.links ?? (sw.links = []);
    const i = links.indexOf(it.id);
    if (i >= 0) { links.splice(i, 1); this.note(`Unlinked door ${it.id} from switch ${sw.id}.`); }
    else { links.push(it.id); this.note(`Linked door ${it.id} to switch ${sw.id}.`); }
    this.dirty = true;
    this.refresh();
  }

  private paint({ x, y }: Pos) {
    const tool = this.stroke;
    if (!tool || y < 0 || x < 0 || y >= this.grid.length || x >= this.grid[0].length) return;
    const before = this.grid[y][x];
    const sp = this.spawnAt(x, y);
    const it = this.interactableAt(x, y);
    const pk = this.pickupAt(x, y);
    const dropSpawn = () => { if (sp) this.spawns[sp.team].splice(sp.i, 1); };
    let changed = true;
    if (tool === 'erase') {
      if (sp) dropSpawn(); else if (it) this.removeInteractable(it.id); else if (pk) this.removePickup(pk.id); else this.grid[y][x] = '.';
    } else if (tool === 'player' || tool === 'enemy') {
      if (!WALKABLE.includes(before)) { this.note('Units need an open floor or bush tile.'); return; }
      if (it) { this.note('Tile is occupied by a door/switch/chest.'); return; }
      if (pk) { this.note('Tile is occupied by a pickup.'); return; }
      const dup = sp && sp.team === tool && this.spawns[tool][sp.i][0] === this.cls;
      dropSpawn();
      // painting the same unit again removes it; 'standard' is left implicit (the mission/team default) rather
      // than baked into every spawn, so a mission's own default can still change later without editing every unit
      if (!dup) this.spawns[tool].push(tool === 'enemy' && this.profile !== 'standard' ? [this.cls, x, y, this.profile] : [this.cls, x, y]);
    } else if (tool === 'door' || tool === 'switch' || tool === 'chest') {
      if (!WALKABLE.includes(before)) { this.note('Doors/switches/chests need an open floor or bush tile.'); return; }
      if (sp) { this.note('Tile is occupied by a unit.'); return; }
      if (pk) { this.note('Tile is occupied by a pickup.'); return; }
      // painting the same kind onto its own tile removes it, matching the unit tools' toggle behaviour
      if (it && it.type === tool) this.removeInteractable(it.id);
      else { if (it) this.removeInteractable(it.id); this.interactables.push({ id: this.nextInteractableId(), type: tool, x, y }); }
    } else if (PICKUP_TOOL_TYPE[tool]) {
      const type = PICKUP_TOOL_TYPE[tool]!;
      if (!WALKABLE.includes(before)) { this.note(`${ITEMS[type].name} needs an open floor or bush tile.`); return; }
      if (sp) { this.note('Tile is occupied by a unit.'); return; }
      if (it) { this.note('Tile is occupied by a door/switch/chest.'); return; }
      // painting the same kind onto its own tile removes it, matching the door/switch tools' toggle behaviour
      if (pk && pk.type === type) this.removePickup(pk.id);
      else { if (pk) this.removePickup(pk.id); this.pickups.push({ id: this.nextPickupId(), type, x, y }); }
    } else {
      const ch = tool === 'low' ? (this.rot === 0 ? 'l' : String(this.rot)) : TERRAIN_CHAR[tool]!;
      const keepsUnit = WALKABLE.includes(ch); // floor and bush can hold a unit; walls, cover and the terminal can't
      changed = before !== ch || (!keepsUnit && !!sp) || (!keepsUnit && !!it) || (!keepsUnit && !!pk);
      if (!keepsUnit) { dropSpawn(); if (it) this.removeInteractable(it.id); if (pk) this.removePickup(pk.id); }
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

  private async resetToDefault() {
    if (!(await confirmModal({ title: 'Reset to default?', body: ['This deletes the saved map and goes back to the default layout.'], cta: 'Delete saved map', danger: true }))) return;
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
    for (const it of this.interactables) if (it.type === 'switch' && !it.links?.length) out.push(`Switch ${it.id} at (${it.x},${it.y}) has no linked doors.`);
    return out;
  }

  private note(text: string) {
    $('b-msg').textContent = text;
  }

  private refresh() {
    $('b-tools').innerHTML = TOOLS.map((t) => `<button data-tool="${t.id}" class="${t.id === this.tool ? 'active' : ''}">${t.label}</button>`).join('');
    $('b-rotlabel').textContent = `${this.rot * 90}°`;
    $('b-profile-row').hidden = this.tool !== 'enemy';
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
    const w = Math.round(s.width * TILE * RES), h = Math.round(s.height * TILE * RES);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    draw(this.ctx, {
      s, selected: null, hover: this.hover, mode: 'move', reach: null, path: null, ringed: new Set(), aimTiles: new Set(),
      coverRot: this.rot, overwatchView: false, floaters: [], now: 0, anim: emptyFrame(), shake: false, ambient: false,
    });
  }
}
