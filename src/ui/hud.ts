import { CLASSES } from '../data/units';
import { GADGETS } from '../data/gadgets';
import { RULES } from '../data/rules';
import { AI_PROFILES, PROFILE_ORDER, SQUAD_ORDERS, type AiProfileId } from '../data/aiProfiles';
import { TIME_ORDER, TIMES_OF_DAY } from '../data/timeOfDay';
import { WEATHER_ORDER, WEATHERS } from '../data/weather';
import { effectiveAccuracyMod, effectiveMove, effectiveVision, envMods } from '../core/environment';
import { effectiveArmor } from '../core/combat';
import { ARMOR } from '../data/armor';
import { EQUIPMENT } from '../data/equipment';
import { PERKS } from '../data/perks';
import type { Unit } from '../core/types';
import { describeObjective } from '../core/objectives';
import type { GameState } from '../core/types';
import { keyFor } from './input';
import { displayKey, type BindableAction } from './keybindings';
import { icon, type IconName } from './icons';
import { seg } from './seg';
import { play } from './audio';
import type { ButtonId, Session } from './session';
import { nameOf } from './log';
import { levelForXp, xpEarned } from '../core/leveling';
import { getPrefs } from './prefs';

const BUTTON_ORDER: ButtonId[] = ['move', 'attack', 'reload', 'gadget', 'overwatch', 'aid', 'revive', 'interact', 'endTurn'];

