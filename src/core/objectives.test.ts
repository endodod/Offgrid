import { describe, expect, it } from 'vitest';
import { runAiTurn } from './ai';
import { act, blank, makeGame, unit } from './testkit';

describe('objective types (feature 3)', () => {
  describe('eliminateTarget', () => {
    it('wins the moment the named enemy dies, even with other enemies still alive', () => {
      const s = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { sniper: [8, 1], soldier: [9, 2] } }, {}, [], {
        type: 'eliminateTarget', enemySpawnIndex: 0, // the sniper, first in the enemy spawn list
      });
      const target = unit(s, 'enemy', 'sniper');
      const other = unit(s, 'enemy', 'soldier');
      target.alive = false; // simulate the target dying (combat itself is covered elsewhere)
      target.hp = 0;
      act(s, { type: 'endTurn' }); // any action re-runs checkWin
      expect(s.winner).toBe('player');
      expect(other.alive).toBe(true); // the rest of the squad didn't need to die
    });

    it('does not win while the named enemy is still alive, even if it is downed', () => {
      const s = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { sniper: [8, 1] } }, {}, [], {
        type: 'eliminateTarget', enemySpawnIndex: 0,
      });
      const target = unit(s, 'enemy', 'sniper');
      target.downed = true;
      target.hp = 0;
      target.bleedOut = 3; // still has time before it dies for good (0b) - not yet a real kill
      act(s, { type: 'endTurn' });
      expect(s.winner).toBeNull();
    });

    it('a full team wipeout still wins regardless of the named target (the always-on fallback)', () => {
      const s = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { sniper: [8, 1], soldier: [9, 2] } }, {}, [], {
        type: 'eliminateTarget', enemySpawnIndex: 0,
      });
      for (const e of s.units.filter((u) => u.team === 'enemy')) e.alive = false;
      act(s, { type: 'endTurn' });
      expect(s.winner).toBe('player');
    });
  });

  describe('sabotage', () => {
    const map = () => makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [8, 1] } }, {}, [
      { id: 1, type: 'switch', x: 3, y: 1 },
      { id: 2, type: 'switch', x: 5, y: 1 },
    ], { type: 'sabotage', interactableIds: [1, 2] });

    it('wins only once every listed interactable is active', () => {
      const s = map();
      const p = unit(s, 'player', 'soldier');
      act(s, { type: 'move', unit: p.id, to: { x: 3, y: 1 } }); // switch 1's own tile - adjacency (cheb 0) is enough
      act(s, { type: 'interact', unit: p.id, target: 1 });
      expect(s.winner).toBeNull(); // only one of two done
      act(s, { type: 'endTurn' });
      act(s, { type: 'endTurn' });
      const p2 = unit(s, 'player', 'soldier');
      act(s, { type: 'move', unit: p2.id, to: { x: 5, y: 1 } });
      act(s, { type: 'interact', unit: p2.id, target: 2 });
      expect(s.winner).toBe('player');
    });

    it('is not satisfied by an unlisted interactable', () => {
      const s = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [8, 1] } }, {}, [
        { id: 1, type: 'switch', x: 3, y: 1 }, { id: 2, type: 'switch', x: 5, y: 1 },
      ], { type: 'sabotage', interactableIds: [1] }); // only id 1 required
      const p = unit(s, 'player', 'soldier');
      act(s, { type: 'move', unit: p.id, to: { x: 3, y: 1 } });
      act(s, { type: 'interact', unit: p.id, target: 1 });
      expect(s.winner).toBe('player');
    });
  });

  describe('reach', () => {
    // Zone tiles at x=6/7, well within every spawn's Move stat (soldier/medic 5, assault 6) of x=1.
    const zoneMap = () => makeGame(blank(10, 3, [[6, 1, 'O'], [7, 1, 'O']]), { player: { soldier: [1, 1], assault: [1, 2] }, enemy: { soldier: [9, 2] } }, {}, [], {
      type: 'reach', unitsRequired: 2,
    });

    it('wins once enough player units are standing in the zone at the same time', () => {
      const s = zoneMap();
      const a = unit(s, 'player', 'soldier');
      const b = unit(s, 'player', 'assault');
      act(s, { type: 'move', unit: a.id, to: { x: 6, y: 1 } });
      expect(s.winner).toBeNull(); // only one of two required
      act(s, { type: 'move', unit: b.id, to: { x: 7, y: 1 } });
      expect(s.winner).toBe('player');
    });

    it('a zone tile is open floor, not a blocked obstacle like the hold terminal', () => {
      const s = zoneMap();
      const a = unit(s, 'player', 'soldier');
      const r = act(s, { type: 'move', unit: a.id, to: { x: 6, y: 1 } });
      expect(r.some((e) => e.t === 'move')).toBe(true);
      expect(a.x).toBe(6);
      expect(a.y).toBe(1);
    });

    it('a downed unit standing in the zone does not count toward the requirement', () => {
      const s = makeGame(blank(10, 3, [[6, 1, 'O'], [7, 1, 'O'], [8, 1, 'O']]),
        { player: { soldier: [1, 1], assault: [8, 1], medic: [2, 2] }, enemy: { soldier: [9, 0] } }, {}, [], { type: 'reach', unitsRequired: 2 });
      const a = unit(s, 'player', 'soldier');
      const b = unit(s, 'player', 'assault'); // spawns already standing in the zone
      const c = unit(s, 'player', 'medic');
      b.downed = true;
      act(s, { type: 'move', unit: a.id, to: { x: 6, y: 1 } });
      expect(s.winner).toBeNull(); // b (downed) doesn't count - only a is a valid occupant so far
      act(s, { type: 'endTurn' });
      act(s, { type: 'endTurn' });
      act(s, { type: 'move', unit: c.id, to: { x: 7, y: 1 } });
      expect(s.winner).toBe('player');
    });
  });

  describe('AI goal hints (objectiveGoalPositions via pickGoal)', () => {
    it('a camper defends a seen sabotage terminal', () => {
      const s = makeGame(blank(20, 3), { player: { soldier: [1, 1] }, enemy: { tank: [18, 1] } }, { enemyProfile: 'camper' }, [
        { id: 1, type: 'switch', x: 5, y: 1 },
      ], { type: 'sabotage', interactableIds: [1] });
      s.memory.enemy.doors[1] = false; // "seen" - a switch at (5,1), not yet thrown
      act(s, { type: 'endTurn' });
      runAiTurn(s, 'enemy');
      expect(unit(s, 'enemy', 'tank').x).toBeLessThan(18); // headed toward the terminal it knows about
    });

    it('never heads for a sabotage terminal it has not seen (fog-fair)', () => {
      const s = makeGame(blank(20, 3), { player: { soldier: [1, 1] }, enemy: { tank: [18, 1] } }, { enemyProfile: 'camper' }, [
        { id: 1, type: 'switch', x: 5, y: 1 },
      ], { type: 'sabotage', interactableIds: [1] });
      act(s, { type: 'endTurn' });
      runAiTurn(s, 'enemy');
      expect(unit(s, 'enemy', 'tank').x).toBe(18); // never learned where it is - holds instead
    });
  });
});
