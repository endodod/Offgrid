import { reconLevel } from '../core/base';
import type { CampaignState } from '../core/campaign';
import { defaultSquad, maxHp, soldierHp, soldierStatus } from '../core/roster';
import { AI_PROFILES } from '../data/aiProfiles';
import { ARMOR } from '../data/armor';
import { EQUIPMENT } from '../data/equipment';
import { TIMES_OF_DAY } from '../data/timeOfDay';
import type { MapDef } from '../data/trainingGrounds';
import { CLASSES, type ClassId } from '../data/units';
import { WEATHERS } from '../data/weather';
import { hpMeter, STATUS_CHIP } from './base';
import { icon } from './icons';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface BriefingInfo {
  name: string;
  sub: string;
  blurb: string;
  objective: string;
  map: MapDef;
}

export interface BriefingHooks {
  onBack: () => void;
  onDeploy: (squad: string[]) => void;
}

/**
 * The mission briefing (11), between picking a campaign mission and playing it: choose who deploys, and see
 * whatever the Recon Uplink can tell you about the target. Level 0 is words only; 1 draws the layout and
 * conditions; 2 adds hostile positions and types; 3 adds supply caches, doors and the objective.
 */
export class Briefing {
  private cs: CampaignState | null = null;
  private info: BriefingInfo | null = null;
  private squad: string[] = []; // soldier ids, in pick order (the order they take the spawn tiles)

  constructor(hooks: BriefingHooks) {
    $('brief-back').addEventListener('click', () => hooks.onBack());
    $('brief-deploy').addEventListener('click', () => {
      if (this.squad.length) hooks.onDeploy([...this.squad]);
    });
    $('brief-squad').addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('[data-pick]');
      if (!card) return;
      const id = card.dataset.pick!;
      if (this.squad.includes(id)) this.squad = this.squad.filter((s) => s !== id);
      else if (this.squad.length < this.slots()) this.squad.push(id);
      this.renderSquad();
    });
  }

  open(cs: CampaignState, info: BriefingInfo) {
    this.cs = cs;
    this.info = info;
    this.squad = defaultSquad(cs, info.map.spawns.player.length);
    $('brief-title').innerHTML = `${info.name}<small>${info.sub}</small>`;
    $('brief-blurb').textContent = info.blurb;
    $('brief-objective').textContent = info.objective;
    this.renderIntel();
    this.renderSquad();
  }

  private slots(): number {
    return this.info?.map.spawns.player.length ?? 5;
  }

  private renderSquad() {
    const cs = this.cs, info = this.info;
    if (!cs || !info) return;
    const full = this.squad.length >= this.slots();
    $('brief-squad').innerHTML = cs.roster.map((s) => {
      const on = this.squad.includes(s.id);
      const st = soldierStatus(cs, s);
      const lo = s.loadout;
      const gear = [lo.armor && ARMOR[lo.armor].name, ...lo.equipment.map((e) => e && EQUIPMENT[e].name)].filter(Boolean).join(', ');
      return `<button type="button" class="pick ${on ? 'is-on' : ''}" data-pick="${s.id}" aria-pressed="${on}" ${!on && full ? 'disabled title="The squad is full"' : ''}>
        <span class="pick__check">${on ? this.squad.indexOf(s.id) + 1 : ''}</span>
        <span class="soldier__badge">${CLASSES[s.cls].letter}</span>
        <span class="pick__body">
          <span class="pick__name">${s.name} <small>${CLASSES[s.cls].name} · Lv ${s.progress.level}</small> ${STATUS_CHIP[st]}</span>
          ${hpMeter(s)}
          <small class="pick__gear">${gear || 'No gear'}</small>
        </span>
      </button>`;
    }).join('');
    const n = this.squad.length;
    const picked = this.squad.map((id) => cs.roster.find((s) => s.id === id)!);
    const weak = picked.filter((s) => soldierHp(s) / maxHp(s.cls) < 0.5).map((s) => s.name.split(' ')[0]);
    const classes = new Map<ClassId, number>();
    for (const s of picked) classes.set(s.cls, (classes.get(s.cls) ?? 0) + 1);
    $('brief-squad-note').textContent = !n ? 'Pick at least one soldier.'
      : `${n} of ${this.slots()} slots: ${[...classes].map(([c, k]) => `${k} ${CLASSES[c].name.toLowerCase()}${k > 1 ? 's' : ''}`).join(', ')}.${weak.length ? ` ${weak.join(', ')} ${weak.length === 1 ? 'is' : 'are'} below half health.` : ''} Whoever stays behind rests.`;
    const deploy = $<HTMLButtonElement>('brief-deploy');
    deploy.disabled = !n;
    deploy.innerHTML = `${icon('play')}Deploy ${n || ''}`;
  }

  private renderIntel() {
    const cs = this.cs!, map = this.info!.map;
    const lvl = reconLevel(cs.base);
    const canvas = $<HTMLCanvasElement>('brief-map');
    canvas.hidden = lvl < 1;
    const facts: string[] = [];
    if (lvl < 1) {
      facts.push(`${map.spawns.enemy.length} hostiles reported. Nothing more: build the Recon Uplink at the base to see the target before you deploy.`);
    } else {
      drawPreview(canvas, map, lvl);
      facts.push(`${map.rows[0].length} x ${map.rows.length} tiles · ${TIMES_OF_DAY[map.startTimeOfDay ?? 'midday'].name}, ${WEATHERS[map.startWeather ?? 'clear'].name.toLowerCase()}`);
      facts.push(`${WEATHERS[map.startWeather ?? 'clear'].blurb} ${TIMES_OF_DAY[map.startTimeOfDay ?? 'midday'].blurb}`);
      if (lvl >= 2) {
        const counts = new Map<ClassId, number>();
        for (const [c] of map.spawns.enemy) counts.set(c, (counts.get(c) ?? 0) + 1);
        facts.push(`Hostiles: ${[...counts].map(([c, k]) => `${k} ${CLASSES[c].name.toLowerCase()}${k > 1 ? 's' : ''}`).join(', ')}. Profile: ${AI_PROFILES[map.enemyProfile ?? 'standard'].name}.`);
      } else facts.push(`${map.spawns.enemy.length} hostiles. Recon Uplink level 2 shows where.`);
      if (lvl >= 3) {
        const chests = (map.interactables ?? []).filter((i) => i.type === 'chest').length;
        const doors = (map.interactables ?? []).filter((i) => i.type === 'door').length;
        facts.push(`${(map.pickups ?? []).length} supply caches, ${chests} locked chests, ${doors} doors.`);
      } else if (lvl === 2) facts.push('Recon Uplink level 3 marks caches and the objective.');
    }
    $('brief-intel').innerHTML = facts.map((f) => `<li>${f}</li>`).join('');
    $('brief-legend').hidden = lvl < 1;
    $('brief-legend').innerHTML = [
      '<span><i style="background:#5f8f6b"></i>Your squad</span>',
      lvl >= 2 ? '<span><i style="background:#c0503a"></i>Hostile</span>' : '',
      lvl >= 3 ? '<span><i style="background:#7fb7a4"></i>Objective</span><span><i style="background:#d8b04a"></i>Cache / chest</span><span><i style="background:#8a6438"></i>Door</span>' : '',
    ].join('');
  }
}

