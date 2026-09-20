import { CLASSES } from '../data/units';
import { GADGETS } from '../data/gadgets';
import { RULES } from '../data/rules';
import type { ButtonId, Session } from './session';
import { nameOf } from './log';

const BUTTONS: { id: ButtonId; key: string }[] = [
  { id: 'move', key: 'M' }, { id: 'attack', key: 'A' }, { id: 'reload', key: 'R' }, { id: 'gadget', key: 'G' },
  { id: 'overwatch', key: 'O' }, { id: 'aid', key: 'F' }, { id: 'interact', key: 'I' }, { id: 'endTurn', key: 'E' },
];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const pips = (n: number, max: number) => '●'.repeat(Math.max(0, n)) + '○'.repeat(Math.max(0, max - n));

/** DOM side of the UI: action bar, unit card, roster, log, debug panel. Rebuilt from Session state on every change. */
export class Hud {
  private logShown = 0;
  private mouse = { x: 0, y: 0 };

  constructor(private session: Session) {
    $('actionbar').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-b]');
      if (b) session.press(b.dataset.b as ButtonId);
    });
    $('roster').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-unit]');
      if (b) session.toggleSelect(Number(b.dataset.unit));
    });
    $<HTMLInputElement>('dbg-fog').addEventListener('change', (e) => session.toggleFog((e.target as HTMLInputElement).checked));
    $<HTMLInputElement>('dbg-skip').addEventListener('change', (e) => { session.skipEnemyPhase = (e.target as HTMLInputElement).checked; });
    $('dbg-reset').addEventListener('click', () => { $<HTMLInputElement>('dbg-fog').checked = true; session.reset(); });
    $('dbg-reseed').addEventListener('click', () => session.reseedRng());
    $('ow-toggle').addEventListener('click', () => session.toggleOverwatchView());
    $('banner-reset').addEventListener('click', () => { $<HTMLInputElement>('dbg-fog').checked = true; session.reset(); });
  }

  /** One line telling the player what to do about the objective right now. */
  private objectiveText(): string {
    const s = this.session.state;
    const hold = RULES.objectiveHoldRounds;
    if (s.capture) {
      const u = s.units[s.capture.unit];
      const rounds = s.capture.roundsLeft;
      return `SECURING: hold ${rounds} more round${rounds > 1 ? 's' : ''} - ${nameOf(u)} must stay where it is and stay alive.`;
    }
    const known = s.memory.player.objectiveSeen || !s.fogEnabled;
    return known
      ? `Objective: interact with the terminal, then keep that unit in place for ${hold} rounds. Or eliminate all enemies.`
      : 'Objective: find the terminal (not yet spotted). Or eliminate all enemies.';
  }

  setMouse(x: number, y: number) {
    this.mouse = { x, y };
  }

  update() {
    const s = this.session.state;
    const sel = this.session.selected();

    $('phase').textContent = `Turn ${s.turn} · ${s.phase === 'player' ? 'PLAYER' : 'ENEMY'} PHASE`;
    $('phase').className = s.phase;
    $('status').textContent = this.session.status;
    $('objective').textContent = this.objectiveText();
    $('objective').className = s.capture ? 'securing' : '';
    $('ow-toggle').classList.toggle('active', this.session.showOverwatch);
    $('ow-legend').hidden = !this.session.showOverwatch;

    $('actionbar').innerHTML = BUTTONS.map(({ id, key }) => {
      const st = this.session.buttonState(id);
      return `<button data-b="${id}" ${st.enabled ? '' : 'disabled'} class="${st.active ? 'active' : ''}" title="${st.reason ?? ''}">${st.label}<kbd>${key}</kbd></button>`;
    }).join('');

    $('roster').innerHTML = s.units.filter((u) => u.team === 'player').map((u, n) => {
      const cls = [u === sel ? 'sel' : '', u.alive ? '' : 'dead'].join(' ');
      return `<button data-unit="${u.id}" class="${cls}"><b>${n + 1}</b> ${CLASSES[u.cls].name}<span>${u.alive ? `${u.hp}/${CLASSES[u.cls].hp}` : 'KIA'}</span></button>`;
    }).join('');

    if (!sel) $('card').innerHTML = '<p class="dim">No unit selected.</p>';
    else {
      const d = CLASSES[sel.cls];
      const w = d.weapon;
      const g = sel.gadget;
      const gtext = !g ? 'none'
        : `${GADGETS[g.id].name} · uses ${g.uses}/${RULES.gadgetUsesPerMission} · ${g.cooldown > 0 ? `ready in ${g.cooldown} turn${g.cooldown > 1 ? 's' : ''}` : 'ready'}`;
      $('card').innerHTML = `
        <h3>${nameOf(sel)}</h3>
        <div class="row"><span>HP</span><b>${sel.hp}/${d.hp}</b><span>Armor</span><b>${d.armor}</b><span>Move</span><b>${d.move}${sel.moveBonus ? ` <em class="boost">+${sel.moveBonus} next move</em>` : ''}</b><span>Vision</span><b>${d.vision}</b></div>
        <div class="row"><span>Weapon</span><b>rng ${w.range} · dmg ${w.damage}${w.shots > 1 ? `x${w.shots}` : ''} · acc ${w.accuracy}%</b></div>
        <div class="row"><span>Actions</span><b class="pips">${pips(sel.actions, RULES.actionsPerTurn)}</b></div>
        <div class="row"><span>Ammo</span><b>${sel.ammo}/${w.magazine}</b><span>Medkits</span><b>${sel.medkits}/${RULES.medkitsPerUnit}</b></div>
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

    const tip = $('tip');
    const lines = this.session.hoverInfo();
    tip.hidden = !lines;
    if (lines) {
      tip.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
      const wrap = tip.parentElement!.getBoundingClientRect();
      tip.style.left = `${Math.min(this.mouse.x - wrap.left + 14, wrap.width - tip.offsetWidth - 4)}px`;
      tip.style.top = `${Math.max(4, this.mouse.y - wrap.top - tip.offsetHeight - 10)}px`;
    }
  }
}


