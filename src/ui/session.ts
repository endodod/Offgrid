import { CLASSES } from '../data/units';
import { GADGETS } from '../data/gadgets';
import { ITEMS } from '../data/items';
import type { AiProfileId } from '../data/aiProfiles';
import type { TimeOfDayId } from '../data/timeOfDay';
import type { WeatherId } from '../data/weather';
import type { MapDef } from '../data/trainingGrounds';
import { RULES } from '../data/rules';
import { aidBlock, gadgetBlock, gadgetTargetBlock, interactBlock, interactableBlock, moveRange, perform, reviveBlock, validate, type Action } from '../core/actions';
import { aiTurn } from '../core/ai';
import { coverAgainst, coverAt, damageAgainst, hitChance, targetBlock } from '../core/combat';
import { envMods } from '../core/environment';
import { cheb, dist, findPath, hasLos, idx, inBounds, reachable } from '../core/grid';
import { createGame, reseed } from '../core/state';
import { refreshVision } from '../core/vision';
import type { GameEvent, GameState, Pos, Unit } from '../core/types';
import type { Floater, View } from '../render/renderer';
import { describe, nameOf, type LogLine } from './log';

export type Mode = 'move' | 'attack' | 'gadget' | 'aid' | 'revive' | 'interact';
export type ButtonId = 'move' | 'attack' | 'reload' | 'gadget' | 'overwatch' | 'aid' | 'revive' | 'interact' | 'endTurn';
export interface ButtonState { enabled: boolean; reason: string | null; label: string; active: boolean }

/** UI state + input rules. Turns clicks into core actions; never implements game rules itself. */
export class Session {
  state!: GameState;
  seed = 1;
  selectedId: number | null = null;
  mode: Mode = 'move';
  hover: Pos | null = null;
  floaters: Floater[] = [];
  log: LogLine[] = [];
  status = '';
  busy = false; // true while the enemy phase (or a player auto-run phase) is playing out
  skipEnemyPhase = false; // debug
  autoRun = false; // player phase is played by the 'friendly' AI instead of manual input (0d)
  coverRot = 0; // rotation the tank gives the cover it places (Q / wheel)
  showOverwatch = false; // overwatch view: coverage of units on overwatch
  lastAction: Action | null = null; // most recent manually-performed action (0f's tutorial reacts to this)
  onChange: () => void = () => {};
  private runId = 0;

  constructor(private map: MapDef) {
    this.reset();
  }

  // ---------- lifecycle / debug ----------
  /** Start a (new) mission from the home screen. */
  load(map: MapDef) {
    this.map = map;
    this.reset();
  }

  reset(seed = this.seed) {
    this.runId++; // cancels an enemy phase that is still animating
    this.seed = seed;
    this.state = createGame(this.map, seed);
    this.busy = false;
    this.autoRun = false;
    this.lastAction = null;
    this.floaters = [];
    this.coverRot = 0;
    this.showOverwatch = false;
    this.log = [{ kind: 'system', text: `${this.map.name} loaded (seed ${seed}).` }];
    this.status = 'Your turn. Click a unit, then a tile to move or an enemy to attack.';
    this.mode = 'move';
    this.selectedId = null; // no unit pre-selected: the player's first click is a deliberate one
    this.flush();
    this.onChange();
  }

  reseedRng() {
    this.seed = Math.floor(Math.random() * 2 ** 31);
    reseed(this.state, this.seed);
    this.say(`RNG reseeded (${this.seed}).`, 'system');
  }

  toggleFog(on: boolean) {
    this.state.fogEnabled = on;
    refreshVision(this.state);
    this.onChange();
  }

  setTimeOfDay(t: TimeOfDayId) {
    this.state.timeOfDay = t;
    refreshVision(this.state);
    this.onChange();
  }

  setWeather(w: WeatherId) {
    this.state.weather = w;
    refreshVision(this.state);
    this.onChange();
  }

  setEnemyProfile(p: AiProfileId) {
    this.state.aiProfiles.enemy = p;
    this.onChange();
  }

  // ---------- selection ----------
  selected(): Unit | null {
    const u = this.selectedId === null ? null : this.state.units[this.selectedId];
    return u && u.alive ? u : null;
  }

  select(id: number) {
    const u = this.state.units[id];
    if (!u || !u.alive || u.downed || u.team !== 'player') return;
    this.selectedId = id;
    this.mode = 'move';
    this.onChange();
  }

