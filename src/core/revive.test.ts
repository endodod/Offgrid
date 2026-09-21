import { describe, expect, it } from 'vitest';
import { RULES } from '../data/rules';
import { reviveBlock, validate } from './actions';
import { aiTurn, runAiTurn } from './ai';
import { act, blank, endTurns, makeGame, place, rolls, unit } from './testkit';

describe('downed state', () => {
  it('HP reaching 0 downs the unit instead of removing it', () => {
    const s = makeGame(blank(10, 5), { player: { soldier: [2, 2] }, enemy: { assault: [4, 2] } });
    const t = unit(s, 'enemy', 'assault');
    t.hp = 4; // exactly the soldier's damage against 0 armor
    rolls(s, 0);
    act(s, { type: 'attack', unit: unit(s, 'player', 'soldier').id, target: t.id });
    expect(t.hp).toBe(0);
    expect(t.downed).toBe(true);
    expect(t.alive).toBe(true);
    expect(t.bleedOut).toBe(RULES.bleedOutRounds);
    expect(t.overwatch).toBe(false);
  });

  it('a downed unit cannot take any action', () => {
    const s = makeGame(blank(10, 5), { player: { soldier: [2, 2] }, enemy: { soldier: [4, 2] } });
    const u = unit(s, 'player', 'soldier');
    u.downed = true;
    expect(validate(s, { type: 'move', unit: u.id, to: { x: 3, y: 2 } })).toBe('Downed - cannot act');
    expect(validate(s, { type: 'overwatch', unit: u.id })).toBe('Downed - cannot act');
  });

  it('the AI skips downed units of its own team - they never act', () => {
    const s = makeGame(blank(10, 5), { player: { soldier: [2, 2] }, enemy: { soldier: [4, 2], tank: [6, 2] } });
    const downedEnemy = unit(s, 'enemy', 'soldier');
    downedEnemy.downed = true;
    downedEnemy.hp = 0;
    act(s, { type: 'endTurn' });
    const acted = [...aiTurn(s, 'enemy')].filter((a) => a.type !== 'endTurn');
    expect(acted.every((a) => 'unit' in a && a.unit !== downedEnemy.id)).toBe(true);
  });

  it('a downed unit stops contributing to its team\'s vision', () => {
    const s = makeGame(blank(20, 5), { player: { sniper: [2, 2] }, enemy: { soldier: [17, 2] } });
    expect(s.seenUnits.player.size).toBe(0); // sniper vision 8 does not reach x=17 at dist 15
    const sniper = unit(s, 'player', 'sniper');
    place(s, sniper, 10, 2); // now within vision(8) of the enemy at dist 7
    expect(s.seenUnits.player.size).toBe(1);
    sniper.downed = true;
    place(s, sniper, 10, 2); // place() calls refreshVision again
    expect(s.seenUnits.player.size).toBe(0);
  });

  it('bleed-out kills a downed unit for good after RULES.bleedOutRounds of its own team\'s phases', () => {
    const s = makeGame(blank(10, 5), { player: { soldier: [2, 2] }, enemy: { soldier: [4, 2] } });
    const u = unit(s, 'player', 'soldier');
    u.hp = 0;
    u.downed = true;
    u.bleedOut = RULES.bleedOutRounds;
    for (let i = 0; i < RULES.bleedOutRounds - 1; i++) {
      endTurns(s, 2); // one full round: back to the player's own phase start
      expect(u.alive).toBe(true);
      expect(u.downed).toBe(true);
    }
    endTurns(s, 2); // final tick: bleeds out for good
    expect(u.alive).toBe(false);
    expect(u.downed).toBe(false);
  });

  it('a downed unit does not count as eliminated, but permanent death does', () => {
    const s = makeGame(blank(10, 5), { player: { soldier: [2, 2] }, enemy: { soldier: [4, 2] } });
    const foe = unit(s, 'enemy', 'soldier');
    foe.hp = 0;
    foe.downed = true;
    foe.bleedOut = RULES.bleedOutRounds;
    expect(s.winner).toBeNull();
    let guard = 0;
    while (!s.winner && guard++ < 20) act(s, { type: 'endTurn' });
    expect(foe.alive).toBe(false);
    expect(s.winner).toBe('player');
  });

  it('any further hit on a downed unit kills it for good, regardless of amount', () => {
    const s = makeGame(blank(10, 5), { player: { soldier: [2, 2] }, enemy: { soldier: [4, 2] } });
    const foe = unit(s, 'enemy', 'soldier');
    foe.hp = 0;
    foe.downed = true;
    rolls(s, 0.99); // even a "miss" roll does not matter: a finishing shot cannot miss
    const events = act(s, { type: 'attack', unit: unit(s, 'player', 'soldier').id, target: foe.id });
    expect(events.some((e) => e.t === 'shot' && e.finishing)).toBe(true);
    expect(foe.alive).toBe(false);
    expect(foe.downed).toBe(false);
  });
});

