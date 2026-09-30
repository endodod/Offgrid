import { describe, expect, it } from 'vitest';
import { endVersusTurn, prepareVersus, versusWinner } from './pvp';
import { blank, makeGame, unit } from './testkit';

describe('hotseat versus', () => {
  const game = () => {
    const s = makeGame(blank(14, 5), { player: { soldier: [1, 2], medic: [1, 3] }, enemy: { sniper: [12, 2], tank: [12, 3] } });
    prepareVersus(s);
    return s;
  };

  it('gives side 2 the same kit side 1 has', () => {
    const s = game();
    expect(unit(s, 'enemy', 'sniper').gadget?.uses).toBeGreaterThan(0);
    expect(s.objectiveDef).toBeNull();
  });

  it('seats the other side as player at the end of each turn, and counts rounds', () => {
    const s = game();
    const sniper = unit(s, 'enemy', 'sniper');
    let side = endVersusTurn(s, 1);
    expect(side).toBe(2);
    expect(sniper.team).toBe('player');
    expect(s.phase).toBe('player');
    expect(sniper.actions).toBe(2);
    expect(s.turn).toBe(1);
    side = endVersusTurn(s, side);
    expect(side).toBe(1);
    expect(sniper.team).toBe('enemy');
    expect(s.turn).toBe(2);
  });

  it('keeps each side\'s memory with that side', () => {
    const s = game();
    s.memory.player.searchIndex = 7; // side 1's
    endVersusTurn(s, 1);
    expect(s.memory.enemy.searchIndex).toBe(7);
    endVersusTurn(s, 2);
    expect(s.memory.player.searchIndex).toBe(7);
  });

  it('reports the winner as a side, whoever is seated', () => {
    const s = game();
    const side = endVersusTurn(s, 1); // side 2 is 'player' now
    for (const u of s.units.filter((x) => x.team === 'enemy')) u.alive = false; // side 1 wiped out
    endVersusTurn(s, side);
    expect(versusWinner(s, 1)).toBe(2);
  });
});