  /** Esc / right-click: leave a targeting mode first; with nothing pending, deselect the unit. */
  cancel() {
    if (this.mode !== 'move') this.mode = 'move';
    else this.selectedId = null;
    this.status = '';
    this.onChange();
  }

  /** Select a unit, or deselect it if it already is the selection. */
  toggleSelect(id: number) {
    if (this.selectedId === id) this.cancelSelection();
    else this.select(id);
  }

  private cancelSelection() {
    this.selectedId = null;
    this.mode = 'move';
    this.status = '';
    this.onChange();
  }

  toggleOverwatchView() {
    this.showOverwatch = !this.showOverwatch;
    this.onChange();
  }

  /**
   * 0d: hand the player phase to the 'friendly' AI instead of manual input. Toggling off mid-phase lets the
   * phase currently in progress finish (it can't cleanly abort mid-unit-turn) but stops it chaining into
   * another one; toggling on while it's not the player's turn just arms it for when that phase starts.
   */
  toggleAutoRun() {
    this.autoRun = !this.autoRun;
    this.state.aiProfiles.player = this.autoRun ? 'friendly' : 'standard';
    if (this.autoRun && this.ready) this.runPlayerAuto();
    this.onChange();
  }

  private alivePlayerCount() {
    return this.state.units.filter((u) => u.team === 'player' && u.alive && !u.downed).length;
  }

  /** Rotate the cover piece the tank is about to place. */
  rotateCover(dir: 1 | -1) {
    if (this.mode !== 'gadget' || this.selected()?.gadget?.id !== 'cover') return;
    this.coverRot = (this.coverRot + dir + 4) % 4;
    this.onChange();
  }

  private get ready() {
    return this.state.phase === 'player' && !this.busy && !this.state.winner;
  }

  private visibleUnitAt(p: Pos): Unit | undefined {
    return this.state.units.find((u) => u.alive && u.x === p.x && u.y === p.y && (u.team === 'player' || this.state.seenUnits.player.has(u.id)));
  }

  // ---------- mouse ----------
  setHover(p: Pos | null) {
    const next = p && inBounds(this.state, p.x, p.y) ? p : null;
    if (next?.x === this.hover?.x && next?.y === this.hover?.y) return;
    this.hover = next;
    this.onChange();
  }

  click(p: Pos) {
    if (!this.ready || !inBounds(this.state, p.x, p.y)) return;
    const sel = this.selected();
    const at = this.visibleUnitAt(p);
    if (sel && this.mode === 'gadget') {
      if (this.try({ type: 'gadget', unit: sel.id, target: p, rotation: this.coverRot })) this.mode = 'move';
    } else if (sel && this.mode === 'aid') {
      if (at?.team === 'player' && this.try({ type: 'aid', unit: sel.id, target: at.id })) this.mode = 'move';
    } else if (sel && this.mode === 'revive') {
      if (at?.team === 'player' && this.try({ type: 'revive', unit: sel.id, target: at.id })) this.mode = 'move';
    } else if (sel && this.mode === 'interact') {
      const it = this.state.interactables.find((x) => x.x === p.x && x.y === p.y);
      const obj = this.state.objective;
      const onObjective = !!obj && obj.x === p.x && obj.y === p.y;
      if (it) { if (this.try({ type: 'interact', unit: sel.id, target: it.id })) this.mode = 'move'; }
      else if (onObjective) { if (this.try({ type: 'interact', unit: sel.id })) this.mode = 'move'; }
    } else if (at?.team === 'player' && !at.downed) {
      this.toggleSelect(at.id); // clicking the selected unit again deselects it
    } else if (sel && at) {
      this.try({ type: 'attack', unit: sel.id, target: at.id });
    } else if (sel) {
      this.try({ type: 'move', unit: sel.id, to: p });
    }
    this.onChange();
  }

  /** Every interact target `u` could legally use right now: the objective (undefined) and/or nearby doors/switches. */
  private interactTargets(u: Unit): (number | undefined)[] {
    const s = this.state;
    const out: (number | undefined)[] = [];
    if (interactBlock(s, u) === null) out.push(undefined);
    for (const it of s.interactables) if (interactableBlock(s, u, it.id) === null) out.push(it.id);
    return out;
  }

