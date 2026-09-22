import { baseGameOptions } from '../core/base';
import {
  applyMissionXp, availableStoryMissions, completeStoryMission, completeSupplyRun, districtStatus,
  markIntroSeen, newCampaign, recordMissionGear, resolveSupplyRun, unseenIntros, type CampaignState,
} from '../core/campaign';
import type { Unit } from '../core/types';
import {
  DISTRICTS, STORY_MISSIONS, SUPPLY_RUN_TIER_LABELS, supplyRunComplication, supplyRunTemplate,
  type GeneratedMissionDef, type StoryMissionDef,
} from '../data/campaign';
import { AI_PROFILES } from '../data/aiProfiles';
import type { MapDef } from '../data/trainingGrounds';
import { clearCampaign, loadCampaign, saveCampaign } from './campaignStore';
import { icon } from './icons';
import { showModal } from './modal';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface CampaignHooks {
  /** Launch `map` as a mission; `missionId` is reported back to `Campaign.reportWin` once it's won. */
  onPlay: (map: MapDef, missionId: string) => void;
  onBack: () => void;
}

/**
 * The campaign screen (5): district progress, the Act 1 story missions, and a rotating pool of generated
 * supply runs. Owns its own `CampaignState`, persisted via `ui/campaignStore.ts`.
 *
 * It is also where the story is told. Two modals, both queued from `open()` so they appear in narrative
 * order when a mission both finishes a beat and unlocks the next district: the mission debrief first, then
 * the new district's briefing.
 */
export class Campaign {
  private state: CampaignState;
  private pendingDebrief: StoryMissionDef | null = null;

  constructor(private hooks: CampaignHooks) {
    this.state = loadCampaign() ?? newCampaign();
    $('campaign-back').addEventListener('click', () => hooks.onBack());
    $('campaign-reset').addEventListener('click', () => {
      if (!confirm('Start a brand new campaign? This discards all current progress.')) return;
      clearCampaign();
      this.state = newCampaign();
      this.pendingDebrief = null;
      saveCampaign(this.state);
      void this.open();
    });
    $('campaign-story').addEventListener('click', (e) => this.onPlayClick(e, 'story'));
    $('campaign-supply').addEventListener('click', (e) => this.onPlayClick(e, 'supply'));
  }

  /** Show the screen with fresh data, then any story that is waiting. */
  async open() {
    this.render();
    const debrief = this.pendingDebrief;
    this.pendingDebrief = null;
    if (debrief) {
      await showModal({
        eyebrow: `${districtName(debrief.district)} · mission complete`,
        title: debrief.name,
        body: [debrief.outcome],
        cta: 'Back to the map',
      });
    }
    for (const id of unseenIntros(this.state)) {
      const district = DISTRICTS.find((d) => d.id === id)!;
      await showModal({
        eyebrow: `Act ${district.act} · ${district.antagonist}`,
        title: district.intro.title,
        body: district.intro.body,
        cta: 'Take the district',
      });
      markIntroSeen(this.state, id);
      saveCampaign(this.state);
      this.render();
    }
  }

  /** The live CampaignState, for main.ts to hand to the base screen (6) - mutated in place, not copied. */
  campaignState(): CampaignState {
    return this.state;
  }

