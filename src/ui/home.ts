import type { Mission } from '../data/missions';
import type { MapDef } from '../data/trainingGrounds';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export type Screen = 'home' | 'game' | 'builder';

/** Show exactly one screen. */
export function showScreen(screen: Screen) {
  for (const s of ['home', 'game', 'builder'] as Screen[]) $(s).hidden = s !== screen;
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
      return `<article class="mission">
        <h3>${m.name}${custom ? ' <span class="badge">custom map</span>' : ''}</h3>
        <p>${m.blurb}</p>
        <p class="obj"><b>Objective</b> ${m.objective}</p>
        <div class="chips"><span>${rows[0].length} x ${rows.length} tiles</span><span>${spawns.player.length} friendly units</span><span>${spawns.enemy.length} enemies</span></div>
        <div class="btns">
          <button class="enter" data-mission="${i}">Enter mission</button>
          ${h.debug ? `<button data-edit="${i}">Edit map (debug)</button>` : ''}
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
