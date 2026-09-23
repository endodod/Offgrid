import { reconLevel } from '../core/base';
import type { CampaignState } from '../core/campaign';
import { currentHp, defaultSquad, maxHp, soldierStatus } from '../core/roster';
import { AI_PROFILES } from '../data/aiProfiles';
import { ARMOR } from '../data/armor';
import { EQUIPMENT } from '../data/equipment';
import { TIMES_OF_DAY } from '../data/timeOfDay';
import type { MapDef } from '../data/trainingGrounds';
import { CLASSES, CLASS_ORDER, type ClassId } from '../data/units';
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
  onDeploy: (squad: ClassId[]) => void;
}

/**
 * The mission briefing (11), between picking a campaign mission and playing it: choose who deploys, and see
 * whatever the Recon Uplink can tell you about the target. Level 0 is words only; 1 draws the layout and
 * conditions; 2 adds hostile positions and types; 3 adds supply caches, doors and the objective.
 */
export class Briefing {
  private cs: CampaignState | null = null;
  private info: BriefingInfo | null = null;
  private squad = new Set<ClassId>();

  constructor(hooks: BriefingHooks) {
    $('brief-back').addEventListener('click', () => hooks.onBack());
    $('brief-deploy').addEventListener('click', () => {
      if (this.squad.size) hooks.onDeploy(CLASS_ORDER.filter((c) => this.squad.has(c)));
    });
    $('brief-squad').addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('[data-pick]');
      if (!card) return;
      const cls = card.dataset.pick as ClassId;
      if (this.squad.has(cls)) this.squad.delete(cls);
      else this.squad.add(cls);
      this.renderSquad();
    });
  }

  open(cs: CampaignState, info: BriefingInfo) {
    this.cs = cs;
    this.info = info;
    const offered = new Set(info.map.spawns.player.map(([c]) => c));
    this.squad = new Set(defaultSquad(cs).filter((c) => offered.has(c)));
    $('brief-title').innerHTML = `${info.name}<small>${info.sub}</small>`;
    $('brief-blurb').textContent = info.blurb;
    $('brief-objective').textContent = info.objective;
    this.renderIntel();
    this.renderSquad();
  }

  private renderSquad() {
    const cs = this.cs, info = this.info;
    if (!cs || !info) return;
    const offered = CLASS_ORDER.filter((c) => info.map.spawns.player.some(([k]) => k === c));
    $('brief-squad').innerHTML = offered.map((cls) => {
      const on = this.squad.has(cls);
      const st = soldierStatus(cs, cls);
      const lo = cs.loadouts[cls];
      const gear = lo ? [lo.armor && ARMOR[lo.armor].name, ...lo.equipment.map((e) => e && EQUIPMENT[e].name)].filter(Boolean).join(', ') : '';
      return `<button type="button" class="pick ${on ? 'is-on' : ''}" data-pick="${cls}" aria-pressed="${on}">
        <span class="pick__check">${on ? icon('check') : ''}</span>
        <span class="soldier__badge">${CLASSES[cls].letter}</span>
        <span class="pick__body">
          <span class="pick__name">${CLASSES[cls].name} <small>Lv ${cs.levels[cls]?.level ?? 1}</small> ${STATUS_CHIP[st]}</span>
          ${hpMeter(cs, cls)}
          <small class="pick__gear">${gear || 'No gear'}</small>
        </span>
      </button>`;
    }).join('');
    const n = this.squad.size;
    const weak = [...this.squad].filter((c) => currentHp(cs, c) / maxHp(c) < 0.5).map((c) => CLASSES[c].name);
    $('brief-squad-note').textContent = !n ? 'Pick at least one soldier.'
      : `${n} of ${offered.length} deploying.${weak.length ? ` ${weak.join(', ')} ${weak.length === 1 ? 'is' : 'are'} below half health.` : ''} Whoever stays behind rests.`;
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
