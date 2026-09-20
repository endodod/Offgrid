import { describe, expect, it } from 'vitest';
import { act, blank, endTurns, makeGame, place, unit } from './testkit';
import { idx } from './grid';
import { refreshVision } from './vision';

describe('fog of war', () => {
  it('a team sees the union of unit vision (range + LOS)', () => {
    const s = makeGame(blank(24, 9, [[5, 3, '#'], [5, 4, '#'], [5, 5, '#']]), {
      player: { tank: [2, 4] }, // vision 5
      enemy: { soldier: [22, 4], assault: [8, 4], sniper: [2, 8] },
    });
    const sees = (x: number, y: number) => s.visible.player[idx(s, x, y)] === 1;
    expect(sees(2, 4)).toBe(true);
    expect(sees(4, 4)).toBe(true);
    expect(sees(5, 4)).toBe(true); // the wall face itself is visible
    expect(sees(7, 4)).toBe(false); // behind the wall
    expect(sees(22, 4)).toBe(false); // out of range
    expect(s.seenUnits.player.has(unit(s, 'enemy', 'assault').id)).toBe(false);
    expect(s.seenUnits.player.has(unit(s, 'enemy', 'sniper').id)).toBe(true); // 4 tiles south, in range
  });

  it('vision is recomputed after a move and unions with allies', () => {
    const s = makeGame(blank(24, 5), { player: { tank: [2, 2], soldier: [3, 4] }, enemy: { sniper: [12, 2] } });
    const sn = unit(s, 'enemy', 'sniper');
    expect(s.seenUnits.player.has(sn.id)).toBe(false);
    act(s, { type: 'move', unit: unit(s, 'player', 'soldier').id, to: { x: 7, y: 3 } }); // soldier vision 7 reaches (12,2)
    expect(s.seenUnits.player.has(sn.id)).toBe(true);
  });

  it('the debug toggle reveals everything to the player only', () => {
    const s = makeGame(blank(24, 5), { player: { tank: [1, 2] }, enemy: { sniper: [22, 2] } });
    s.fogEnabled = false;
    refreshVision(s);
    expect(s.seenUnits.player.has(unit(s, 'enemy', 'sniper').id)).toBe(true);
    expect(s.seenUnits.enemy.has(unit(s, 'player', 'tank').id)).toBe(false);
  });
});

describe('bushes', () => {
  const setup = () => makeGame(blank(16, 5, [[8, 2, 'b']]), { player: { soldier: [1, 2], sniper: [1, 4] }, enemy: { tank: [8, 2] } });

  it('hide units unless an observer is within 2 tiles', () => {
    const s = setup();
    const tank = unit(s, 'enemy', 'tank');
    const sol = unit(s, 'player', 'soldier');
    place(s, sol, 4, 2); // dist 4: the tile is visible but the unit is hidden
    expect(s.visible.player[idx(s, 8, 2)]).toBe(1);
    expect(s.seenUnits.player.has(tank.id)).toBe(false);
    place(s, sol, 6, 2); // dist 2: revealed
    expect(s.seenUnits.player.has(tank.id)).toBe(true);
    place(s, sol, 5, 2); // dist 3: hidden again
    expect(s.seenUnits.player.has(tank.id)).toBe(false);
  });

  it('a hidden unit cannot be targeted', () => {
    const s = setup();
    place(s, unit(s, 'player', 'soldier'), 4, 2);
    expect(() => act(s, { type: 'attack', unit: unit(s, 'player', 'soldier').id, target: unit(s, 'enemy', 'tank').id })).toThrow('not visible');
  });

  it('a scan reveals them', () => {
    const s = setup();
    place(s, unit(s, 'player', 'soldier'), 4, 2);
    act(s, { type: 'gadget', unit: unit(s, 'player', 'sniper').id, target: { x: 9, y: 2 } });
    expect(s.seenUnits.player.has(unit(s, 'enemy', 'tank').id)).toBe(true);
  });

  it('the enemy team is bound by the same rule', () => {
    const s = makeGame(blank(16, 5, [[5, 2, 'b']]), { player: { soldier: [5, 2] }, enemy: { tank: [9, 2] } });
    expect(s.seenUnits.enemy.has(unit(s, 'player', 'soldier').id)).toBe(false);
    place(s, unit(s, 'enemy', 'tank'), 7, 2);
    expect(s.seenUnits.enemy.has(unit(s, 'player', 'soldier').id)).toBe(true);
  });
});

