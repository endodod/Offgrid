import { candidateCount, facilityLevel, infirmaryBeds, infirmaryHeal, lockerCapacity, restRate, rosterCapacity, upgradeCost, fabricatorTier } from '../core/base';
import { gearStock, upgradeFacility, type CampaignState, type Soldier } from '../core/campaign';
import { craft, craftBlocker, lockerCount, scrap, scrapValue } from '../core/crafting';
import { admit, discharge, dismiss, hire, hireCost, maxHp, soldierHp, soldierStatus } from '../core/roster';
import { confirmModal } from './modal';
import { ARMOR, ARMOR_ORDER, type ArmorId } from '../data/armor';
import { FACILITIES, FACILITY_ORDER, type FacilityGroup, type FacilityId } from '../data/base';
import { RECIPES, type RecipeKind } from '../data/crafting';
import { EQUIPMENT, EQUIPMENT_ORDER, type EquipmentId } from '../data/equipment';
import { CLASSES } from '../data/units';
import { saveCampaign } from './campaignStore';
import { icon } from './icons';
import { seg } from './seg';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface BaseHooks {
  onBack: () => void;
}

type Tab = 'squad' | 'recruit' | 'stations' | 'fabricator' | 'locker';
const TABS = [
  { value: 'squad', label: 'Squad' },
  { value: 'recruit', label: 'Recruit' },
  { value: 'stations', label: 'Stations' },
  { value: 'fabricator', label: 'Fabricator' },
  { value: 'locker', label: 'Locker' },
];

export const gearName = (kind: RecipeKind, id: string): string =>
  kind === 'armor' ? ARMOR[id as ArmorId].name : EQUIPMENT[id as EquipmentId].name;
const gearBlurb = (kind: RecipeKind, id: string): string =>
  kind === 'armor' ? ARMOR[id as ArmorId].blurb : EQUIPMENT[id as EquipmentId].blurb;

/** A soldier's carried-over HP as a meter (11), shared with the briefing screen. */
export function hpMeter(s: Soldier): string {
  const hp = soldierHp(s), max = maxHp(s.cls);
  const f = hp / max;
  return `<div class="hp-line"><div class="meter ${f <= 0.34 ? 'is-critical' : f < 1 ? 'is-low' : ''}"><i style="width:${f * 100}%"></i></div><span>${hp}/${max} HP</span></div>`;
}

export const STATUS_CHIP: Record<ReturnType<typeof soldierStatus>, string> = {
  ready: '<span class="chip chip--ok">Ready</span>',
  wounded: '<span class="chip chip--warn">Wounded</span>',
  infirmary: '<span class="chip chip--info">In the infirmary</span>',
};

/**
 * The base screen (6, overhauled in 11): the squad's condition and the infirmary, the ten stations, the
 * fabricator and the locker. Reads and mutates the campaign's own `CampaignState` (passed in on `open()`),
 * so everything spent here shows straight away on the campaign screen.
 */
export class Base {
  private cs: CampaignState | null = null;
  private tab: Tab = 'squad';

  constructor(hooks: BaseHooks) {
    $('base-back').addEventListener('click', () => hooks.onBack());
    seg($('base-tabs'), TABS, this.tab, (v) => { this.tab = v as Tab; this.render(); });
    $('base-body').addEventListener('click', (e) => this.onClick(e));
  }

  open(cs: CampaignState) {
    this.cs = cs;
    $('base-msg').textContent = '';
    this.render();
  }

  private async onClick(e: Event) {
    const cs = this.cs;
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
    if (!cs || !btn || btn.disabled) return;
    const [act, a, b] = btn.dataset.act!.split(':');
    let err: string | null = null;
    if (act === 'build') err = upgradeFacility(cs, a as FacilityId);
    else if (act === 'admit') err = admit(cs, a);
    else if (act === 'discharge') discharge(cs, a);
    else if (act === 'hire') err = hire(cs, a);
    else if (act === 'dismiss') {
      const s = cs.roster.find((r) => r.id === a);
      if (!s) return;
      const ok = await confirmModal({
        title: `Dismiss ${s.name}?`, body: ['They leave the squad for good, along with their level and perks. Their gear goes back to the locker.'],
        cta: 'Dismiss', danger: true,
      });
      if (!ok) return;
      err = dismiss(cs, a);
    }
    else if (act === 'craft') err = craft(cs, RECIPES.find((r) => r.kind === a && r.id === b)!);
    else if (act === 'scrap') err = scrap(cs, a as RecipeKind, b);
    saveCampaign(cs);
    $('base-msg').textContent = err ?? '';
    this.render();
  }

