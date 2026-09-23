import type { Mission } from '../data/missions';
import type { MapDef } from '../data/trainingGrounds';
import { icon } from './icons';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export type Screen = 'home' | 'game' | 'builder' | 'settings' | 'campaign' | 'base' | 'equip' | 'briefing';

const SCREENS: Screen[] = ['home', 'game', 'builder', 'settings', 'campaign', 'base', 'equip', 'briefing'];

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
  render();
  return render;
}
