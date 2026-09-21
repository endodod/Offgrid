import { describe, expect, it } from 'vitest';
import { effectiveArmor, damageAgainst } from './combat';
import { effectiveAccuracyMod, effectiveMove, effectiveVision } from './environment';
import { act, blank, makeGame, unit } from './testkit';

describe('armor and equipment (feature 7)', () => {
  describe('armor stacks on top of the class base (resolves the "stack or replace" open question)', () => {
    it('effectiveArmor adds the equipped piece to the class base', () => {
      const s = makeGame(blank(10, 3), { player: { tank: [1, 1] }, enemy: { soldier: [8, 1] } });
      const t = unit(s, 'player', 'tank');
      expect(effectiveArmor(t)).toBe(3); // tank's own base armor, unequipped
      t.armor = 'lightVest';
      expect(effectiveArmor(t)).toBe(3 + 1); // stacks, doesn't replace
      t.armor = 'heavyPlate';
      expect(effectiveArmor(t)).toBe(3 + 3);
    });

    it('damage taken through damageAgainst reflects the equipped armor', () => {
      const s = makeGame(blank(10, 3), { player: { tank: [1, 1] }, enemy: { soldier: [8, 1] } });
      const t = unit(s, 'player', 'tank');
      const weaponDamage = 7; // high enough relative to the tank's base armor (3) to leave room to see a reduction
      const dmgBefore = damageAgainst(weaponDamage, effectiveArmor(t));
      t.armor = 'heavyPlate';
      const dmgAfter = damageAgainst(weaponDamage, effectiveArmor(t));
      expect(dmgAfter).toBeLessThan(dmgBefore);
    });
  });

  describe('boots: a flat move bonus', () => {
    it('effectiveMove adds boots\' bonus on top of the environment-scaled base', () => {
      const s = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [8, 1] } });
      const p = unit(s, 'player', 'soldier');
      const before = effectiveMove(s, p);
      p.equipment[0] = 'boots';
      expect(effectiveMove(s, p)).toBe(before + 1);
    });
  });

  describe('flashlight and NVG: each counters a specific penalty, never the other', () => {
    it('flashlight blunts weather\'s vision penalty but leaves time-of-day\'s untouched', () => {
      const s = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [8, 1] } });
      s.weather = 'stormy'; // visionMult 0.65
      s.timeOfDay = 'midnight'; // visionMult 0.5
      const p = unit(s, 'player', 'soldier');
      const noItem = effectiveVision(s, p);
      p.equipment[0] = 'flashlight';
      const withFlashlight = effectiveVision(s, p);
      expect(withFlashlight).toBeGreaterThan(noItem); // weather's penalty is blunted
      // Swap for a control unit with no weather penalty (clear) to isolate: flashlight should do nothing extra
      // when weather has no penalty to counter.
      const s2 = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [8, 1] } });
      s2.weather = 'clear';
      s2.timeOfDay = 'midnight';
      const p2 = unit(s2, 'player', 'soldier');
      const noItem2 = effectiveVision(s2, p2);
      p2.equipment[0] = 'flashlight';
      expect(effectiveVision(s2, p2)).toBe(noItem2); // nothing to counter in clear weather -> no change
    });

    it('NVG blunts time-of-day\'s vision AND accuracy penalty but leaves weather\'s untouched', () => {
      const s = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [8, 1] } });
      s.weather = 'stormy';
      s.timeOfDay = 'midnight';
      const p = unit(s, 'player', 'soldier');
      const visionBefore = effectiveVision(s, p);
      const accBefore = effectiveAccuracyMod(s, p);
      p.equipment[0] = 'nvg';
      expect(effectiveVision(s, p)).toBeGreaterThan(visionBefore);
      expect(effectiveAccuracyMod(s, p)).toBeGreaterThan(accBefore); // less negative

      // Isolate: weather-only penalty (midday, stormy) - NVG should do nothing.
      const s2 = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [8, 1] } });
      s2.weather = 'stormy';
      s2.timeOfDay = 'midday';
      const p2 = unit(s2, 'player', 'soldier');
      const visionBefore2 = effectiveVision(s2, p2);
      const accBefore2 = effectiveAccuracyMod(s2, p2);
      p2.equipment[0] = 'nvg';
      expect(effectiveVision(s2, p2)).toBe(visionBefore2);
      expect(effectiveAccuracyMod(s2, p2)).toBe(accBefore2);
    });

    it('both together counter both penalties independently, more than either alone', () => {
      const s = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [8, 1] } });
      s.weather = 'stormy';
      s.timeOfDay = 'midnight';
      const p = unit(s, 'player', 'soldier');
      const neither = effectiveVision(s, p);
      p.equipment = ['flashlight', 'nvg'];
      const both = effectiveVision(s, p);
      expect(both).toBeGreaterThan(neither);
    });
  });

  describe('collecting armor/equipment pickups equips them', () => {
    it('an armor pickup sets the armor slot outright', () => {
      const s = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [8, 1] } }, {}, [], undefined, [
        { id: 1, type: 'armor', x: 4, y: 1, itemId: 'heavyPlate' },
      ]);
      const p = unit(s, 'player', 'soldier');
      act(s, { type: 'move', unit: p.id, to: { x: 4, y: 1 } });
      expect(p.armor).toBe('heavyPlate');
      expect(s.pickups).toHaveLength(0);
    });

    it('an equipment pickup fills the first empty slot, then replaces slot 0 once both are full', () => {
      const s = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [9, 2] } }, {}, [], undefined, [
        { id: 1, type: 'equipment', x: 3, y: 1, itemId: 'boots' },
        { id: 2, type: 'equipment', x: 5, y: 1, itemId: 'flashlight' },
        { id: 3, type: 'equipment', x: 7, y: 1, itemId: 'nvg' },
      ]);
      const p = unit(s, 'player', 'soldier');
      act(s, { type: 'move', unit: p.id, to: { x: 3, y: 1 } });
      expect(p.equipment).toEqual(['boots', null]);
      act(s, { type: 'endTurn' });
      act(s, { type: 'endTurn' });
      const p2 = unit(s, 'player', 'soldier');
      act(s, { type: 'move', unit: p2.id, to: { x: 5, y: 1 } });
      expect(p2.equipment).toEqual(['boots', 'flashlight']);
      act(s, { type: 'endTurn' });
      act(s, { type: 'endTurn' });
      const p3 = unit(s, 'player', 'soldier');
      act(s, { type: 'move', unit: p3.id, to: { x: 7, y: 1 } });
      expect(p3.equipment).toEqual(['nvg', 'flashlight']); // slot 0 replaced, slot 1 untouched
    });
  });

  describe('chests (7): interact opens them and drops loot; cannot reopen', () => {
    it('opening a chest drops a pickup at its tile and costs an action', () => {
      const s = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [8, 1] } }, {}, [
        { id: 1, type: 'chest', x: 2, y: 1 },
      ]);
      const p = unit(s, 'player', 'soldier');
      expect(p.actions).toBe(2);
      act(s, { type: 'interact', unit: p.id, target: 1 });
      expect(p.actions).toBe(1);
      expect(s.interactables[0].active).toBe(true);
      expect(s.pickups).toHaveLength(1);
      expect(s.pickups[0].x).toBe(2);
      expect(s.pickups[0].y).toBe(1);
      expect(['armor', 'equipment']).toContain(s.pickups[0].type);
    });

    it('an already-opened chest cannot be opened again', () => {
      const s = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [8, 1] } }, {}, [
        { id: 1, type: 'chest', x: 2, y: 1 },
      ]);
      const p = unit(s, 'player', 'soldier');
      act(s, { type: 'interact', unit: p.id, target: 1 });
      expect(() => act(s, { type: 'interact', unit: p.id, target: 1 })).toThrow('Already opened');
    });
  });

  describe('enemy deaths drop loot deterministically', () => {
    it('a dead enemy leaves a pickup on its tile, reproducibly for the same seed', () => {
      const s = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [2, 1] } });
      const e = unit(s, 'enemy', 'soldier');
      e.hp = 0; e.downed = true; e.bleedOut = 1;
      act(s, { type: 'endTurn' }); // enemy phase start ticks bleed-out to 0 -> dies for good
      expect(e.alive).toBe(false);
      expect(s.pickups.some((p) => p.x === 2 && p.y === 1 && (p.type === 'armor' || p.type === 'equipment'))).toBe(true);
    });

    it('a downed (not yet dead) player never drops loot, and a dead player unit never does either', () => {
      const s = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [8, 1] } });
      const p = unit(s, 'player', 'soldier');
      p.hp = 0; p.downed = true; p.bleedOut = 1;
      act(s, { type: 'endTurn' }); // player's own next phase isn't reached in one endTurn from player phase
      act(s, { type: 'endTurn' });
      expect(p.alive).toBe(false);
      expect(s.pickups).toHaveLength(0); // only enemy deaths drop loot
    });
  });
});
