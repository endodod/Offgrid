import { describe, expect, it } from 'vitest';
import { gadgetBlock } from './actions';
import { findPath } from './grid';
import { act, blank, endTurns, makeGame, place, rolls, unit } from './testkit';

const far: [number, number] = [22, 8]; // parking spot for an enemy that should not interfere

describe('gadgets: uses and cooldown', () => {
  const setup = () => makeGame(blank(24, 9), { player: { soldier: [1, 2] }, enemy: { tank: far } });

  it('cooldown: used on turn N, ready again on turn N+3, ticking only at the owner phase start', () => {
    const s = setup();
    const u = unit(s, 'player', 'soldier');
    act(s, { type: 'gadget', unit: u.id, target: { x: 4, y: 2 } });
    expect(u.gadget!.uses).toBe(2);
    expect(s.turn).toBe(1);
    act(s, { type: 'endTurn' }); // enemy phase of turn 1: player cooldowns do not tick
    expect(u.gadget!.cooldown).toBe(3);
    act(s, { type: 'endTurn' }); // player turn 2
    expect(s.turn).toBe(2);
    expect(gadgetBlock(u)).toMatch(/Cooling down/);
    endTurns(s, 2); // player turn 3
    expect(s.turn).toBe(3);
    expect(gadgetBlock(u)).toMatch(/Cooling down/);
    endTurns(s, 2); // player turn 4
    expect(s.turn).toBe(4);
    expect(gadgetBlock(u)).toBeNull();
    act(s, { type: 'gadget', unit: u.id, target: { x: 4, y: 2 } });
    expect(u.gadget!.uses).toBe(1);
  });

  it('is limited to 3 uses per mission', () => {
    const s = setup();
    const u = unit(s, 'player', 'soldier');
    for (let i = 0; i < 3; i++) {
      u.gadget!.cooldown = 0;
      u.actions = 2;
      act(s, { type: 'gadget', unit: u.id, target: { x: 4, y: 2 } });
    }
    u.gadget!.cooldown = 0;
    u.actions = 2;
    expect(gadgetBlock(u)).toBe('No uses left');
  });

  it('enemies have no gadgets', () => {
    expect(unit(setup(), 'enemy', 'tank').gadget).toBeNull();
  });

  it('only visible tiles can be targeted (scan excepted)', () => {
    const wall: [number, number, string][] = Array.from({ length: 9 }, (_, y) => [3, y, '#']);
    const s = makeGame(blank(24, 9, wall), { player: { soldier: [1, 2], sniper: [1, 6] }, enemy: { tank: far } });
    const sol = unit(s, 'player', 'soldier');
    expect(() => act(s, { type: 'gadget', unit: sol.id, target: { x: 5, y: 2 } })).toThrow('Target tile not visible');
    expect(() => act(s, { type: 'gadget', unit: sol.id, target: { x: 1, y: 8 } })).toThrow('Out of range'); // visible but 6 tiles away
    act(s, { type: 'gadget', unit: unit(s, 'player', 'sniper').id, target: { x: 5, y: 2 } }); // scan any tile
  });
});

describe('adrenaline', () => {
  const setup = () => {
    const s = makeGame(blank(24, 9), { player: { assault: [1, 2] }, enemy: { tank: far } });
    return { s, u: unit(s, 'player', 'assault') };
  };
  it('costs 1 action but restores 2: a net gain of 1 action (2 -> 3)', () => {
    const { s, u } = setup();
    expect(u.actions).toBe(2);
    act(s, { type: 'gadget', unit: u.id });
    expect(u.actions).toBe(3);
    // with only one action left it still nets +1
    const b = setup();
    b.u.actions = 1;
    act(b.s, { type: 'gadget', unit: b.u.id });
    expect(b.u.actions).toBe(2);
  });
  it('the extra action is real: 3 actions to spend, then none', () => {
    const { s, u } = setup();
    act(s, { type: 'gadget', unit: u.id });
    act(s, { type: 'move', unit: u.id, to: { x: 4, y: 2 } });
    act(s, { type: 'move', unit: u.id, to: { x: 8, y: 2 } });
    act(s, { type: 'move', unit: u.id, to: { x: 12, y: 2 } });
    expect(u.actions).toBe(0);
    expect(() => act(s, { type: 'move', unit: u.id, to: { x: 13, y: 2 } })).toThrow('No actions left');
  });
  it('lets the next move go further (Move 6 + 4)', () => {
    const { s, u } = setup();
    expect(() => act(s, { type: 'move', unit: u.id, to: { x: 11, y: 2 } })).toThrow('Cannot reach'); // 10 > 6
    act(s, { type: 'gadget', unit: u.id });
    expect(u.actions).toBe(3);
    expect(u.moveBonus).toBe(4);
    act(s, { type: 'move', unit: u.id, to: { x: 11, y: 2 } }); // 10 tiles
    expect(u.x).toBe(11);
    expect(u.actions).toBe(2);
  });
  it('only boosts one move: the bonus is used up even by a short move', () => {
    const { s, u } = setup();
    act(s, { type: 'gadget', unit: u.id });
    act(s, { type: 'move', unit: u.id, to: { x: 3, y: 2 } }); // short hop consumes it
    expect(u.moveBonus).toBe(0);
    expect(() => act(s, { type: 'move', unit: u.id, to: { x: 13, y: 2 } })).toThrow('Cannot reach'); // back to Move 6
  });
  it('is gone at the end of the turn, and cannot be stacked', () => {
    const { s, u } = setup();
    act(s, { type: 'gadget', unit: u.id });
    u.gadget!.cooldown = 0;
    expect(gadgetBlock(u)).toBe('Adrenaline already active');
    endTurns(s, 2);
    expect(u.moveBonus).toBe(0);
    expect(() => act(s, { type: 'move', unit: u.id, to: { x: 8, y: 2 } })).toThrow('Cannot reach');
  });
});