  private render() {
    const cs = this.cs;
    if (!cs) return;
    $('base-currency').innerHTML = `${icon('currency')}${cs.currency}`;
    $('base-parts').innerHTML = `${icon('bolt')}${cs.parts} parts`;
    $('base-body').innerHTML = this.tab === 'squad' ? squadTab(cs)
      : this.tab === 'recruit' ? recruitTab(cs)
      : this.tab === 'stations' ? stationsTab(cs)
      : this.tab === 'fabricator' ? fabricatorTab(cs)
      : lockerTab(cs);
  }
}

function squadTab(cs: CampaignState): string {
  const beds = infirmaryBeds(cs.base);
  const used = cs.infirmary.length;
  const note = beds
    ? `Infirmary: ${used}/${beds} beds, heals ${Math.round(infirmaryHeal(cs.base) * 100)}% of max HP per mission.`
    : 'No infirmary yet: build one under Stations to heal the badly wounded fast.';
  const cards = cs.roster.map((s) => {
    const st = soldierStatus(cs, s);
    const action = st === 'infirmary'
      ? `<button class="btn--ghost btn--block" data-act="discharge:${s.id}">Discharge</button>`
      : st === 'wounded'
        ? `<button class="btn--primary btn--block" data-act="admit:${s.id}" ${beds && used < beds ? '' : 'disabled'} title="${beds ? (used < beds ? 'Sits missions out and heals fast' : 'Every bed is taken') : 'Build the infirmary first'}">${icon('medkit')}Admit to infirmary</button>`
        : '';
    return `<article class="card soldier soldier--${st}">
      <div class="card__head">
        <div class="soldier__badge">${CLASSES[s.cls].letter}</div>
        <div><h3 class="card__title">${s.name}</h3><span class="card__sub">${CLASSES[s.cls].name} · level ${s.progress.level}</span></div>
        <div class="spacer"></div>${STATUS_CHIP[st]}
      </div>
      ${hpMeter(s)}
      <div class="card__foot">${action}<button class="btn--ghost btn--sm" data-act="dismiss:${s.id}" ${cs.roster.length <= 1 ? 'disabled' : ''}>Dismiss</button></div>
    </article>`;
  }).join('');
  return `<p class="section__note">${cs.roster.length}/${rosterCapacity(cs.base)} soldiers. Everyone keeps their wounds between missions, won or lost.
      Whoever sits a mission out rests (${Math.round(restRate(cs.base) * 100)}% of max HP); whoever deploys and survives is patched up for half that.
      ${note} The fallen are gone for good. Pick who deploys on each mission's briefing; swap gear under Loadout.</p>
    <div class="grid grid--soldiers">${cards}</div>`;
}

function recruitTab(cs: CampaignState): string {
  const full = cs.roster.length >= rosterCapacity(cs.base);
  const cards = cs.recruits.map((s) => {
    const cost = hireCost(s);
    const def = CLASSES[s.cls];
    return `<article class="card soldier">
      <div class="card__head">
        <div class="soldier__badge">${def.letter}</div>
        <div><h3 class="card__title">${s.name}</h3><span class="card__sub">${def.name} · level ${s.progress.level}</span></div>
      </div>
      <p class="card__body">${def.hp} HP · move ${def.move} · vision ${def.vision} · range ${def.weapon.range}</p>
      <div class="card__foot"><button class="btn--primary btn--block" data-act="hire:${s.id}" ${full || cs.currency < cost ? 'disabled' : ''} title="${full ? 'The barracks are full' : cs.currency < cost ? 'Not enough salvage' : ''}">${icon('currency')}${cost} · Hire</button></div>
    </article>`;
  }).join('');
  return `<p class="section__note">${candidateCount(cs.base)} candidates after every mission; whoever you don't hire moves on.
      Room for ${rosterCapacity(cs.base)} soldiers (${cs.roster.length} now) - the Barracks adds more. Build the Recruitment Office for more, and more experienced, candidates.</p>
    ${cards ? `<div class="grid grid--soldiers">${cards}</div>` : '<p class="muted">Nobody is waiting. New candidates arrive after the next mission.</p>'}`;
}

