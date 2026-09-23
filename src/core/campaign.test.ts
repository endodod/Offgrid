import { describe, expect, it } from 'vitest';
import { DISTRICT_ORDER, STORY_MISSIONS, SUPPLY_RUN_COMPLICATIONS, SUPPLY_RUN_TEMPLATES, supplyRunComplication } from '../data/campaign';
import type { ArmorId } from '../data/armor';
import type { EquipmentId } from '../data/equipment';
import type { ClassId } from '../data/units';
import {
  applyMissionXp, availableStoryMissions, completeStoryMission, completeSupplyRun, districtStatus, newCampaign,
  addGear, equipFromInventory, markIntroSeen, migrateCampaign, moveEquipped, perkSlots, progressFor,
  recordMissionGear, resolveSupplyRun, setPerkSlot, soldierById, stockOf, togglePerk, unequipToInventory, unseenIntros,
  type CampaignState,
} from './campaign';

/** A founder's loadout / progress (13: the five founders use their class id as their soldier id). */
const lo = (cs: CampaignState, id: string) => soldierById(cs, id)!.loadout;
const lv = (cs: CampaignState, id: string) => soldierById(cs, id)!.progress;

/** A minimal EndedUnit for recordMissionGear/applyMissionXp tests - fills in stat defaults not under test. */
const endedUnit = (over: {
  team?: 'player' | 'enemy'; cls: ClassId; armor?: ArmorId | null; equipment?: [EquipmentId | null, EquipmentId | null];
  dmgDealt?: number; kills?: number; revives?: number; alive?: boolean; soldierId?: string;
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
    const riverside = STORY_MISSIONS.filter((m) => m.district === 'riverside').map((m) => m.id);
    expect(ids).toEqual(riverside); // every riverside mission; market-row is still locked
    expect(ids).toHaveLength(5);
  });

  it('completing every story mission in a district unlocks the next one', () => {
    const cs = newCampaign(1);
    const riverside = STORY_MISSIONS.filter((m) => m.district === 'riverside');
    for (const m of riverside.slice(0, -1)) completeStoryMission(cs, m.id);
    expect(districtStatus(cs, 'riverside')).toBe('available'); // four of five done, not yet completed
    expect(cs.unlockedDistricts).not.toContain('market-row');
    completeStoryMission(cs, riverside[riverside.length - 1].id);
    expect(districtStatus(cs, 'riverside')).toBe('completed');
    expect(cs.unlockedDistricts).toContain('market-row');
    expect(availableStoryMissions(cs).map((m) => m.id))
      .toEqual(STORY_MISSIONS.filter((m) => m.district === 'market-row').map((m) => m.id));
  });

  it('gives every district that has missions at all exactly five of them', () => {
    for (const district of new Set(STORY_MISSIONS.map((m) => m.district))) {
      expect.soft(STORY_MISSIONS.filter((m) => m.district === district), district).toHaveLength(5);
    }
  });

  it('shows a briefing once per district, when it unlocks', () => {
    const cs = newCampaign(1);
    expect(unseenIntros(cs)).toEqual(['riverside']); // only the starting district is unlocked
    markIntroSeen(cs, 'riverside');
    expect(unseenIntros(cs)).toEqual([]);
    for (const m of STORY_MISSIONS.filter((x) => x.district === 'riverside')) completeStoryMission(cs, m.id);
    expect(unseenIntros(cs)).toEqual(['market-row']); // the new district's briefing is now pending
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

  describe('gear: recordMissionGear and the locker (feature 7)', () => {
    it('a fresh campaign starts with five bare founders and an empty locker', () => {
      const cs = newCampaign(1);
      expect(cs.roster.map((s) => s.cls).sort()).toEqual(['assault', 'medic', 'sniper', 'soldier', 'tank']);
      for (const sol of cs.roster) expect(sol.loadout).toEqual({ armor: null, equipment: [null, null] });
      expect(cs.inventory).toEqual({ armor: {}, equipment: {} });
    });

    it("persists a player unit's ending loadout on its soldier, and never the enemy's", () => {
      const cs = newCampaign(1);
      recordMissionGear(cs, [
        endedUnit({ cls: 'soldier', armor: 'heavyPlate', equipment: ['boots', null] }),
        endedUnit({ team: 'enemy', cls: 'soldier', armor: 'lightVest' }), // enemy gear never persists
      ]);
      expect(lo(cs, 'soldier')).toEqual({ armor: 'heavyPlate', equipment: ['boots', null] });
      expect(lo(cs, 'sniper')).toEqual({ armor: null, equipment: [null, null] });
      // found on the mission and still worn: on the unit, not in the locker
      expect(stockOf(cs.inventory, 'armor', 'heavyPlate')).toBe(0);
    });

    it('returns a piece to the locker when a class stops carrying it', () => {
      const cs = newCampaign(1);
      recordMissionGear(cs, [endedUnit({ cls: 'medic', armor: 'lightVest' })]);
      recordMissionGear(cs, [endedUnit({ cls: 'medic', equipment: ['nvg', 'flashlight'] })]);
      expect(lo(cs, 'medic')).toEqual({ armor: null, equipment: ['nvg', 'flashlight'] });
      expect(stockOf(cs.inventory, 'armor', 'lightVest')).toBe(1); // back on the shelf, not lost
    });

    it('counts two of the same piece when two missions each find one', () => {
      const cs = newCampaign(1);
      recordMissionGear(cs, [endedUnit({ cls: 'tank', armor: 'lightVest' })]);
      recordMissionGear(cs, [endedUnit({ cls: 'sniper', armor: 'lightVest' })]);
      // both are worn, so neither is in the locker...
      expect(stockOf(cs.inventory, 'armor', 'lightVest')).toBe(0);
      // ...and taking both off leaves two, not one
      unequipToInventory(cs, 'tank', 'armor');
      unequipToInventory(cs, 'sniper', 'armor');
      expect(stockOf(cs.inventory, 'armor', 'lightVest')).toBe(2);
    });

    it('equipping takes from the locker, and displaces whatever was in the slot back into it', () => {
      const cs = newCampaign(1);
      addGear(cs.inventory, 'armor', 'lightVest');
      addGear(cs.inventory, 'armor', 'heavyPlate');
      expect(equipFromInventory(cs, 'soldier', 'armor', 'lightVest')).toBeNull();
      expect(stockOf(cs.inventory, 'armor', 'lightVest')).toBe(0);
      expect(equipFromInventory(cs, 'soldier', 'armor', 'heavyPlate')).toBeNull();
      expect(lo(cs, 'soldier').armor).toBe('heavyPlate');
      expect(stockOf(cs.inventory, 'armor', 'lightVest')).toBe(1); // displaced, not deleted
    });

    it('refuses to equip something the squad does not own, and changes nothing', () => {
      const cs = newCampaign(1);
      expect(equipFromInventory(cs, 'soldier', 'armor', 'heavyPlate')).toBe('Not in the locker');
      expect(lo(cs, 'soldier').armor ?? null).toBeNull();
    });

    it('moves a piece straight from one squadmate to another without leaking a copy', () => {
      const cs = newCampaign(1);
      addGear(cs.inventory, 'equipment', 'boots');
      equipFromInventory(cs, 'assault', 'equip0', 'boots');
      expect(moveEquipped(cs, { cls: 'assault', slot: 'equip0' }, { cls: 'sniper', slot: 'equip1' })).toBeNull();
      expect(lo(cs, 'assault').equipment[0]).toBeNull();
      expect(lo(cs, 'sniper').equipment[1]).toBe('boots');
      expect(stockOf(cs.inventory, 'equipment', 'boots')).toBe(0); // exactly one pair still exists
    });

    it('refuses to put armor in an equipment slot', () => {
      const cs = newCampaign(1);
      addGear(cs.inventory, 'armor', 'lightVest');
      equipFromInventory(cs, 'tank', 'armor', 'lightVest');
      expect(moveEquipped(cs, { cls: 'tank', slot: 'armor' }, { cls: 'tank', slot: 'equip0' })).toBe('Wrong kind of slot');
      expect(lo(cs, 'tank').armor).toBe('lightVest');
    });

    it('converts a save from before the locker existed, minus what is already worn', () => {
      const cs = newCampaign(1);
      // the old shape: a flat "ever found" list, with one of them equipped
      soldierById(cs, 'soldier')!.loadout = { armor: 'heavyPlate', equipment: [null, null] };
      (cs as unknown as { unlockedGear: unknown }).unlockedGear = { armor: ['heavyPlate', 'lightVest'], equipment: ['boots'] };
      cs.inventory = { armor: {}, equipment: {} };
      migrateCampaign(cs);
      expect(stockOf(cs.inventory, 'armor', 'heavyPlate')).toBe(0); // the soldier is wearing it
      expect(stockOf(cs.inventory, 'armor', 'lightVest')).toBe(1);
      expect(stockOf(cs.inventory, 'equipment', 'boots')).toBe(1);
      expect((cs as unknown as { unlockedGear?: unknown }).unlockedGear).toBeUndefined();
    });
  });

  describe('perk slots (feature 8)', () => {
    it('reads equipped perks back as indexed slots, one per unlocked slot', () => {
      const cs = newCampaign(1);
      const progress = progressFor(cs, 'sniper');
      progress.level = 3; // two slots
      progress.perkPool = ['sniperFocus', 'sniperEagleEye'];
      expect(perkSlots(cs, 'sniper')).toEqual([null, null]);
      expect(setPerkSlot(cs, 'sniper', 1, 'sniperFocus')).toBeNull();
      expect(progress.equippedPerks).toEqual(['sniperFocus']); // written back compacted
    });

    it('moves a perk between slots rather than duplicating it', () => {
      const cs = newCampaign(1);
      const progress = progressFor(cs, 'tank');
      progress.level = 5; // three slots
      progress.perkPool = ['tankPlating', 'tankBrace'];
      setPerkSlot(cs, 'tank', 0, 'tankPlating');
      setPerkSlot(cs, 'tank', 1, 'tankBrace');
      setPerkSlot(cs, 'tank', 0, 'tankBrace');
      expect(progress.equippedPerks).toEqual(['tankBrace']);
    });

    it('refuses a perk that is not unlocked, and a slot that is not unlocked', () => {
      const cs = newCampaign(1);
      progressFor(cs, 'medic').perkPool = [];
      expect(setPerkSlot(cs, 'medic', 0, 'medicTriage')).toBe('Not unlocked yet');
      progressFor(cs, 'medic').perkPool = ['medicTriage'];
      expect(setPerkSlot(cs, 'medic', 2, 'medicTriage')).toBe('No open perk slots'); // level 1 has one slot
    });
  });

  describe('applyMissionXp and togglePerk (feature 8)', () => {
    it('a fresh campaign starts every founder at level 1 with no XP', () => {
      const cs = newCampaign(1);
      for (const sol of cs.roster) expect(sol.progress).toMatchObject({ xp: 0, level: 1 });
    });

    it('awards XP from a unit\'s own final stats, only for surviving player units', () => {
      const cs = newCampaign(1);
      applyMissionXp(cs, [
        endedUnit({ cls: 'soldier', dmgDealt: 20, kills: 1 }), // 20*1 + 1*15 + 5 (survived) = 40
        endedUnit({ team: 'enemy', cls: 'soldier', dmgDealt: 999, kills: 99 }), // enemy XP never recorded
      ]);
      expect(lv(cs, 'soldier').xp).toBe(40);
      expect(lv(cs, 'soldier').level).toBe(1); // below the level-2 threshold (100)
    });

    it('levels up and grants exactly 2 perks at a significant level', () => {
      const cs = newCampaign(1);
      applyMissionXp(cs, [endedUnit({ cls: 'sniper', dmgDealt: 100 })]); // 100 + 5 = 105 xp -> level 2
      expect(lv(cs, 'sniper').level).toBe(2);
      expect(lv(cs, 'sniper').perkPool).toHaveLength(2);
      expect(lv(cs, 'sniper').equippedPerks).toEqual([]); // granted, not auto-equipped
    });

    it('XP accumulates across missions rather than resetting each time', () => {
      const cs = newCampaign(1);
      applyMissionXp(cs, [endedUnit({ cls: 'tank', dmgDealt: 50 })]); // 55 xp
      applyMissionXp(cs, [endedUnit({ cls: 'tank', dmgDealt: 50 })]); // +55 = 110 xp -> level 2
      expect(lv(cs, 'tank').xp).toBe(110);
      expect(lv(cs, 'tank').level).toBe(2);
    });

    it('the dead earn no XP (13: they leave the roster in afterMission instead)', () => {
      const cs = newCampaign(1);
      applyMissionXp(cs, [endedUnit({ cls: 'medic', dmgDealt: 100, alive: false })]);
      expect(lv(cs, 'medic').xp).toBe(0);
    });

    it('two soldiers of the same class level separately', () => {
      const cs = newCampaign(1);
      cs.roster.push({ ...cs.roster.find((x) => x.id === 'sniper')!, id: 'r9', name: 'Second Sniper', progress: { xp: 0, level: 1, perkPool: [], equippedPerks: [] } });
      applyMissionXp(cs, [endedUnit({ cls: 'sniper', soldierId: 'r9', dmgDealt: 100 })]);
      expect(lv(cs, 'r9').level).toBe(2);
      expect(lv(cs, 'sniper').level).toBe(1);
    });

    it('togglePerk respects the slot cap and refuses a locked perk', () => {
      const cs = newCampaign(1);
      applyMissionXp(cs, [endedUnit({ cls: 'assault', dmgDealt: 100 })]); // level 2, 1 slot (from level 1), 2 unlocked perks
      const [a, b] = lv(cs, 'assault').perkPool;
      expect(togglePerk(cs, 'assault', a)).toBeNull();
      expect(togglePerk(cs, 'assault', b)).toBe('No open perk slots'); // only 1 slot until level 3
      expect(togglePerk(cs, 'assault', 'tankPlating')).toBe('Not unlocked yet'); // a different class's perk
    });
  });
});
