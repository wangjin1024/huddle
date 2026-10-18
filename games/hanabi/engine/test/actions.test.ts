import { describe, expect, it } from 'vitest';
import { maxScore, score } from '../src/index.js';
import { act, codes, discard, errorOf, eventsOf, game, hand, hintColour, hintNumber, play, slot } from './helpers.js';

const A = ['R1', 'Y1', 'R2', 'B5', 'W3'];
const B = ['G1', 'R1', 'G4', 'Y2', 'R3'];

describe('hints', () => {
  it('names every matching card, records what it ruled out, and spends a token', () => {
    const s = game({ a: A, b: B }, ['W1']);
    const events = eventsOf(s, hintColour('a', 'b', 'R'));
    expect(events[0]).toEqual({ type: 'hinted', player: 'a', to: 'b', colour: 'R', cardIds: [slot(s, 'b', 1), slot(s, 'b', 4)] });

    const t = act(s, hintColour('a', 'b', 'R'));
    expect(t.hints).toBe(7);
    expect(hand(t, 'b').map((c) => c.knowledge)).toEqual([
      { notColours: ['R'], notNumbers: [] },
      { colour: 'R', notColours: [], notNumbers: [] },
      { notColours: ['R'], notNumbers: [] },
      { notColours: ['R'], notNumbers: [] },
      { colour: 'R', notColours: [], notNumbers: [] },
    ]);
    expect(t.currentSeat).toBe(1);

    const u = act(t, hintNumber('b', 'a', 1));
    expect(hand(u, 'a').map((c) => c.knowledge.number ?? null)).toEqual([1, 1, null, null, null]);
    expect(hand(u, 'a')[3]!.knowledge.notNumbers).toEqual([1]);
  });

  it('must name at least one card, and never your own hand', () => {
    const s = game({ a: A, b: B });
    expect(errorOf(s, hintColour('a', 'b', 'W'))).toBe('EMPTY_HINT');
    expect(errorOf(s, hintNumber('a', 'b', 5))).toBe('EMPTY_HINT');
    expect(errorOf(s, hintColour('a', 'a', 'R'))).toBe('SELF_HINT');
    expect(errorOf(s, hintColour('a', 'z', 'R'))).toBe('UNKNOWN_PLAYER');
    expect(errorOf(s, { type: 'hint', player: 'a', to: 'b', colour: 'R', number: 1 } as never)).toBe('INVALID_ACTION');
    expect(errorOf(s, { type: 'hint', player: 'a', to: 'b' } as never)).toBe('INVALID_ACTION');
    expect(errorOf(s, { type: 'hint', player: 'a', to: 'b', number: 6 } as never)).toBe('INVALID_ACTION');
  });

  it('needs a hint token', () => {
    let s = game({ a: A, b: B });
    s = { ...s, hints: 0 };
    expect(errorOf(s, hintColour('a', 'b', 'R'))).toBe('NO_HINTS');
  });
});

describe('discarding', () => {
  it('returns a hint token, discards face up and draws into the leftmost slot', () => {
    let s = game({ a: A, b: B }, ['W1']);
    s = act(s, hintColour('a', 'b', 'R'));
    const events = eventsOf(s, discard(s, 'b', 2));
    expect(events[0]).toMatchObject({ type: 'discarded', player: 'b', colour: 'G', number: 4, drew: true });
    s = act(s, discard(s, 'b', 2));
    expect(s.hints).toBe(8);
    expect(s.discard).toEqual([{ colour: 'G', number: 4 }]);
    expect(codes(s, 'b')).toEqual(['W1', 'G1', 'R1', 'Y2', 'R3']);
    expect(hand(s, 'b')[0]).toMatchObject({ id: 'c10', drawnAt: 1 });
    // The cards that stayed keep their knowledge.
    expect(hand(s, 'b')[2]!.knowledge.colour).toBe('R');
  });

  it('is not allowed with all 8 hint tokens in the pool', () => {
    const s = game({ a: A, b: B });
    expect(errorOf(s, discard(s, 'a', 0))).toBe('HINTS_FULL');
  });
});

