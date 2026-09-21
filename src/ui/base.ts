import { facilityLevel, upgradeCost, type BaseState } from '../core/base';
import { upgradeFacility, type CampaignState } from '../core/campaign';
import { FACILITIES, FACILITY_ORDER, type FacilityId } from '../data/base';
import { saveCampaign } from './campaignStore';

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
    $('base-currency').textContent = `Currency: ${cs.currency}`;
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
  return `<article class="mission">
    <h3>${def.name} <span class="badge">Lv ${level}/${def.tiers.length}</span></h3>
    <p>${def.blurb}</p>
    <div class="chips">${def.tiers.map((t, i) => `<span class="${i < level ? 'ok' : ''}">${t.blurb}</span>`).join('')}</div>
    ${maxed
      ? '<p class="dim">Fully upgraded.</p>'
      : `<div class="btns"><button data-build="${id}" ${affordable ? '' : 'disabled'}>Upgrade (${cost}) - ${nextTier!.blurb}</button></div>`}
  </article>`;
}
