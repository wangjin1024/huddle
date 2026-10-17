import { describe, expect, it } from 'vitest';
import { DIFFICULTY, applyAction, createGame, createGameFromHands } from '../src/index.js';
import { act, b, errorOf, r, seeded, wid, y } from './helpers.js';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

describe('createGame', () => {
  it.each(['simple', 'medium', 'hard'] as const)('deals the %s deck', (difficulty) => {
    const state = createGame({ playerIds: ids(4), difficulty, rng: seeded(1) });
    const wires = state.players.flatMap((p) => p.rack);
    const count = (color: string) => wires.filter((w) => w.color === color).length;
    expect(count('blue')).toBe(48);
    expect(count('red')).toBe(DIFFICULTY[difficulty].red);
    expect(count('yellow')).toBe(DIFFICULTY[difficulty].yellow);
    for (let v = 1; v <= 12; v++) {
      expect(wires.filter((w) => w.color === 'blue' && w.value === v)).toHaveLength(4);
    }
  });

  it('gives red wires distinct X.5 values and yellow wires distinct X.1 values within 1–11', () => {
    for (let seed = 0; seed < 50; seed++) {
      const state = createGame({ playerIds: ids(3), difficulty: 'hard', rng: seeded(seed) });
      const wires = state.players.flatMap((p) => p.rack);
      for (const color of ['red', 'yellow'] as const) {
        const values = wires.filter((w) => w.color === color).map((w) => w.value);
        const frac = color === 'red' ? 0.5 : 0.1;
        expect(new Set(values).size).toBe(values.length);
        for (const v of values) {
          expect(v - Math.floor(v)).toBeCloseTo(frac);
          expect(Math.floor(v)).toBeGreaterThanOrEqual(1);
          expect(Math.floor(v)).toBeLessThanOrEqual(11);
        }
      }
    }
  });

  it.each([2, 3, 4, 5])('deals %i players evenly into sorted racks', (n) => {
    const state = createGame({ playerIds: ids(n), difficulty: 'hard', rng: seeded(n) });
    const sizes = state.players.map((p) => p.rack.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    for (const p of state.players) {
      const values = p.rack.map((w) => w.value);
      expect(values).toEqual([...values].sort((a, b) => a - b));
    }
  });

  it('starts in the reveal phase with players + 1 mistakes allowed', () => {
    const state = createGame({ playerIds: ids(4), difficulty: 'simple', rng: seeded(2) });
    expect(state.phase).toBe('reveal');
    expect(state.mistakes).toBe(0);
    expect(state.mistakesAllowed).toBe(5);
    expect(state.currentSeat).toBeGreaterThanOrEqual(0);
    expect(state.currentSeat).toBeLessThan(4);
  });

  it('uses position-based wire ids that say nothing about the wire', () => {
    const state = createGame({ playerIds: ids(2), difficulty: 'hard', rng: seeded(3) });
    state.players.forEach((p, seat) => p.rack.forEach((w, i) => expect(w.id).toBe(`${seat}-${i}`)));
  });

  it('is reproducible with the same rng seed', () => {
    const a = createGame({ playerIds: ids(3), difficulty: 'medium', rng: seeded(42) });
    const c = createGame({ playerIds: ids(3), difficulty: 'medium', rng: seeded(42) });
    expect(a).toEqual(c);
  });

  it.each([1, 6])('rejects %i players', (n) => {
    expect(() => createGame({ playerIds: ids(n), difficulty: 'simple' })).toThrow();
  });

  it('rejects duplicate player ids', () => {
    expect(() => createGame({ playerIds: ['a', 'a'], difficulty: 'simple' })).toThrow();
  });
});

describe('setup reveal', () => {
  const fresh = () =>
    createGameFromHands({
      playerIds: ['A', 'B'],
      hands: [
        [b(1), y(2), b(3)],
        [b(4), r(5), b(6)],
      ],
      difficulty: 'hard',
      firstSeat: 1,
    });

  it('marks the chosen blue wire without cutting it', () => {
    const state = act(fresh(), { type: 'reveal', player: 'A', wireId: wid(fresh(), 'A', 2) });
    const w = state.players[0]!.rack[2]!;
    expect(w.marked).toBe(true);
    expect(w.cut).toBe(false);
    expect(state.players[0]!.revealDone).toBe(true);
    expect(state.phase).toBe('reveal');
  });

  it('only allows blue wires', () => {
    const s = fresh();
    expect(errorOf(s, { type: 'reveal', player: 'A', wireId: wid(s, 'A', 1) })).toBe('NOT_A_BLUE_WIRE');
    expect(errorOf(s, { type: 'reveal', player: 'B', wireId: wid(s, 'B', 1) })).toBe('NOT_A_BLUE_WIRE');
  });

  it('only allows one reveal per player, on their own rack', () => {
    const s = fresh();
    expect(errorOf(s, { type: 'reveal', player: 'A', wireId: wid(s, 'B', 0) })).toBe('UNKNOWN_WIRE');
    const after = act(s, { type: 'reveal', player: 'A', wireId: wid(s, 'A', 0) });
    expect(errorOf(after, { type: 'reveal', player: 'A', wireId: wid(s, 'A', 2) })).toBe('ALREADY_REVEALED');
  });

  it('blocks turn actions until everyone has revealed, then starts with the first player', () => {
    let s = fresh();
    expect(errorOf(s, { type: 'dualCut', player: 'B', targetWireId: wid(s, 'A', 0), guess: 4 })).toBe(
      'WRONG_PHASE',
    );
    s = act(s, { type: 'reveal', player: 'A', wireId: wid(s, 'A', 0) });
    const result = applyAction(s, { type: 'reveal', player: 'B', wireId: wid(s, 'B', 0) });
    expect(result.ok && result.state.phase).toBe('playing');
    expect(result.ok && result.events.at(-1)).toEqual({ type: 'turnStarted', player: 'B' });
  });

  it('skips the reveal for a player with no blue wires', () => {
    const s = createGameFromHands({
      playerIds: ['A', 'B'],
      hands: [[r(1)], [b(2)]],
      difficulty: 'simple',
    });
    expect(s.players[0]!.revealDone).toBe(true);
    expect(act(s, { type: 'reveal', player: 'B', wireId: wid(s, 'B', 0) }).phase).toBe('playing');
  });
});