  // ---------- action bar ----------
  buttonState(b: ButtonId): ButtonState {
    const u = this.selected();
    const off = (reason: string): ButtonState => ({ enabled: false, reason, label: b, active: false });
    if (b === 'endTurn') return this.ready ? { enabled: true, reason: null, label: 'End turn', active: false } : off('Not your phase');
    if (!this.ready) return off('Not your phase');
    if (!u) return off('Select a unit');
    const gate = (reason: string | null, label: string, active = false): ButtonState => ({ enabled: !reason, reason, label, active });
    switch (b) {
      case 'move': return gate(u.actions > 0 ? null : 'No actions left', 'Move', this.mode === 'move');
      case 'attack': return gate(u.actions <= 0 ? 'No actions left' : u.overwatch ? 'Weapon reserved for overwatch' : u.ammo <= 0 ? 'Out of ammo' : null, 'Attack', this.mode === 'attack');
      case 'reload': return gate(validate(this.state, { type: 'reload', unit: u.id }), 'Reload');
      case 'gadget': return gate(gadgetBlock(u), u.gadget ? GADGETS[u.gadget.id].name : 'Gadget', this.mode === 'gadget');
      case 'overwatch': return gate(validate(this.state, { type: 'overwatch', unit: u.id }), 'Overwatch');
      case 'aid': return gate(aidBlock(u), 'First aid', this.mode === 'aid');
      case 'revive': return gate(reviveBlock(u), 'Revive', this.mode === 'revive');
      case 'interact': {
        const targets = this.interactTargets(u);
        if (targets.length) return gate(null, 'Interact', this.mode === 'interact');
        const reason = this.state.interactables.length && interactBlock(this.state, u) === 'No objective' ? 'Not adjacent to a door, switch, or chest' : interactBlock(this.state, u);
        return gate(reason, 'Interact');
      }
    }
  }

  press(b: ButtonId) {
    if (!this.buttonState(b).enabled) return;
    const u = this.selected();
    if (b === 'endTurn') return this.endTurn();
    if (!u) return;
    switch (b) {
      case 'move':
      case 'attack': this.mode = b; break;
      case 'reload': this.try({ type: 'reload', unit: u.id }); break;
      case 'overwatch': this.try({ type: 'overwatch', unit: u.id }); break;
      case 'interact': {
        const targets = this.interactTargets(u);
        if (targets.length === 1) this.try({ type: 'interact', unit: u.id, target: targets[0] });
        else this.mode = this.mode === 'interact' ? 'move' : 'interact';
        this.status = this.mode === 'interact' ? 'Pick the objective, a door, switch, or chest to interact with.' : '';
        break;
      }
      case 'gadget':
        if (GADGETS[u.gadget!.id].target === 'none') this.try({ type: 'gadget', unit: u.id });
        else {
          this.mode = this.mode === 'gadget' ? 'move' : 'gadget';
          this.status = this.mode !== 'gadget' ? '' : u.gadget!.id === 'cover' ? 'Pick a tile within 2. Q / mouse wheel rotates the piece.' : 'Pick a target.';
        }
        break;
      case 'aid': {
        const targets = this.state.units.filter((t) => aidBlock(u, t) === null);
        if (targets.length === 1) this.try({ type: 'aid', unit: u.id, target: targets[0].id }); // only one option: just do it
        else if (targets.length === 0) this.status = 'No wounded ally in reach (self or adjacent).';
        else this.mode = this.mode === 'aid' ? 'move' : 'aid';
        break;
      }
      case 'revive': {
        const targets = this.state.units.filter((t) => reviveBlock(u, t) === null);
        if (targets.length === 1) this.try({ type: 'revive', unit: u.id, target: targets[0].id });
        else if (targets.length === 0) this.status = 'No downed ally in reach (adjacent).';
        else this.mode = this.mode === 'revive' ? 'move' : 'revive';
        break;
      }
    }
    this.onChange();
  }

  // ---------- turn flow ----------
  endTurn() {
    if (!this.try({ type: 'endTurn' })) return;
    this.mode = 'move';
    this.busy = true;
    const runId = ++this.runId;
    if (this.skipEnemyPhase) { // debug: the enemy passes
      this.try({ type: 'endTurn' });
      this.finishEnemyPhase();
      return;
    }
    const gen = aiTurn(this.state, 'enemy'); // one action per step so the player can follow what happens
    const step = () => {
      if (runId !== this.runId) return;
      const r = gen.next();
      this.flush();
      this.onChange();
      if (r.done || this.state.winner) this.finishEnemyPhase();
      else setTimeout(step, 420);
    };
    this.status = 'Enemy phase...';
    setTimeout(step, 250);
  }