/** One-line description and AP/resource cost shown in the button tooltip; every action costs 1 action unless noted. */
const BUTTON_INFO: Record<ButtonId, { desc: string; cost: string }> = {
  move: { desc: 'Move up to your Move stat in tiles toward the clicked destination.', cost: '1 action' },
  attack: { desc: 'Fire your weapon at a visible enemy in range and line of sight.', cost: '1 action, 1 ammo' },
  reload: { desc: 'Refill your magazine from reserve ammo.', cost: '1 action' },
  gadget: { desc: 'Use your class gadget.', cost: '1 action, 1 use' },
  overwatch: { desc: 'Reserve your weapon to react to the first enemy that moves or acts in your range and sight.', cost: '1 action, needs ammo' },
  aid: { desc: 'First aid: heal an adjacent ally (or yourself) for a fixed amount from your personal medkits.', cost: '1 action, 1 medkit' },
  revive: { desc: 'Bring a downed adjacent ally back with partial HP before their bleed-out timer runs out.', cost: '1 action, 1 medkit' },
  interact: { desc: 'Open/close an adjacent door, flip a switch, or interact with the objective terminal and hold position to capture it.', cost: '1 action' },
  endTurn: { desc: 'End your phase; the enemy acts next.', cost: 'no action cost' },
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const pips = (n: number, max: number) => '●'.repeat(Math.max(0, n)) + '○'.repeat(Math.max(0, max - n));

/** Equipped armor/equipment (7), comma-joined; '' if the unit carries none. */
const gearText = (u: Unit): string =>
  [u.armor ? ARMOR[u.armor].name : null, ...u.equipment.map((id) => (id ? EQUIPMENT[id].name : null))].filter(Boolean).join(', ');

/** Equipped perks (8), comma-joined; '' if none are equipped. */
const perkText = (u: Unit): string => u.equippedPerks.map((id) => PERKS[id].name).join(', ');

const stat = (k: string, v: string | number, boost?: string) =>
  `<div class="stat"><div class="stat__k">${k}</div><div class="stat__v">${v}${boost ? `<em>${boost}</em>` : ''}</div></div>`;

/** DOM side of the UI: action bar, unit card, roster, mission panel, log, debug panel. Rebuilt from Session state on every change. */
/** Short labels for the auto-run order picker (16). */
const AUTO_LABEL: Partial<Record<AiProfileId, string>> = { friendly: 'Balanced', explore: 'Explore', rush: 'Rush', defend: 'Defend' };

export class Hud {
  private logShown = 0;
  private logEpoch = -1;
  private keyHelp = '';
  private phaseKey = '';
  private mouse = { x: 0, y: 0 };
  // Tracked by id, not DOM element: the actionbar's buttons are rebuilt on every update(), which would
  // otherwise leave a hovered/focused reference pointing at a detached node.
  private hoveredButtonId: ButtonId | null = null;
  /** Set once by main.ts after both are constructed (0f); read fresh on every actionbar render for the same
   *  detached-node reason as hoveredButtonId above. */
  tutorial: { currentHighlight: string | null } | null = null;
  // Segmented-control setters, so state changed elsewhere (loading a map) re-syncs the highlight.
  private setTime: (v: string) => void;
  private setWeather: (v: string) => void;
  private setProfile: (v: string) => void;

  constructor(private session: Session) {
    const actionbar = $('actionbar');
    actionbar.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-b]');
      if (b) session.press(b.dataset.b as ButtonId);
    });
    const showButtonTip = (e: Event) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-b]');
      if (b) { this.hoveredButtonId = b.dataset.b as ButtonId; this.renderTip(); }
    };
    const hideButtonTip = (e: Event) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-b]');
      if (b && b.dataset.b === this.hoveredButtonId) { this.hoveredButtonId = null; this.renderTip(); }
    };
    // mouseover/mouseout and focusin/focusout bubble (unlike mouseenter/leave and focus/blur), so one listener
    // on the container covers every button - and focusin makes the tooltip keyboard/gamepad-reachable too.
    actionbar.addEventListener('mouseover', showButtonTip);
    actionbar.addEventListener('mouseout', hideButtonTip);
    actionbar.addEventListener('focusin', showButtonTip);
    actionbar.addEventListener('focusout', hideButtonTip);
    $('roster').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-unit]');
      if (b) session.toggleSelect(Number(b.dataset.unit));
    });
    $<HTMLInputElement>('dbg-fog').addEventListener('change', (e) => session.toggleFog((e.target as HTMLInputElement).checked));
    $<HTMLInputElement>('dbg-skip').addEventListener('change', (e) => { session.skipEnemyPhase = (e.target as HTMLInputElement).checked; });

    this.setTime = seg($('dbg-time'), TIME_ORDER.map((t) => ({ value: t, label: TIMES_OF_DAY[t].name, title: TIMES_OF_DAY[t].blurb })),
      session.state.timeOfDay, (v) => session.setTimeOfDay(v as (typeof TIME_ORDER)[number]));
    this.setWeather = seg($('dbg-weather'), WEATHER_ORDER.map((w) => ({ value: w, label: WEATHERS[w].name, title: WEATHERS[w].blurb })),
      session.state.weather, (v) => session.setWeather(v as (typeof WEATHER_ORDER)[number]));
    this.setProfile = seg($('dbg-enemy-profile'), PROFILE_ORDER.map((p) => ({ value: p, label: AI_PROFILES[p].name, title: AI_PROFILES[p].blurb })),
      session.state.aiProfiles.enemy, (v) => session.setEnemyProfile(v as (typeof PROFILE_ORDER)[number]));

    $('dbg-reset').addEventListener('click', () => { $<HTMLInputElement>('dbg-fog').checked = true; session.reset(); });
    $('dbg-reseed').addEventListener('click', () => session.reseedRng());
    $('ow-toggle').addEventListener('click', () => session.toggleOverwatchView());
    $('auto-run-toggle').addEventListener('click', () => session.toggleAutoRun());
    $('undo').addEventListener('click', () => session.undo());
    seg($('auto-mode'), SQUAD_ORDERS.map((p) => ({ value: p, label: AUTO_LABEL[p] ?? AI_PROFILES[p].name, title: AI_PROFILES[p].blurb })),
      getPrefs().autoMode, (v) => session.setAutoMode(v as AiProfileId));
    $('banner-reset').addEventListener('click', () => { $<HTMLInputElement>('dbg-fog').checked = true; session.reset(); });
  }

  /** One line telling the player what to do about the objective right now (3: type-generic, see core/objectives.ts). */
  private objectiveText(): string {
    const s = this.session.state;
    if (s.capture) {
      const u = s.units[s.capture.unit];
      const rounds = s.capture.roundsLeft;
      return `SECURING: hold ${rounds} more round${rounds > 1 ? 's' : ''} - ${nameOf(u)} must stay where it is and stay alive.`;
    }
    return describeObjective(s);
  }

  /** Mission panel: current map, time of day and weather, and their combined effect on move/vision/accuracy. */
  private missionInfo(s: GameState): string {
    const mods = envMods(s);
    const delta = (mult: number) => { const d = Math.round((mult - 1) * 100); return `${d > 0 ? '+' : ''}${d}%`; };
    const acc = `${mods.accuracyMod > 0 ? '+' : ''}${mods.accuracyMod}%`;
    return `
      <h3>Mission</h3>
      <div class="kv"><span>Map</span><b>${s.map.name}</b></div>
      <div class="kv"><span>Time of day</span><b>${TIMES_OF_DAY[s.timeOfDay].name}</b></div>
      <div class="kv"><span>Weather</span><b>${WEATHERS[s.weather].name}</b></div>
      <div class="kv"><span>Effect</span><b>Vis ${delta(mods.visionMult)} · Mov ${delta(mods.moveMult)} · Acc ${acc}</b></div>
      <p class="muted" style="margin-top:8px">${TIMES_OF_DAY[s.timeOfDay].blurb} ${WEATHERS[s.weather].blurb}</p>`;
  }

  /**
   * "Hostiles: 2 in sight · 3/6 down" for the phase strip. The total is on the mission card already, and every
   * enemy death comes from something the player did, so neither number is new information.
   */
  private hostileCount(s: GameState): string {
    const enemies = s.units.filter((u) => u.team === 'enemy');
    const down = enemies.filter((u) => !u.alive).length;
    const inSight = enemies.filter((u) => u.alive && s.seenUnits.player.has(u.id)).length;
    return `<span class="phase__meta">Hostiles: ${inSight} in sight · ${down}/${enemies.length} down</span>`;
  }

  /** The key help under the board, from the live bindings. Rebuilt only when a binding changed. */
  private renderKeyHelp() {
    const k = (a: BindableAction) => `<kbd>${displayKey(keyFor(a))}</kbd>`;
    const html = `Click a unit to select it, then a tile to move or an enemy to attack. Right-click / <kbd>Esc</kbd> cancels, then deselects.<br />
      ${k('selectUnit1')}-${k('selectUnit5')} select · ${k('endTurn')} end turn · ${k('toggleOverwatchView')} overwatch view · ${k('toggleAutoRun')} auto-run · ${k('rotateCoverCW')} / wheel rotate cover while placing it · ${k('panUp')}${k('panLeft')}${k('panDown')}${k('panRight')} / left-drag move map · ${k('zoomIn')} ${k('zoomOut')} / wheel zoom · ${k('centerCamera')} centre`;
    if (html !== this.keyHelp) { this.keyHelp = html; $('keyhelp').innerHTML = html; }
  }

  setMouse(x: number, y: number) {
    this.mouse = { x, y };
  }

  /** Tooltip lines for an action-bar button: what it does, what it costs, and why it's disabled right now. */
  private buttonTip(b: ButtonId): string[] {
    const st = this.session.buttonState(b);
    const g = this.session.selected()?.gadget;
    // the gadget button's own description depends on which gadget the selected unit actually carries
    const info = b === 'gadget' && g ? { desc: GADGETS[g.id].blurb, cost: '1 action, 1 use' } : BUTTON_INFO[b];
    return [info.desc, `Cost: ${info.cost}   Key: ${displayKey(keyFor(b))}`, ...(st.reason ? [`Disabled: ${st.reason}`] : [])];
  }

  update() {
    const s = this.session.state;
    const sel = this.session.selected();

    $('phase').innerHTML = `<b>Turn ${s.turn}</b> ${s.phase === 'player' ? 'PLAYER PHASE' : 'ENEMY PHASE'}${this.hostileCount(s)}`;
    $('phase').className = s.phase;
    this.announcePhase(s);
    this.setTime(s.timeOfDay);
    this.setWeather(s.weather);
    this.setProfile(s.aiProfiles.enemy);
    $('status').textContent = this.session.status;
    $('objective').textContent = this.objectiveText();
    $('objective').className = s.capture ? 'securing' : '';
    $('ow-toggle').classList.toggle('is-active', this.session.showOverwatch);
    $('ow-legend').hidden = !this.session.showOverwatch;
    $('auto-run-toggle').classList.toggle('is-active', this.session.autoRun);
    const undo = $('undo');
    undo.setAttribute('aria-disabled', String(!this.session.canUndo()));
    undo.querySelector('kbd')!.textContent = displayKey(keyFor('undo'));

    // aria-disabled + a class, not the disabled attribute: a truly disabled button can't be hovered or
    // focused in most browsers, which would make it impossible to show the tooltip explaining *why*.
    // Session.press() already no-ops when the button isn't enabled, so this is safe to still click.
    $('actionbar').innerHTML = BUTTON_ORDER.map((id) => {
      const st = this.session.buttonState(id);
      const cls = [st.active ? 'active' : '', st.enabled ? '' : 'disabled', this.tutorial?.currentHighlight === id ? 'tutorial-highlight' : ''].join(' ');
      return `<button data-b="${id}" aria-disabled="${!st.enabled}" class="${cls}">
        ${icon(id as IconName)}<span class="lbl">${st.label}<kbd>${displayKey(keyFor(id))}</kbd></span>
      </button>`;
    }).join('');

    $('roster').innerHTML = s.units.filter((u) => u.team === 'player').map((u, n) => {
      const max = CLASSES[u.cls].hp;
      const cls = [u === sel ? 'sel' : '', !u.alive ? 'dead' : u.downed ? 'down' : ''].join(' ');
      const status = !u.alive ? 'KIA' : u.downed ? `DOWN ${u.bleedOut}` : `${u.hp}/${max}`;
      const frac = u.alive && !u.downed ? u.hp / max : 0;
      const meterCls = frac <= 0.25 ? 'is-critical' : frac <= 0.55 ? 'is-low' : '';
      return `<button data-unit="${u.id}" class="${cls}">
        <span class="r-top"><span class="r-num">${n + 1}</span>${u.name ? `${u.name.split(' ')[0]} <small>${CLASSES[u.cls].name}</small>` : CLASSES[u.cls].name}<span class="r-hp">${status}</span></span>
        <span class="meter ${meterCls}"><i style="width:${Math.round(frac * 100)}%"></i></span>
      </button>`;
    }).join('');

    $('mission').innerHTML = this.missionInfo(s);

    if (!sel) $('card').innerHTML = '<h3>Unit</h3><p class="muted">No unit selected. Click one on the board or in the squad list.</p>';
    else {
      const d = CLASSES[sel.cls];
      const w = d.weapon;
      const g = sel.gadget;
      const gtext = !g ? 'none'
        : `${GADGETS[g.id].name} · ${g.uses} left · ${g.cooldown > 0 ? `ready in ${g.cooldown}` : 'ready'}`;
      const move = effectiveMove(s, sel);
      const vision = effectiveVision(s, sel);
      const armor = effectiveArmor(sel);
      const acc = effectiveAccuracyMod(s, sel);
      $('card').innerHTML = `
        <h3>${nameOf(sel)} <span class="badge">Lv ${sel.level}</span></h3>
        <div class="stat-grid">
          ${stat('HP', `${sel.hp}/${d.hp}`)}
          ${stat('Armor', armor, armor !== d.armor ? `base ${d.armor}` : undefined)}
          ${stat('Move', move, sel.moveBonus ? `+${sel.moveBonus} next` : move !== d.move ? `base ${d.move}` : undefined)}
          ${stat('Vision', vision, vision !== d.vision ? `base ${d.vision}` : undefined)}
        </div>
        <div class="kv"><span>Actions</span><b>${pips(sel.actions, RULES.actionsPerTurn)}</b></div>
        <div class="kv"><span>Weapon</span><b>rng ${w.range} · dmg ${w.damage}${w.shots > 1 ? `x${w.shots}` : ''} · ${w.accuracy}%${acc ? ` (${acc > 0 ? '+' : ''}${acc})` : ''}</b></div>
        <div class="kv"><span>Ammo</span><b>${sel.ammo}/${w.magazine} (+${sel.reserve})</b></div>
        <div class="kv"><span>Medkits</span><b>${sel.medkits}</b></div>
        <div class="kv"><span>Gadget</span><b>${gtext}</b></div>
        ${gearText(sel) ? `<div class="kv"><span>Gear</span><b>${gearText(sel)}</b></div>` : ''}
        ${perkText(sel) ? `<div class="kv"><span>Perks</span><b>${perkText(sel)}</b></div>` : ''}
        ${sel.overwatch ? '<p class="flag flag--ow">On overwatch</p>' : ''}
        ${sel.exposed ? '<p class="flag flag--exposed">Exposed: seen in the bush until your next turn</p>' : ''}`;
    }

    this.updateLog(performance.now());

    $('seed').textContent = String(this.session.seed);
    this.renderKeyHelp();
    const banner = $('banner');
    if (s.winner && banner.hidden) play(s.winner === 'player' ? 'win' : 'lose');
    banner.hidden = !s.winner;
    if (s.winner) {
      banner.className = s.winner;
      $('banner-text').textContent = s.winner === 'player' ? 'MISSION COMPLETE' : s.winner === 'enemy' ? 'SQUAD LOST' : 'DRAW';
      $('banner-sub').textContent = `${s.map.name} · ${s.turn} turn${s.turn === 1 ? '' : 's'}`;
      $('results').innerHTML = this.results(s);
    }

    this.renderTip();
  }

  /**
   * Mission results (10g): per squad member, what happened to them and what they did. XP is shown only for a
   * win - that is the only time the campaign awards it (core/campaign.ts applyMissionXp) - and a level-up is
   * flagged when this mission's XP crosses the class's next threshold.
   */
  private results(s: GameState): string {
    const won = s.winner === 'player';
    const rows = s.units.filter((u) => u.team === 'player').map((u) => {
      const status = !u.alive ? '<span class="st-kia">KIA</span>' : u.downed ? '<span class="st-down">Downed</span>' : '<span class="st-ok">OK</span>';
      const acc = u.shotsFired ? `${u.shotsHit}/${u.shotsFired} <small>(${Math.round((100 * u.shotsHit) / u.shotsFired)}%)</small>` : '-';
      const xp = won && u.alive ? xpEarned(u) : 0;
      const up = xp && levelForXp(u.cls, u.xp + xp) > u.level ? '<span class="lvl">LEVEL UP</span>' : '';
      return `<tr><td>${u.name ?? CLASSES[u.cls].name}${u.name ? ` <small>${CLASSES[u.cls].name}</small>` : ''}${up}</td><td>${status}</td><td>${u.kills}</td><td>${acc}</td><td>${u.dmgDealt}</td><td>${u.dmgTaken}</td><td>${won && u.alive ? `+${xp}` : '-'}</td></tr>`;
    }).join('');
    const loot = this.session.loot;
    return `<table>
      <thead><tr><th>Unit</th><th>Status</th><th>Kills</th><th>Hits</th><th>Dealt</th><th>Taken</th><th>XP</th></tr></thead>
      <tbody>${rows}</tbody></table>
      ${loot.length ? `<p class="loot">Recovered: ${loot.join(', ')}</p>` : ''}`;
  }

  /** Phase banner (10d): once per new phase, never on the first frame of a mission or once it's over. */
  private announcePhase(s: GameState) {
    const key = `${this.session.logEpoch}:${s.turn}:${s.phase}`;
    if (key === this.phaseKey) return;
    const first = !this.phaseKey.startsWith(`${this.session.logEpoch}:`);
    this.phaseKey = key;
    const el = $('phase-banner');
    if (first || s.winner) { el.hidden = true; return; }
    el.className = s.phase;
    el.innerHTML = `${s.phase === 'player' ? 'Your turn' : 'Enemy activity'}<small>Turn ${s.turn}</small>`;
    play(s.phase === 'player' ? 'phasePlayer' : 'phaseEnemy');
    el.hidden = false;
    // restart the CSS animation, then hide once it's done so it never sits over the board
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => { el.hidden = true; }, 1200);
  }
  private bannerTimer: ReturnType<typeof setTimeout> | undefined;

  /** Appends log lines whose moment has come (10d holds each until its event plays). Cheap: call every frame. */
  updateLog(now: number) {
    const logEl = $('log');
    if (this.logEpoch !== this.session.logEpoch) { logEl.innerHTML = ''; this.logShown = 0; this.logEpoch = this.session.logEpoch; }
    const start = this.logShown;
    for (; this.logShown < this.session.log.length; this.logShown++) {
      const line = this.session.log[this.logShown];
      if (line.at !== undefined && line.at > now) break;
      const div = document.createElement('div');
      div.className = line.kind;
      div.textContent = line.text;
      logEl.appendChild(div);
    }
    if (this.logShown !== start) logEl.scrollTop = logEl.scrollHeight;
  }

  /**
   * Renders only the #tip element: hover/focus on an action button, or (failing that) the canvas tile under the
   * mouse. Deliberately separate from update() - hover/focus fire far more often than real state changes, and
   * update() rebuilds the whole action bar's innerHTML, which would detach the very button being hovered.
   */
  private renderTip() {
    const tip = $('tip');
    const btnEl = this.hoveredButtonId ? document.querySelector<HTMLElement>(`[data-b="${this.hoveredButtonId}"]`) : null;
    const lines = btnEl ? this.buttonTip(this.hoveredButtonId!) : this.session.hoverInfo();
    tip.hidden = !lines;
    if (lines) {
      tip.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
      if (btnEl) {
        // above the button, clamped to the viewport
        const r = btnEl.getBoundingClientRect();
        tip.style.left = `${Math.max(4, Math.min(r.left, window.innerWidth - tip.offsetWidth - 4))}px`;
        tip.style.top = `${Math.max(4, r.top - tip.offsetHeight - 8)}px`;
      } else {
        tip.style.left = `${Math.min(this.mouse.x + 14, window.innerWidth - tip.offsetWidth - 4)}px`;
        tip.style.top = `${Math.max(4, this.mouse.y - tip.offsetHeight - 10)}px`;
      }
    }
  }
}
