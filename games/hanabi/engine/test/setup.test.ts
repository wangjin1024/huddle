import { describe, expect, it } from 'vitest';
import { COLOURS, createGame, faceCode, fullDeck, viewFor } from '../src/index.js';
import { seeded } from './helpers.js';

describe('setup', () => {
  it('has 50 cards: three 1s, two each of 2–4 and one 5 per colour', () => {
    const deck = fullDeck();
    expect(deck).toHaveLength(50);
    for (const colour of COLOURS) {
      const counts = [1, 2, 3, 4, 5].map((n) => deck.filter((f) => f.colour === colour && f.number === n).length);
      expect(counts).toEqual([3, 2, 2, 2, 1]);
    }
  });

  it('deals 5 cards each to 2–3 players and 4 each to 4–5', () => {
    for (const [n, size] of [[2, 5], [3, 5], [4, 4], [5, 4]] as const) {
      const ids = Array.from({ length: n }, (_, i) => `p${i}`);
      const s = createGame({ playerIds: ids, rng: seeded(n) });
      expect(s.players.every((p) => p.hand.length === size)).toBe(true);
      expect(s.deck).toHaveLength(50 - n * size);
      expect(s).toMatchObject({ hints: 8, misplays: 0, turn: 0, turnsLeft: null, phase: 'play' });
    }
    expect(() => createGame({ playerIds: ['solo'] })).toThrow();
    expect(() => createGame({ playerIds: ['a', 'b', 'c', 'd', 'e', 'f'] })).toThrow();
  });

  it('shuffles the deck and picks the first player with the rng', () => {
    const a = createGame({ playerIds: ['a', 'b', 'c'], rng: seeded(1) });
    const b = createGame({ playerIds: ['a', 'b', 'c'], rng: seeded(2) });
    expect(a.deck.map(faceCode)).not.toEqual(b.deck.map(faceCode));
    const seats = new Set(Array.from({ length: 20 }, (_, i) => createGame({ playerIds: ['a', 'b', 'c'], rng: seeded(i) }).currentSeat));
    expect(seats.size).toBe(3);
  });

  it('gives card ids in draw order, which reveal nothing', () => {
    const s = createGame({ playerIds: ['a', 'b'], rng: seeded(3) });
    expect(s.players.flatMap((p) => p.hand.map((c) => c.id))).toEqual(Array.from({ length: 10 }, (_, i) => `c${i}`));
    expect(viewFor(s, 'a').players[0]!.hand[0]).toEqual({ id: 'c0', drawnAt: -1, knowledge: { notColours: [], notNumbers: [] } });
  });
});