describe('scan', () => {
  it('reveals fog behind walls for 2 turns, ignoring range and LOS', () => {
    const s = makeGame(blank(24, 5, [[10, 1, '#'], [10, 2, '#'], [10, 3, '#']]), { player: { sniper: [2, 2] }, enemy: { tank: [20, 2] } });
    const tank = unit(s, 'enemy', 'tank');
    expect(s.seenUnits.player.has(tank.id)).toBe(false);
    act(s, { type: 'gadget', unit: unit(s, 'player', 'sniper').id, target: { x: 19, y: 2 } }); // far beyond range 8
    expect(s.seenUnits.player.has(tank.id)).toBe(true);
    endTurns(s, 2); // turn 2
    expect(s.seenUnits.player.has(tank.id)).toBe(true);
    endTurns(s, 2); // turn 3: expired
    expect(s.seenUnits.player.has(tank.id)).toBe(false);
  });
});

describe('memory', () => {
  const setup = () => {
    const s = makeGame(blank(24, 5, [[8, 1, '#'], [8, 2, '#'], [8, 3, '#']]), { player: { soldier: [2, 2] }, enemy: { tank: [7, 2] } });
    return { s, sol: unit(s, 'player', 'soldier'), tank: unit(s, 'enemy', 'tank') };
  };

  it('keeps a last-seen ghost for an enemy that leaves vision', () => {
    const { s, tank } = setup();
    expect(s.memory.player.lastSeen[tank.id]).toMatchObject({ x: 7, y: 2 });
    place(s, tank, 12, 2); // walks behind the wall
    expect(s.seenUnits.player.has(tank.id)).toBe(false);
    expect(s.memory.player.lastSeen[tank.id]).toMatchObject({ x: 7, y: 2 }); // still where we last saw it
  });

  it('the ghost is cleared by a fresh look at its tile after it was out of sight', () => {
    const { s, sol, tank } = setup();
    place(s, tank, 12, 2);
    place(s, sol, 0, 4); // (7,2) is now out of sight (dist 7.3 > 7)
    expect(s.memory.player.lastSeen[tank.id]).toBeDefined();
    place(s, sol, 2, 2); // look again: empty
    expect(s.memory.player.lastSeen[tank.id]).toBeUndefined();
  });

  it('the ghost is cleared when a friendly unit reaches it, or when the enemy dies', () => {
    const { s, sol, tank } = setup();
    place(s, tank, 12, 2);
    place(s, sol, 6, 2);
    expect(s.memory.player.lastSeen[tank.id]).toBeUndefined();
    const b = setup();
    place(b.s, b.tank, 12, 2);
    b.tank.alive = false;
    refreshVision(b.s);
    expect(b.s.memory.player.lastSeen[b.tank.id]).toBeUndefined();
  });

  it('a unit hiding in a bush does not leak its position through the ghost', () => {
    const s = makeGame(blank(24, 5, [[7, 2, 'b']]), { player: { soldier: [2, 2] }, enemy: { tank: [6, 2] } });
    const tank = unit(s, 'enemy', 'tank');
    place(s, tank, 7, 2);
    expect(s.seenUnits.player.has(tank.id)).toBe(false);
    expect(s.memory.player.lastSeen[tank.id]).toMatchObject({ x: 6, y: 2 });
  });

  it('remembers the objective once seen', () => {
    const s = makeGame(blank(24, 5, [[15, 2, 'O']]), { player: { sniper: [2, 2] }, enemy: { tank: [22, 4] } });
    expect(s.memory.player.objectiveSeen).toBe(false);
    place(s, unit(s, 'player', 'sniper'), 9, 2);
    expect(s.memory.player.objectiveSeen).toBe(true);
    place(s, unit(s, 'player', 'sniper'), 1, 4);
    expect(s.memory.player.objectiveSeen).toBe(true);
  });
});

describe('debug fog toggle', () => {
  it('does not write into the player memory while everything is revealed', () => {
    const s = makeGame(blank(24, 5, [[15, 2, 'O']]), { player: { soldier: [1, 2] }, enemy: { tank: [22, 2] } });
    s.fogEnabled = false;
    refreshVision(s);
    expect(s.memory.player.lastSeen).toEqual({});
    expect(s.memory.player.objectiveSeen).toBe(false);
    s.fogEnabled = true;
    refreshVision(s);
    expect(s.seenUnits.player.size).toBe(0);
  });
});
