import { deserializeGame, SAVE_VERSION, serializeGame } from '../core/save';
import type { GameState } from '../core/types';

/**
 * In-progress missions (10c), in two slots so they can't clobber each other: a campaign mission, and a single
 * mission (the Training Grounds). Starting another mission of the same kind replaces that slot; finishing one
 * clears it. A campaign mission is never simply dropped - the campaign screen won't deploy anyone else while
 * its slot is taken, and the only ways out are to finish it or to retreat (a loss, see ui/campaign.ts).
 */
export type SaveSlot = 'campaign' | 'single';
const KEY: Record<SaveSlot, string> = { campaign: 'offgrid.mission.campaign', single: 'offgrid.mission' };

export interface MissionSave {
  /** Home-screen mission id, or null for a campaign mission (see campaignMissionId). */
  missionId: string | null;
  /** Set when the mission was launched from the campaign screen, so its result is still reported after a resume. */
  campaignMissionId: string | null;
  state: GameState;
}

export const slotOf = (m: { campaignMissionId: string | null }): SaveSlot => (m.campaignMissionId ? 'campaign' : 'single');

export function saveMission(m: MissionSave): boolean {
  try {
    localStorage.setItem(KEY[slotOf(m)], JSON.stringify({ v: SAVE_VERSION, missionId: m.missionId, campaignMissionId: m.campaignMissionId, state: serializeGame(m.state) }));
    return true;
  } catch {
    return false; // storage full or unavailable: the mission just won't be resumable
  }
}

export function loadMission(slot: SaveSlot): MissionSave | null {
  try {
    const raw = localStorage.getItem(KEY[slot]);
    if (!raw) return null;
    const o = JSON.parse(raw) as { v?: number; missionId?: string | null; campaignMissionId?: string | null; state?: string };
    if (o.v !== SAVE_VERSION || typeof o.state !== 'string') return null;
    const state = deserializeGame(o.state);
    if (state.winner) return null;
    return { missionId: o.missionId ?? null, campaignMissionId: o.campaignMissionId ?? null, state };
  } catch {
    return null;
  }
}

export function clearMission(slot: SaveSlot) {
  try { localStorage.removeItem(KEY[slot]); } catch { /* nothing to clear */ }
}
