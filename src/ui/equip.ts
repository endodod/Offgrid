import { togglePerk, type CampaignState } from '../core/campaign';
import { slotCount } from '../core/leveling';
import { ARMOR } from '../data/armor';
import { EQUIPMENT } from '../data/equipment';
import { CLASS_ORDER, CLASSES, type ClassId } from '../data/units';
import { LEVEL_PATHS } from '../data/leveling';
import { PERKS, type PerkId } from '../data/perks';
import type { ClassProgress, UnitLoadout } from '../data/trainingGrounds';
import { saveCampaign } from './campaignStore';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface EquipHooks {
  onBack: () => void;
}

/**
 * The equip screen (7, 8): per class, one armor slot, two equipment slots, and its level/XP with a perk
 * checklist limited to unlocked perks and the current slot count. Reads and mutates the same live
 * `CampaignState` the campaign screen (5) owns, exactly like the base screen (6) - not a private copy.
 */
export class Equip {
  private cs: CampaignState | null = null;

  constructor(hooks: EquipHooks) {
    $('equip-back').addEventListener('click', () => hooks.onBack());
    $('equip-classes').addEventListener('change', (e) => this.onChange(e));
  }

  open(cs: CampaignState) {
    this.cs = cs;
    this.render();
  }

  private loadoutFor(cls: ClassId): UnitLoadout {
    return this.cs!.loadouts[cls] ?? { armor: null, equipment: [null, null] };
  }

  private progressFor(cls: ClassId): ClassProgress {
    return this.cs!.levels[cls] ?? { xp: 0, level: 1, perkPool: [], equippedPerks: [] };
  }

  private onChange(e: Event) {
    if (!this.cs) return;
    const el = e.target as HTMLElement;
    if (el instanceof HTMLSelectElement) this.onGearChange(el);
    else if (el instanceof HTMLInputElement && el.dataset.perk) this.onPerkToggle(el);
  }

  private onGearChange(sel: HTMLSelectElement) {
    if (!this.cs) return;
    const cls = sel.dataset.cls as ClassId | undefined;
    const slot = sel.dataset.slot; // 'armor' | '0' | '1'
    if (!cls || slot === undefined) return;
    const loadout = { ...this.loadoutFor(cls), equipment: [...this.loadoutFor(cls).equipment] as UnitLoadout['equipment'] };
    const value = sel.value || null;
    if (slot === 'armor') loadout.armor = value as UnitLoadout['armor'];
    else loadout.equipment[Number(slot)] = value as UnitLoadout['equipment'][number];
    this.cs.loadouts[cls] = loadout;
    saveCampaign(this.cs);
    this.render();
  }

  private onPerkToggle(box: HTMLInputElement) {
    if (!this.cs) return;
    const cls = box.dataset.cls as ClassId;
    const id = box.dataset.perk as PerkId;
    const err = togglePerk(this.cs, cls, id);
    $('equip-msg').textContent = err ?? '';
    saveCampaign(this.cs);
    this.render();
  }

  private render() {
    const cs = this.cs;
    if (!cs) return;
    $('equip-classes').innerHTML = CLASS_ORDER.map((cls) => classCard(cls, this.loadoutFor(cls), this.progressFor(cls), cs)).join('');
  }
}

const option = (value: string, label: string, selected: boolean) =>
  `<option value="${value}" ${selected ? 'selected' : ''}>${label}</option>`;

function classCard(cls: ClassId, loadout: UnitLoadout, progress: ClassProgress, cs: CampaignState): string {
  const armorOptions = [option('', 'None', !loadout.armor), ...cs.unlockedGear.armor.map((id) => option(id, ARMOR[id].name, loadout.armor === id))];
  const equipOptions = (slot: 0 | 1) => [
    option('', 'None', !loadout.equipment[slot]),
    ...cs.unlockedGear.equipment.map((id) => option(id, EQUIPMENT[id].name, loadout.equipment[slot] === id)),
  ];
  const slots = slotCount(cls, progress.level);
  const nextThreshold = LEVEL_PATHS[cls].find((d) => d.xpThreshold > progress.xp)?.xpThreshold;
  const perkRows = progress.perkPool.length ? progress.perkPool.map((id) => perkRow(cls, id, progress)).join('')
    : '<p class="dim">No perks unlocked yet - earn XP on missions to level up.</p>';
  return `<article class="mission">
    <h3>${CLASSES[cls].name} <span class="badge">Lv ${progress.level} - ${progress.xp} XP${nextThreshold !== undefined ? ` (next at ${nextThreshold})` : ' (max)'}</span></h3>
    <div class="row">
      <span>Armor</span><select data-cls="${cls}" data-slot="armor">${armorOptions.join('')}</select>
      <span>Equipment</span><select data-cls="${cls}" data-slot="0">${equipOptions(0).join('')}</select>
      <select data-cls="${cls}" data-slot="1">${equipOptions(1).join('')}</select>
    </div>
    <p class="dim">Perks: ${progress.equippedPerks.length}/${slots} slots used</p>
    ${perkRows}
  </article>`;
}

function perkRow(cls: ClassId, id: PerkId, progress: ClassProgress): string {
  const def = PERKS[id];
  const equipped = progress.equippedPerks.includes(id);
  const full = !equipped && progress.equippedPerks.length >= slotCount(cls, progress.level);
  return `<label class="row"><input type="checkbox" data-cls="${cls}" data-perk="${id}" ${equipped ? 'checked' : ''} ${full ? 'disabled' : ''} />
    <span>${def.name}</span><span class="dim">${def.blurb}</span></label>`;
}
