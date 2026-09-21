import { baseGameOptions } from '../core/base';
import {
  applyMissionXp, availableStoryMissions, completeStoryMission, completeSupplyRun, districtStatus, newCampaign,
  recordMissionGear, type CampaignState,
} from '../core/campaign';
import type { Unit } from '../core/types';
import { DISTRICTS, type GeneratedMissionDef, type StoryMissionDef } from '../data/campaign';
import type { MapDef } from '../data/trainingGrounds';
import { clearCampaign, loadCampaign, saveCampaign } from './campaignStore';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface CampaignHooks {
  /** Launch `map` as a mission; `missionId` is reported back to `Campaign.reportWin` once it's won. */
  onPlay: (map: MapDef, missionId: string) => void;
  onBack: () => void;
}

/**
 * The campaign screen (5): district progress, the four handcrafted Act 1 story missions, and a rotating pool
 * of generated "supply run" missions. Owns its own `CampaignState`, persisted via `ui/campaignStore.ts`.
 */
export class Campaign {
  private state: CampaignState;

  constructor(private hooks: CampaignHooks) {
    this.state = loadCampaign() ?? newCampaign();
    $('campaign-back').addEventListener('click', () => hooks.onBack());
    $('campaign-reset').addEventListener('click', () => {
      if (!confirm('Start a brand new campaign? This discards all current progress.')) return;
      clearCampaign();
      this.state = newCampaign();
      saveCampaign(this.state);
      this.render();
    });
    $('campaign-story').addEventListener('click', (e) => this.onPlayClick(e, 'story'));
    $('campaign-supply').addEventListener('click', (e) => this.onPlayClick(e, 'supply'));
  }

  /** Show the screen with fresh data (call every time it's entered, in case something changed elsewhere). */
  open() {
    this.render();
  }

  /** The live CampaignState, for main.ts to hand to the base screen (6) - mutated in place, not copied. */
  campaignState(): CampaignState {
    return this.state;
  }

  /** Called once a mission launched from here ends in a player win; `finalUnits` persists ending loadouts (7)
   *  and awards XP/levels (8). */
  reportWin(missionId: string, finalUnits: Unit[]) {
    if (this.state.supplyRunPool.some((m) => m.id === missionId)) completeSupplyRun(this.state, missionId);
    else completeStoryMission(this.state, missionId);
    recordMissionGear(this.state, finalUnits);
    applyMissionXp(this.state, finalUnits);
    saveCampaign(this.state);
  }

  /** Layers a built base's meta-progression bonuses (6), the campaign's current per-class loadouts (7) and
   *  levels/perks (8) onto a mission's own map - see core/base.ts and core/campaign.ts's `CampaignState`. */
  private applyBase(map: MapDef): MapDef {
    const bonus = baseGameOptions(this.state.base);
    return {
      ...map,
      playerReserveMult: 1 + bonus.reserveMultBonus,
      ...(bonus.medkitBonus ? { medkitBonus: bonus.medkitBonus } : {}),
      ...(bonus.gadgetUsesBonus ? { gadgetUsesBonus: bonus.gadgetUsesBonus } : {}),
      startingLoadouts: this.state.loadouts,
      startingProgress: this.state.levels,
    };
  }

  private onPlayClick(e: Event, kind: 'story' | 'supply') {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-play]');
    if (!btn) return;
    const id = btn.dataset.play!;
    if (kind === 'story') {
      const m = availableStoryMissions(this.state).find((x) => x.id === id);
      if (m) this.hooks.onPlay(this.applyBase(m.map), m.id);
    } else {
      const m = this.state.supplyRunPool.find((x) => x.id === id);
      if (m) this.hooks.onPlay(this.applyBase({ ...m.map, enemyProfile: m.enemyProfile }), m.id);
    }
  }

  private render() {
    $('campaign-currency').textContent = `Currency: ${this.state.currency}`;

    $('campaign-districts').innerHTML = DISTRICTS.map((d) => {
      const status = districtStatus(this.state, d.id);
      return `<span class="district ${status}" title="${d.blurb}">${d.name} <em>(act ${d.act}, ${d.antagonist})</em> - ${status}</span>`;
    }).join('');

    const story = availableStoryMissions(this.state);
    $('campaign-story').innerHTML = story.length ? story.map((m) => storyCard(m)).join('')
      : '<p class="dim">No story missions available right now - clear the current district\'s missions to unlock the next one.</p>';

    $('campaign-supply').innerHTML = this.state.supplyRunPool.map((m) => supplyCard(m)).join('');
  }
}

const storyCard = (m: StoryMissionDef) => `<article class="mission">
  <h3>${m.name}</h3>
  <p>${m.blurb}</p>
  <p class="obj"><b>Objective</b> ${m.objective}</p>
  <div class="btns"><button data-play="${m.id}">Play</button></div>
</article>`;

const supplyCard = (m: GeneratedMissionDef) => `<article class="mission">
  <h3>${m.name}</h3>
  <p>${m.blurb}</p>
  <div class="chips"><span>AI: ${m.enemyProfile}</span><span>Reward: ${m.reward}</span></div>
  <div class="btns"><button data-play="${m.id}">Play</button></div>
</article>`;
