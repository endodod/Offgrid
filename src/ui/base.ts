import { facilityLevel, upgradeCost, type BaseState } from '../core/base';
import { upgradeFacility, type CampaignState } from '../core/campaign';
import { FACILITIES, FACILITY_ORDER, type FacilityId } from '../data/base';
import { saveCampaign } from './campaignStore';
import { icon } from './icons';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface BaseHooks {
  onBack: () => void;
}

/**
 * The home-base screen (6): build/upgrade facilities with campaign currency. Reads and mutates the same
 * `CampaignState` the campaign screen owns (passed in fresh on every `open()`, not copied), so a spend here
 * is immediately reflected back there.
 */
export class Base {
  private cs: CampaignState | null = null;

  constructor(hooks: BaseHooks) {
    $('base-back').addEventListener('click', () => hooks.onBack());
    $('base-facilities').addEventListener('click', (e) => this.onBuildClick(e));
  }

  open(cs: CampaignState) {
    this.cs = cs;
    this.render();
  }

  private onBuildClick(e: Event) {
    if (!this.cs) return;
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-build]');
    if (!btn) return;
    const id = btn.dataset.build as FacilityId;
    const err = upgradeFacility(this.cs, id);
    saveCampaign(this.cs);
    if (err) $('base-msg').textContent = err;
    else $('base-msg').textContent = '';
    this.render();
  }

  private render() {
    const cs = this.cs;
    if (!cs) return;
    $('base-currency').innerHTML = `${icon('currency')}${cs.currency}`;
    $('base-facilities').innerHTML = FACILITY_ORDER.map((id) => facilityCard(cs.base, cs.currency, id)).join('');
  }
}

function facilityCard(base: BaseState, currency: number, id: FacilityId): string {
  const def = FACILITIES[id];
  const level = facilityLevel(base, id);
  const cost = upgradeCost(base, id);
  const maxed = cost === null;
  const affordable = !maxed && currency >= cost;
  const nextTier = maxed ? null : def.tiers[level];
  return `<article class="card card--interactive">
    <div class="card__head">
      <div>
        <h3 class="card__title">${def.name}</h3>
        <span class="card__sub">Level ${level} of ${def.tiers.length}</span>
      </div>
      <div class="spacer"></div>
      <span class="badge">${level}/${def.tiers.length}</span>
    </div>
    <p class="card__body">${def.blurb}</p>
    <div class="meter"><i style="width:${(level / def.tiers.length) * 100}%"></i></div>
    <div class="chips">${def.tiers.map((t, i) => `<span class="chip ${i < level ? 'chip--ok' : ''}">${i < level ? icon('check') : ''}${t.blurb}</span>`).join('')}</div>
    <div class="card__foot">
      ${maxed
        ? '<span class="chip chip--ok">Fully upgraded</span>'
        : `<button class="btn--primary btn--block" data-build="${id}" ${affordable ? '' : 'disabled'}>
             ${icon('currency')}${cost} - ${nextTier!.blurb}
           </button>`}
    </div>
  </article>`;
}
