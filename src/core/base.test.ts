import { describe, expect, it } from 'vitest';
import { FACILITIES } from '../data/base';
import { buildLevel, facilityEffect, facilityLevel, newBaseState, upgradeCost, baseGameOptions } from './base';
import { newCampaign, upgradeFacility } from './campaign';
import { blank, makeGame, unit } from './testkit';

describe('base building (feature 6)', () => {
  describe('core/base.ts: pure facility state', () => {
    it('starts fully unbuilt with every facility at level 0', () => {
      const base = newBaseState();
      for (const id of ['medstation', 'workbench', 'commsRelay'] as const) {
        expect(facilityLevel(base, id)).toBe(0);
        expect(facilityEffect(base, id)).toBe(0);
        expect(upgradeCost(base, id)).toBe(FACILITIES[id].tiers[0].cost);
      }
    });

    it('buildLevel advances one tier and its effect/cost follow the tier table', () => {
      const base = newBaseState();
      buildLevel(base, 'medstation');
      expect(facilityLevel(base, 'medstation')).toBe(1);
      expect(facilityEffect(base, 'medstation')).toBe(FACILITIES.medstation.tiers[0].effect);
      expect(upgradeCost(base, 'medstation')).toBe(FACILITIES.medstation.tiers[1].cost);
    });

    it('upgradeCost is null once a facility is at its max tier', () => {
      const base = newBaseState();
      for (let i = 0; i < FACILITIES.workbench.tiers.length; i++) buildLevel(base, 'workbench');
      expect(upgradeCost(base, 'workbench')).toBeNull();
      expect(facilityLevel(base, 'workbench')).toBe(FACILITIES.workbench.tiers.length);
    });

    it('baseGameOptions reflects each facility independently, zero when unbuilt', () => {
      const base = newBaseState();
      expect(baseGameOptions(base)).toEqual({ medkitBonus: 0, reserveMultBonus: 0, gadgetUsesBonus: 0 });
      buildLevel(base, 'workbench');
      const opts = baseGameOptions(base);
      expect(opts.reserveMultBonus).toBe(FACILITIES.workbench.tiers[0].effect);
      expect(opts.medkitBonus).toBe(0);
      expect(opts.gadgetUsesBonus).toBe(0);
    });
  });

  describe('core/campaign.ts: upgradeFacility spends currency and validates', () => {
    it('spends the right amount and advances the level', () => {
      const cs = newCampaign(1);
      cs.currency = 1000;
      const cost = FACILITIES.medstation.tiers[0].cost;
      const err = upgradeFacility(cs, 'medstation');
      expect(err).toBeNull();
      expect(cs.currency).toBe(1000 - cost);
      expect(facilityLevel(cs.base, 'medstation')).toBe(1);
    });

    it('refuses (and charges nothing) when currency is insufficient', () => {
      const cs = newCampaign(1);
      cs.currency = 10; // less than any tier's cost
      const err = upgradeFacility(cs, 'medstation');
      expect(err).toBe('Not enough currency');
      expect(cs.currency).toBe(10);
      expect(facilityLevel(cs.base, 'medstation')).toBe(0);
    });

    it('refuses once a facility is already at max level', () => {
      const cs = newCampaign(1);
      cs.currency = 100000;
      for (let i = 0; i < FACILITIES.commsRelay.tiers.length; i++) expect(upgradeFacility(cs, 'commsRelay')).toBeNull();
      const before = cs.currency;
      const err = upgradeFacility(cs, 'commsRelay');
      expect(err).toBe('Already at max level');
      expect(cs.currency).toBe(before); // unchanged
    });
  });

  describe('applied to a mission: GameOptions/MapDef bonuses actually change unit stats', () => {
    it('medkitBonus and gadgetUsesBonus only affect the player team, never the enemy', () => {
      const s = makeGame(blank(10, 3), { player: { medic: [1, 1] }, enemy: { medic: [8, 1] } }, { medkitBonus: 2, gadgetUsesBonus: 3 });
      const p = unit(s, 'player', 'medic');
      const e = unit(s, 'enemy', 'medic');
      expect(p.medkits).toBe(2 + 2); // RULES.medkitsPerUnit (2) + bonus
      expect(p.gadget!.uses).toBe(3 + 3); // RULES.gadgetUsesPerMission (3) + bonus
      expect(e.medkits).toBe(2); // enemy unaffected
      expect(e.gadget).toBeNull(); // enemy units never carry a gadget regardless
    });

    it('playerReserveMult only affects the player team; reserveMult (4) affects both', () => {
      const s = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [8, 1] } }, { playerReserveMult: 2, reserveMult: 0.5 });
      const p = unit(s, 'player', 'soldier');
      const e = unit(s, 'enemy', 'soldier');
      // soldier base reserve is 18: reserveMult (0.5, both teams) * playerReserveMult (2, player only)
      expect(p.reserve).toBe(Math.round(18 * 0.5 * 2));
      expect(e.reserve).toBe(Math.round(18 * 0.5)); // no playerReserveMult applied
    });
  });
});