  private finishEnemyPhase() {
    this.busy = false; // selection is left alone: nothing selected stays nothing selected
    this.status = this.state.winner ? '' : 'Your turn.';
    this.onChange();
    if (!this.state.winner && this.autoRun) this.runPlayerAuto();
  }

  /** 0d: play the player's own phase with the 'friendly' AI, mirroring endTurn()'s stepped enemy-phase loop. */
  private runPlayerAuto() {
    this.mode = 'move';
    this.selectedId = null; // nothing to manually control while it's driving
    this.busy = true;
    const runId = ++this.runId;
    const before = this.alivePlayerCount();
    const gen = aiTurn(this.state, 'player');
    const step = () => {
      if (runId !== this.runId) return;
      const r = gen.next();
      this.flush();
      if (this.autoRun && this.alivePlayerCount() < before) { // hand control back on a casualty
        this.autoRun = false;
        this.state.aiProfiles.player = 'standard';
        this.say('Auto-run stopped: a unit went down.', 'system');
      }
      this.onChange();
      if (r.done || this.state.winner) {
        this.busy = false;
        this.status = this.state.winner ? '' : this.autoRun ? 'Auto-run...' : 'Your turn.';
        this.onChange();
        if (!this.state.winner && this.autoRun) this.endTurn(); // chain into the enemy phase, then loop back here
        return;
      }
      setTimeout(step, 220);
    };
    this.status = 'Auto-run...';
    setTimeout(step, 200);
  }

  // ---------- helpers ----------
  private try(a: Action): boolean {
    const r = perform(this.state, a);
    this.flush();
    this.status = r.ok ? '' : r.error;
    if (r.ok) this.lastAction = a; // a manually-performed action, for 0f's tutorial to react to - never set by AI turns
    return r.ok;
  }

  private say(text: string, kind: LogLine['kind']) {
    this.log.push({ kind, text });
    this.onChange();
  }

  /** Move engine events into the log and floating texts. */
  private flush() {
    const s = this.state;
    const now = performance.now();
    let n = 0; // stagger floating texts so a burst reads as separate shots
    for (const e of s.events.splice(0)) {
      const line = describe(s, e);
      if (line) this.log.push(line);
      if (e.seen && this.floaterFor(e, now + n * 260)) n++;
    }
    if (this.selectedId !== null && !this.selected()) this.selectedId = null;
  }

  /** Returns true if the event produced a floating text. */
  private floaterFor(e: GameEvent, born: number): boolean {
    const add = (p: Pos, text: string, color: string) => { this.floaters.push({ x: p.x, y: p.y, text, color, born }); return true; };
    if (e.t === 'shot') return add(e.at, e.hit ? `-${e.damage}` : 'MISS', e.hit ? '#ff7a63' : '#b8b8a8');
    if (e.t === 'damage') return add(e.at, `-${e.amount}`, '#ff7a63');
    if (e.t === 'heal') return add(e.at, `+${e.amount}`, '#8fd19a');
    if (e.t === 'revive') return add(e.at, `+${e.amount}`, '#8fd19a');
    if (e.t === 'downed') return add(e.at, 'DOWN', '#e6a23a');
    if (e.t === 'died') return add(e.at, 'DEAD', '#e6e0c8');
    return false;
  }

  // ---------- read models for render / HUD ----------
  view(now: number): View {
    const s = this.state;
    const u = this.selected();
    this.floaters = this.floaters.filter((f) => now - f.born < 1400);
    const view: View = { s, selected: u, hover: this.hover, mode: this.mode, reach: null, path: null, ringed: new Set(), aimTiles: new Set(), coverRot: this.coverRot, overwatchView: this.showOverwatch, floaters: this.floaters, now };
    if (!u || !this.ready) return view;
    if (this.mode === 'move' && u.actions > 0) {
      const reach = reachable(s, u, moveRange(s, u));
      view.reach = new Set([...reach.keys()].filter((i) => i !== idx(s, u.x, u.y)));
      if (this.hover && reach.has(idx(s, this.hover.x, this.hover.y))) view.path = findPath(s, u, this.hover, moveRange(s, u));
    }
    if (this.mode === 'attack') for (const t of s.units) if (t.team === 'enemy' && validate(s, { type: 'attack', unit: u.id, target: t.id }) === null) view.ringed.add(t.id);
    if (this.mode === 'aid') for (const t of s.units) if (aidBlock(u, t) === null) view.ringed.add(t.id);
    if (this.mode === 'revive') for (const t of s.units) if (reviveBlock(u, t) === null) view.ringed.add(t.id);
    if (this.mode === 'interact') {
      for (const it of s.interactables) if (interactableBlock(s, u, it.id) === null) view.aimTiles.add(idx(s, it.x, it.y));
      if (s.objective && interactBlock(s, u) === null) view.aimTiles.add(idx(s, s.objective.x, s.objective.y));
    }
    if (this.mode === 'gadget' && u.gadget && GADGETS[u.gadget.id].range !== undefined) {
      const r = GADGETS[u.gadget.id].range!;
      for (let y = u.y - r; y <= u.y + r; y++)
        for (let x = u.x - r; x <= u.x + r; x++)
          if (inBounds(s, x, y) && gadgetTargetBlock(s, u, { x, y }) === null) view.aimTiles.add(idx(s, x, y));
    }
    return view;
  }

