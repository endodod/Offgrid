import { describe, expect, it } from 'vitest';
import type { MapDef, Spawn } from '../data/trainingGrounds';
import type { ClassId } from '../data/units';
import { blank } from '../core/testkit';
import { Session } from './session';

type Spawns = Partial<Record<'player' | 'enemy', Partial<Record<ClassId, [number, number]>>>>;
const toSpawns = (units: Spawns['player'] = {}): Spawn[] => Object.entries(units).map(([cls, at]) => [cls as ClassId, at![0], at![1]]);

/** A Session over a small hand-built map - Session itself has no DOM dependency, only Hud does. */
function makeSession(rows: string[], spawns: Spawns): Session {
  const map: MapDef = { name: 'test', rows, spawns: { player: toSpawns(spawns.player), enemy: toSpawns(spawns.enemy) }, searchPoints: { player: [], enemy: [] } };
  return new Session(map);
}

describe('move-mode hover (0a)', () => {
  it('shows path cost and actions remaining for a reachable tile, and no danger line by default', () => {
    const session = makeSession(blank(10, 5), { player: { soldier: [2, 2] }, enemy: { soldier: [8, 2] } });
    session.setHover({ x: 5, y: 2 }); // 3 tiles away in a straight line, well within soldier move (5)
    const lines = session.hoverInfo()!;
    expect(lines[0]).toBe('Move here: 3 tiles (of 5 max)');
    expect(lines[1]).toBe('Actions after move: 1');
    expect(lines.join(' ')).not.toContain('Danger');
  });

  it('returns null for an unreachable tile (out of move range) so the tile-info fallback can take over', () => {
    const session = makeSession(blank(20, 5), { player: { soldier: [2, 2] }, enemy: { soldier: [18, 2] } });
    session.setHover({ x: 19, y: 2 }); // far past the soldier's move of 5
    expect(session.hoverInfo()).toBeNull();
  });

  it('flags danger when a known (seen) enemy is on overwatch and covers the destination', () => {
    const session = makeSession(blank(10, 5), { player: { soldier: [2, 2] }, enemy: { soldier: [6, 2] } });
    const enemy = session.state.units.find((u) => u.team === 'enemy')!;
    expect(session.state.seenUnits.player.has(enemy.id)).toBe(true); // sanity: open map, within vision/LOS
    enemy.overwatch = true;
    session.setHover({ x: 5, y: 2 }); // within the enemy's weapon range and LOS
    expect(session.hoverInfo()).toContain('Danger: known enemy overwatch covers this tile');
  });

  it('never leaks danger from an enemy the player has not seen (fog-fair)', () => {
    const rows = blank(12, 5, [[6, 0, '#'], [6, 1, '#'], [6, 2, '#'], [6, 3, '#'], [6, 4, '#']]); // wall column blocks LOS
    const session = makeSession(rows, { player: { soldier: [2, 2] }, enemy: { soldier: [9, 2] } });
    const enemy = session.state.units.find((u) => u.team === 'enemy')!;
    expect(session.state.seenUnits.player.has(enemy.id)).toBe(false); // sanity: blocked by the wall
    enemy.overwatch = true; // even so
    session.setHover({ x: 5, y: 2 });
    expect(session.hoverInfo()!.join(' ')).not.toContain('Danger');
  });
});

describe('gadget-mode hover (0a)', () => {
  it('previews grenade damage and who visible would be caught in the blast', () => {
    const session = makeSession(blank(14, 5), { player: { soldier: [2, 2] }, enemy: { soldier: [6, 2] } });
    session.press('gadget'); // soldier's gadget is grenade; enters targeting mode rather than firing immediately
    session.setHover({ x: 6, y: 2 }); // the enemy's own tile: within throw range and inside the blast
    const lines = session.hoverInfo()!;
    expect(lines[0]).toContain('Grenade: 3 dmg');
    expect(lines.some((l) => l.startsWith('Catches:') && !l.includes('nobody visible'))).toBe(true);
  });

  it('shows "nobody visible" when the blast would catch no known unit', () => {
    const session = makeSession(blank(14, 5), { player: { soldier: [2, 2] }, enemy: { soldier: [6, 2] } });
    session.press('gadget');
    session.setHover({ x: 2, y: 4 }); // empty tile, in range, away from the enemy
    const lines = session.hoverInfo()!;
    expect(lines.some((l) => l.includes('nobody visible'))).toBe(true);
  });

  it('explains why an out-of-range tile cannot be targeted', () => {
    const session = makeSession(blank(20, 5), { player: { soldier: [2, 2] }, enemy: { soldier: [18, 2] } });
    session.press('gadget');
    session.setHover({ x: 8, y: 2 }); // dist 6: within soldier vision (7, so visible) but past grenade range (5)
    expect(session.hoverInfo()).toEqual(['Grenade', 'Cannot target: Out of range']);
  });
});
