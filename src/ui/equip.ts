import {
  equipFromInventory, gearStock, loadoutFor, moveEquipped, perkSlots, progressFor, setPerkSlot,
  unequipToInventory, type CampaignState, type GearSlot, type Soldier,
} from '../core/campaign';
import { soldierHp } from '../core/roster';
import { onMission } from '../core/campaign';
import { slotCount } from '../core/leveling';
import { ARMOR, ARMOR_ORDER, type ArmorId } from '../data/armor';
import { EQUIPMENT, EQUIPMENT_ORDER, type EquipmentId } from '../data/equipment';
import { CLASSES } from '../data/units';
import { LEVEL_PATHS } from '../data/leveling';
import { PERKS, type PerkId } from '../data/perks';
import { DragDrop } from './dnd';
import { icon } from './icons';
import { saveCampaign } from './campaignStore';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface EquipHooks {
  onBack: () => void;
}

/**
 * The loadout screen (7, 8, 13). Gear and perks move by drag and drop between a shared locker and each
 * soldier's slots - gear between any two soldiers, perks only within one - no dropdowns, and no list of checkboxes.
 *
 * Payload/target encoding, both consumed by `onDrop` below:
 *   sources   inv:<kind>:<id>  |  gear:<soldier>:<slot>  |  perk:<soldier>:<perkId>  |  perkslot:<soldier>:<index>
 *   targets   slot:<soldier>:<slot>  |  perkslot:<soldier>:<index>  |  locker
 *
 * Everything is a string because `DragDrop` is deliberately payload-agnostic; this module owns the grammar.
 */
export class Equip {
  private cs: CampaignState | null = null;
  private dnd: DragDrop;
  private message = '';

