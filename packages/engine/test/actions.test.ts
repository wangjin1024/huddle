import { describe, expect, it } from 'vitest';
import { applyAction, legalActions } from '../src/index.js';
import { act, b, errorOf, playing, r, wid, wire, y } from './helpers.js';

describe('dual cut', () => {
  // A: [2, 5, 5, 9]   B: [3, 4.5(red), 5, 7]   C: [1, 5.1(yellow), 8]
  const game = () =>
    playing({
      A: [b(2), b(5), b(5), b(9)],
      B: [b(3), r(4), b(5), b(7)],
      C: [b(1), y(5), b(8)],
    });

  it('cuts both wires on a correct guess and passes the turn', () => {
    const s = game();
    const result = applyAction(s, {
      type: 'dualCut',
      player: 'A',
      targetWireId: wid(s, 'B', 2),
      guess: 5,
      ownWireId: wid(s, 'A', 2),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(wire(result.state, wid(s, 'B', 2)).cut).toBe(true);
    expect(wire(result.state, wid(s, 'A', 2)).cut).toBe(true);
    expect(wire(result.state, wid(s, 'A', 1)).cut).toBe(false);
    expect(result.state.mistakes).toBe(0);
    expect(result.state.currentSeat).toBe(1);
    expect(result.events).toEqual([
      {
        type: 'dualCutSuccess',
        player: 'A',
        target: 'B',
        targetWireId: wid(s, 'B', 2),
        ownWireId: wid(s, 'A', 2),
        guess: 5,
      },
      { type: 'turnStarted', player: 'B' },
    ]);
  });

  it('requires choosing which own wire to cut when holding more than one', () => {
    const s = game();
    expect(errorOf(s, { type: 'dualCut', player: 'A', targetWireId: wid(s, 'B', 2), guess: 5 })).toBe(
      'OWN_WIRE_REQUIRED',
    );
  });

  it('picks the only matching own wire automatically', () => {
    const s = game();
    const next = act(s, { type: 'dualCut', player: 'A', targetWireId: wid(s, 'C', 2), guess: 2 });
    expect(wire(next, wid(s, 'A', 0)).cut).toBe(false); // wrong guess: C's wire is 8
    const s2 = playing({ A: [b(2), b(9)], B: [b(2), b(9)] });
    const hit = act(s2, { type: 'dualCut', player: 'A', targetWireId: wid(s2, 'B', 0), guess: 2 });
    expect(wire(hit, wid(s2, 'A', 0)).cut).toBe(true);
  });

  it('rejects an own wire that does not match the guess', () => {
    const s = game();
    expect(
      errorOf(s, {
        type: 'dualCut',
        player: 'A',
        targetWireId: wid(s, 'B', 2),
        guess: 5,
        ownWireId: wid(s, 'A', 0),
      }),
    ).toBe('INVALID_OWN_WIRE');
  });

  it('only allows naming a value the player holds', () => {
    const s = game();
    expect(errorOf(s, { type: 'dualCut', player: 'A', targetWireId: wid(s, 'B', 0), guess: 3 })).toBe(
      'GUESS_NOT_HELD',
    );
    expect(errorOf(s, { type: 'dualCut', player: 'A', targetWireId: wid(s, 'C', 1), guess: 'yellow' })).toBe(
      'GUESS_NOT_HELD',
    );
  });

  it.each([0, 13, 2.5, '5', null])('rejects invalid guess %s', (guess) => {
    const s = game();
    expect(
      errorOf(s, { type: 'dualCut', player: 'A', targetWireId: wid(s, 'B', 0), guess: guess as never }),
    ).toBe('INVALID_GUESS');
  });

  it('rejects targeting your own, an unknown, or an already cut wire', () => {
    const s = game();
    const own = { type: 'dualCut', player: 'A', targetWireId: wid(s, 'A', 0), guess: 2 } as const;
    expect(errorOf(s, own)).toBe('TARGET_IS_OWN_WIRE');
    expect(errorOf(s, { ...own, targetWireId: 'nope' })).toBe('UNKNOWN_WIRE');
    s.players[1]!.rack[0]!.cut = true;
    expect(errorOf(s, { ...own, targetWireId: wid(s, 'B', 0) })).toBe('TARGET_ALREADY_CUT');
  });

  it('rejects actions out of turn and from unknown players', () => {
    const s = game();
    expect(errorOf(s, { type: 'dualCut', player: 'B', targetWireId: wid(s, 'A', 0), guess: 3 })).toBe(
      'NOT_YOUR_TURN',
    );
    expect(errorOf(s, { type: 'pass', player: 'Z' })).toBe('UNKNOWN_PLAYER');
  });

  it('on a miss, marks the real value and advances the detonator', () => {
    const s = game();
    const result = applyAction(s, { type: 'dualCut', player: 'A', targetWireId: wid(s, 'B', 3), guess: 9 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const target = wire(result.state, wid(s, 'B', 3));
    expect(target).toMatchObject({ cut: false, marked: true });
    expect(wire(result.state, wid(s, 'A', 3)).cut).toBe(false);
    expect(result.state.mistakes).toBe(1);
    expect(result.events[0]).toMatchObject({ type: 'dualCutMiss', guess: 9, actual: 7, mistakes: 1 });
    expect(result.state.currentSeat).toBe(1);
  });

  it('reports a missed yellow wire as "yellow"', () => {
    const s = game();
    const result = applyAction(s, { type: 'dualCut', player: 'A', targetWireId: wid(s, 'C', 1), guess: 9 });
    expect(result.ok && result.events[0]).toMatchObject({ type: 'dualCutMiss', actual: 'yellow' });
  });

  it('cuts yellow wires by naming "yellow"', () => {
    const s = playing({ A: [b(1), y(3)], B: [y(6), b(9)] });
    const next = act(s, { type: 'dualCut', player: 'A', targetWireId: wid(s, 'B', 0), guess: 'yellow' });
    expect(wire(next, wid(s, 'B', 0)).cut).toBe(true);
    expect(wire(next, wid(s, 'A', 1)).cut).toBe(true);
  });

  it('a wrong "yellow" guess on a blue wire marks its number', () => {
    const s = playing({ A: [b(1), y(3)], B: [b(4), y(6)] });
    const result = applyAction(s, { type: 'dualCut', player: 'A', targetWireId: wid(s, 'B', 0), guess: 'yellow' });
    expect(result.ok && result.events[0]).toMatchObject({ type: 'dualCutMiss', actual: 4 });
  });

  it('loses immediately when a red wire is cut', () => {
    const s = game();
    const result = applyAction(s, { type: 'dualCut', player: 'A', targetWireId: wid(s, 'B', 1), guess: 9 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('lost');
    expect(result.state.lossReason).toBe('red-wire');
    expect(result.events).toEqual([
      { type: 'redWireCut', player: 'A', target: 'B', targetWireId: wid(s, 'B', 1) },
      { type: 'gameLost', reason: 'red-wire' },
    ]);
    expect(errorOf(result.state, { type: 'pass', player: 'B' })).toBe('GAME_OVER');
  });

  it('allows players + 1 wrong guesses; the next one explodes the bomb', () => {
    // 2 players → 3 mistakes allowed, the 4th loses.
    let s = playing({ A: [b(1), b(2)], B: [b(3), b(4)] });
    for (let i = 0; i < 3; i++) {
      const player = i % 2 === 0 ? 'A' : 'B';
      const target = player === 'A' ? wid(s, 'B', 0) : wid(s, 'A', 0);
      s = act(s, { type: 'dualCut', player, targetWireId: target, guess: player === 'A' ? 2 : 4 });
      expect(s.phase).toBe('playing');
    }
    expect(s.mistakes).toBe(3);
    const result = applyAction(s, { type: 'dualCut', player: 'B', targetWireId: wid(s, 'A', 0), guess: 4 });
    expect(result.ok && result.state.phase).toBe('lost');
    expect(result.ok && result.state.lossReason).toBe('detonator');
    expect(result.ok && result.events.at(-1)).toEqual({ type: 'gameLost', reason: 'detonator' });
  });

  it('does not mutate the input state', () => {
    const s = game();
    const before = structuredClone(s);
    act(s, { type: 'dualCut', player: 'A', targetWireId: wid(s, 'B', 3), guess: 9 });
    expect(s).toEqual(before);
  });
});

describe('solo cut', () => {
  it('cuts all 4 copies held by one player without touching the detonator', () => {
    const s = playing({ A: [b(3), b(3), b(3), b(3), b(8)], B: [b(1), b(8)] });
    expect(legalActions(s, 'A').soloCut).toEqual([3]);
    const result = applyAction(s, { type: 'soloCut', player: 'A', value: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0]!.rack.slice(0, 4).every((w) => w.cut)).toBe(true);
    expect(result.state.mistakes).toBe(0);
    expect(result.events[0]).toEqual({
      type: 'soloCut',
      player: 'A',
      value: 3,
      wireIds: ['0-0', '0-1', '0-2', '0-3'],
    });
  });

  it('cuts the last 2 copies once the other 2 are cut', () => {
    const s = playing({ A: [b(6), b(6), b(9)], B: [b(6), b(6), b(9)] });
    expect(errorOf(s, { type: 'soloCut', player: 'A', value: 6 })).toBe('SOLO_CUT_NOT_ALLOWED');
    s.players[1]!.rack[0]!.cut = true;
    s.players[1]!.rack[1]!.cut = true;
    expect(act(s, { type: 'soloCut', player: 'A', value: 6 }).players[0]!.rack.slice(0, 2).every((w) => w.cut)).toBe(
      true,
    );
  });

  it('is not allowed when another player still holds a copy', () => {
    const s = playing({ A: [b(3), b(3), b(3)], B: [b(3)] });
    expect(errorOf(s, { type: 'soloCut', player: 'A', value: 3 })).toBe('SOLO_CUT_NOT_ALLOWED');
    expect(errorOf(s, { type: 'soloCut', player: 'A', value: 7 })).toBe('SOLO_CUT_NOT_ALLOWED');
  });

  it('allows both yellows only after every blue wire is cut, as the final cut', () => {
    const s = playing({ A: [b(1), y(2), y(7)], B: [b(1), b(4)] }, { difficulty: 'medium' });
    expect(errorOf(s, { type: 'soloCut', player: 'A', value: 'yellow' })).toBe('SOLO_CUT_NOT_ALLOWED');
    for (const p of s.players) for (const w of p.rack) if (w.color === 'blue') w.cut = true;
    expect(legalActions(s, 'A').soloCut).toEqual(['yellow']);
    const result = applyAction(s, { type: 'soloCut', player: 'A', value: 'yellow' });
    expect(result.ok && result.state.phase).toBe('won');
  });

  it('is optional: a qualifying player may dual cut instead', () => {
    const s = playing({ A: [b(3), b(3), b(3), b(3), b(8)], B: [b(1), b(8)] });
    const next = act(s, { type: 'dualCut', player: 'A', targetWireId: wid(s, 'B', 1), guess: 8 });
    expect(next.players[0]!.rack[4]!.cut).toBe(true);
  });
});

describe('pass', () => {
  it('is only allowed when no other action is legal', () => {
    const s = playing({ A: [b(1), b(2)], B: [b(1), b(2)] });
    expect(errorOf(s, { type: 'pass', player: 'A' })).toBe('PASS_NOT_ALLOWED');
  });

  it('passes the turn when only red wires remain', () => {
    const s = playing({ A: [b(1), r(5)], B: [b(1), b(7)] }, { firstSeat: 0 });
    s.players[0]!.rack[0]!.cut = true;
    s.players[1]!.rack[0]!.cut = true;
    expect(legalActions(s, 'A')).toEqual({ dualCut: [], soloCut: [], mustPass: true });
    const result = applyAction(s, { type: 'pass', player: 'A' });
    expect(result.ok && result.events).toEqual([
      { type: 'passed', player: 'A' },
      { type: 'turnStarted', player: 'B' },
    ]);
  });
});

describe('winning', () => {
  it('wins when the last blue wire is cut, even with red wires left', () => {
    const s = playing({ A: [b(4), r(8)], B: [b(4), r(2)] }, { difficulty: 'hard' });
    const result = applyAction(s, { type: 'dualCut', player: 'A', targetWireId: wid(s, 'B', 1), guess: 4 });
    expect(result.ok && result.state.phase).toBe('won');
    expect(result.ok && result.events.at(-1)).toEqual({ type: 'gameWon' });
  });

  it('does not win while a yellow wire is uncut', () => {
    const s = playing({ A: [b(4), y(5)], B: [b(4), y(9)] }, { difficulty: 'medium' });
    const next = act(s, { type: 'dualCut', player: 'A', targetWireId: wid(s, 'B', 0), guess: 4 });
    expect(next.phase).toBe('playing');
    const done = act(next, { type: 'dualCut', player: 'B', targetWireId: wid(s, 'A', 1), guess: 'yellow' });
    expect(done.phase).toBe('won');
  });

  it('only advances turns clockwise through every seat', () => {
    let s = playing({ A: [b(1)], B: [b(2)], C: [b(3)] }, { firstSeat: 2 });
    const order: string[] = [];
    for (let i = 0; i < 3; i++) {
      const p = s.players[s.currentSeat]!.id;
      order.push(p);
      const target = s.players[(s.currentSeat + 1) % 3]!;
      s = act(s, { type: 'dualCut', player: p, targetWireId: target.rack[0]!.id, guess: s.players[s.currentSeat]!.rack[0]!.value });
    }
    expect(order).toEqual(['C', 'A', 'B']);
  });
});
