import { describe, expect, it } from 'vitest';
import { runAiTurn } from './ai';
import { effectiveMove } from './environment';
import { describeObjective, isTarget, objectiveGoalPositions, roundsLeft } from './objectives';
import { act, blank, endTurns, makeGame, place, unit } from './testkit';

/** The four objective types added with Act 2 (survive, defend, retrieve, eliminateTargets) and Act 3's hardware. */
describe('Act 2 objective types', () => {
  describe('survive', () => {
    const game = () => makeGame(blank(12, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [10, 1] } }, {}, [], { type: 'survive', rounds: 3 });

    it('wins at the start of the round after the last one, not before', () => {
      const s = game();
      expect(roundsLeft(s)).toBe(3);
      endTurns(s, 4); // rounds 1 and 2, both phases
      expect(s.winner).toBeNull();
      expect(roundsLeft(s)).toBe(1);
      endTurns(s, 1); // round 3, player phase over
      expect(s.winner).toBeNull();
      endTurns(s, 1); // round 3's enemy phase over: round 4 begins
      expect(s.winner).toBe('player');
    });

    it('is still lost by a wipeout', () => {
      const s = game();
      unit(s, 'player', 'soldier').alive = false;
      endTurns(s, 1);
      expect(s.winner).toBe('enemy');
    });

    it('describes how many rounds are left', () => {
      expect(describeObjective(game())).toContain('3 to go');
    });
  });

  describe('defend', () => {
    const game = () => makeGame(blank(12, 3, [[6, 1, 'O'], [6, 2, 'O']]), { player: { soldier: [1, 1] }, enemy: { assault: [10, 1] } }, {}, [], {
      type: 'defend', rounds: 2, label: 'the pump',
    });

    it('is lost the moment an enemy stands on the zone', () => {
      const s = game();
      endTurns(s, 1);
      place(s, unit(s, 'enemy', 'assault'), 7, 1);
      act(s, { type: 'move', unit: unit(s, 'enemy', 'assault').id, to: { x: 6, y: 1 } });
      expect(s.winner).toBe('enemy');
    });

    it('is won once the rounds run out with the zone clear', () => {
      const s = game();
      endTurns(s, 4);
      expect(s.winner).toBe('player');
    });

    it('gives the attackers the zone as a goal from turn one', () => {
      const s = game();
      expect(objectiveGoalPositions(s, 'enemy')).toHaveLength(2);
    });
  });

  describe('retrieve', () => {
    const game = () => makeGame(blank(12, 3, [[10, 1, 'O'], [10, 2, 'O']]), { player: { soldier: [1, 1], medic: [1, 2] }, enemy: { sniper: [11, 0] } }, {}, [
      { id: 1, type: 'switch', x: 4, y: 1 },
    ], { type: 'retrieve', interactableIds: [1], unitsRequired: 2, label: 'the ledger' });

    it('needs the intel first: standing on the zone without it wins nothing', () => {
      const s = game();
      place(s, unit(s, 'player', 'soldier'), 10, 1);
      place(s, unit(s, 'player', 'medic'), 10, 2);
      act(s, { type: 'endTurn' });
      expect(s.winner).toBeNull();
    });

    it('wins with the intel taken and enough units on the zone', () => {
      const s = game();
      const p = unit(s, 'player', 'soldier');
      act(s, { type: 'move', unit: p.id, to: { x: 4, y: 1 } });
      act(s, { type: 'interact', unit: p.id, target: 1 });
      expect(s.winner).toBeNull();
      expect(describeObjective(s)).toContain('secured');
      place(s, p, 10, 1);
      place(s, unit(s, 'player', 'medic'), 10, 2);
      act(s, { type: 'endTurn' });
      expect(s.winner).toBe('player');
    });

    it('points the squad AI at the intel before the zone', () => {
      const s = game();
      s.memory.player.doors[1] = false; // seen, not yet taken
      expect(objectiveGoalPositions(s, 'player')).toEqual([expect.objectContaining({ x: 4, y: 1 })]);
    });
  });

  describe('eliminateTargets', () => {
    const game = () => makeGame(blank(12, 3), { player: { soldier: [1, 1] }, enemy: { sniper: [8, 1], soldier: [9, 2], tank: [10, 1] } }, {}, [], {
      type: 'eliminateTargets', enemySpawnIndices: [0, 2], label: 'the officers',
    });

    it('wins only once every target is dead', () => {
      const s = game();
      unit(s, 'enemy', 'sniper').alive = false;
      act(s, { type: 'endTurn' });
      expect(s.winner).toBeNull();
      expect(describeObjective(s)).toContain('1/2');
      unit(s, 'enemy', 'tank').alive = false;
      act(s, { type: 'endTurn' });
      expect(s.winner).toBe('player');
      expect(unit(s, 'enemy', 'soldier').alive).toBe(true);
    });

    it('marks exactly the targets', () => {
      const s = game();
      expect(isTarget(s, unit(s, 'enemy', 'sniper'))).toBe(true);
      expect(isTarget(s, unit(s, 'enemy', 'soldier'))).toBe(false);
      expect(isTarget(s, unit(s, 'enemy', 'tank'))).toBe(true);
    });
  });
});

describe('Act 3 hardware', () => {
  it('a sentry never moves, even under the AI', () => {
    const s = makeGame(blank(14, 3), { player: { soldier: [1, 1] }, enemy: { sentry: [12, 1] } });
    const sentry = unit(s, 'enemy', 'sentry');
    expect(effectiveMove(s, sentry)).toBe(0);
    endTurns(s, 1);
    runAiTurn(s, 'enemy');
    expect([sentry.x, sentry.y]).toEqual([12, 1]);
  });

  it('a sentry shoots what it can see', () => {
    const s = makeGame(blank(10, 3), { player: { tank: [2, 1] }, enemy: { sentry: [8, 1] } });
    endTurns(s, 1);
    const hpBefore = unit(s, 'player', 'tank').hp;
    s.rollSource = () => 0; // every roll hits
    runAiTurn(s, 'enemy');
    expect(unit(s, 'player', 'tank').hp).toBeLessThan(hpBefore);
  });

  it('a drone moves further than anyone on the squad', () => {
    const s = makeGame(blank(14, 3), { player: { assault: [1, 1] }, enemy: { drone: [12, 1] } });
    expect(effectiveMove(s, unit(s, 'enemy', 'drone'))).toBeGreaterThan(effectiveMove(s, unit(s, 'player', 'assault')));
  });
});