describe('grenade', () => {
  it('high cover becomes low, low cover is destroyed, 3 flat damage hits everyone in the blast', () => {
    const s = makeGame(blank(24, 9, [[5, 2, 'h'], [4, 3, 'l'], [6, 1, 'l']]), {
      player: { soldier: [1, 2], tank: [5, 3] }, enemy: { sniper: [6, 2], tank: far },
    });
    const thrower = unit(s, 'player', 'soldier');
    const ally = unit(s, 'player', 'tank');
    const foe = unit(s, 'enemy', 'sniper');
    act(s, { type: 'gadget', unit: thrower.id, target: { x: 5, y: 2 } });
    expect(s.cover[2 * 24 + 5]).toBe('low'); // was high
    expect(s.cover[3 * 24 + 4]).toBeNull(); // destroyed
    expect(s.cover[1 * 24 + 6]).toBeNull(); // destroyed
    expect(foe.hp).toBe(8 - 3);
    expect(ally.hp).toBe(24 - 3); // friendly fire, armor ignored
    expect(thrower.hp).toBe(12); // outside the blast
  });
  it('brings the last enemy to 0 HP: downs it, does not end the game yet', () => {
    const s = makeGame(blank(24, 9), { player: { soldier: [1, 2] }, enemy: { sniper: [5, 2] } });
    const foe = unit(s, 'enemy', 'sniper');
    foe.hp = 3;
    act(s, { type: 'gadget', unit: unit(s, 'player', 'soldier').id, target: { x: 5, y: 2 } });
    expect(foe.downed).toBe(true);
    expect(foe.alive).toBe(true);
    expect(s.winner).toBeNull();
  });
  it('a finishing shot on the downed last enemy ends the game', () => {
    const s = makeGame(blank(24, 9), { player: { soldier: [1, 2] }, enemy: { sniper: [5, 2] } });
    const soldier = unit(s, 'player', 'soldier');
    const foe = unit(s, 'enemy', 'sniper');
    foe.hp = 3;
    act(s, { type: 'gadget', unit: soldier.id, target: { x: 5, y: 2 } }); // grenade downs the last enemy
    act(s, { type: 'attack', unit: soldier.id, target: foe.id }); // guaranteed kill on a downed target
    expect(foe.alive).toBe(false);
    expect(s.winner).toBe('player');
  });
});

describe('tank cover gadget', () => {
  it('low -> high, empty tile -> low, high and occupied tiles are rejected', () => {
    const s = makeGame(blank(24, 9, [[4, 2, 'l'], [3, 3, 'h']]), { player: { tank: [3, 2] }, enemy: { sniper: far } });
    const t = unit(s, 'player', 'tank');
    act(s, { type: 'gadget', unit: t.id, target: { x: 4, y: 2 } });
    expect(s.cover[2 * 24 + 4]).toBe('high');
    t.gadget!.cooldown = 0; t.actions = 2;
    act(s, { type: 'gadget', unit: t.id, target: { x: 2, y: 2 } });
    expect(s.cover[2 * 24 + 2]).toBe('low');
    t.gadget!.cooldown = 0; t.actions = 2;
    expect(() => act(s, { type: 'gadget', unit: t.id, target: { x: 3, y: 3 } })).toThrow('Already high cover');
    expect(() => act(s, { type: 'gadget', unit: t.id, target: { x: 3, y: 2 } })).toThrow('Tile occupied');
    expect(() => act(s, { type: 'gadget', unit: t.id, target: { x: 0, y: 2 } })).toThrow('Out of range');
  });
});