  /** Called once a mission launched from here ends in a player win; `finalUnits` persists ending loadouts (7)
   *  and awards XP/levels (8). */
  reportWin(missionId: string, finalUnits: Unit[]) {
    if (this.state.supplyRunPool.some((m) => m.id === missionId)) completeSupplyRun(this.state, missionId);
    else {
      completeStoryMission(this.state, missionId);
      this.pendingDebrief = STORY_MISSIONS.find((m) => m.id === missionId) ?? null;
    }
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
      if (m) this.hooks.onPlay(this.applyBase(resolveSupplyRun(m)), m.id);
    }
  }

  private render() {
    $('campaign-currency').innerHTML = `${icon('currency')}${this.state.currency}`;

    $('campaign-districts').innerHTML = DISTRICTS.map((d) => {
      const status = districtStatus(this.state, d.id);
      const done = STORY_MISSIONS.filter((m) => m.district === d.id && this.state.completedStoryMissions.includes(m.id)).length;
      const total = STORY_MISSIONS.filter((m) => m.district === d.id).length;
      return `<div class="district is-${status}" title="${d.blurb}">
        <div class="district__act">Act ${d.act}${status === 'locked' ? ' · locked' : ''}</div>
        <div class="district__name">${d.name}</div>
        <div class="district__foe">${total ? `${done}/${total} missions` : 'no missions yet'} · ${d.antagonist}</div>
      </div>`;
    }).join('');

    const story = availableStoryMissions(this.state);
    $('campaign-story').innerHTML = story.length ? story.map((m) => this.storyCard(m)).join('')
      : `<p class="section__note">Every story mission in the districts you hold is done. ${
        DISTRICTS.some((d) => districtStatus(this.state, d.id) === 'locked')
          ? 'The next district is not written yet - supply runs keep paying in the meantime.'
          : ''}</p>`;

    $('campaign-supply').innerHTML = this.state.supplyRunPool.map((m) => supplyCard(m)).join('');
  }

  private storyCard(m: StoryMissionDef): string {
    const inDistrict = STORY_MISSIONS.filter((x) => x.district === m.district);
    const n = inDistrict.findIndex((x) => x.id === m.id) + 1;
    return `<article class="card card--interactive card--accent">
      <div class="card__head">
        <div>
          <h3 class="card__title">${m.name}</h3>
          <span class="card__sub">${districtName(m.district)} · mission ${n} of ${inDistrict.length}</span>
        </div>
      </div>
      <p class="card__body">${m.blurb}</p>
      <p class="objective-line"><b>Objective</b> <span>${m.objective}</span></p>
      <div class="chips">${mapChips(m.map)}</div>
      <div class="card__foot"><button class="btn--primary btn--block" data-play="${m.id}">${icon('play')}Deploy</button></div>
    </article>`;
  }
}

const districtName = (id: string) => DISTRICTS.find((d) => d.id === id)?.name ?? id;

/** The at-a-glance shape of a mission: size, squad sizes, and the conditions it starts under. */
function mapChips(map: MapDef): string {
  const chips = [
    `<span class="chip">${map.rows[0].length} x ${map.rows.length}</span>`,
    `<span class="chip chip--danger">${map.spawns.enemy.length} hostile</span>`,
  ];
  if (map.startTimeOfDay && map.startTimeOfDay !== 'midday') chips.push(`<span class="chip chip--info">${map.startTimeOfDay}</span>`);
  if (map.startWeather && map.startWeather !== 'clear') chips.push(`<span class="chip chip--info">${map.startWeather}</span>`);
  if (map.interactables?.some((i) => i.type === 'chest')) chips.push('<span class="chip chip--warn">loot</span>');
  return chips.join('');
}

function supplyCard(m: GeneratedMissionDef): string {
  const template = supplyRunTemplate(m.templateId);
  const complication = supplyRunComplication(m.complicationId);
  return `<article class="card card--interactive">
    <div class="card__head">
      <div>
        <h3 class="card__title">${m.name}</h3>
        <span class="card__sub">${SUPPLY_RUN_TIER_LABELS[m.tier] ?? ''} · ${AI_PROFILES[m.enemyProfile].name}</span>
      </div>
      <div class="spacer"></div>
      <span class="badge">+${m.reward}</span>
    </div>
    <p class="card__body">${m.blurb}</p>
    <p class="objective-line"><b>Objective</b> <span>${m.objective}</span></p>
    ${complication ? `<p class="card__body"><b class="dim">${complication.label}.</b> ${complication.blurb}</p>` : ''}
    <div class="chips">${(template?.tags ?? []).map((t) => `<span class="chip">${t}</span>`).join('')}</div>
    <div class="card__foot"><button class="btn--primary btn--block" data-play="${m.id}">${icon('play')}Take the job</button></div>
  </article>`;
}