  constructor(hooks: EquipHooks) {
    $('equip-back').addEventListener('click', () => hooks.onBack());
    const root = $('equip');
    this.dnd = new DragDrop(root, {
      accepts: (payload, target) => this.accepts(payload, target),
      onDrop: (payload, target) => this.onDrop(payload, target),
      onArmedChange: () => this.paintArmed(),
    });
    root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('button[data-act]');
      if (!btn) return;
      const [cls, slot] = (btn.dataset.target ?? '').split(':');
      if (btn.dataset.act === 'unequip-gear') this.mutate(() => unequipToInventory(this.cs!, cls , slot as GearSlot));
      if (btn.dataset.act === 'unequip-perk') this.mutate(() => setPerkSlot(this.cs!, cls , Number(slot), null));
    });
  }

  open(cs: CampaignState) {
    this.cs = cs;
    this.message = '';
    this.dnd.disarm();
    this.render();
  }

  // ---------- drag/drop rules ----------

  private accepts(payload: string, target: string): boolean {
    const [kind] = payload.split(':');
    if (target === 'locker') return kind === 'gear' || kind === 'perkslot';
    const [tKind, tCls, tKey] = target.split(':');
    if (tKind === 'slot') {
      const wanted = tKey === 'armor' ? 'armor' : 'equipment';
      if (kind === 'inv') return payload.split(':')[1] === wanted;
      if (kind === 'gear') {
        const from = payload.split(':')[2];
        return (from === 'armor' ? 'armor' : 'equipment') === wanted;
      }
      return false;
    }
    if (tKind === 'perkslot') {
      if (kind !== 'perk' && kind !== 'perkslot') return false;
      return payload.split(':')[1] === tCls; // perks never move between soldiers
    }
    return false;
  }

  private onDrop(payload: string, target: string) {
    const cs = this.cs;
    if (!cs) return;
    const src = payload.split(':');
    const dst = target.split(':');

    this.mutate(() => {
      if (target === 'locker') {
        if (src[0] === 'gear') return unequipToInventory(cs, src[1] , src[2] as GearSlot);
        if (src[0] === 'perkslot') return setPerkSlot(cs, src[1] , Number(src[2]), null);
        return null;
      }
      if (dst[0] === 'slot') {
        const toCls = dst[1] ;
        const toSlot = dst[2] as GearSlot;
        if (src[0] === 'inv') return equipFromInventory(cs, toCls, toSlot, src[2] as ArmorId | EquipmentId);
        return moveEquipped(cs, { cls: src[1] , slot: src[2] as GearSlot }, { cls: toCls, slot: toSlot });
      }
      if (dst[0] === 'perkslot') {
        const cls = dst[1] ;
        const index = Number(dst[2]);
        if (src[0] === 'perk') return setPerkSlot(cs, cls, index, src[2] as PerkId);
        const moving = perkSlots(cs, cls)[Number(src[2])];
        return moving ? setPerkSlot(cs, cls, index, moving) : null;
      }
      return null;
    });
  }

  /** Runs a mutation, reports whatever it refused, saves and redraws. One path for drops and buttons alike. */
  private mutate(fn: () => string | null | void) {
    if (!this.cs) return;
    this.message = fn() || '';
    saveCampaign(this.cs);
    this.dnd.disarm();
    this.render();
  }

  // ---------- rendering ----------

  private paintArmed() {
    for (const el of $('equip').querySelectorAll<HTMLElement>('[data-drag]')) {
      el.classList.toggle('is-armed', el.dataset.drag === this.dnd.armed);
    }
  }

  private render() {
    const cs = this.cs;
    if (!cs) return;
    $('equip-msg').textContent = this.message;
    $('equip-classes').innerHTML = cs.roster.map((s) => this.soldierCard(s)).join('');
    $('equip-locker-items').innerHTML = this.lockerItems();
    this.paintArmed();
  }

  private lockerItems(): string {
    const cs = this.cs!;
    const rows = [
      ...gearStock(cs.inventory, 'armor', ARMOR_ORDER).map((e) =>
        itemTile(`inv:armor:${e.id}`, 'armor', ARMOR[e.id as ArmorId].name, ARMOR[e.id as ArmorId].blurb, e.count)),
      ...gearStock(cs.inventory, 'equipment', EQUIPMENT_ORDER).map((e) =>
        itemTile(`inv:equipment:${e.id}`, 'equipment', EQUIPMENT[e.id as EquipmentId].name, EQUIPMENT[e.id as EquipmentId].blurb, e.count)),
    ];
    return rows.length ? rows.join('')
      : '<p class="locker__empty">Empty. Gear drops from enemies and chests, and the fabricator at the base makes it from parts.</p>';
  }

  private soldierCard(soldier: Soldier): string {
    const cs = this.cs!;
    const cls = soldier.cls;
    const id = soldier.id; // every drag/drop address below is by soldier, so gear moves between anyone
    const lo = loadoutFor(cs, id);
    const progress = progressFor(cs, id);
    const slots = slotCount(cls, progress.level);
    const next = LEVEL_PATHS[cls].find((d) => d.xpThreshold > progress.xp)?.xpThreshold;
    const prev = [...LEVEL_PATHS[cls]].reverse().find((d) => d.xpThreshold <= progress.xp)?.xpThreshold ?? 0;
    const pct = next === undefined ? 100 : Math.round(((progress.xp - prev) / (next - prev)) * 100);
    const equippedPerks = perkSlots(cs, id);
    const loose = progress.perkPool.filter((id) => !equippedPerks.includes(id));

    if (onMission(cs, id)) {
      return `<article class="card card--player card--locked"><div class="card__head"><div>
        <h3 class="card__title">${soldier.name}</h3><span class="card__sub">${CLASSES[cls].name} · on a mission</span>
      </div></div><p class="muted">Their gear can't change until the mission in progress ends.</p></article>`;
    }
    return `<article class="card card--player">
      <div class="card__head">
        <div>
          <h3 class="card__title">${soldier.name}</h3>
          <span class="card__sub">${CLASSES[cls].name} · ${soldierHp(soldier)}/${CLASSES[cls].hp} HP · move ${CLASSES[cls].move} · vision ${CLASSES[cls].vision}</span>
        </div>
        <div class="spacer"></div>
        <span class="badge">Lv ${progress.level}</span>
      </div>

      <div class="xp">
        <span>${progress.xp} XP</span>
        <div class="meter"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>
        <span>${next === undefined ? 'max level' : `next ${next}`}</span>
      </div>

      <div class="loadout">
        ${gearSlot(id, 'armor', 'Armor', lo.armor, 'armor')}
        ${gearSlot(id, 'equip0', 'Equipment 1', lo.equipment[0], 'equipment')}
        ${gearSlot(id, 'equip1', 'Equipment 2', lo.equipment[1], 'equipment')}
      </div>

      <h4 class="section__title" style="margin:4px 0 0">Perks · ${equippedPerks.filter(Boolean).length}/${slots} slots</h4>
      <div class="loadout">
        ${equippedPerks.map((perk, i) => perkSlot(id, i, perk)).join('')}
      </div>
      ${loose.length
        ? `<div class="stack" style="gap:6px">${loose.map((perk) => perkTile(`perk:${id}:${perk}`, perk)).join('')}</div>`
        : progress.perkPool.length
          ? '<p class="muted">Every unlocked perk is equipped.</p>'
          : '<p class="muted">No perks unlocked yet - earn XP on missions to level up.</p>'}
    </article>`;
  }
}

