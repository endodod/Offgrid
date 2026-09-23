import type { CampaignState } from '../core/campaign';
import { DISTRICTS, STORY_MISSIONS } from '../data/campaign';
import { LORE_HOW, LORE_WORLD, type LoreSection } from '../data/lore';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface LoreHooks {
  onBack: () => void;
  onCampaign: () => void;
}

/**
 * The Lore screen: the world as a newcomer should meet it, the districts (names always, details only once
 * reached), and the player's own record - every district briefing and mission debrief they have seen, in
 * order, so the story can be re-read.
 */
export class Lore {
  constructor(hooks: LoreHooks) {
    $('lore-back').addEventListener('click', () => hooks.onBack());
    $('lore-campaign').addEventListener('click', () => hooks.onCampaign());
  }

  open(cs: CampaignState | null) {
    $('lore-world').innerHTML = [...LORE_WORLD, LORE_HOW].map(section).join('');
    const reached = new Set(cs?.unlockedDistricts ?? [DISTRICTS[0].id]);
    $('lore-districts').innerHTML = DISTRICTS.map((d) => {
      const known = reached.has(d.id) || d.act === 1;
      return `<li class="lore-district ${reached.has(d.id) ? 'is-reached' : ''}">
        <span class="lore-district__act">Act ${d.act}</span>
        <b>${d.name}</b>
        <span>${known ? d.blurb : 'Unknown until you get there.'}</span>
      </li>`;
    }).join('');
    $('lore-record').innerHTML = record(cs);
  }
}

const section = (s: LoreSection) => `<article class="lore-section"><h2>${s.title}</h2>${s.body.map((p) => `<p>${p}</p>`).join('')}</article>`;

/** Briefings and debriefs in play order: each district's briefing, then its completed missions' outcomes. */
function record(cs: CampaignState | null): string {
  if (!cs || !cs.seenIntros.length) {
    return '<p class="muted">Nothing yet. Start the campaign and every briefing and debrief you see is kept here to re-read.</p>';
  }
  return DISTRICTS.filter((d) => cs.seenIntros.includes(d.id)).map((d) => {
    const done = STORY_MISSIONS.filter((m) => m.district === d.id && cs.completedStoryMissions.includes(m.id));
    return `<article class="lore-entry">
      <div class="lore-entry__eyebrow">Act ${d.act} · briefing</div>
      <h3>${d.intro.title}</h3>
      ${d.intro.body.map((p) => `<p>${p}</p>`).join('')}
      ${done.map((m) => `<div class="lore-entry__mission"><b>${m.name}</b><p>${m.outcome}</p></div>`).join('')}
    </article>`;
  }).join('');
}
