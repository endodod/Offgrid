import { describe, expect, it } from 'vitest';
import { act, blank, endTurns, makeGame, rolls, unit } from './testkit';

// An enemy tank sits in a bush; a player soldier stands `dist` tiles away. Bush units are only spotted from within 2 tiles.
const setup = (dist = 4) => {
  const s = makeGame(blank(16, 5, [[8, 2, 'b'], [9, 2, 'b']]), { player: { soldier: [8 - dist, 2] }, enemy: { tank: [8, 2] } });
  return { s, sol: unit(s, 'player', 'soldier'), tank: unit(s, 'enemy', 'tank') };
};

describe('bush exposure', () => {
  it('a unit hiding in a bush is not visible to a distant observer', () => {
    const { s, tank } = setup();
    expect(s.seenUnits.player.has(tank.id)).toBe(false);
  });

  it('acting from the bush exposes the unit through the opponent\'s next phase, then cover returns', () => {
    const { s, sol, tank } = setup();
    act(s, { type: 'endTurn' }); // enemy phase
    tank.ammo = 3;
    const events = act(s, { type: 'reload', unit: tank.id });
    expect(tank.exposed).toBe(true);
    expect(events.some((e) => e.t === 'exposed')).toBe(true);
    expect(s.seenUnits.player.has(tank.id)).toBe(true);

    act(s, { type: 'endTurn' }); // player phase: the exposed tank can be seen and shot
    expect(s.seenUnits.player.has(tank.id)).toBe(true);
    rolls(s, 0.99);
    expect(() => act(s, { type: 'attack', unit: sol.id, target: tank.id })).not.toThrow();

    act(s, { type: 'endTurn' }); // enemy phase again: the bush hides it once more
    expect(tank.exposed).toBe(false);
    expect(s.seenUnits.player.has(tank.id)).toBe(false);
  });

  it('attacking from a bush exposes the attacker', () => {
    const { s, tank } = setup(3); // soldier 3 tiles away: sees nothing in the bush, but the tank sees the soldier
    act(s, { type: 'endTurn' });
    rolls(s, 0.99);
    expect(s.seenUnits.player.has(tank.id)).toBe(false);
    act(s, { type: 'attack', unit: tank.id, target: unit(s, 'player', 'soldier').id });
    expect(tank.exposed).toBe(true);
    expect(s.seenUnits.player.has(tank.id)).toBe(true);
  });

  it('going on overwatch from a bush exposes the unit', () => {
    const { s, tank } = setup();
    act(s, { type: 'endTurn' });
    act(s, { type: 'overwatch', unit: tank.id });
    expect(tank.exposed).toBe(true);
  });

  it('moving does not expose, even between bush tiles', () => {
    const { s, tank } = setup();
    act(s, { type: 'endTurn' });
    act(s, { type: 'move', unit: tank.id, to: { x: 9, y: 2 } });
    expect(tank.exposed).toBe(false);
    expect(s.seenUnits.player.has(tank.id)).toBe(false);
  });

  it('acting on open ground does not expose', () => {
    const s = makeGame(blank(16, 5), { player: { soldier: [4, 2] }, enemy: { tank: [8, 2] } });
    const tank = unit(s, 'enemy', 'tank');
    act(s, { type: 'endTurn' });
    tank.ammo = 3;
    act(s, { type: 'reload', unit: tank.id });
    expect(tank.exposed).toBe(false);
  });

  it('an exposed unit still needs its tile in view: a wall keeps hiding it', () => {
    const s = makeGame(blank(16, 5, [[8, 2, 'b'], [6, 1, '#'], [6, 2, '#'], [6, 3, '#']]), { player: { soldier: [4, 2] }, enemy: { tank: [8, 2] } });
    const tank = unit(s, 'enemy', 'tank');
    act(s, { type: 'endTurn' });
    tank.ammo = 3;
    act(s, { type: 'reload', unit: tank.id });
    expect(tank.exposed).toBe(true);
    expect(s.seenUnits.player.has(tank.id)).toBe(false);
  });

  it('works the same for player units: the enemy sees them after they act from a bush', () => {
    const s = makeGame(blank(16, 5, [[8, 2, 'b']]), { player: { soldier: [8, 2] }, enemy: { tank: [12, 2] } });
    const sol = unit(s, 'player', 'soldier');
    expect(s.seenUnits.enemy.has(sol.id)).toBe(false);
    sol.ammo = 3;
    act(s, { type: 'reload', unit: sol.id });
    expect(s.seenUnits.enemy.has(sol.id)).toBe(true);
    endTurns(s, 2); // back to the player's phase: cover restored
    expect(sol.exposed).toBe(false);
    expect(s.seenUnits.enemy.has(sol.id)).toBe(false);
  });

  it('a reaction shot fired from a bush exposes the watcher', () => {
    const s = makeGame(blank(16, 5, [[8, 2, 'b']]), { player: { soldier: [8, 2] }, enemy: { tank: [13, 2] } });
    const sol = unit(s, 'player', 'soldier'), tank = unit(s, 'enemy', 'tank');
    act(s, { type: 'overwatch', unit: sol.id });
    act(s, { type: 'endTurn' }); // enemy phase
    sol.exposed = false; // isolate the reaction shot from the exposure caused by setting overwatch
    rolls(s, 0.99);
    act(s, { type: 'move', unit: tank.id, to: { x: 12, y: 2 } }); // 4 tiles from the watcher: it fires
    expect(sol.overwatch).toBe(false);
    expect(sol.exposed).toBe(true);
    expect(s.seenUnits.enemy.has(sol.id)).toBe(true);
  });
});
