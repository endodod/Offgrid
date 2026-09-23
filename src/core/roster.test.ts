import { describe, expect, it } from 'vitest';
import { RECIPES } from '../data/crafting';
import { STORY_MISSIONS } from '../data/campaign';
import { CLASSES, type ClassId } from '../data/units';
import { buildLevel, lockerCapacity, rosterCapacity } from './base';
import {
  addGear, completeStoryMission, completeSupplyRun, migrateCampaign, moveEquipped, newCampaign, onMission, poolSize,
  recordMissionGear, soldierById, unequipToInventory, upgradeFacility, type CampaignState,
} from './campaign';
import { craft, craftBlocker, lockerCount, scrap, scrapValue, trimLocker } from './crafting';
import { admit, afterMission, endMission, RETREAT_FEE, defaultSquad, deploySquad, dismiss, hire, hireCost, maxHp, soldierHp, soldierStatus } from './roster';
import { createGame } from './state';

const ended = (cls: ClassId, hp: number, extra: Partial<{ alive: boolean; downed: boolean; soldierId: string }> = {}) =>
  ({ team: 'player' as const, cls, hp, alive: true, downed: false, ...extra });

/** An ended unit with the gear/stat fields endMission also reads. */
const gear = <T extends object>(u: T) => ({ ...u, armor: null, equipment: [null, null] as [null, null], dmgDealt: 0, kills: 0, revives: 0 });

const build = (cs: CampaignState, id: Parameters<typeof buildLevel>[1], n = 1) => { for (let i = 0; i < n; i++) buildLevel(cs.base, id); };
const sol = (cs: CampaignState, id: string) => soldierById(cs, id)!;
const hp = (cs: CampaignState, id: string) => soldierHp(sol(cs, id));