describe('overwatch', () => {
  // Player soldier (range 7, vision 7) watches a long lane; enemy tank walks toward it.
  const setup = () => {
    const s = makeGame(blank(20, 5), { player: { soldier: [1, 2] }, enemy: { tank: [12, 2], sniper: [19, 4] } });
    const sol = unit(s, 'player', 'soldier');
    act(s, { type: 'overwatch', unit: sol.id });
    act(s, { type: 'endTurn' });
    return { s, sol, tank: unit(s, 'enemy', 'tank'), sniper: unit(s, 'enemy', 'sniper') };
  };

  it('costs an action, reserves the weapon and fires once at a mover entering range', () => {
    const { s, sol, tank } = setup();
    expect(sol.actions).toBe(1); // overwatch cost 1 of 2 actions
    rolls(s, 0);
    const events = act(s, { type: 'move', unit: tank.id, to: { x: 8, y: 2 } }); // steps 11, 10, 9, 8 -> range 7 at x=8
    const shots = events.filter((e) => e.t === 'shot');
    expect(shots).toHaveLength(1);
    expect(shots[0].t === 'shot' && shots[0].overwatch).toBe(true);
    expect(tank.hp).toBe(24 - 1); // 4 dmg - 3 armor
    expect(sol.ammo).toBe(5);
    expect(sol.overwatch).toBe(false); // ends afterward
  });

  it('does not trigger outside weapon range, and fires only once', () => {
    const { s, sol, tank, sniper } = setup();
    act(s, { type: 'move', unit: tank.id, to: { x: 9, y: 2 } }); // distance 8 - out of range
    expect(sol.overwatch).toBe(true);
    expect(sol.ammo).toBe(6);
    rolls(s, 0.99);
    act(s, { type: 'move', unit: tank.id, to: { x: 8, y: 2 } }); // in range: fires (misses)
    expect(sol.ammo).toBe(5);
    place(s, sniper, 8, 3);
    const events = act(s, { type: 'move', unit: sniper.id, to: { x: 8, y: 4 } });
    expect(events.some((e) => e.t === 'shot')).toBe(false); // already spent
  });

  it('also triggers on non-move actions inside range', () => {
    const { s, tank } = setup();
    place(s, tank, 7, 2);
    rolls(s, 0.99);
    // Placing the unit directly bypasses triggers; a reload counts as acting in range.
    tank.ammo = 3;
    const events = act(s, { type: 'reload', unit: tank.id });
    expect(events.some((e) => e.t === 'shot' && e.overwatch)).toBe(true);
  });

  it('cannot see targets hidden in bushes, so it does not fire', () => {
    const s = makeGame(blank(20, 5, [[7, 2, 'b'], [8, 2, 'b']]), { player: { soldier: [1, 2] }, enemy: { tank: [12, 2] } });
    const sol = unit(s, 'player', 'soldier');
    act(s, { type: 'overwatch', unit: sol.id });
    act(s, { type: 'endTurn' });
    const tank = unit(s, 'enemy', 'tank');
    place(s, tank, 10, 2);
    const events = act(s, { type: 'move', unit: tank.id, to: { x: 7, y: 2 } }); // walks through bushes at 8 and 7, in range but hidden
    expect(events.some((e) => e.t === 'shot')).toBe(false);
    expect(sol.overwatch).toBe(true);
  });

  it('is cleared when the owner phase starts again, and needs ammo', () => {
    const { s, sol } = setup();
    act(s, { type: 'endTurn' });
    expect(sol.overwatch).toBe(false);
    sol.ammo = 0;
    expect(() => act(s, { type: 'overwatch', unit: sol.id })).toThrow('Out of ammo');
  });

  it('blocks attacking while the weapon is reserved', () => {
    const s = makeGame(blank(20, 5), { player: { soldier: [1, 2] }, enemy: { tank: [5, 2] } });
    const sol = unit(s, 'player', 'soldier');
    act(s, { type: 'overwatch', unit: sol.id });
    expect(() => act(s, { type: 'attack', unit: sol.id, target: unit(s, 'enemy', 'tank').id })).toThrow('reserved');
  });
});

