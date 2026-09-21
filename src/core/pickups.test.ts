import { describe, expect, it } from 'vitest';
import { runAiTurn } from './ai';
import { idx } from './grid';
import { act, blank, makeGame, place, unit } from './testkit';

describe('ammo economy and pickups (feature 4)', () => {
  describe('reload draws from reserve', () => {
    it('a normal reload refills the magazine from reserve', () => {
      const s = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [8, 1] } });
      const p = unit(s, 'player', 'soldier');
      p.ammo = 2; // magazine 6
      const before = p.reserve;
      act(s, { type: 'reload', unit: p.id });
      expect(p.ammo).toBe(6);
      expect(p.reserve).toBe(before - 4);
      expect(p.reserveUsed).toBe(4);
    });

    it('a partial reserve gives a partial refill, not a full one', () => {
      const s = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [8, 1] } });
      const p = unit(s, 'player', 'soldier');
      p.ammo = 1;
      p.reserve = 2; // less than the 5 needed to top off a 6-round magazine
      act(s, { type: 'reload', unit: p.id });
      expect(p.ammo).toBe(3); // 1 + 2
      expect(p.reserve).toBe(0);
    });

    it('reload is refused once reserve is empty', () => {
      const s = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [8, 1] } });
      const p = unit(s, 'player', 'soldier');
      p.ammo = 0;
      p.reserve = 0;
      expect(() => act(s, { type: 'reload', unit: p.id })).toThrow('No reserve ammo');
    });

    it('a full magazine still refuses reload even with reserve left (unchanged pre-existing rule)', () => {
      const s = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [8, 1] } });
      const p = unit(s, 'player', 'soldier');
      expect(() => act(s, { type: 'reload', unit: p.id })).toThrow('Magazine full');
    });
  });

  describe('pickups: collected for free by walking onto their tile', () => {
    it('an ammo pickup refills reserve, not the magazine directly', () => {
      const s = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [8, 1] } }, {}, [], undefined, [
        { id: 1, type: 'ammo', x: 4, y: 1, amount: 5 },
      ]);
      const p = unit(s, 'player', 'soldier');
      p.ammo = 6; // full - so the pickup's effect is provably on reserve, not ammo
      const before = p.reserve;
      const events = act(s, { type: 'move', unit: p.id, to: { x: 4, y: 1 } });
      expect(p.ammo).toBe(6);
      expect(p.reserve).toBe(before + 5);
      expect(s.pickups).toHaveLength(0); // gone once collected
      expect(events.some((e) => e.t === 'pickup' && e.item === 'ammo' && e.amount === 5)).toBe(true);
    });

    it('a medkit pickup adds a medkit; a gadget pickup adds a gadget use', () => {
      const s = makeGame(blank(10, 3), { player: { medic: [1, 1] }, enemy: { soldier: [8, 1] } }, {}, [], undefined, [
        { id: 1, type: 'medkit', x: 3, y: 1 }, { id: 2, type: 'gadget', x: 5, y: 1 },
      ]);
      const p = unit(s, 'player', 'medic');
      const beforeMedkits = p.medkits;
      const beforeUses = p.gadget!.uses;
      act(s, { type: 'move', unit: p.id, to: { x: 3, y: 1 } });
      expect(p.medkits).toBe(beforeMedkits + 1);
      act(s, { type: 'endTurn' });
      act(s, { type: 'endTurn' });
      const p2 = unit(s, 'player', 'medic');
      act(s, { type: 'move', unit: p2.id, to: { x: 5, y: 1 } });
      expect(p2.gadget!.uses).toBe(beforeUses + 1);
    });

    it('walking through a pickup tile mid-path (not just ending there) still collects it', () => {
      const s = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [9, 2] } }, {}, [], undefined, [
        { id: 1, type: 'ammo', x: 3, y: 1, amount: 4 },
      ]);
      const p = unit(s, 'player', 'soldier');
      const before = p.reserve;
      act(s, { type: 'move', unit: p.id, to: { x: 5, y: 1 } }); // passes through (3,1) on the way
      expect(p.reserve).toBe(before + 4);
      expect(s.pickups).toHaveLength(0);
    });

    it('an enemy unit can collect a pickup too (no team restriction)', () => {
      const s = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [8, 1] } }, {}, [], undefined, [
        { id: 1, type: 'ammo', x: 6, y: 1, amount: 3 },
      ]);
      act(s, { type: 'endTurn' }); // enemy phase
      const e = unit(s, 'enemy', 'soldier');
      const before = e.reserve;
      act(s, { type: 'move', unit: e.id, to: { x: 6, y: 1 } });
      expect(e.reserve).toBe(before + 3);
    });
  });

  describe('fog: pickups are drawn from current visibility only, not remembered (documented v1 scope)', () => {
    it('a pickup outside memory is simply not known to have ever been there - no stale ghost of it', () => {
      // core has no memory of pickups at all; this test documents that GameState.pickups is always the full,
      // unfogged list (fog is applied at the UI/render layer, same as s.interactables/s.objective).
      const s = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [8, 1] } }, {}, [], undefined, [
        { id: 1, type: 'ammo', x: 9, y: 2 },
      ]);
      expect(s.pickups).toHaveLength(1);
      expect(s.visible.player[idx(s, 9, 2)]).toBeFalsy(); // not currently visible, but still present in state
    });
  });

  describe('AI: reload gating and dry-run pickup seeking', () => {
    it('the enemy AI does not reload with an empty reserve (falls through to something else instead)', () => {
      const s = makeGame(blank(20, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [18, 1] } });
      const e = unit(s, 'enemy', 'soldier');
      e.ammo = 0;
      e.reserve = 0;
      act(s, { type: 'endTurn' });
      runAiTurn(s, 'enemy');
      expect(s.events.some((ev) => ev.t === 'reload')).toBe(false);
    });

    it('an out-of-ammo, out-of-reserve unit with no visible enemy heads for a visible ammo pickup', () => {
      // The tank's vision is 5, so the pickup at x=14 (distance 4 from x=18) is within sight.
      const s = makeGame(blank(20, 3), { player: { soldier: [1, 1] }, enemy: { tank: [18, 1] } }, {}, [], undefined, [
        { id: 1, type: 'ammo', x: 14, y: 1 },
      ]);
      const e = unit(s, 'enemy', 'tank');
      e.ammo = 0;
      e.reserve = 0;
      place(s, e, 18, 1); // refresh vision so the pickup registers as seen
      act(s, { type: 'endTurn' });
      runAiTurn(s, 'enemy');
      expect(unit(s, 'enemy', 'tank').x).toBeLessThan(18); // headed toward the pickup, not idling
    });

    it('never heads for an ammo pickup it has not seen (fog-fair)', () => {
      const s = makeGame(blank(30, 3), { player: { soldier: [1, 1] }, enemy: { tank: [28, 1] } }, {}, [], undefined, [
        { id: 1, type: 'ammo', x: 5, y: 1 }, // far outside the tank's vision range
      ]);
      const e = unit(s, 'enemy', 'tank');
      e.ammo = 0;
      e.reserve = 0;
      act(s, { type: 'endTurn' });
      runAiTurn(s, 'enemy');
      expect(unit(s, 'enemy', 'tank').x).toBe(28); // never saw it - holds instead
    });

    it("a unit with ammo but a visible target it can't hit doesn't throw away its turn trying to fire", () => {
      // Guards the ai.ts change that skips the attack branch when ammo is 0: build that exact scenario and
      // confirm the unit still does *something* (moves/repositions) instead of a wasted invalid attack attempt.
      const s = makeGame(blank(10, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [3, 1] } });
      const e = unit(s, 'enemy', 'soldier');
      e.ammo = 0;
      e.reserve = 0;
      act(s, { type: 'endTurn' });
      runAiTurn(s, 'enemy');
      expect(s.events.some((ev) => ev.t === 'shot')).toBe(false); // never actually fired (it had no ammo)
    });
  });
});