// ---------- tiles ----------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function itemTile(payload: string, kind: 'armor' | 'equipment', name: string, blurb: string, count?: number): string {
  return `<div class="item" data-drag="${payload}" tabindex="0" role="button" title="${esc(blurb)}">
    <span class="item__icon">${icon(kind)}</span>
    <span class="item__text"><span class="item__name">${name}</span><span class="item__stat">${esc(blurb)}</span></span>
    ${count !== undefined && count > 1 ? `<span class="item__count">x${count}</span>` : ''}
  </div>`;
}

function perkTile(payload: string, id: PerkId): string {
  const def = PERKS[id];
  return `<div class="item item--perk" data-drag="${payload}" tabindex="0" role="button" title="${esc(def.blurb)}">
    <span class="item__icon">${icon('perk')}</span>
    <span class="item__text"><span class="item__name">${def.name}</span><span class="item__stat">${esc(def.blurb)}</span></span>
  </div>`;
}

function gearSlot(cls: string, slot: GearSlot, label: string, id: ArmorId | EquipmentId | null, kind: 'armor' | 'equipment'): string {
  const filled = id !== null;
  const def = !id ? null : kind === 'armor' ? ARMOR[id as ArmorId] : EQUIPMENT[id as EquipmentId];
  return `<div class="slot ${filled ? 'is-filled' : ''}" data-drop="slot:${cls}:${slot}">
    ${filled
      ? `<div class="item" data-drag="gear:${cls}:${slot}" tabindex="0" role="button" title="${esc(def!.blurb)}">
           <span class="item__icon">${icon(kind)}</span>
           <span class="item__text"><span class="item__name">${def!.name}</span><span class="item__stat">${label}</span></span>
         </div>
         <button class="btn--ghost slot__remove" data-act="unequip-gear" data-target="${cls}:${slot}" title="Take off">${icon('close')}</button>`
      : `<span class="item__icon">${icon(kind)}</span><span class="item__text"><span class="slot__label">${label}</span><span class="slot__empty">Empty</span></span>`}
  </div>`;
}

function perkSlot(cls: string, index: number, id: PerkId | null): string {
  const def = id ? PERKS[id] : null;
  return `<div class="slot ${id ? 'is-filled' : ''}" data-drop="perkslot:${cls}:${index}">
    ${def
      ? `<div class="item item--perk" data-drag="perkslot:${cls}:${index}" tabindex="0" role="button" title="${esc(def.blurb)}">
           <span class="item__icon">${icon('perk')}</span>
           <span class="item__text"><span class="item__name">${def.name}</span><span class="item__stat">${esc(def.blurb)}</span></span>
         </div>
         <button class="btn--ghost slot__remove" data-act="unequip-perk" data-target="${cls}:${index}" title="Unequip">${icon('close')}</button>`
      : `<span class="item__icon">${icon('perk')}</span><span class="item__text"><span class="slot__label">Perk ${index + 1}</span><span class="slot__empty">Empty</span></span>`}
  </div>`;
}