describe('first aid', () => {
  const setup = () => {
    const s = makeGame(blank(12, 5), { player: { soldier: [2, 2], assault: [3, 2], sniper: [8, 2] }, enemy: { tank: [11, 4] } });
    return { s, medic: unit(s, 'player', 'soldier'), ally: unit(s, 'player', 'assault'), far: unit(s, 'player', 'sniper') };
  };
  it('heals 3 HP (capped) using the acting unit\'s own medkit', () => {
    const { s, medic, ally } = setup();
    ally.hp = 5;
    act(s, { type: 'aid', unit: medic.id, target: ally.id });
    expect(ally.hp).toBe(8);
    expect(medic.medkits).toBe(1);
    expect(ally.medkits).toBe(2);
    ally.hp = 11;
    const events = act(s, { type: 'aid', unit: medic.id, target: ally.id });
    expect(ally.hp).toBe(12);
    expect(events[0].t === 'heal' && events[0].amount).toBe(1);
  });
  it('is limited to 2 medkits per unit', () => {
    const { s, medic } = setup();
    medic.hp = 1;
    act(s, { type: 'aid', unit: medic.id, target: medic.id }); // self is allowed
    act(s, { type: 'endTurn' }); act(s, { type: 'endTurn' });
    medic.hp = 1;
    act(s, { type: 'aid', unit: medic.id, target: medic.id });
    expect(medic.medkits).toBe(0);
    medic.hp = 1;
    act(s, { type: 'endTurn' }); act(s, { type: 'endTurn' });
    expect(() => act(s, { type: 'aid', unit: medic.id, target: medic.id })).toThrow('No medkits');
  });
  it('needs an adjacent, wounded ally', () => {
    const { s, medic, far, ally } = setup();
    far.hp = 1;
    expect(() => act(s, { type: 'aid', unit: medic.id, target: far.id })).toThrow('not adjacent');
    expect(() => act(s, { type: 'aid', unit: medic.id, target: ally.id })).toThrow('full HP');
    expect(() => act(s, { type: 'aid', unit: medic.id, target: unit(s, 'enemy', 'tank').id })).toThrow('Not an ally');
  });
});