describe('roster (11, 13): health between missions', () => {
  it('a fresh campaign has five founders at full HP, and candidates to hire', () => {
    const cs = newCampaign(1);
    expect(cs.roster).toHaveLength(5);
    for (const s of cs.roster) {
      expect(soldierHp(s)).toBe(maxHp(s.cls));
      expect(soldierStatus(cs, s)).toBe('ready');
      expect(s.name).toMatch(/\w+ \w+/);
    }
    expect(cs.recruits.length).toBeGreaterThan(0);
  });

  it('deployed survivors keep their wounds, patched up a little; the benched rest', () => {
    const cs = newCampaign(1);
    sol(cs, 'sniper').hp = 2; // benched, wounded from before
    afterMission(cs, [ended('medic', 4)]);
    expect(hp(cs, 'medic')).toBe(4 + Math.max(1, Math.round(maxHp('medic') * 0.1)));
    expect(hp(cs, 'sniper')).toBe(2 + Math.max(1, Math.round(maxHp('sniper') * 0.2)));
    expect(soldierStatus(cs, sol(cs, 'medic'))).toBe('wounded');
  });

  it('a downed survivor comes home on 1 HP; the fallen are gone for good', () => {
    const cs = newCampaign(1);
    const r = afterMission(cs, [ended('tank', 0, { downed: true }), ended('assault', 0, { alive: false })]);
    expect(hp(cs, 'tank')).toBe(1 + Math.max(1, Math.round(maxHp('tank') * 0.1)));
    expect(soldierById(cs, 'assault')).toBeUndefined();
    expect(r.lines.join(' ')).toMatch(/killed in action/);
  });

  it('a loss is time passing too: wounds carry, the benched rest, candidates refresh', () => {
    const cs = newCampaign(1);
    const before = cs.recruits.map((r) => r.id).join();
    sol(cs, 'sniper').hp = 2;
    const lines = endMission(cs, STORY_MISSIONS[0].id, [gear(ended('medic', 3))], 'lost');
    expect(hp(cs, 'sniper')).toBeGreaterThan(2);
    expect(hp(cs, 'medic')).toBeGreaterThan(3);
    expect(cs.recruits.map((x) => x.id).join()).not.toBe(before);
    expect(cs.completedStoryMissions).toEqual([]);
    expect(lines[0]).toMatch(/failed/);
  });

  it('gear on the fallen is recovered on a win and lost on a loss', () => {
    const win = newCampaign(1);
    recordMissionGear(win, [{ ...ended('tank', 0, { alive: false }), armor: 'heavyPlate', equipment: [null, null], dmgDealt: 0, kills: 0, revives: 0 }], true);
    expect(win.inventory.armor.heavyPlate).toBe(1);
    const loss = newCampaign(1);
    recordMissionGear(loss, [{ ...ended('tank', 0, { alive: false }), armor: 'heavyPlate', equipment: [null, null], dmgDealt: 0, kills: 0, revives: 0 }], false);
    expect(loss.inventory.armor.heavyPlate).toBeUndefined();
  });

  it('volunteers step up if the whole roster falls', () => {
    const cs = newCampaign(1);
    afterMission(cs, cs.roster.map((s) => ended(s.cls, 0, { alive: false, soldierId: s.id })));
    expect(cs.roster.length).toBe(2);
  });

  it('the infirmary needs building, has limited beds, and heals a lot', () => {
    const cs = newCampaign(1);
    sol(cs, 'soldier').hp = 1;
    sol(cs, 'medic').hp = 1;
    expect(admit(cs, 'soldier')).toMatch(/infirmary/);
    build(cs, 'infirmary');
    expect(admit(cs, 'soldier')).toBeNull();
    expect(admit(cs, 'medic')).toMatch(/bed/);
    expect(admit(cs, 'sniper')).toMatch(/wounded/i);
    expect(defaultSquad(cs, 5)).not.toContain('soldier');
    afterMission(cs, [ended('sniper', maxHp('sniper'))]);
    expect(hp(cs, 'soldier')).toBe(Math.min(maxHp('soldier'), 1 + Math.round(maxHp('soldier') * 0.6)));
  });

  it('a full heal in the infirmary discharges the patient', () => {
    const cs = newCampaign(1);
    build(cs, 'infirmary', 3);
    sol(cs, 'soldier').hp = 1;
    admit(cs, 'soldier');
    const r = afterMission(cs, [ended('sniper', maxHp('sniper'))]);
    expect(hp(cs, 'soldier')).toBe(maxHp('soldier'));
    expect(cs.infirmary).toEqual([]);
    expect(r.lines.join(' ')).toMatch(/discharged/);
  });

  it('the training room gives XP only to the benched', () => {
    const cs = newCampaign(1);
    build(cs, 'trainingRoom');
    afterMission(cs, [ended('medic', maxHp('medic'))]);
    expect(sol(cs, 'sniper').progress.xp).toBe(15);
    expect(sol(cs, 'medic').progress.xp).toBe(0);
  });
});

describe('ending a campaign mission (14)', () => {
  it('a win completes the mission, pays out and queues the debrief', () => {
    const cs = newCampaign(1);
    endMission(cs, STORY_MISSIONS[0].id, [gear(ended('medic', 9))], 'won');
    expect(cs.completedStoryMissions).toEqual([STORY_MISSIONS[0].id]);
    expect(cs.parts).toBe(4);
    expect(cs.inbox?.debrief).toBe(STORY_MISSIONS[0].id);
  });

  it('a retreat costs the evacuation fee (never below zero) and pays nothing', () => {
    const cs = newCampaign(1);
    cs.currency = 100;
    const lines = endMission(cs, STORY_MISSIONS[0].id, [gear(ended('medic', 9))], 'retreat');
    expect(cs.currency).toBe(100 - RETREAT_FEE);
    expect(cs.parts).toBe(0);
    expect(lines.join(' ')).toMatch(/retreated/);
    cs.currency = 10;
    endMission(cs, STORY_MISSIONS[0].id, [gear(ended('medic', 9))], 'retreat');
    expect(cs.currency).toBe(0);
  });

  it('a lost or abandoned supply run leaves the board without advancing the tier', () => {
    const cs = newCampaign(1);
    const run = cs.supplyRunPool[0];
    endMission(cs, run.id, [gear(ended('medic', 9))], 'lost');
    expect(cs.supplyRunPool.some((m) => m.id === run.id)).toBe(false);
    expect(cs.supplyRunPool).toHaveLength(3);
    expect(cs.completedSupplyRuns).toBe(0);
  });

  it('never scraps the locker on its own; it reports the overflow instead', () => {
    const cs = newCampaign(1);
    addGear(cs.inventory, 'armor', 'lightVest', 9);
    const lines = endMission(cs, STORY_MISSIONS[0].id, [gear(ended('medic', 9))], 'won');
    expect(lockerCount(cs.inventory)).toBe(9);
    expect(lines.join(' ')).toMatch(/over capacity/);
  });
});