describe('playing', () => {
  it('places a card that continues its firework', () => {
    let s = game({ a: A, b: B }, ['W1', 'W2']);
    s = act(s, play(s, 'a', 0));
    expect(s.fireworks.R).toBe(1);
    expect(codes(s, 'a')).toEqual(['W1', 'Y1', 'R2', 'B5', 'W3']);
    s = act(s, play(s, 'b', 0));
    expect(s.fireworks.G).toBe(1);
    expect(score(s)).toBe(2);
  });

  it('misplays a card that does not fit: discarded, plus a misplay', () => {
    const s = game({ a: A, b: B });
    const events = eventsOf(s, play(s, 'a', 2));
    expect(events[0]).toMatchObject({ type: 'played', colour: 'R', number: 2, placed: false, drew: false });
    const t = act(s, play(s, 'a', 2));
    expect(t.misplays).toBe(1);
    expect(t.fireworks.R).toBe(0);
    expect(t.discard).toEqual([{ colour: 'R', number: 2 }]);
    expect(t.hints).toBe(8);
  });

  it('a duplicate is a misplay', () => {
    let s = game({ a: A, b: B });
    s = act(s, play(s, 'a', 0));
    s = act(s, play(s, 'b', 1));
    expect(s.misplays).toBe(1);
  });

  it('a placed 5 returns a hint token, but never above 8', () => {
    let s = game({ a: ['B5', 'R1', 'R1', 'R1', 'R1'], b: B });
    s = { ...s, fireworks: { ...s.fireworks, B: 4 }, hints: 5 };
    const events = eventsOf(s, play(s, 'a', 0));
    expect(events.map((e) => e.type)).toEqual(['played', 'hintRegained']);
    expect(act(s, play(s, 'a', 0)).hints).toBe(6);

    s = { ...s, hints: 8 };
    expect(eventsOf(s, play(s, 'a', 0)).map((e) => e.type)).toEqual(['played']);
    expect(act(s, play(s, 'a', 0)).hints).toBe(8);
  });

  it('rejects cards that are not in your hand, and turns out of order', () => {
    const s = game({ a: A, b: B });
    expect(errorOf(s, { type: 'play', player: 'a', cardId: slot(s, 'b', 0) })).toBe('CARD_NOT_IN_HAND');
    expect(errorOf(s, play(s, 'b', 0))).toBe('NOT_YOUR_TURN');
    expect(errorOf(s, { type: 'play', player: 'z', cardId: 'c0' })).toBe('UNKNOWN_PLAYER');
    expect(errorOf(s, { type: 'cheat', player: 'a' } as never)).toBe('INVALID_ACTION');
  });

  it('never mutates the input state', () => {
    const s = game({ a: A, b: B }, ['W1']);
    const before = structuredClone(s);
    act(s, play(s, 'a', 0));
    act(s, hintColour('a', 'b', 'R'));
    expect(s).toEqual(before);
  });
});

describe('end of game', () => {
  it('the third misplay blows up the show for 0 points', () => {
    let s = game({ a: ['R3', 'R4', 'R5', 'G1', 'G1'], b: ['Y3', 'Y4', 'Y5', 'G1', 'G1'] });
    s = act(s, play(s, 'a', 0));
    s = act(s, play(s, 'b', 0));
    s = { ...s, fireworks: { ...s.fireworks, W: 4 } };
    expect(score(s)).toBe(4);
    const events = eventsOf(s, play(s, 'a', 0));
    expect(events.at(-1)).toEqual({ type: 'gameOver', reason: 'boom', score: 0 });
    const t = act(s, play(s, 'a', 0));
    expect(t).toMatchObject({ phase: 'over', endReason: 'boom', misplays: 3 });
    expect(score(t)).toBe(0);
    expect(errorOf(t, play(t, 'b', 0))).toBe('GAME_OVER');
  });

  it('a perfect 25 ends the game at once', () => {
    let s = game({ a: ['W5', 'R1', 'R1', 'R1', 'R1'], b: B }, ['G2', 'G3']);
    s = { ...s, fireworks: { R: 5, Y: 5, G: 5, B: 5, W: 4 } };
    s = act(s, play(s, 'a', 0));
    expect(s).toMatchObject({ phase: 'over', endReason: 'perfect' });
    expect(score(s)).toBe(25);
  });

  it('after the last card is drawn, everyone takes one more turn, the drawer last, without drawing', () => {
    let s = game({ a: A, b: B, c: ['W4', 'W4', 'Y3', 'Y3', 'G5'] }, ['B1']);
    s = act(s, hintColour('a', 'b', 'R'));
    const events = eventsOf(s, discard(s, 'b', 0));
    expect(events.at(-1)).toEqual({ type: 'finalRound', turns: 3 });
    s = act(s, discard(s, 'b', 0));
    expect(s.deck).toHaveLength(0);
    expect(s.turnsLeft).toBe(3);

    s = act(s, hintColour('c', 'a', 'R'));
    expect(s.turnsLeft).toBe(2);
    s = act(s, play(s, 'a', 0));
    expect(hand(s, 'a')).toHaveLength(4);
    expect(s.turnsLeft).toBe(1);
    expect(s.currentSeat).toBe(1);
    const last = eventsOf(s, play(s, 'b', 0));
    expect(last.at(-1)).toEqual({ type: 'gameOver', reason: 'deck', score: 2 });
    s = act(s, play(s, 'b', 0));
    expect(s).toMatchObject({ phase: 'over', endReason: 'deck' });
  });
});

describe('maxScore', () => {
  it('stops a firework at the first number with every copy discarded', () => {
    const s = game({ a: A, b: B });
    expect(maxScore(s)).toBe(25);
    expect(maxScore({ ...s, discard: [{ colour: 'G', number: 4 }, { colour: 'G', number: 4 }] })).toBe(23);
    expect(maxScore({ ...s, discard: [{ colour: 'W', number: 5 }, { colour: 'R', number: 1 }, { colour: 'R', number: 1 }] })).toBe(24);
    expect(maxScore({ ...s, discard: [{ colour: 'B', number: 1 }, { colour: 'B', number: 1 }, { colour: 'B', number: 1 }] })).toBe(20);
    expect(maxScore({ ...s, fireworks: { ...s.fireworks, B: 2 }, discard: [{ colour: 'B', number: 1 }, { colour: 'B', number: 1 }, { colour: 'B', number: 1 }] })).toBe(25);
    expect(maxScore({ ...s, misplays: 3 })).toBe(0);
  });
});
