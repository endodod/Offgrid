import type { Mission } from '../data/missions';
import type { MapDef } from '../data/trainingGrounds';
import { icon } from './icons';
import type { CampaignState } from '../core/campaign';
import { DISTRICTS, STORY_MISSIONS } from '../data/campaign';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export type Screen = 'home' | 'game' | 'builder' | 'settings' | 'campaign' | 'base' | 'equip' | 'briefing' | 'lore' | 'stash';

const SCREENS: Screen[] = ['home', 'game', 'builder', 'settings', 'campaign', 'base', 'equip', 'briefing', 'lore', 'stash'];

/** Show exactly one screen. */
export function showScreen(screen: Screen) {
  for (const s of SCREENS) $(s).hidden = s !== screen;
  window.scrollTo({ top: 0 });
}

export const isGameVisible = () => !$('game').hidden;

export interface HomeHooks {
  /** The map to play for a mission (a saved custom map in debug mode, else the default). */
  resolve: (m: Mission) => MapDef;
  isCustom: (m: Mission) => boolean;
  debug: boolean;
  onEnter: (m: Mission) => void;
  onEdit: (m: Mission) => void;
}

/** Mission cards on the home screen, built from data. Call the returned function to redraw (e.g. after saving a map). */
export function initHome(missions: Mission[], h: HomeHooks): () => void {
  const render = () => {
    $('missions').innerHTML = missions.map((m, i) => {
      const { rows, spawns } = h.resolve(m);
      const custom = h.debug && h.isCustom(m);
      return `<article class="card card--interactive card--accent">
        <div class="card__head">
          <div>
            <h3 class="card__title">${m.name}</h3>
            <span class="card__sub">${rows[0].length} x ${rows.length} tiles</span>
          </div>
          <div class="spacer"></div>
          ${custom ? '<span class="badge">custom map</span>' : ''}
        </div>
        <p class="card__body">${m.blurb}</p>
        <p class="objective-line"><b>Objective</b> <span>${m.objective}</span></p>
        <div class="chips">
          <span class="chip chip--ok">${spawns.player.length} friendly</span>
          <span class="chip chip--danger">${spawns.enemy.length} hostile</span>
        </div>
        <div class="card__foot">
          <button class="btn--primary" data-mission="${i}">${icon('play')}Enter mission</button>
          ${h.debug ? `<button class="btn--ghost" data-edit="${i}">Edit map</button>` : ''}
        </div>
      </article>`;
    }).join('');
  };
  $('missions').addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const enter = t.closest<HTMLElement>('[data-mission]');
    const edit = t.closest<HTMLElement>('[data-edit]');
    if (enter) h.onEnter(missions[Number(enter.dataset.mission)]);
    else if (edit) h.onEdit(missions[Number(edit.dataset.edit)]);
  });
  $('home-debug').hidden = !h.debug;
  const training = missions.find((m) => m.id === 'training-grounds') ?? missions[0];
  $('home-training').addEventListener('click', () => h.onEnter(training));
  render();
  return render;
}

/** The campaign tile's line: where the campaign stands, or an invitation (and a nudge to the lore) if new. */
export function renderCampaignTile(cs: CampaignState | null) {
  $('home-lore').querySelector('.lore-strip__text')!.innerHTML = cs
    ? '<b>The story so far.</b> Re-read every briefing and debrief, and what is known about Ashport.'
    : '<b>New to Ashport?</b> Read what happened to the city, and who you are up against, before your first mission.';
  if (!cs) {
    $('home-campaign-sub').textContent = 'Take Ashport back, one district at a time. First time? Read the lore below.';
    $('home-campaign-cta').textContent = 'Start';
    return;
  }
  const current = [...DISTRICTS].reverse().find((d) => cs.unlockedDistricts.includes(d.id)) ?? DISTRICTS[0];
  const inDistrict = STORY_MISSIONS.filter((m) => m.district === current.id);
  const done = inDistrict.filter((m) => cs.completedStoryMissions.includes(m.id)).length;
  $('home-campaign-sub').textContent = `Act ${current.act} · ${current.name} · ${done}/${inDistrict.length} missions · ${cs.currency} salvage`;
  $('home-campaign-cta').textContent = 'Continue';
}
