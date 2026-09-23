import { describe, expect, it } from 'vitest';
import { AI_PROFILES } from '../data/aiProfiles';
import { planAction, runAiTurn } from './ai';
import { act, blank, makeGame, rolls, unit } from './testkit';

/** Ends the player's phase (so the enemy is up) and plays out the enemy's whole turn. */
const runEnemyTurn = (s: ReturnType<typeof makeGame>) => { act(s, { type: 'endTurn' }); runAiTurn(s, 'enemy'); };

/** Pokes a hold-type objective directly onto an already-built state, for maps with no 'O' tile of their own. */
const setObjective = (s: ReturnType<typeof makeGame>, x: number, y: number) => {
  s.objective = { x, y };
  s.objectiveZone = [{ x, y }];
  s.objectiveDef = { type: 'hold' };
};

describe('AI profiles (0c)', () => {
  it('defaults to "standard" for both teams', () => {
    const s = makeGame(blank(10, 5), { player: { soldier: [2, 2] }, enemy: { soldier: [8, 2] } });
    expect(s.aiProfiles).toEqual({ player: 'standard', enemy: 'standard' });
  });

  it('GameOptions can set the enemy (and player, for the simulator) profile', () => {
    const s = makeGame(blank(10, 5), { player: { soldier: [2, 2] }, enemy: { soldier: [8, 2] } }, { enemyProfile: 'ambush', playerProfile: 'camper' });
    expect(s.aiProfiles).toEqual({ player: 'camper', enemy: 'ambush' });
  });

  it('a per-unit spawn override (Spawn\'s 4th element) beats the team/mission default', () => {
    // team default is 'ambush' (never moves, not even toward a seen objective); this one unit is overridden to
    // 'camper', which does advance toward a seen objective - so the override is provably in effect, not just stored.
    const s = makeGame(blank(30, 5), { player: { soldier: [1, 2] }, enemy: { tank: [28, 2, 'camper'] } }, { enemyProfile: 'ambush' });
    setObjective(s, 10, 2);
    s.memory.enemy.objectiveSeen = true;
    const t = unit(s, 'enemy', 'tank');
    expect(t.aiProfile).toBe('camper');
    runEnemyTurn(s);
    expect(t.x).toBeLessThan(28);
  });

  describe('habitat: idle behaviour with no visible enemy', () => {
    it('patrol (default) uses search waypoints', () => {
      const s = makeGame(blank(30, 5), { player: { soldier: [1, 2] }, enemy: { tank: [28, 2] } });
      s.map.searchPoints.enemy = [[5, 2]];
      runEnemyTurn(s);
      const t = unit(s, 'enemy', 'tank');
      expect(t.x).toBeLessThan(28); // moved toward the waypoint
    });

    it('camper ignores search waypoints and holds', () => {
      const s = makeGame(blank(30, 5), { player: { soldier: [1, 2] }, enemy: { tank: [28, 2] } }, { enemyProfile: 'camper' });
      s.map.searchPoints.enemy = [[5, 2]];
      runEnemyTurn(s);
      const t = unit(s, 'enemy', 'tank');
      expect(t.x).toBe(28); // did not move
      expect(t.overwatch).toBe(true);
    });

    it('camper still advances toward a seen-but-unreachable objective', () => {
      const s = makeGame(blank(30, 5), { player: { soldier: [1, 2] }, enemy: { tank: [28, 2] } }, { enemyProfile: 'camper' });
      setObjective(s, 10, 2);
      s.memory.enemy.objectiveSeen = true;
      runEnemyTurn(s);
      expect(unit(s, 'enemy', 'tank').x).toBeLessThan(28);
    });

    it('ambush never moves, not even toward a seen objective, until it has a target', () => {
      const s = makeGame(blank(30, 5), { player: { soldier: [1, 2] }, enemy: { tank: [28, 2] } }, { enemyProfile: 'ambush' });
      s.map.searchPoints.enemy = [[5, 2]];
      s.objective = { x: 10, y: 2 };
      s.memory.enemy.objectiveSeen = true;
      runEnemyTurn(s);
      const t = unit(s, 'enemy', 'tank');
      expect(t.x).toBe(28);
      expect(t.overwatch).toBe(true);
    });

    it('ambush fights normally (moves, shoots) once it gets a visible target', () => {
      const s = makeGame(blank(10, 5), { player: { soldier: [2, 2] }, enemy: { soldier: [4, 2] } }, { enemyProfile: 'ambush' });
      runEnemyTurn(s); // both are already in vision/range at this distance
      const shots = s.events.filter((e) => e.t === 'shot');
      expect(shots.length).toBeGreaterThan(0);
    });
  });

  describe('habitat: camper is reluctant to reposition while in combat', () => {
    it('does not move to a better cover tile even with 2 actions and a shot already available', () => {
      // enemy soldier can shoot from (8,2) in the open, or from (7,3) which has low cover to its west - standard
      // AI takes the better tile (see ai.test.ts); camper should stay and shoot from where it started.
      const s = makeGame(blank(16, 6, [[6, 3, 'l']]), { player: { soldier: [2, 3] }, enemy: { soldier: [8, 2] } }, { enemyProfile: 'camper' });
      rolls(s, 0.99);
      runEnemyTurn(s);
      const e = unit(s, 'enemy', 'soldier');
      expect([e.x, e.y]).toEqual([8, 2]); // did not reposition
    });

    it('still closes distance if it can see a target but has no shot at all (out of weapon range)', () => {
      // assault: vision 6, weapon range 4 - so it sees the player at dist 5 (enemies.length > 0) but has no
      // valid shot from where it stands, which is a different case from "no target visible" above.
      const s = makeGame(blank(16, 5), { player: { soldier: [2, 2] }, enemy: { assault: [7, 2] } }, { enemyProfile: 'camper' });
      runEnemyTurn(s);
      const e = unit(s, 'enemy', 'assault');
      expect(e.x).toBeLessThan(7); // moved toward the player rather than sitting just out of range
    });
  });

  describe('difficulty: reactionChance', () => {
    it('reactionChance 1 (standard/hard/camper/ambush) never consumes an RNG draw', () => {
      const s = makeGame(blank(10, 5), { player: { soldier: [2, 2] }, enemy: { soldier: [4, 2] } });
      act(s, { type: 'endTurn' }); // enemy units start each mission with 0 actions until their own phase begins
      const rngBefore = s.rng;
      planAction(s, unit(s, 'enemy', 'soldier'));
      expect(s.rng).toBe(rngBefore); // no roll happened
    });

    it('a failed reaction roll makes the unit hold instead of taking its best shot', () => {
      const s = makeGame(blank(10, 5), { player: { soldier: [2, 2] }, enemy: { soldier: [4, 2] } }, { enemyProfile: 'easy' });
      act(s, { type: 'endTurn' });
      rolls(s, 0.99); // >= 0.5 reactionChance: fails the roll
      const a = planAction(s, unit(s, 'enemy', 'soldier'));
      expect(a).toEqual({ type: 'overwatch', unit: unit(s, 'enemy', 'soldier').id });
    });

    it('a passed reaction roll acts normally', () => {
      const s = makeGame(blank(10, 5), { player: { soldier: [2, 2] }, enemy: { soldier: [4, 2] } }, { enemyProfile: 'easy' });
      act(s, { type: 'endTurn' });
      rolls(s, 0.01); // < 0.5 reactionChance: passes
      const a = planAction(s, unit(s, 'enemy', 'soldier'));
      expect(a?.type).toBe('attack');
    });
  });

  describe('difficulty: retreatBelowHp (hard)', () => {
    it('falls back toward safety instead of fighting once badly hurt', () => {
      const s = makeGame(blank(20, 5), { player: { soldier: [2, 2] }, enemy: { soldier: [8, 2] } }, { enemyProfile: 'hard' });
      act(s, { type: 'endTurn' });
      const e = unit(s, 'enemy', 'soldier');
      e.hp = 1; // well under 30% of 12
      const a = planAction(s, e);
      expect(a?.type).toBe('move');
      if (a?.type === 'move') expect(a.to.x).toBeGreaterThan(e.x); // away from the player, further east
    });

    it('does not retreat above the threshold - fights instead, same visible target as the case above', () => {
      const s = makeGame(blank(20, 5), { player: { soldier: [2, 2] }, enemy: { soldier: [8, 2] } }, { enemyProfile: 'hard' });
      act(s, { type: 'endTurn' });
      rolls(s, 0);
      const e = unit(s, 'enemy', 'soldier');
      e.hp = 10; // well above 30% of 12
      const a = planAction(s, e);
      expect(a?.type).toBe('attack'); // confirms enemies.length > 0 here, not a vacuous "didn't even see them" pass
    });

    it('does not retreat while holding the objective', () => {
      const s = makeGame(blank(20, 5, [[15, 2, 'O']]), { player: { soldier: [2, 2] }, enemy: { soldier: [8, 2] } }, { enemyProfile: 'hard' });
      act(s, { type: 'endTurn' });
      rolls(s, 0);
      const e = unit(s, 'enemy', 'soldier');
      s.capture = { team: 'enemy', unit: e.id, at: { x: e.x, y: e.y }, roundsLeft: 2 };
      e.hp = 1;
      const a = planAction(s, e);
      expect(a?.type).toBe('attack'); // held in place and fought rather than fleeing
    });
  });

  describe('friendly profile (0d: auto-run)', () => {
    it('is patrol habitat, prioritizes a seen objective, and retreats sooner than hard', () => {
      expect(AI_PROFILES.friendly.habitat).toBe('patrol');
      expect(AI_PROFILES.friendly.prioritizeObjective).toBe(true);
      expect(AI_PROFILES.friendly.retreatBelowHp).toBeGreaterThan(AI_PROFILES.hard.retreatBelowHp!);
    });

    it('heads for a seen objective ahead of chasing a spotted ghost', () => {
      const s = makeGame(blank(20, 5), { player: { soldier: [1, 2] } }, { playerProfile: 'friendly' });
      setObjective(s, 15, 2);
      s.memory.player.objectiveSeen = true;
      s.memory.player.lastSeen[999] = { x: 1, y: 4, hidden: false }; // a ghost in the opposite direction
      runAiTurn(s, 'player');
      expect(unit(s, 'player', 'soldier').x).toBeGreaterThan(1); // headed toward the objective (east), not the ghost
    });

    it('a friendly-controlled player unit never reacts to an enemy it has not seen (fog-fair)', () => {
      // mirrors ai.test.ts's equivalent check for the enemy team - the exact same planAction, just team='player'
      const s = makeGame(blank(16, 5, [[4, 1, '#'], [4, 2, '#'], [4, 3, '#']]),
        { player: { soldier: [2, 2] }, enemy: { soldier: [7, 2] } }, { playerProfile: 'friendly' });
      expect(s.seenUnits.player.size).toBe(0); // walled off, sanity check
      runAiTurn(s, 'player');
      expect(s.events.some((e) => e.t === 'shot')).toBe(false);
      expect(unit(s, 'player', 'soldier').x).toBeLessThan(4); // did not walk toward/through the hidden enemy
    });

    it('resolves deterministically for a given seed', () => {
      const setup = () => makeGame(blank(16, 5), { player: { soldier: [2, 2] }, enemy: { soldier: [7, 2] } }, { playerProfile: 'friendly' });
      const run = () => { const s = setup(); runAiTurn(s, 'player'); return { units: s.units, rng: s.rng, shots: s.events.filter((e) => e.t === 'shot').length }; };
      const a = run();
      expect(a.shots).toBeGreaterThan(0); // exercises real RNG draws, not a vacuous no-op comparison
      expect(a).toEqual(run());
    });
  });
});

