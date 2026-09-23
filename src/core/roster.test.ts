import { describe, expect, it } from 'vitest';
import { RECIPES } from '../data/crafting';
import { STORY_MISSIONS } from '../data/campaign';
import { CLASSES, type ClassId } from '../data/units';
import { buildLevel, lockerCapacity } from './base';
import { addGear, completeStoryMission, completeSupplyRun, migrateCampaign, newCampaign, poolSize, upgradeFacility, type CampaignState } from './campaign';
import { craft, craftBlocker, lockerCount, scrap, scrapValue, trimLocker } from './crafting';
import { admit, afterMission, currentHp, defaultSquad, deploySquad, maxHp, soldierStatus } from './roster';
import { createGame } from './state';

const ended = (cls: ClassId, hp: number, extra: Partial<{ alive: boolean; downed: boolean }> = {}) =>
  ({ team: 'player' as const, cls, hp, alive: true, downed: false, ...extra });

const build = (cs: CampaignState, id: Parameters<typeof buildLevel>[1], n = 1) => { for (let i = 0; i < n; i++) buildLevel(cs.base, id); };

describe('roster (11): health between missions', () => {
  it('a fresh campaign has everyone at full HP and ready', () => {
    const cs = newCampaign(1);
    for (const c of ['sniper', 'medic'] as const) {
      expect(currentHp(cs, c)).toBe(maxHp(c));
      expect(soldierStatus(cs, c)).toBe('ready');
    }
  });

  it('deployed survivors keep their wounds, patched up a little; the benched rest', () => {
    const cs = newCampaign(1);
    cs.health.sniper = 2; // benched, wounded from before
    afterMission(cs, [ended('medic', 4)]);
    const medicMax = maxHp('medic');
    // field patch-up = half the rest rate (20% unbuilt) = 10% of max, at least 1
    expect(currentHp(cs, 'medic')).toBe(4 + Math.max(1, Math.round(medicMax * 0.1)));
    expect(currentHp(cs, 'sniper')).toBe(2 + Math.max(1, Math.round(maxHp('sniper') * 0.2)));
    expect(soldierStatus(cs, 'medic')).toBe('wounded');
  });

  it('a downed survivor comes home on 1 HP, the fallen are replaced at full strength', () => {
    const cs = newCampaign(1);
    afterMission(cs, [ended('tank', 0, { downed: true }), ended('assault', 0, { alive: false })]);
    expect(currentHp(cs, 'tank')).toBe(1 + Math.max(1, Math.round(maxHp('tank') * 0.1)));
    expect(currentHp(cs, 'assault')).toBe(maxHp('assault'));
  });

  it('the infirmary needs building, has limited beds, and heals a lot', () => {
    const cs = newCampaign(1);
    cs.health.soldier = 1;
    cs.health.medic = 1;
    expect(admit(cs, 'soldier')).toMatch(/infirmary/);
    build(cs, 'infirmary');
    expect(admit(cs, 'soldier')).toBeNull();
    expect(admit(cs, 'medic')).toMatch(/bed/);
    expect(admit(cs, 'sniper')).toMatch(/wounded/i); // full HP
    expect(defaultSquad(cs)).not.toContain('soldier');
    afterMission(cs, [ended('sniper', maxHp('sniper'))]);
    expect(currentHp(cs, 'soldier')).toBe(Math.min(maxHp('soldier'), 1 + Math.round(maxHp('soldier') * 0.6)));
  });

  it('a full heal in the infirmary discharges the patient', () => {
    const cs = newCampaign(1);
    build(cs, 'infirmary', 3);
    cs.health.soldier = 1;
    admit(cs, 'soldier');
    const r = afterMission(cs, [ended('sniper', maxHp('sniper'))]);
    expect(currentHp(cs, 'soldier')).toBe(maxHp('soldier'));
    expect(cs.infirmary).toEqual([]);
    expect(r.lines.join(' ')).toMatch(/discharged/);
  });

  it('deploySquad drops unchosen spawns, carries HP into the mission and empties their beds', () => {
    const cs = newCampaign(1);
    build(cs, 'infirmary');
    cs.health.medic = 3;
    admit(cs, 'medic');
    const map = deploySquad(cs, STORY_MISSIONS[0].map, ['medic', 'sniper']);
    expect(map.spawns.player.map((s) => s[0]).sort()).toEqual(['medic', 'sniper']);
    expect(cs.infirmary).toEqual([]);
    const s = createGame(map, 1);
    const players = s.units.filter((u) => u.team === 'player');
    expect(players).toHaveLength(2);
    expect(players.find((u) => u.cls === 'medic')!.hp).toBe(3);
    expect(players.find((u) => u.cls === 'sniper')!.hp).toBe(CLASSES.sniper.hp);
  });

  it('the training room gives XP only to the benched', () => {
    const cs = newCampaign(1);
    build(cs, 'trainingRoom');
    afterMission(cs, [ended('medic', maxHp('medic'))]);
    expect(cs.levels.sniper?.xp).toBe(15);
    expect(cs.levels.medic?.xp ?? 0).toBe(0);
  });
});

