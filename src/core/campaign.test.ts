import { describe, expect, it } from 'vitest';
import { DISTRICT_ORDER, STORY_MISSIONS, SUPPLY_RUN_COMPLICATIONS, SUPPLY_RUN_TEMPLATES, supplyRunComplication } from '../data/campaign';
import type { ArmorId } from '../data/armor';
import type { EquipmentId } from '../data/equipment';
import type { ClassId } from '../data/units';
import {
  applyMissionXp, availableStoryMissions, completeStoryMission, completeSupplyRun, districtStatus, newCampaign,
  migrateCampaign, recordMissionGear, resolveSupplyRun, togglePerk,
} from './campaign';

/** A minimal EndedUnit for recordMissionGear/applyMissionXp tests - fills in stat defaults not under test. */
const endedUnit = (over: {
  team?: 'player' | 'enemy'; cls: ClassId; armor?: ArmorId | null; equipment?: [EquipmentId | null, EquipmentId | null];
  dmgDealt?: number; kills?: number; revives?: number; alive?: boolean;
}) => ({
  team: 'player' as const, armor: null, equipment: [null, null] as [EquipmentId | null, EquipmentId | null],
  dmgDealt: 0, kills: 0, revives: 0, alive: true, ...over,
});

const supplyRunTemplateExists = (id: string) => SUPPLY_RUN_TEMPLATES.some((t) => t.id === id);

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

  it('offers three different layouts at once rather than the same place three times', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const cs = newCampaign(seed);
      const templates = cs.supplyRunPool.map((m) => m.templateId);
      expect.soft(new Set(templates).size, `seed ${seed} pool: ${templates.join(', ')}`).toBe(3);
    }
  });

  it('rolls a real template and complication onto every generated run', () => {
    const cs = newCampaign(7);
    for (const m of cs.supplyRunPool) {
      expect(SUPPLY_RUN_TEMPLATES.some((t) => t.id === m.templateId)).toBe(true);
      expect(SUPPLY_RUN_COMPLICATIONS.some((c) => c.id === m.complicationId)).toBe(true);
      expect(m.name).toContain(':');
      expect(m.reward).toBeGreaterThan(0);
    }
  });

  it('varies map, weather and objective across a long run of generated missions', () => {
    const cs = newCampaign(3);
    const templates = new Set<string>();
    const complications = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const m = cs.supplyRunPool[0];
      templates.add(m.templateId);
      complications.add(m.complicationId);
      completeSupplyRun(cs, m.id);
    }
    expect(templates.size).toBe(SUPPLY_RUN_TEMPLATES.length); // every layout shows up
    expect(complications.size).toBeGreaterThanOrEqual(4);
  });

  it('resolves a generated run to its template map with the rolled conditions layered on', () => {
    const cs = newCampaign(11);
    for (const m of cs.supplyRunPool) {
      const template = SUPPLY_RUN_TEMPLATES.find((t) => t.id === m.templateId)!;
      const map = resolveSupplyRun(m);
      expect(map.rows).toBe(template.map.rows); // same layout, not a copy that could drift
      expect(map.enemyProfile).toBe(m.enemyProfile);
      const complication = supplyRunComplication(m.complicationId)!;
      if (complication.weather) expect(map.startWeather).toBe(complication.weather);
      if (complication.timeOfDay) expect(map.startTimeOfDay).toBe(complication.timeOfDay);
      if (complication.reserveMult) expect(map.reserveMult).toBe(complication.reserveMult);
      // a complication that sets nothing leaves the template's own house weather alone
      if (!complication.weather) expect(map.startWeather).toBe(template.map.startWeather);
    }
  });

  it('re-rolls pool entries saved before supply runs were template-based', () => {
    const cs = newCampaign(5);
    // what an old save looks like: a name and a profile, no templateId
    cs.supplyRunPool = [{ id: 'supply-run-old', name: 'Salvage Run', blurb: '', enemyProfile: 'easy', reward: 120 } as never];
    migrateCampaign(cs);
    expect(cs.supplyRunPool).toHaveLength(3);
    expect(cs.supplyRunPool.every((m) => !!supplyRunTemplateExists(m.templateId))).toBe(true);
    expect(cs.supplyRunPool.some((m) => m.id === 'supply-run-old')).toBe(false);
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
        endedUnit({ cls: 'soldier', armor: 'heavyPlate', equipment: ['boots', null] }),
        endedUnit({ team: 'enemy', cls: 'soldier', armor: 'lightVest' }), // enemy gear never persists
      ]);
      expect(cs.loadouts.soldier).toEqual({ armor: 'heavyPlate', equipment: ['boots', null] });
      expect(cs.unlockedGear.armor).toEqual(['heavyPlate']);
      expect(cs.unlockedGear.equipment).toEqual(['boots']);
    });

    it('overwrites a class\'s loadout on a later mission rather than merging', () => {
      const cs = newCampaign(1);
      recordMissionGear(cs, [endedUnit({ cls: 'medic', armor: 'lightVest' })]);
      recordMissionGear(cs, [endedUnit({ cls: 'medic', equipment: ['nvg', 'flashlight'] })]);
      expect(cs.loadouts.medic).toEqual({ armor: null, equipment: ['nvg', 'flashlight'] });
      // but the armor found on the first mission stays unlocked even though it's no longer equipped
      expect(cs.unlockedGear.armor).toEqual(['lightVest']);
      expect(cs.unlockedGear.equipment).toEqual(['nvg', 'flashlight']);
    });

    it('never unlocks the same item id twice', () => {
      const cs = newCampaign(1);
      recordMissionGear(cs, [endedUnit({ cls: 'tank', armor: 'lightVest' })]);
      recordMissionGear(cs, [endedUnit({ cls: 'sniper', armor: 'lightVest' })]);
      expect(cs.unlockedGear.armor).toEqual(['lightVest']); // not duplicated
    });
  });

  describe('applyMissionXp and togglePerk (feature 8)', () => {
    it('a fresh campaign has no per-class progress', () => {
      const cs = newCampaign(1);
      expect(cs.levels).toEqual({});
    });

    it('awards XP from a unit\'s own final stats, only for surviving player units', () => {
      const cs = newCampaign(1);
      applyMissionXp(cs, [
        endedUnit({ cls: 'soldier', dmgDealt: 20, kills: 1 }), // 20*1 + 1*15 + 5 (survived) = 40
        endedUnit({ team: 'enemy', cls: 'soldier', dmgDealt: 999, kills: 99 }), // enemy XP never recorded
      ]);
      expect(cs.levels.soldier?.xp).toBe(40);
      expect(cs.levels.soldier?.level).toBe(1); // below the level-2 threshold (100)
    });

    it('levels up and grants exactly 2 perks at a significant level', () => {
      const cs = newCampaign(1);
      applyMissionXp(cs, [endedUnit({ cls: 'sniper', dmgDealt: 100 })]); // 100 + 5 = 105 xp -> level 2
      expect(cs.levels.sniper?.level).toBe(2);
      expect(cs.levels.sniper?.perkPool).toHaveLength(2);
      expect(cs.levels.sniper?.equippedPerks).toEqual([]); // granted, not auto-equipped
    });

    it('XP accumulates across missions rather than resetting each time', () => {
      const cs = newCampaign(1);
      applyMissionXp(cs, [endedUnit({ cls: 'tank', dmgDealt: 50 })]); // 55 xp
      applyMissionXp(cs, [endedUnit({ cls: 'tank', dmgDealt: 50 })]); // +55 = 110 xp -> level 2
      expect(cs.levels.tank?.xp).toBe(110);
      expect(cs.levels.tank?.level).toBe(2);
    });

    it('permadeath resets XP/level/equipped perks but keeps the unlocked pool (institutional knowledge)', () => {
      const cs = newCampaign(1);
      applyMissionXp(cs, [endedUnit({ cls: 'medic', dmgDealt: 100 })]); // -> level 2, 2 perks unlocked
      const unlockedId = cs.levels.medic!.perkPool[0];
      expect(togglePerk(cs, 'medic', unlockedId)).toBeNull(); // equip it
      expect(cs.levels.medic?.equippedPerks).toContain(unlockedId);

      applyMissionXp(cs, [endedUnit({ cls: 'medic', alive: false })]); // died for good this time
      expect(cs.levels.medic?.xp).toBe(0);
      expect(cs.levels.medic?.level).toBe(1);
      expect(cs.levels.medic?.equippedPerks).toEqual([]);
      expect(cs.levels.medic?.perkPool).toContain(unlockedId); // still unlocked, just not equipped
    });

    it('togglePerk respects the slot cap and refuses a locked perk', () => {
      const cs = newCampaign(1);
      applyMissionXp(cs, [endedUnit({ cls: 'assault', dmgDealt: 100 })]); // level 2, 1 slot (from level 1), 2 unlocked perks
      const [a, b] = cs.levels.assault!.perkPool;
      expect(togglePerk(cs, 'assault', a)).toBeNull();
      expect(togglePerk(cs, 'assault', b)).toBe('No open perk slots'); // only 1 slot until level 3
      expect(togglePerk(cs, 'assault', 'tankPlating')).toBe('Not unlocked yet'); // a different class's perk
    });
  });
});
