import type { CampaignState } from '../core/campaign';
import { ARMOR } from '../data/armor';
import { EQUIPMENT } from '../data/equipment';
import { CLASS_ORDER, CLASSES, type ClassId } from '../data/units';
import type { UnitLoadout } from '../data/trainingGrounds';
import { saveCampaign } from './campaignStore';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface EquipHooks {
  onBack: () => void;
}

/**
 * The equip screen (7): per class, one armor slot and two equipment slots, assignable from whatever has been
 * unlocked (found via a chest or an enemy drop - `CampaignState.unlockedGear`). Reads and mutates the same
 * live `CampaignState` the campaign screen (5) owns, exactly like the base screen (6) - not a private copy.
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

  private onChange(e: Event) {
    if (!this.cs) return;
    const sel = e.target as HTMLSelectElement;
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

  private render() {
    const cs = this.cs;
    if (!cs) return;
    $('equip-classes').innerHTML = CLASS_ORDER.map((cls) => classCard(cls, this.loadoutFor(cls), cs)).join('');
  }
}

const option = (value: string, label: string, selected: boolean) =>
  `<option value="${value}" ${selected ? 'selected' : ''}>${label}</option>`;

function classCard(cls: ClassId, loadout: UnitLoadout, cs: CampaignState): string {
  const armorOptions = [option('', 'None', !loadout.armor), ...cs.unlockedGear.armor.map((id) => option(id, ARMOR[id].name, loadout.armor === id))];
  const equipOptions = (slot: 0 | 1) => [
    option('', 'None', !loadout.equipment[slot]),
    ...cs.unlockedGear.equipment.map((id) => option(id, EQUIPMENT[id].name, loadout.equipment[slot] === id)),
  ];
  return `<article class="mission">
    <h3>${CLASSES[cls].name}</h3>
    <div class="row">
      <span>Armor</span><select data-cls="${cls}" data-slot="armor">${armorOptions.join('')}</select>
      <span>Equipment</span><select data-cls="${cls}" data-slot="0">${equipOptions(0).join('')}</select>
      <select data-cls="${cls}" data-slot="1">${equipOptions(1).join('')}</select>
    </div>
  </article>`;
}