describe('objective and win/lose', () => {
  const hold = () => {
    const s = makeGame(blank(10, 5, [[5, 2, 'O']]), { player: { soldier: [1, 2], sniper: [1, 4] }, enemy: { tank: [9, 4] } });
    return { s, u: unit(s, 'player', 'soldier'), other: unit(s, 'player', 'sniper') };
  };
  it('interacting needs adjacency, costs 1 action and starts a hold instead of winning at once', () => {
    const { s, u } = hold();
    expect(() => act(s, { type: 'interact', unit: u.id })).toThrow('not adjacent');
    act(s, { type: 'move', unit: u.id, to: { x: 4, y: 2 } });
    act(s, { type: 'interact', unit: u.id });
    expect(s.winner).toBeNull();
    expect(u.actions).toBe(0);
    expect(s.capture).toMatchObject({ team: 'player', unit: u.id, roundsLeft: 2 });
  });
  it('the mission is won once the unit has stood there for 2 rounds', () => {
    const { s, u } = hold();
    act(s, { type: 'move', unit: u.id, to: { x: 4, y: 2 } });
    act(s, { type: 'interact', unit: u.id });
    endTurns(s, 2); // start of turn 2: one round held
    expect(s.turn).toBe(2);
    expect(s.winner).toBeNull();
    expect(s.capture!.roundsLeft).toBe(1);
    u.ammo = 1;
    act(s, { type: 'reload', unit: u.id }); // other actions do not break the hold
    expect(s.capture).not.toBeNull();
    endTurns(s, 2); // start of turn 3: two rounds held
    expect(s.winner).toBe('player');
  });
  it('moving away, or dying, breaks the hold', () => {
    const a = hold();
    act(a.s, { type: 'move', unit: a.u.id, to: { x: 4, y: 2 } });
    act(a.s, { type: 'interact', unit: a.u.id });
    endTurns(a.s, 2);
    act(a.s, { type: 'move', unit: a.u.id, to: { x: 4, y: 3 } });
    expect(a.s.capture).toBeNull();
    endTurns(a.s, 2);
    expect(a.s.winner).toBeNull();

    const b = hold();
    act(b.s, { type: 'move', unit: b.u.id, to: { x: 4, y: 2 } });
    act(b.s, { type: 'interact', unit: b.u.id });
    act(b.s, { type: 'endTurn' });
    b.u.hp = 1;
    rolls(b.s, 0);
    const foe = unit(b.s, 'enemy', 'tank');
    place(b.s, foe, 7, 2);
    act(b.s, { type: 'attack', unit: foe.id, target: b.u.id });
    expect(b.u.downed).toBe(true);
    expect(b.s.capture).toBeNull();
  });
  it('only one unit can secure at a time, and the same unit cannot restart', () => {
    const { s, u, other } = hold();
    act(s, { type: 'move', unit: u.id, to: { x: 4, y: 2 } });
    act(s, { type: 'interact', unit: u.id });
    place(s, other, 5, 3);
    expect(() => act(s, { type: 'interact', unit: other.id })).toThrow('already being secured');
    u.actions = 1;
    expect(() => act(s, { type: 'interact', unit: u.id })).toThrow('Already securing');
  });
  it('the objective tile itself cannot be walked onto', () => {
    const s = makeGame(blank(10, 5, [[5, 2, 'O']]), { player: { soldier: [1, 2] }, enemy: { tank: [9, 4] } });
    expect(() => act(s, { type: 'move', unit: unit(s, 'player', 'soldier').id, to: { x: 5, y: 2 } })).toThrow();
  });
  it('objective capture can be limited to the player, opened to both teams, or disabled', () => {
    const tryCapture = (objectiveCapture: 'player' | 'both' | 'none', team: 'player' | 'enemy') => {
      const s = makeGame(blank(10, 5, [[5, 2, 'O']]), { player: { soldier: [4, 2] }, enemy: { tank: [6, 2] } }, { objectiveCapture });
      if (team === 'enemy') act(s, { type: 'endTurn' });
      const r = () => act(s, { type: 'interact', unit: unit(s, team, team === 'player' ? 'soldier' : 'tank').id });
      return { s, r };
    };
    const e = tryCapture('player', 'enemy');
    expect(e.r).toThrow('cannot capture');
    const both = tryCapture('both', 'enemy');
    both.r();
    expect(both.s.capture?.team).toBe('enemy');
    const p = tryCapture('player', 'player');
    p.r();
    expect(p.s.capture?.team).toBe('player');
    expect(tryCapture('none', 'player').r).toThrow('disabled');
  });
  it('the player loses when all player units are dead (downed doesn\'t count - a finishing shot does)', () => {
    const s = makeGame(blank(10, 5), { player: { sniper: [1, 2] }, enemy: { soldier: [4, 2] } });
    const sniper = unit(s, 'player', 'sniper');
    sniper.hp = 1;
    act(s, { type: 'endTurn' });
    rolls(s, 0);
    const foe = unit(s, 'enemy', 'soldier');
    act(s, { type: 'attack', unit: foe.id, target: sniper.id }); // downs the last player unit
    expect(sniper.downed).toBe(true);
    expect(s.winner).toBeNull();
    act(s, { type: 'attack', unit: foe.id, target: sniper.id }); // finishing shot: permanent
    expect(sniper.alive).toBe(false);
    expect(s.winner).toBe('enemy');
    expect(() => act(s, { type: 'endTurn' })).toThrow('over');
  });
});

describe('movement', () => {
  it('respects the Move stat and does not cut blocked corners', () => {
    const s = makeGame(blank(10, 6, [[3, 2, '#'], [2, 3, '#']]), { player: { tank: [2, 2] }, enemy: { sniper: [9, 5] } });
    const t = unit(s, 'player', 'tank');
    expect(() => act(s, { type: 'move', unit: t.id, to: { x: 7, y: 2 } })).toThrow('Cannot reach'); // 5 > move 4
    // (3,3) is diagonal to (2,2) but both corners are walls: the walk has to detour (> 1 step, > tank move)
    expect(findPath(s, t, { x: 3, y: 3 }, 10)!.length).toBeGreaterThan(1);
    expect(() => act(s, { type: 'move', unit: t.id, to: { x: 3, y: 3 } })).toThrow('Cannot reach');
    act(s, { type: 'move', unit: t.id, to: { x: 1, y: 3 } }); // a legal diagonal
    expect(t.actions).toBe(1);
  });
  it('units block movement', () => {
    const s = makeGame(blank(10, 3), { player: { tank: [2, 1], soldier: [3, 1] }, enemy: { sniper: [9, 2] } });
    expect(() => act(s, { type: 'move', unit: unit(s, 'player', 'tank').id, to: { x: 3, y: 1 } })).toThrow('Cannot reach');
  });
});

