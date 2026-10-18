import { describe, expect, it } from 'vitest';
import { createGame, createGameFromHands, viewFor } from '../src/index.js';
import { act, b, playing, r, seeded, wid, y } from './helpers.js';

describe('viewFor', () => {
  it('never exposes color or value of other players’ uncut wires', () => {
    for (let seed = 0; seed < 20; seed++) {
      const state = createGame({ playerIds: ['A', 'B', 'C', 'D'], difficulty: 'hard', rng: seeded(seed) });
      for (const viewer of ['A', 'B', 'C', 'D']) {
        // Round-trip through JSON: this is exactly what goes over the network.
        const view = JSON.parse(JSON.stringify(viewFor(state, viewer)));
        for (const p of view.players) {
          for (const w of p.rack) {
            if (p.id === viewer) expect(w).toHaveProperty('color');
            else expect(Object.keys(w).sort()).toEqual(['cut', 'id']);
          }
        }
      }
    }
  });

  it('shows cut wires and markers to everyone', () => {
    let s = playing({ A: [b(2), b(5)], B: [b(5), b(7)] });
    s = act(s, { type: 'dualCut', player: 'A', targetWireId: wid(s, 'B', 0), guess: 5 });
    s = act(s, { type: 'dualCut', player: 'B', targetWireId: wid(s, 'A', 0), guess: 7 });
    const view = viewFor(s, 'B');
    expect(view.players[0]!.rack[0]).toEqual({ id: '0-0', cut: false, marker: 2 });
    expect(view.players[0]!.rack[1]).toEqual({ id: '0-1', cut: true, color: 'blue', value: 5 });
    expect(view.blueCut[5]).toBe(2);
    expect(view.mistakes).toBe(1);
  });

  it('shows a yellow marker as "yellow" without its decimal value', () => {
    let s = playing({ A: [b(2), b(9)], B: [y(4), b(9)] });
    s = act(s, { type: 'dualCut', player: 'A', targetWireId: wid(s, 'B', 0), guess: 2 });
    expect(viewFor(s, 'A').players[1]!.rack[0]).toEqual({ id: '1-0', cut: false, marker: 'yellow' });
  });

  it('hides other players’ setup reveals until everyone has chosen', () => {
    let s = createGameFromHands({
      playerIds: ['A', 'B'],
      hands: [
        [b(1), b(3)],
        [b(2), b(4)],
      ],
      difficulty: 'simple',
    });
    s = act(s, { type: 'reveal', player: 'A', wireId: wid(s, 'A', 1) });
    expect(viewFor(s, 'A').players[0]!.rack[1]!.marker).toBe(3);
    expect(viewFor(s, 'B').players[0]!.rack[1]).toEqual({ id: '0-1', cut: false });
    expect(viewFor(s, 'B').players[0]!.revealDone).toBe(true);
    s = act(s, { type: 'reveal', player: 'B', wireId: wid(s, 'B', 0) });
    expect(viewFor(s, 'B').players[0]!.rack[1]!.marker).toBe(3);
  });

  it('reveals every rack once the game is over', () => {
    let s = playing({ A: [b(1), b(9)], B: [r(3), b(9)] });
    s = act(s, { type: 'dualCut', player: 'A', targetWireId: wid(s, 'B', 0), guess: 1 });
    expect(s.phase).toBe('lost');
    const view = viewFor(s, 'A');
    expect(view.lossReason).toBe('red-wire');
    expect(view.players[1]!.rack.every((w) => w.color !== undefined)).toBe(true);
  });

  it('includes legal actions only for the active viewer', () => {
    const s = playing({ A: [b(2), b(2)], B: [b(2), b(2)] });
    expect(viewFor(s, 'A').legal).toEqual({ dualCut: [2], soloCut: [], mustPass: false });
    expect(viewFor(s, 'B').legal).toEqual({ dualCut: [], soloCut: [], mustPass: false });
    expect(viewFor(s, 'A').currentPlayer).toBe('A');
  });

  it('announces the red and yellow values in play to everyone, without their owners', () => {
    const s = playing({ A: [b(1), r(8), y(2)], B: [r(3), b(1), y(6)] });
    for (const viewer of ['A', 'B']) {
      expect(viewFor(s, viewer).inPlay).toEqual({ red: [3.5, 8.5], yellow: [2.1, 6.1] });
    }
    expect(viewFor(s, 'A').players[1]!.rack[0]).toEqual({ id: '1-0', cut: false });
  });

  it('counts yellow wires in play', () => {
    const s = playing({ A: [b(1), y(2)], B: [b(1), y(8)] });
    expect(viewFor(s, 'A')).toMatchObject({ yellowCut: 0, yellowTotal: 2 });
  });
});
