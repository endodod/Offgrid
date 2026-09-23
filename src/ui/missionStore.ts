import { deserializeGame, SAVE_VERSION, serializeGame } from '../core/save';
import type { GameState } from '../core/types';

const KEY = 'offgrid.mission';

/** The one in-progress mission (10c). Starting any other mission overwrites it; finishing it clears it. */
export interface MissionSave {
  /** Home-screen mission id, or null for a campaign mission (see campaignMissionId). */
  missionId: string | null;
  /** Set when the mission was launched from the campaign screen, so a win is still reported after a resume. */
  campaignMissionId: string | null;
  state: GameState;
}

export function saveMission(m: MissionSave): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: SAVE_VERSION, missionId: m.missionId, campaignMissionId: m.campaignMissionId, state: serializeGame(m.state) }));
    return true;
  } catch {
    return false; // storage full or unavailable: the mission just won't be resumable
  }
}

export function loadMission(): MissionSave | null {
  try {
    const raw = localStorage.getItem(KEY);
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

export function clearMission() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}