describe('squad orders for auto-run (16)', () => {
  /** Plays the player team's phase with the AI under `profile`. */
  const runSquad = (s: ReturnType<typeof makeGame>) => runAiTurn(s, 'player');

  it('every squad order is a known profile with a name and blurb', async () => {
    const { SQUAD_ORDERS } = await import('../data/aiProfiles');
    for (const id of SQUAD_ORDERS) expect(AI_PROFILES[id].blurb.length).toBeGreaterThan(10);
  });

  it('defend never goes looking: no waypoint walking, overwatch in place', () => {
    const s = makeGame(blank(30, 5), { player: { soldier: [2, 2] }, enemy: { tank: [28, 2] } }, { playerProfile: 'defend' });
    s.map.searchPoints.player = [[20, 2]];
    runSquad(s);
    const u = unit(s, 'player', 'soldier');
    expect(u.x).toBe(2);
    expect(u.overwatch).toBe(true);
  });

  it('defend does not advance on an enemy it cannot shoot', () => {
    const s = makeGame(blank(30, 5), { player: { soldier: [2, 2] }, enemy: { tank: [20, 2] } }, { playerProfile: 'defend' });
    s.seenUnits.player.add(unit(s, 'enemy', 'tank').id);
    runSquad(s);
    expect(unit(s, 'player', 'soldier').x).toBe(2);
  });

  it('explore heads for loot it can see before the search waypoints', () => {
    const s = makeGame(blank(30, 5), { player: { soldier: [10, 2] }, enemy: { tank: [28, 2] } }, { playerProfile: 'explore' });
    s.map.searchPoints.player = [[25, 2]];
    s.pickups.push({ id: 99, type: 'ammo', x: 4, y: 2, amount: 2 });
    s.visible.player.fill(1);
    runSquad(s);
    expect(unit(s, 'player', 'soldier').x).toBeLessThan(10); // toward the cache at x=4, away from the waypoint
  });

  it('rush walks toward the objective even with an enemy in sight it cannot shoot', () => {
    const s = makeGame(blank(40, 5), { player: { soldier: [2, 2] }, enemy: { tank: [2, 4] } }, { playerProfile: 'rush' });
    setObjective(s, 30, 2);
    s.memory.player.objectiveSeen = true;
    s.seenUnits.player.add(unit(s, 'enemy', 'tank').id);
    runSquad(s);
    expect(unit(s, 'player', 'soldier').x).toBeGreaterThan(2);
  });

  it('balanced (friendly) is still the default auto-run order', async () => {
    const { defaultPrefs } = await import('../ui/prefs');
    expect(defaultPrefs().autoMode).toBe('friendly');
  });
});
