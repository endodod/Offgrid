import { CLASSES } from '../data/units';
import { GADGETS } from '../data/gadgets';
import { RULES } from '../data/rules';
import { AI_PROFILES, PROFILE_ORDER } from '../data/aiProfiles';
import { TIME_ORDER, TIMES_OF_DAY } from '../data/timeOfDay';
import { WEATHER_ORDER, WEATHERS } from '../data/weather';
import { envMods, scaledMove, scaledVision } from '../core/environment';
import { describeObjective } from '../core/objectives';
import type { GameState } from '../core/types';
import { keyFor } from './input';
import { displayKey } from './keybindings';
import type { ButtonId, Session } from './session';
import { nameOf } from './log';

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

/** DOM side of the UI: action bar, unit card, roster, mission panel, log, debug panel. Rebuilt from Session state on every change. */
export class Hud {
  private logShown = 0;
  private mouse = { x: 0, y: 0 };
  // Tracked by id, not DOM element: the actionbar's buttons are rebuilt on every update(), which would
  // otherwise leave a hovered/focused reference pointing at a detached node.
  private hoveredButtonId: ButtonId | null = null;
  /** Set once by main.ts after both are constructed (0f); read fresh on every actionbar render for the same
   *  detached-node reason as hoveredButtonId above. */
  tutorial: { currentHighlight: string | null } | null = null;

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
    const timeSel = $<HTMLSelectElement>('dbg-time');
    timeSel.innerHTML = TIME_ORDER.map((t) => `<option value="${t}">${TIMES_OF_DAY[t].name}</option>`).join('');
    timeSel.addEventListener('change', () => session.setTimeOfDay(timeSel.value as (typeof TIME_ORDER)[number]));
    const weatherSel = $<HTMLSelectElement>('dbg-weather');
    weatherSel.innerHTML = WEATHER_ORDER.map((w) => `<option value="${w}">${WEATHERS[w].name}</option>`).join('');
    weatherSel.addEventListener('change', () => session.setWeather(weatherSel.value as (typeof WEATHER_ORDER)[number]));
    const profileSel = $<HTMLSelectElement>('dbg-enemy-profile');
    profileSel.innerHTML = PROFILE_ORDER.map((p) => `<option value="${p}">${AI_PROFILES[p].name}</option>`).join('');
    profileSel.addEventListener('change', () => session.setEnemyProfile(profileSel.value as (typeof PROFILE_ORDER)[number]));
    $('dbg-reset').addEventListener('click', () => { $<HTMLInputElement>('dbg-fog').checked = true; session.reset(); });
    $('dbg-reseed').addEventListener('click', () => session.reseedRng());
    $('ow-toggle').addEventListener('click', () => session.toggleOverwatchView());
    $('auto-run-toggle').addEventListener('click', () => session.toggleAutoRun());
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
      <div class="row"><span>Map</span><b>${s.map.name}</b></div>
      <div class="row"><span>Time of day</span><b>${TIMES_OF_DAY[s.timeOfDay].name}</b></div>
      <p class="dim">${TIMES_OF_DAY[s.timeOfDay].blurb}</p>
      <div class="row"><span>Weather</span><b>${WEATHERS[s.weather].name}</b></div>
      <p class="dim">${WEATHERS[s.weather].blurb}</p>
      <div class="row"><span>Combined effect</span><b>Vision ${delta(mods.visionMult)} · Move ${delta(mods.moveMult)} · Accuracy ${acc}</b></div>`;
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

    $('phase').textContent = `Turn ${s.turn} · ${s.phase === 'player' ? 'PLAYER' : 'ENEMY'} PHASE`;
    $('phase').className = s.phase;
    $<HTMLSelectElement>('dbg-time').value = s.timeOfDay;
    $<HTMLSelectElement>('dbg-weather').value = s.weather;
    $<HTMLSelectElement>('dbg-enemy-profile').value = s.aiProfiles.enemy;
    $('status').textContent = this.session.status;
    $('objective').textContent = this.objectiveText();
    $('objective').className = s.capture ? 'securing' : '';
    $('ow-toggle').classList.toggle('active', this.session.showOverwatch);
    $('ow-legend').hidden = !this.session.showOverwatch;
    $('auto-run-toggle').classList.toggle('active', this.session.autoRun);

    // aria-disabled + a class, not the disabled attribute: a truly disabled button can't be hovered or
    // focused in most browsers, which would make it impossible to show the tooltip explaining *why*.
    // Session.press() already no-ops when the button isn't enabled, so this is safe to still click.
    $('actionbar').innerHTML = BUTTON_ORDER.map((id) => {
      const st = this.session.buttonState(id);
      const cls = [st.active ? 'active' : '', st.enabled ? '' : 'disabled', this.tutorial?.currentHighlight === id ? 'tutorial-highlight' : ''].join(' ');
      return `<button data-b="${id}" aria-disabled="${!st.enabled}" class="${cls}">${st.label}<kbd>${displayKey(keyFor(id))}</kbd></button>`;
    }).join('');

    $('roster').innerHTML = s.units.filter((u) => u.team === 'player').map((u, n) => {
      const cls = [u === sel ? 'sel' : '', !u.alive ? 'dead' : u.downed ? 'down' : ''].join(' ');
      const status = !u.alive ? 'KIA' : u.downed ? `DOWN ${u.bleedOut}` : `${u.hp}/${CLASSES[u.cls].hp}`;
      return `<button data-unit="${u.id}" class="${cls}"><b>${n + 1}</b> ${CLASSES[u.cls].name}<span>${status}</span></button>`;
    }).join('');

    $('mission').innerHTML = this.missionInfo(s);

    if (!sel) $('card').innerHTML = '<p class="dim">No unit selected.</p>';
    else {
      const d = CLASSES[sel.cls];
      const w = d.weapon;
      const g = sel.gadget;
      const gtext = !g ? 'none'
        : `${GADGETS[g.id].name} · uses ${g.uses} · ${g.cooldown > 0 ? `ready in ${g.cooldown} turn${g.cooldown > 1 ? 's' : ''}` : 'ready'}`;
      const move = scaledMove(s, d.move);
      const vision = scaledVision(s, d.vision);
      const acc = envMods(s).accuracyMod;
      $('card').innerHTML = `
        <h3>${nameOf(sel)}</h3>
        <div class="row"><span>HP</span><b>${sel.hp}/${d.hp}</b><span>Armor</span><b>${d.armor}</b><span>Move</span><b>${move}${move !== d.move ? ` <em class="boost">(base ${d.move})</em>` : ''}${sel.moveBonus ? ` <em class="boost">+${sel.moveBonus} next move</em>` : ''}</b><span>Vision</span><b>${vision}${vision !== d.vision ? ` <em class="boost">(base ${d.vision})</em>` : ''}</b></div>
        <div class="row"><span>Weapon</span><b>rng ${w.range} · dmg ${w.damage}${w.shots > 1 ? `x${w.shots}` : ''} · acc ${w.accuracy}%${acc ? ` <em class="boost">(${acc > 0 ? '+' : ''}${acc}%)</em>` : ''}</b></div>
        <div class="row"><span>Actions</span><b class="pips">${pips(sel.actions, RULES.actionsPerTurn)}</b></div>
        <div class="row"><span>Ammo</span><b>${sel.ammo}/${w.magazine} <em class="boost">(+${sel.reserve} reserve)</em></b><span>Medkits</span><b>${sel.medkits}</b></div>
        <div class="row"><span>Gadget</span><b>${gtext}</b></div>
        ${g ? `<p class="dim">${GADGETS[g.id].blurb}</p>` : ''}
        ${sel.overwatch ? '<p class="ow">On overwatch</p>' : ''}
        ${sel.exposed ? '<p class="exposed">Exposed: seen in the bush until your next turn</p>' : ''}`;
    }

    const logEl = $('log');
    for (; this.logShown < this.session.log.length; this.logShown++) {
      const line = this.session.log[this.logShown];
      const div = document.createElement('div');
      div.className = line.kind;
      div.textContent = line.text;
      logEl.appendChild(div);
    }
    if (this.logShown > this.session.log.length) { logEl.innerHTML = ''; this.logShown = 0; this.update(); return; } // after a reset
    logEl.scrollTop = logEl.scrollHeight;

    $('seed').textContent = String(this.session.seed);
    const banner = $('banner');
    banner.hidden = !s.winner;
    if (s.winner) {
      banner.className = s.winner;
      $('banner-text').textContent = s.winner === 'player' ? 'MISSION COMPLETE' : s.winner === 'enemy' ? 'SQUAD LOST' : 'DRAW';
    }

    this.renderTip();
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