describe('soldiers away on a mission (14)', () => {
  it('are locked: no re-equipping, dismissing or admitting until the mission ends', () => {
    const cs = newCampaign(1);
    build(cs, 'infirmary');
    sol(cs, 'tank').loadout.armor = 'heavyPlate';
    sol(cs, 'tank').hp = 3;
    deploySquad(cs, STORY_MISSIONS[0].map, ['tank']);
    expect(onMission(cs, 'tank')).toBe(true);
    unequipToInventory(cs, 'tank', 'armor');
    expect(sol(cs, 'tank').loadout.armor).toBe('heavyPlate'); // not moved: the mission still has it
    expect(moveEquipped(cs, { cls: 'tank', slot: 'armor' }, { cls: 'medic', slot: 'armor' })).toMatch(/mission/);
    expect(dismiss(cs, 'tank')).toMatch(/mission/);
    expect(admit(cs, 'tank')).toMatch(/mission/);
    endMission(cs, STORY_MISSIONS[0].id, [{ ...gear(ended('tank', 3)), armor: 'heavyPlate' as const }], 'won');
    expect(onMission(cs, 'tank')).toBe(false);
    expect(cs.inventory.armor.heavyPlate).toBeUndefined(); // exactly one plate still exists, on the tank
    expect(sol(cs, 'tank').loadout.armor).toBe('heavyPlate');
  });
});

describe('squad selection (13)', () => {
  it('any soldiers take the spawn tiles in pick order, with their own class, HP and gear', () => {
    const cs = newCampaign(1);
    cs.currency = 1000;
    const r = cs.recruits[0];
    expect(hire(cs, r.id)).toBeNull();
    sol(cs, 'medic').hp = 3;
    sol(cs, r.id).loadout.armor = 'lightVest';
    const map = deploySquad(cs, STORY_MISSIONS[0].map, [r.id, 'medic', 'sniper']);
    const s = createGame(map, 1);
    const players = s.units.filter((u) => u.team === 'player');
    expect(players.map((u) => u.soldierId)).toEqual([r.id, 'medic', 'sniper']);
    expect(players[0].cls).toBe(r.cls);
    expect(players[0].armor).toBe('lightVest');
    expect(players[0].name).toBe(r.name);
    expect(players[1].hp).toBe(3);
    expect(players[2].hp).toBe(CLASSES.sniper.hp);
    const spawn = STORY_MISSIONS[0].map.spawns.player[0];
    expect([players[0].x, players[0].y]).toEqual([spawn[1], spawn[2]]);
  });

  it('two soldiers of one class deploy side by side', () => {
    const cs = newCampaign(1);
    cs.roster.push({ ...sol(cs, 'sniper'), id: 'r99', name: 'Twin Sniper' });
    const s = createGame(deploySquad(cs, STORY_MISSIONS[0].map, ['sniper', 'r99']), 1);
    expect(s.units.filter((u) => u.team === 'player').map((u) => u.cls)).toEqual(['sniper', 'sniper']);
  });

  it('never deploys more soldiers than the map has spawn tiles', () => {
    const cs = newCampaign(1);
    for (let i = 0; i < 3; i++) cs.roster.push({ ...sol(cs, 'tank'), id: `x${i}`, name: `Extra ${i}` });
    expect(defaultSquad(cs, 5)).toHaveLength(5);
    const map = deploySquad(cs, STORY_MISSIONS[0].map, cs.roster.map((s) => s.id));
    expect(map.squad).toHaveLength(STORY_MISSIONS[0].map.spawns.player.length);
  });
});