describe('fabricator and locker (11)', () => {
  it('crafting needs the fabricator tier, parts and locker room', () => {
    const cs = newCampaign(1);
    const boots = RECIPES.find((r) => r.id === 'boots')!;
    const heavy = RECIPES.find((r) => r.id === 'heavyPlate')!;
    expect(craftBlocker(cs, boots)).toMatch(/fabricator/i);
    build(cs, 'fabricator');
    expect(craftBlocker(cs, boots)).toMatch(/parts/);
    cs.parts = 100;
    expect(craft(cs, boots)).toBeNull();
    expect(cs.parts).toBe(100 - boots.parts);
    expect(cs.inventory.equipment.boots).toBe(1);
    expect(craftBlocker(cs, heavy)).toMatch(/level 3/);
    addGear(cs.inventory, 'armor', 'lightVest', lockerCapacity(cs.base) - lockerCount(cs.inventory));
    expect(craftBlocker(cs, boots)).toMatch(/full/);
  });

  it('scrapping returns half the recipe, so crafting never loops for profit', () => {
    for (const r of RECIPES) expect(scrapValue(r.kind, r.id)).toBeLessThan(r.parts);
    const cs = newCampaign(1);
    addGear(cs.inventory, 'equipment', 'nvg');
    expect(scrap(cs, 'equipment', 'nvg')).toBeNull();
    expect(cs.parts).toBe(4);
    expect(scrap(cs, 'equipment', 'nvg')).toMatch(/locker/);
  });

  it('an over-full locker scraps duplicates first after a mission', () => {
    const cs = newCampaign(1);
    addGear(cs.inventory, 'armor', 'lightVest', 5);
    addGear(cs.inventory, 'equipment', 'nvg', 1);
    addGear(cs.inventory, 'equipment', 'boots', 2);
    const gone = trimLocker(cs); // 8 pieces, capacity 6
    expect(gone.map((g) => g.id)).toEqual(['lightVest', 'lightVest']);
    expect(lockerCount(cs.inventory)).toBe(6);
    expect(cs.inventory.equipment.nvg).toBe(1);
  });
});

describe('campaign economy (11)', () => {
  it('missions pay parts; the war room adds offers immediately', () => {
    const cs = newCampaign(1);
    completeStoryMission(cs, STORY_MISSIONS[0].id);
    expect(cs.parts).toBe(4);
    const run = cs.supplyRunPool[0];
    completeSupplyRun(cs, run.id);
    expect(cs.parts).toBe(4 + 2 + run.tier);
    expect(cs.supplyRunPool).toHaveLength(3);
    cs.currency = 1000;
    expect(upgradeFacility(cs, 'warRoom')).toBeNull();
    expect(poolSize(cs)).toBe(4);
    expect(cs.supplyRunPool).toHaveLength(4);
  });

  it('an older save gains the new fields on migration', () => {
    const cs = newCampaign(1) as Partial<CampaignState>;
    delete cs.parts; delete cs.health; delete cs.infirmary;
    const m = migrateCampaign(cs as CampaignState);
    expect(m.parts).toBe(0);
    expect(m.health).toEqual({});
    expect(m.infirmary).toEqual([]);
  });

  it('med pouch and bandolier change starting supplies', () => {
    const base = STORY_MISSIONS[0].map;
    const plain = createGame(base, 1).units.find((u) => u.cls === 'medic')!;
    const kitted = createGame({ ...base, startingLoadouts: { medic: { armor: null, equipment: ['medPouch', 'bandolier'] } } }, 1).units.find((u) => u.cls === 'medic')!;
    expect(kitted.medkits).toBe(plain.medkits + 1);
    expect(kitted.reserve).toBeGreaterThan(plain.reserve);
  });
});