/** A small top-down drawing of the map for the briefing, fog-free but showing only what recon has found. */
function drawPreview(canvas: HTMLCanvasElement, map: MapDef, lvl: number) {
  const w = map.rows[0].length, h = map.rows.length;
  const t = Math.max(6, Math.floor(Math.min(560 / w, 380 / h)));
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  canvas.width = w * t * dpr;
  canvas.height = h * t * dpr;
  canvas.style.width = `${w * t}px`;
  canvas.style.aspectRatio = `${w} / ${h}`;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#3a3f2e';
  ctx.fillRect(0, 0, w * t, h * t);
  map.rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const c = ch === '#' ? '#1c1a18' : ch === 'b' ? '#4c6a3a' : ch === 'h' ? '#8d8171' : 'l123'.includes(ch) ? '#8a7148'
      : ch === 'O' && lvl >= 3 ? '#7fb7a4' : null;
    if (!c) return;
    ctx.fillStyle = c;
    const inset = ch === 'h' || 'l123'.includes(ch) ? Math.max(1, t / 5) : 0;
    ctx.fillRect(x * t + inset, y * t + inset, t - inset * 2, t - inset * 2);
  }));
  const dot = (x: number, y: number, color: string, r = 0.36) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x * t + t / 2, y * t + t / 2, t * r, 0, Math.PI * 2);
    ctx.fill();
  };
  if (lvl >= 3) {
    for (const it of map.interactables ?? []) {
      if (it.type === 'door') { ctx.fillStyle = '#8a6438'; ctx.fillRect(it.x * t + 1, it.y * t + 1, t - 2, t - 2); }
      else if (it.type === 'chest') dot(it.x, it.y, '#d8b04a', 0.3);
    }
    for (const p of map.pickups ?? []) dot(p.x, p.y, '#d8b04a', 0.22);
  }
  if (lvl >= 2) for (const [, x, y] of map.spawns.enemy) dot(x, y, '#c0503a');
  for (const [, x, y] of map.spawns.player) dot(x, y, '#8fd19a');
}
