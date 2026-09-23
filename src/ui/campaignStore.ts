import { newBaseState } from '../core/base';
import { migrateCampaign, newGearInventory, type CampaignState } from '../core/campaign';

const KEY = 'offgrid.campaign';

/** Light structural check - just enough to reject obviously corrupt/foreign JSON before it reaches the game. */
function isCampaignState(v: unknown): v is CampaignState {
  if (typeof v !== 'object' || v === null) return false;
  const c = v as Partial<CampaignState>;
  return typeof c.seed === 'number' && typeof c.rng === 'number' && Array.isArray(c.unlockedDistricts)
    && Array.isArray(c.completedStoryMissions) && Array.isArray(c.supplyRunPool)
    && typeof c.completedSupplyRuns === 'number' && typeof c.currency === 'number' && typeof c.nextSupplyRunSeq === 'number';
}

/** The saved campaign, or null (nothing saved, storage unavailable, or the data doesn't look like a CampaignState). */
export function loadCampaign(): CampaignState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isCampaignState(parsed)) return null;
    // Repair rather than reject a save from before a feature that added a new top-level field - a safe empty
    // default beats losing an otherwise-valid campaign save over one missing field.
    if (!parsed.base || typeof parsed.base !== 'object') parsed.base = newBaseState(); // base building (6)
    if (!parsed.inventory || typeof parsed.inventory !== 'object') parsed.inventory = newGearInventory(); // equipment (7)
    if (!Array.isArray(parsed.seenIntros)) parsed.seenIntros = [...parsed.unlockedDistricts]; // story briefings: don't re-show for districts already reached
    // Supply runs became template-based, gear became a counted locker, and per-class loadouts/levels/health
    // became a roster of soldiers (13): migrateCampaign does all of it.
    return migrateCampaign(parsed);
  } catch {
    return null;
  }
}

export function saveCampaign(cs: CampaignState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(cs));
    return true;
  } catch {
    return false;
  }
}

export function clearCampaign() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: nothing to clear */
  }
}
