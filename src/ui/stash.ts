import { lockerCapacity } from '../core/base';
import { gearStock, type CampaignState } from '../core/campaign';
import { lockerCount, scrap, scrapValue, trimLocker } from '../core/crafting';
import { ARMOR_ORDER } from '../data/armor';
import { EQUIPMENT_ORDER } from '../data/equipment';
import type { RecipeKind } from '../data/crafting';
import { gearName } from './base';
import { saveCampaign } from './campaignStore';
import { icon } from './icons';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface StashHooks {
  /** Back to the campaign screen - only offered once the locker fits. */
  onDone: () => void;
  /** Equip pieces onto soldiers instead of scrapping them. */
  onLoadout: () => void;
}

/**
 * The Locker Full screen (14). Shown whenever the campaign screen opens with more spare gear than the locker
 * holds - usually straight after a mission that brought gear home. Nothing is scrapped behind the player's
 * back: they scrap pieces here (for parts), put them on soldiers in the Loadout screen, or let the game
 * scrap the most duplicated pieces. The campaign won't deploy until the locker fits.
 */
export class Stash {
  private cs: CampaignState | null = null;

  constructor(hooks: StashHooks) {
    $('stash-done').addEventListener('click', () => { if (this.cs && this.over() <= 0) hooks.onDone(); });
    $('stash-loadout').addEventListener('click', () => hooks.onLoadout());
    $('stash-body').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
      if (!this.cs || !btn) return;
      const [act, kind, id] = btn.dataset.act!.split(':');
      if (act === 'scrap') scrap(this.cs, kind as RecipeKind, id);
      if (act === 'auto') trimLocker(this.cs);
      saveCampaign(this.cs);
      this.render();
    });
  }

  open(cs: CampaignState) {
    this.cs = cs;
    this.render();
  }

  private over(): number {
    return this.cs ? lockerCount(this.cs.inventory) - lockerCapacity(this.cs.base) : 0;
  }

  private render() {
    const cs = this.cs;
    if (!cs) return;
    const n = lockerCount(cs.inventory), cap = lockerCapacity(cs.base), over = n - cap;
    const items = [
      ...gearStock(cs.inventory, 'armor', ARMOR_ORDER).map((e) => ({ kind: 'armor' as const, ...e })),
      ...gearStock(cs.inventory, 'equipment', EQUIPMENT_ORDER).map((e) => ({ kind: 'equipment' as const, ...e })),
    ];
    $('stash-parts').innerHTML = `${icon('bolt')}${cs.parts} parts`;
    $('stash-body').innerHTML = `
      <p class="section__note">${over > 0
        ? `The squad brought home more than the locker holds. Scrap <b>${over}</b> piece${over === 1 ? '' : 's'} for parts, or put gear on soldiers in the Loadout, before the next deployment. A bigger locker is a Locker upgrade at the base.`
        : 'Everything fits. You can go back to the campaign.'}</p>
      <div class="locker-cap"><div class="meter ${over > 0 ? 'is-critical' : 'is-low'}"><i style="width:${Math.min(100, (n / cap) * 100)}%"></i></div><span>${n}/${cap}</span></div>
      <div class="stack">${items.map((e) => `<div class="locker-row">
        <span class="locker-row__icon">${icon(e.kind)}</span>
        <span class="locker-row__name">${gearName(e.kind, e.id)}</span>
        <span class="badge">x${e.count}</span>
        <button class="btn--ghost btn--sm" data-act="scrap:${e.kind}:${e.id}">Scrap +${scrapValue(e.kind, e.id)} parts</button>
      </div>`).join('')}</div>
      ${over > 0 ? '<button class="btn--ghost" data-act="auto">Scrap the most duplicated pieces for me</button>' : ''}`;
    const done = $<HTMLButtonElement>('stash-done');
    done.disabled = over > 0;
    done.title = over > 0 ? `Still ${over} over capacity` : '';
  }
}