describe('recruitment (13)', () => {
  it('hiring costs salvage, needs room, and moves the candidate onto the roster', () => {
    const cs = newCampaign(1);
    const r = cs.recruits[0];
    expect(hire(cs, r.id)).toMatch(/salvage/);
    cs.currency = 1000;
    expect(hire(cs, r.id)).toBeNull();
    expect(cs.currency).toBe(1000 - hireCost(r));
    expect(soldierById(cs, r.id)).toBeDefined();
    while (cs.roster.length < rosterCapacity(cs.base)) cs.roster.push({ ...r, id: `f${cs.roster.length}` });
    expect(hire(cs, cs.recruits[0].id)).toMatch(/full/);
  });

  it('the recruitment office offers more, and more experienced, candidates', () => {
    const cs = newCampaign(1);
    expect(cs.recruits).toHaveLength(2);
    cs.currency = 10000;
    upgradeFacility(cs, 'recruitment');
    upgradeFacility(cs, 'recruitment');
    expect(cs.recruits).toHaveLength(4);
    for (const r of cs.recruits) expect(r.progress.level).toBe(2);
  });

  it('dismissing returns gear to the locker, and the last soldier stays', () => {
    const cs = newCampaign(1);
    sol(cs, 'tank').loadout.armor = 'heavyPlate';
    expect(dismiss(cs, 'tank')).toBeNull();
    expect(cs.inventory.armor.heavyPlate).toBe(1);
    cs.roster = cs.roster.slice(0, 1);
    expect(dismiss(cs, cs.roster[0].id)).toMatch(/at least one/);
  });

  it('an old per-class save becomes five founders with their class data', () => {
    const cs = newCampaign(1) as unknown as Record<string, unknown>;
    delete cs.roster; delete cs.recruits; cs.nextSoldierSeq = 0;
    cs.loadouts = { tank: { armor: 'lightVest', equipment: [null, null] } };
    cs.levels = { sniper: { xp: 120, level: 2, perkPool: [], equippedPerks: [] } };
    cs.health = { medic: 4 };
    const m = migrateCampaign(cs as unknown as CampaignState);
    expect(sol(m, 'tank').loadout.armor).toBe('lightVest');
    expect(sol(m, 'sniper').progress.level).toBe(2);
    expect(hp(m, 'medic')).toBe(4);
    expect(m.recruits.length).toBeGreaterThan(0);
    expect((m as unknown as Record<string, unknown>).loadouts).toBeUndefined();
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
    const gone = trimLocker(cs);
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
    delete cs.parts; delete cs.infirmary;
    const m = migrateCampaign(cs as CampaignState);
    expect(m.parts).toBe(0);
    expect(m.infirmary).toEqual([]);
  });

  it('med pouch and bandolier change starting supplies', () => {
    const cs = newCampaign(1);
    const plain = createGame(deploySquad(cs, STORY_MISSIONS[0].map, ['medic']), 1).units.find((u) => u.cls === 'medic')!;
    sol(cs, 'medic').loadout.equipment = ['medPouch', 'bandolier'];
    const kitted = createGame(deploySquad(cs, STORY_MISSIONS[0].map, ['medic']), 1).units.find((u) => u.cls === 'medic')!;
    expect(kitted.medkits).toBe(plain.medkits + 1);
    expect(kitted.reserve).toBeGreaterThan(plain.reserve);
  });
});

describe('debug helpers (17)', () => {
  it('set HP clamps to 1..max, and full clears the carried-over value', async () => {
    const { debugSetHp } = await import('./roster');
    const cs = newCampaign(1);
    debugSetHp(cs, 'tank', 5);
    expect(hp(cs, 'tank')).toBe(5);
    debugSetHp(cs, 'tank', 0);
    expect(hp(cs, 'tank')).toBe(1);
    debugSetHp(cs, 'tank', 999);
    expect(sol(cs, 'tank').hp).toBeUndefined();
  });

  it('level up gives exactly the XP to the next threshold, perks included', async () => {
    const { debugGiveXp } = await import('./roster');
    const cs = newCampaign(1);
    debugGiveXp(cs, 'sniper', 'level');
    expect(sol(cs, 'sniper').progress.level).toBe(2);
    expect(sol(cs, 'sniper').progress.perkPool).toHaveLength(2);
    debugGiveXp(cs, 'sniper', 50);
    expect(sol(cs, 'sniper').progress.xp).toBe(150);
  });
});
