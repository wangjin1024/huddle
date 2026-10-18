import { describe, expect, it } from 'vitest';
import { PLAYER_SETUP, createGame, rankOf } from '../src/index.js';
import { seeded } from './helpers.js';

describe('createGame', () => {
  it.each([1, 2, 3, 4])('deals a %i-player game by the setup table', (n) => {
    const ids = ['a', 'b', 'c', 'd'].slice(0, n);
    const s = createGame({ playerIds: ids, rng: seeded(n) });
    const { handSize, jesters } = PLAYER_SETUP[n]!;
    expect(s.handSize).toBe(handSize);
    expect(s.players.map((p) => p.hand.length)).toEqual(ids.map(() => handSize));
    const all = [...s.players.flatMap((p) => p.hand), ...s.tavern];
    expect(all).toHaveLength(40 + jesters);
    expect(new Set(all).size).toBe(all.length);
    expect(all.filter((c) => c.startsWith('X'))).toHaveLength(jesters);
    expect(s.currentSeat).toBeGreaterThanOrEqual(0);
    expect(s.currentSeat).toBeLessThan(n);
    expect(s.phase).toBe('play');
  });

  it('stacks the castle as shuffled Jacks, then Queens, then Kings', () => {
    const s = createGame({ playerIds: ['a', 'b'], rng: seeded(7) });
    const castle = [s.enemy.card, ...s.castle];
    expect(castle.map(rankOf)).toEqual(['J', 'J', 'J', 'J', 'Q', 'Q', 'Q', 'Q', 'K', 'K', 'K', 'K']);
    expect(new Set(castle).size).toBe(12);
    expect(s.enemy).toMatchObject({ damage: 0, shield: 0, immunityCancelled: false });
  });

  it('refuses unsupported player counts', () => {
    expect(() => createGame({ playerIds: [] })).toThrow();
    expect(() => createGame({ playerIds: ['a', 'b', 'c', 'd', 'e'] })).toThrow();
  });
});