function stationsTab(cs: CampaignState): string {
  const groups: FacilityGroup[] = ['Medical', 'Supply', 'Operations'];
  const built = FACILITY_ORDER.filter((id) => facilityLevel(cs.base, id) > 0).length;
  return `<p class="section__note">${built} of ${FACILITY_ORDER.length} stations built. Upgrades apply to every campaign mission; nothing here affects single missions.</p>
    ${groups.map((g) => `<h2 class="section__title">${g}</h2>
      <div class="grid grid--cards">${FACILITY_ORDER.filter((id) => FACILITIES[id].group === g).map((id) => facilityCard(cs, id)).join('')}</div>`).join('')}`;
}

function facilityCard(cs: CampaignState, id: FacilityId): string {
  const def = FACILITIES[id];
  const level = facilityLevel(cs.base, id);
  const cost = upgradeCost(cs.base, id);
  const next = cost === null ? null : def.tiers[level];
  return `<article class="card station ${level ? 'is-built' : ''}">
    <div class="card__head">
      <div><h3 class="card__title">${def.name}</h3><span class="card__sub">${level ? `Level ${level} of ${def.tiers.length}` : 'Not built'}</span></div>
      <div class="spacer"></div>
      <span class="pips">${def.tiers.map((_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('')}</span>
    </div>
    <p class="card__body">${def.blurb}</p>
    <ul class="tiers">${def.tiers.map((t, i) => `<li class="${i < level ? 'done' : i === level ? 'next' : ''}">${i < level ? icon('check') : ''}${t.blurb}</li>`).join('')}</ul>
    <div class="card__foot">
      ${next
        ? `<button class="btn--primary btn--block" data-act="build:${id}" ${cs.currency >= cost! ? '' : 'disabled'}>${icon('currency')}${cost} · ${level ? 'Upgrade' : 'Build'}</button>`
        : '<span class="chip chip--ok">Fully upgraded</span>'}
    </div>
  </article>`;
}

function fabricatorTab(cs: CampaignState): string {
  const tier = fabricatorTier(cs.base);
  const head = tier
    ? `Fabricator level ${tier}. Crafted gear goes to the locker (${lockerCount(cs.inventory)}/${lockerCapacity(cs.base)}); equip it from Loadout.`
    : 'Build the fabricator under Stations to turn parts into gear. Parts come from every won mission and from scrapping gear in the locker.';
  const rows = RECIPES.map((r) => {
    const why = craftBlocker(cs, r);
    const locked = tier < r.tier;
    return `<article class="card recipe ${locked ? 'card--locked' : ''}">
      <div class="card__head">
        <div><h3 class="card__title">${gearName(r.kind, r.id)}</h3><span class="card__sub">${r.kind} · tier ${r.tier}</span></div>
        <div class="spacer"></div><span class="badge">${r.parts} parts</span>
      </div>
      <p class="card__body">${gearBlurb(r.kind, r.id)}</p>
      <div class="card__foot"><button class="btn--primary btn--block" data-act="craft:${r.kind}:${r.id}" ${why ? `disabled title="${why}"` : ''}>${icon('bolt')}${why && locked ? why : 'Craft'}</button></div>
    </article>`;
  }).join('');
  return `<p class="section__note">${head}</p><div class="grid grid--cards">${rows}</div>`;
}

function lockerTab(cs: CampaignState): string {
  const n = lockerCount(cs.inventory), cap = lockerCapacity(cs.base);
  const items = [
    ...gearStock(cs.inventory, 'armor', ARMOR_ORDER).map((e) => ({ kind: 'armor' as const, ...e })),
    ...gearStock(cs.inventory, 'equipment', EQUIPMENT_ORDER).map((e) => ({ kind: 'equipment' as const, ...e })),
  ];
  const list = items.length ? items.map((e) => `<div class="locker-row">
      <span class="locker-row__icon">${icon(e.kind)}</span>
      <span class="locker-row__name">${gearName(e.kind, e.id)}<small>${gearBlurb(e.kind, e.id)}</small></span>
      <span class="badge">x${e.count}</span>
      <button class="btn--ghost btn--sm" data-act="scrap:${e.kind}:${e.id}">Scrap +${scrapValue(e.kind, e.id)}</button>
    </div>`).join('') : '<p class="muted">Empty. Gear the squad takes off goes here, and so does everything the fabricator makes.</p>';
  return `<p class="section__note">Spare gear, not counting what the squad is wearing. Over capacity after a mission, the most duplicated pieces are scrapped for parts automatically.</p>
    <div class="locker-cap"><div class="meter ${n > cap ? 'is-critical' : n === cap ? 'is-low' : ''}"><i style="width:${Math.min(100, (n / cap) * 100)}%"></i></div><span>${n}/${cap}</span></div>
    <div class="stack">${list}</div>`;
}