  /** Known enemy on overwatch that could react if a unit ends up on `p` - fog-fair: only units the player has seen. */
  private dangerAt(p: Pos): string | null {
    const s = this.state;
    for (const e of s.units) {
      if (!e.alive || e.team === 'player' || !e.overwatch || !s.seenUnits.player.has(e.id)) continue;
      if (dist(e, p) <= CLASSES[e.cls].weapon.range && hasLos(s, e, p)) return 'Danger: known enemy overwatch covers this tile';
    }
    return null;
  }

  /** Move-mode hover: path cost, actions left after the move, and whether the destination is watched. */
  private moveHoverInfo(sel: Unit, p: Pos): string[] | null {
    const s = this.state;
    const r = reachable(s, sel, moveRange(s, sel)).get(idx(s, p.x, p.y));
    if (!r || r.cost === 0) return null; // unreachable, occupied, or the unit's own tile
    const lines = [`Move here: ${r.cost} tile${r.cost > 1 ? 's' : ''} (of ${moveRange(s, sel)} max)`, `Actions after move: ${sel.actions - 1}`];
    const danger = this.dangerAt(p);
    if (danger) lines.push(danger);
    return lines;
  }

  /** Gadget-mode hover: what the gadget would do if used on `p` (or why it can't be targeted there). */
  private gadgetHoverInfo(sel: Unit, p: Pos): string[] | null {
    const s = this.state;
    const g = sel.gadget;
    if (!g) return null;
    const def = GADGETS[g.id];
    if (def.target === 'none') return null;
    const blocked = gadgetTargetBlock(s, sel, p);
    if (blocked) return [def.name, `Cannot target: ${blocked}`];
    if (g.id === 'grenade') {
      const hit = s.units.filter((u) => u.alive && cheb(p, u) <= def.radius! && (u.team === 'player' || s.seenUnits.player.has(u.id)));
      const names = hit.length ? hit.map((u) => nameOf(u)).join(', ') : 'nobody visible';
      return [`Grenade: ${def.damage} dmg (ignores armor) to everyone in the 3x3 blast`, `Catches: ${names}`, 'Cover in the blast: high -> low, low -> destroyed'];
    }
    if (g.id === 'cover') {
      const c = coverAt(s, p.x, p.y);
      return [c === 'low' ? 'Cover: low -> high here' : 'Cover: places low cover here'];
    }
    if (g.id === 'medkit') {
      const t = this.visibleUnitAt(p)!;
      return [`Medkit: heals ${nameOf(t)} for ${CLASSES[t.cls].hp - t.hp} HP (to full)`];
    }
    if (g.id === 'scan') return [`Scan: reveals fog and hidden units within ${def.radius} tiles here for ${def.durationTurns} turns`];
    return null;
  }

  /** Revive-mode hover: the heal-to amount, or why the hovered ally can't be revived. */
  private reviveHoverInfo(sel: Unit, p: Pos): string[] | null {
    const t = this.visibleUnitAt(p);
    if (!t || t.team !== 'player') return null;
    const blocked = reviveBlock(sel, t);
    if (blocked) return [`Revive`, `Cannot revive: ${blocked}`];
    return [`Revive ${nameOf(t)}: restores to ${Math.min(CLASSES[t.cls].hp, RULES.reviveHp)} HP`];
  }

