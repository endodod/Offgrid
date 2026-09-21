import { describe, expect, it } from 'vitest';
import { runAiTurn } from './ai';
import { blocksLos, blocksMove, closedDoorAt, findPath, hasLos, idx } from './grid';
import { act, blank, makeGame, place, rolls, unit } from './testkit';

// A 1-tile-wide corridor (row y=1) walled off top and bottom, so the door at (4,1) is the only way through.
const corridorEdits = (w: number): [number, number, string][] => {
  const edits: [number, number, string][] = [];
  for (let x = 0; x < w; x++) { edits.push([x, 0, '#']); edits.push([x, 2, '#']); }
  return edits;
};

describe('doors: movement and line of sight (feature 2)', () => {
  const doorMap = () => makeGame(blank(10, 3, corridorEdits(10)), { player: { soldier: [1, 1] }, enemy: { soldier: [8, 1] } }, {}, [
    { id: 1, type: 'door', x: 4, y: 1 },
  ]);

  it('a closed door blocks movement and LOS; an open one does not', () => {
    const s = doorMap();
    const p = unit(s, 'player', 'soldier');
    const e = unit(s, 'enemy', 'soldier');
    expect(closedDoorAt(s, 4, 1)).toBeTruthy();
    expect(blocksMove(s, 4, 1)).toBe(true);
    expect(blocksLos(s, 4, 1)).toBe(true);
    expect(hasLos(s, p, e)).toBe(false);
    expect(findPath(s, p, { x: 7, y: 1 }, 20)).toBeNull(); // just short of the enemy's tile, beyond the door

    s.interactables[0].active = true; // open it directly (perform() is covered below)
    expect(closedDoorAt(s, 4, 1)).toBeUndefined();
    expect(blocksMove(s, 4, 1)).toBe(false);
    expect(blocksLos(s, 4, 1)).toBe(false);
    expect(hasLos(s, p, e)).toBe(true);
    expect(findPath(s, p, { x: 7, y: 1 }, 20)).not.toBeNull();
  });

  it('opening a door costs an action and can trigger enemy overwatch', () => {
    const s = makeGame(blank(20, 5), { player: { soldier: [4, 2] }, enemy: { soldier: [10, 2] } }, {}, [
      { id: 1, type: 'door', x: 5, y: 2 },
    ]);
    const p = unit(s, 'player', 'soldier');
    const e = unit(s, 'enemy', 'soldier');
    expect(hasLos(s, p, e)).toBe(false); // closed door blocks the enemy's view of the player
    act(s, { type: 'endTurn' }); // enemy phase
    act(s, { type: 'overwatch', unit: e.id });
    act(s, { type: 'endTurn' }); // back to the player
    rolls(s, 0.01); // guarantee the reaction shot hits
    const events = act(s, { type: 'interact', unit: p.id, target: 1 });
    expect(p.actions).toBe(1); // cost 1 of the soldier's 2 actions
    expect(s.interactables[0].active).toBe(true); // now open
    expect(events.some((ev) => ev.t === 'shot' && ev.overwatch)).toBe(true);
  });

  it('a switch toggles every door in its links, and toggles back', () => {
    const s = makeGame(blank(10, 5), { player: { soldier: [1, 2] }, enemy: { soldier: [9, 4] } }, {}, [
      { id: 1, type: 'switch', x: 2, y: 2, links: [2, 3] },
      { id: 2, type: 'door', x: 4, y: 2 },
      { id: 3, type: 'door', x: 6, y: 2 },
    ]);
    const p = unit(s, 'player', 'soldier');
    const doors = () => s.interactables.filter((i) => i.type === 'door');
    expect(doors().every((d) => !d.active)).toBe(true);
    act(s, { type: 'interact', unit: p.id, target: 1 });
    expect(s.interactables.find((i) => i.id === 1)!.active).toBe(true); // the switch's own state
    expect(doors().every((d) => d.active)).toBe(true);
    act(s, { type: 'interact', unit: p.id, target: 1 });
    expect(doors().every((d) => !d.active)).toBe(true); // flipping again toggles both doors back shut
  });

  it('the AI does not walk through a closed door: it holds position instead', () => {
    const s = makeGame(blank(9, 3, corridorEdits(9)), { player: { soldier: [8, 1] }, enemy: { soldier: [2, 1] } }, {}, [
      { id: 1, type: 'door', x: 4, y: 1 },
    ]);
    s.map.searchPoints.enemy = [[7, 1]]; // beyond the door, in the same corridor as the (unseen) player
    act(s, { type: 'endTurn' });
    const e = unit(s, 'enemy', 'soldier');
    expect(s.seenUnits.enemy.size).toBe(0); // the closed door hides the player too, symmetrically
    runAiTurn(s, 'enemy');
    expect(e.x).toBe(2); // never crossed the door
    expect(e.y).toBe(1);
    expect(s.events.some((ev) => ev.t === 'shot')).toBe(false);
  });

  it('remembers the last-seen door state under fog until seen again', () => {
    const s = makeGame(blank(20, 3), { player: { soldier: [1, 1] }, enemy: { soldier: [18, 1] } }, {}, [
      { id: 1, type: 'door', x: 3, y: 1 },
    ]);
    const p = unit(s, 'player', 'soldier');
    expect(s.memory.player.doors[1]).toBe(false); // seen closed at the start

    place(s, p, 19, 1); // walk far enough away that the door leaves the player's vision
    s.interactables[0].active = true; // something changes it off-screen
    expect(s.visible.player[idx(s, 3, 1)]).toBeFalsy();
    expect(s.memory.player.doors[1]).toBe(false); // stale: still remembered closed

    place(s, p, 1, 1); // walk back within sight
    expect(s.memory.player.doors[1]).toBe(true); // now correctly remembered open
  });

  it("grenades don't affect doors (v1 scope: not destructible or force-openable)", () => {
    const s = makeGame(blank(20, 5), { player: { soldier: [1, 2] }, enemy: { soldier: [15, 2] } }, {}, [
      { id: 1, type: 'door', x: 3, y: 2 },
    ]);
    const p = unit(s, 'player', 'soldier');
    act(s, { type: 'gadget', unit: p.id, target: { x: 3, y: 2 } }); // grenade centered right on the door tile
    expect(s.interactables[0].active).toBe(false); // untouched by the blast
  });
});
