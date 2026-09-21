import { describe, expect, it } from 'vitest';
import { DISTRICT_ORDER, STORY_MISSIONS } from '../data/campaign';
import { availableStoryMissions, completeStoryMission, completeSupplyRun, districtStatus, newCampaign, recordMissionGear } from './campaign';

describe('campaign (feature 5)', () => {
  it('a fresh campaign starts with only the first district unlocked and a full supply-run pool', () => {
    const cs = newCampaign(1);
    expect(cs.unlockedDistricts).toEqual([DISTRICT_ORDER[0]]);
    expect(districtStatus(cs, DISTRICT_ORDER[0])).toBe('available');
    expect(districtStatus(cs, DISTRICT_ORDER[1])).toBe('locked');
    expect(cs.supplyRunPool).toHaveLength(3);
    expect(cs.completedStoryMissions).toEqual([]);
    expect(cs.currency).toBe(0);
  });

  it('supply-run pool generation is deterministic for a given seed, and differs for a different one', () => {
    const a = newCampaign(42);
    const b = newCampaign(42);
    expect(a.supplyRunPool).toEqual(b.supplyRunPool);
    const c = newCampaign(43);
    expect(c.supplyRunPool).not.toEqual(a.supplyRunPool);
  });

  it('story missions are fixed handcrafted content, not generated from the seed', () => {
    // Unlike the supply-run pool, STORY_MISSIONS is static data - the same for every campaign regardless of
    // seed, matching the design goal ("one story mission per act is handcrafted and fixed for that
    // playthrough"). A fresh campaign's *available* story missions are identical across different seeds.
    const a = newCampaign(1);
    const b = newCampaign(999);
    expect(availableStoryMissions(a)).toEqual(availableStoryMissions(b));
  });

  it('only lists available story missions (unlocked district, not yet completed)', () => {
    const cs = newCampaign(1);
    const ids = availableStoryMissions(cs).map((m) => m.id);
    expect(ids).toEqual(['lights-out', 'signal-fire']); // both riverside missions; market-row is still locked
  });

  it('completing every story mission in a district unlocks the next one', () => {
    const cs = newCampaign(1);
    completeStoryMission(cs, 'lights-out');
    expect(districtStatus(cs, 'riverside')).toBe('available'); // one of two done, not yet completed
    expect(cs.unlockedDistricts).not.toContain('market-row');
    completeStoryMission(cs, 'signal-fire');
    expect(districtStatus(cs, 'riverside')).toBe('completed');
    expect(cs.unlockedDistricts).toContain('market-row');
    expect(availableStoryMissions(cs).map((m) => m.id)).toEqual(['supply-run-market-row', 'jackals-den']);
  });

  it('completing every written story mission unlocks the next district in the order and does not crash beyond it', () => {
    // STORY_MISSIONS only covers Act 1 (riverside, market-row) - completing all of it unlocks the next
    // district in line (dockyards, Act 2's first), and stops there since nothing exists yet to complete it.
    const cs = newCampaign(1);
    for (const m of STORY_MISSIONS) completeStoryMission(cs, m.id);
    const marketRowIndex = DISTRICT_ORDER.indexOf('market-row');
    expect(cs.unlockedDistricts).toContain(DISTRICT_ORDER[marketRowIndex + 1]);
    expect(districtStatus(cs, DISTRICT_ORDER[marketRowIndex + 1])).toBe('available'); // unlocked but not "completed" (no missions written for it)
  });

  it('completing a story mission twice is a no-op', () => {
    const cs = newCampaign(1);
    completeStoryMission(cs, 'lights-out');
    completeStoryMission(cs, 'lights-out');
    expect(cs.completedStoryMissions).toEqual(['lights-out']);
  });

  it('completing a supply run banks its reward, retires it, and tops the pool back up to size', () => {
    const cs = newCampaign(1);
    const target = cs.supplyRunPool[0];
    completeSupplyRun(cs, target.id);
    expect(cs.currency).toBe(target.reward);
    expect(cs.completedSupplyRuns).toBe(1);
    expect(cs.supplyRunPool).toHaveLength(3); // still topped up
    expect(cs.supplyRunPool.some((m) => m.id === target.id)).toBe(false); // the completed one is gone
  });

  it('regenerated pool slots never reuse an id within one campaign', () => {
    const cs = newCampaign(1);
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      for (const m of cs.supplyRunPool) seen.add(m.id);
      completeSupplyRun(cs, cs.supplyRunPool[0].id);
    }
    for (const m of cs.supplyRunPool) seen.add(m.id);
    expect(seen.size).toBe(13); // 3 initial + 10 replacements, all distinct
  });

  it('supply-run difficulty escalates with completions (tier scales enemy profile pool)', () => {
    // Untouched pool slots keep whatever tier they were generated at, so only the freshly-regenerated slot
    // (always appended last by fillPool) is guaranteed to reflect the *current* tier - check that one.
    const cs = newCampaign(1);
    for (let i = 0; i < 9; i++) completeSupplyRun(cs, cs.supplyRunPool[0].id); // 9 completions -> tier index 3
    const fresh = cs.supplyRunPool[cs.supplyRunPool.length - 1];
    expect(['hard', 'ambush']).toContain(fresh.enemyProfile); // tier 3's pool is only ever 'hard' or 'ambush'
  });

  describe('recordMissionGear (feature 7)', () => {
    it('a fresh campaign starts with no loadouts and no unlocked gear', () => {
      const cs = newCampaign(1);
      expect(cs.loadouts).toEqual({});
      expect(cs.unlockedGear).toEqual({ armor: [], equipment: [] });
    });

    it('persists a player unit\'s ending loadout by class, and unlocks what it found', () => {
      const cs = newCampaign(1);
      recordMissionGear(cs, [
        { team: 'player', cls: 'soldier', armor: 'heavyPlate', equipment: ['boots', null] },
        { team: 'enemy', cls: 'soldier', armor: 'lightVest', equipment: [null, null] }, // enemy gear never persists
      ]);
      expect(cs.loadouts.soldier).toEqual({ armor: 'heavyPlate', equipment: ['boots', null] });
      expect(cs.unlockedGear.armor).toEqual(['heavyPlate']);
      expect(cs.unlockedGear.equipment).toEqual(['boots']);
    });

    it('overwrites a class\'s loadout on a later mission rather than merging', () => {
      const cs = newCampaign(1);
      recordMissionGear(cs, [{ team: 'player', cls: 'medic', armor: 'lightVest', equipment: [null, null] }]);
      recordMissionGear(cs, [{ team: 'player', cls: 'medic', armor: null, equipment: ['nvg', 'flashlight'] }]);
      expect(cs.loadouts.medic).toEqual({ armor: null, equipment: ['nvg', 'flashlight'] });
      // but the armor found on the first mission stays unlocked even though it's no longer equipped
      expect(cs.unlockedGear.armor).toEqual(['lightVest']);
      expect(cs.unlockedGear.equipment).toEqual(['nvg', 'flashlight']);
    });

    it('never unlocks the same item id twice', () => {
      const cs = newCampaign(1);
      recordMissionGear(cs, [{ team: 'player', cls: 'tank', armor: 'lightVest', equipment: [null, null] }]);
      recordMissionGear(cs, [{ team: 'player', cls: 'sniper', armor: 'lightVest', equipment: [null, null] }]);
      expect(cs.unlockedGear.armor).toEqual(['lightVest']); // not duplicated
    });
  });
});