  /** Tooltip lines for the hovered tile (enemy: hit chance, damage, cover state relative to the selected unit). */
  hoverInfo(): string[] | null {
    const p = this.hover;
    if (!p) return null;
    const s = this.state;
    const at = this.visibleUnitAt(p);
    const sel = this.selected();
    if (sel && this.mode === 'move' && sel.actions > 0) {
      const info = this.moveHoverInfo(sel, p);
      if (info) return info;
    }
    if (sel && this.mode === 'gadget') {
      const info = this.gadgetHoverInfo(sel, p);
      if (info) return info;
    }
    if (sel && this.mode === 'revive') {
      const info = this.reviveHoverInfo(sel, p);
      if (info) return info;
    }
    const downedLine = (t: Unit) => `Downed: dies for good in ${t.bleedOut} round${t.bleedOut === 1 ? '' : 's'} if not revived`;
    if (at?.team === 'enemy') {
      const def = CLASSES[at.cls];
      const lines = [`${nameOf(at)}  HP ${at.hp}/${def.hp}  Armor ${def.armor}`];
      if (at.downed) lines.push(downedLine(at));
      if (!sel) return [...lines, 'Select a unit to see hit chance.'];
      if (at.exposed) lines.push('Exposed: visible in the bush until its next turn');
      if (at.downed) {
        lines.push('Finishing shot: no roll needed, any hit is a guaranteed kill');
        const blocked = targetBlock(s, sel, at);
        if (blocked) lines.push(`Cannot fire: ${blocked}`);
        return lines;
      }
      const cover = coverAgainst(s, at, sel);
      const w = CLASSES[sel.cls].weapon;
      lines.push(`Cover: ${cover.state}${cover.penalty ? ` (-${cover.penalty}% to hit)` : ''}`);
      const envMod = envMods(s).accuracyMod;
      if (envMod) lines.push(`Weather/time: ${envMod > 0 ? '+' : ''}${envMod}% to hit`);
      lines.push(`Hit chance ${hitChance(s, sel, at)}%   Damage ${damageAgainst(w.damage, def.armor)}${w.shots > 1 ? ` x${w.shots} shots` : ''}`);
      const blocked = targetBlock(s, sel, at);
      if (blocked) lines.push(`Cannot fire: ${blocked}`);
      return lines;
    }
    if (at) {
      const lines = [`${nameOf(at)}  HP ${at.hp}/${CLASSES[at.cls].hp}  Ammo ${at.ammo}/${CLASSES[at.cls].weapon.magazine}`];
      if (at.downed) lines.push(downedLine(at));
      if (at.exposed) lines.push('Exposed: visible in the bush until your next turn');
      return lines;
    }
    const it = s.interactables.find((x) => x.x === p.x && x.y === p.y);
    if (it) {
      const nowVisible = s.visible.player[idx(s, p.x, p.y)] === 1;
      const known = !s.fogEnabled || nowVisible || it.id in s.memory.player.doors;
      if (known) {
        const active = !s.fogEnabled || nowVisible ? it.active : s.memory.player.doors[it.id];
        const stale = s.fogEnabled && !nowVisible ? ' (last seen - may have changed)' : '';
        if (it.type === 'door') return [`Door: ${active ? 'open' : 'closed'}${stale}`];
        if (it.type === 'chest') return [`Chest: ${active ? 'already opened' : 'unopened'}${stale}`];
        const linkCount = it.links?.length ?? 0;
        return [`Switch: ${active ? 'on' : 'off'}${stale}`, `Linked to ${linkCount} door${linkCount === 1 ? '' : 's'}`];
      }
    }
    const pickup = s.pickups.find((x) => x.x === p.x && x.y === p.y);
    if (pickup && (!s.fogEnabled || s.visible.player[idx(s, p.x, p.y)] === 1)) return [`${ITEMS[pickup.type].name} (+${pickup.amount}) - walk onto it to collect`];
    const ghost = Object.entries(s.memory.player.lastSeen).find(([id, g]) => g.x === p.x && g.y === p.y && s.units[Number(id)].alive);
    if (ghost) return [`Last seen: ${nameOf(s.units[Number(ghost[0])])}`];
    const i = idx(s, p.x, p.y);
    const seen = s.visible.player[i] === 1;
    const cover = s.cover[i];
    const what = s.terrain[i] === 'wall' ? 'Wall' : cover ? `${cover === 'high' ? 'High' : 'Low'} cover` : s.terrain[i] === 'bush' ? 'Bush (hides units)' : null;
    return what ? [`${what}${seen ? '' : ' - out of sight'}`] : null;
  }
}
