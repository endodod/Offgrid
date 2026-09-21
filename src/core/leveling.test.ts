import { describe, expect, it } from 'vitest';
import { LEVEL_PATHS } from '../data/leveling';
import {
  equipPerk, gainXp, levelForXp, newClassProgress, perkBonus, resetOnDeath, slotCount, unequipPerk, xpEarned,
} from './leveling';
import { damageAgainst, effectiveArmor, effectiveDamage, hitChance } from './combat';
import { effectiveAccuracyMod, effectiveMove, effectiveVision } from './environment';
import { blank, makeGame, unit } from './testkit';

describe('leveling (feature 8)', () => {
  describe('xpEarned', () => {
    it('sums damage, kills, revives, and a flat survival bonus', () => {
      expect(xpEarned({ dmgDealt: 10, kills: 2, revives: 1, alive: true })).toBe(10 * 1 + 2 * 15 + 1 * 10 + 5);
    });

    it('a dead unit gets no survival bonus, but its damage/kills/revives still count toward the total this function returns', () => {
      // (whether that total is actually applied on death is applyMissionXp's own call - not this pure function's job)
      expect(xpEarned({ dmgDealt: 10, kills: 0, revives: 0, alive: false })).toBe(10);
    });
  });

  describe('levelForXp / slotCount', () => {
    it('starts at level 1 with 1 slot below every threshold', () => {
      expect(levelForXp('soldier', 0)).toBe(1);
      expect(levelForXp('soldier', 99)).toBe(1);
      expect(slotCount('soldier', 1)).toBe(1);
    });

    it('reaches each class\'s own thresholds', () => {
      for (const cls of Object.keys(LEVEL_PATHS) as (keyof typeof LEVEL_PATHS)[]) {
        for (const def of LEVEL_PATHS[cls]) expect(levelForXp(cls, def.xpThreshold)).toBe(def.level);
      }
    });

    it('slot count never exceeds 3 and only increases at slotUnlock milestones', () => {
      expect(slotCount('soldier', 1)).toBe(1);
      expect(slotCount('soldier', 2)).toBe(1); // level 2 is a perk milestone, not a slot one
      expect(slotCount('soldier', 3)).toBe(2);
      expect(slotCount('soldier', 5)).toBe(3);
    });
  });

  describe('gainXp', () => {
    it('adds xp and does nothing else below a level-up threshold', () => {
      const p = newClassProgress();
      gainXp('soldier', p, 50);
      expect(p).toEqual({ xp: 50, level: 1, perkPool: [], equippedPerks: [] });
    });

    it('levels up and grants exactly 2 perks at a significant level, never auto-equipped', () => {
      const p = newClassProgress();
      gainXp('sniper', p, 100);
      expect(p.level).toBe(2);
      expect(p.perkPool).toHaveLength(2);
      expect(p.equippedPerks).toEqual([]);
    });

    it('crossing two milestones in one jump grants every perk in between', () => {
      const p = newClassProgress();
      gainXp('tank', p, 500); // past both level 2 and level 4's thresholds
      expect(p.level).toBe(4);
      expect(p.perkPool).toHaveLength(4); // 2 from level 2, 2 from level 4
    });

    it('never grants the same perk twice even if called repeatedly at the same level', () => {
      const p = newClassProgress();
      gainXp('medic', p, 100);
      gainXp('medic', p, 0); // no new xp, no new level - re-checks the same milestone harmlessly
      expect(p.perkPool).toHaveLength(2);
    });
  });

  describe('resetOnDeath', () => {
    it('resets xp/level/equipped perks but keeps the unlocked pool', () => {
      const p = newClassProgress();
      gainXp('assault', p, 100);
      equipPerk('assault', p, p.perkPool[0]);
      resetOnDeath(p);
      expect(p.xp).toBe(0);
      expect(p.level).toBe(1);
      expect(p.equippedPerks).toEqual([]);
      expect(p.perkPool).toHaveLength(2); // still unlocked
    });
  });

  describe('equipPerk / unequipPerk', () => {
    it('refuses an unlocked-nothing perk, then succeeds once granted, then refuses past the slot cap', () => {
      const p = newClassProgress();
      expect(equipPerk('soldier', p, 'soldierGrit')).toBe('Not unlocked yet');
      gainXp('soldier', p, 100); // unlocks soldierGrit + soldierMarksman, 1 slot at level 2
      expect(equipPerk('soldier', p, 'soldierGrit')).toBeNull();
      expect(equipPerk('soldier', p, 'soldierMarksman')).toBe('No open perk slots');
    });

    it('equipping an already-equipped perk is a harmless no-op', () => {
      const p = newClassProgress();
      gainXp('soldier', p, 100);
      equipPerk('soldier', p, 'soldierGrit');
      expect(equipPerk('soldier', p, 'soldierGrit')).toBeNull();
      expect(p.equippedPerks).toEqual(['soldierGrit']); // not duplicated
    });

    it('unequip always succeeds and frees the slot for another perk', () => {
      const p = newClassProgress();
      gainXp('soldier', p, 100);
      equipPerk('soldier', p, 'soldierGrit');
      unequipPerk(p, 'soldierGrit');
      expect(p.equippedPerks).toEqual([]);
      expect(equipPerk('soldier', p, 'soldierMarksman')).toBeNull(); // slot free again
    });
  });

  describe('perkBonus', () => {
    it('sums effects from every equipped perk, zero for none equipped', () => {
      expect(perkBonus([])).toEqual({ accuracyBonus: 0, damageBonus: 0, armorBonus: 0, moveBonus: 0, visionBonus: 0, medkitBonus: 0 });
      const combined = perkBonus(['sniperFocus', 'sniperEagleEye']); // accuracyBonus 10, visionBonus 2
      expect(combined.accuracyBonus).toBe(10);
      expect(combined.visionBonus).toBe(2);
      expect(combined.damageBonus).toBe(0);
    });
  });

  describe('equipped perks actually change a real unit\'s effective stats', () => {
    it('an armor perk stacks with the class base and any equipped armor piece (7)', () => {
      const s = makeGame(blank(10, 3), { player: { tank: [1, 1] }, enemy: { soldier: [8, 1] } });
      const t = unit(s, 'player', 'tank');
      const before = effectiveArmor(t);
      t.equippedPerks = ['tankPlating']; // +2 armor
      expect(effectiveArmor(t)).toBe(before + 2);
    });

    it('a damage perk raises effectiveDamage, which flows into damageAgainst', () => {
      const s = makeGame(blank(10, 3), { player: { tank: [1, 1] }, enemy: { soldier: [8, 1] } });
      const t = unit(s, 'player', 'tank');
      const before = effectiveDamage(t);
      t.equippedPerks = ['tankBrace']; // +1 damage
      expect(effectiveDamage(t)).toBe(before + 1);
      expect(damageAgainst(effectiveDamage(t), 0)).toBe(damageAgainst(before, 0) + 1);
    });

    it('a move perk raises effectiveMove', () => {
      const s = makeGame(blank(10, 3), { player: { tank: [1, 1] }, enemy: { soldier: [8, 1] } });
      const t = unit(s, 'player', 'tank');
      const before = effectiveMove(s, t);
      t.equippedPerks = ['tankStrider']; // +1 move
      expect(effectiveMove(s, t)).toBe(before + 1);
    });

    it('a vision perk raises effectiveVision', () => {
      const s = makeGame(blank(10, 3), { player: { tank: [1, 1] }, enemy: { soldier: [8, 1] } });
      const t = unit(s, 'player', 'tank');
      const before = effectiveVision(s, t);
      t.equippedPerks = ['tankVigilance']; // +1 vision
      expect(effectiveVision(s, t)).toBe(before + 1);
    });

    it('an accuracy perk raises effectiveAccuracyMod and therefore hitChance', () => {
      const s = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [3, 1] } });
      const p = unit(s, 'player', 'soldier');
      const e = unit(s, 'enemy', 'soldier');
      const before = effectiveAccuracyMod(s, p);
      const chanceBefore = hitChance(s, p, e);
      p.equippedPerks = ['soldierMarksman']; // +10% accuracy
      expect(effectiveAccuracyMod(s, p)).toBe(before + 10);
      expect(hitChance(s, p, e)).toBe(Math.min(95, chanceBefore + 10)); // still respects the hit-chance clamp
    });
  });
});