describe('revive action', () => {
  const setup = () => {
    const s = makeGame(blank(10, 5), { player: { soldier: [2, 2], medic: [3, 2] }, enemy: { tank: [8, 4] } });
    const downed = unit(s, 'player', 'soldier');
    downed.hp = 0;
    downed.downed = true;
    downed.bleedOut = RULES.bleedOutRounds;
    return { s, downed, reviver: unit(s, 'player', 'medic') };
  };

  it('requires adjacency, a medkit, and a downed ally', () => {
    const { reviver, downed } = setup();
    expect(reviveBlock(reviver, downed)).toBeNull();
    expect(reviveBlock(reviver, { ...downed, downed: false })).toMatch('Not a downed ally');
    expect(reviveBlock({ ...reviver, medkits: 0 }, downed)).toBe('No medkits');
  });

  it('restores partial HP (capped to class max), clears downed status, and consumes a medkit', () => {
    const { s, reviver, downed } = setup();
    const before = reviver.medkits;
    act(s, { type: 'revive', unit: reviver.id, target: downed.id });
    expect(downed.downed).toBe(false);
    expect(downed.bleedOut).toBe(0);
    expect(downed.hp).toBe(RULES.reviveHp);
    expect(reviver.medkits).toBe(before - 1);
    expect(reviver.actions).toBe(1);
    expect(reviver.revives).toBe(1);
  });

  it('a revived unit can act again immediately if it is its team\'s phase', () => {
    const { s, reviver, downed } = setup();
    act(s, { type: 'revive', unit: reviver.id, target: downed.id });
    expect(validate(s, { type: 'overwatch', unit: downed.id })).toBeNull();
  });
});

describe('AI and revive', () => {
  it('an enemy heads for and revives its own downed ally when it has no visible target', () => {
    const s = makeGame(blank(16, 5), { player: { sniper: [15, 4] }, enemy: { soldier: [8, 2], medic: [2, 2] } });
    const downed = unit(s, 'enemy', 'soldier');
    downed.hp = 0;
    downed.downed = true;
    downed.bleedOut = RULES.bleedOutRounds;
    act(s, { type: 'endTurn' });
    runAiTurn(s, 'enemy');
    expect(downed.downed).toBe(false); // medic reached and revived it (well within its move range)
  });

  it('--no-ai-revive (aiRevive: false) leaves a downed ally alone', () => {
    const s = makeGame(blank(16, 5), { player: { sniper: [15, 4] }, enemy: { soldier: [8, 2], medic: [2, 2] } }, { aiRevive: false });
    const downed = unit(s, 'enemy', 'soldier');
    downed.hp = 0;
    downed.downed = true;
    downed.bleedOut = RULES.bleedOutRounds;
    act(s, { type: 'endTurn' });
    runAiTurn(s, 'enemy');
    expect(downed.downed).toBe(true);
  });

  it('finishing off a downed, visible enemy takes priority over engaging a healthy one', () => {
    // both within the tank's vision (5) and weapon range (6), so it genuinely has to choose between them
    const s = makeGame(blank(16, 5), { player: { soldier: [2, 2], sniper: [2, 4] }, enemy: { tank: [6, 2] } });
    const downed = unit(s, 'player', 'soldier');
    downed.hp = 0;
    downed.downed = true;
    act(s, { type: 'endTurn' });
    rolls(s, 0.99);
    runAiTurn(s, 'enemy');
    expect(downed.alive).toBe(false); // finished off rather than shooting at the healthy sniper
  });
});
