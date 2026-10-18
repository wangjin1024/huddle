import { describe, expect, it } from 'vitest';
import { viewFor } from '../src/index.js';
import { act, discard, game, hintColour, play } from './helpers.js';

describe('viewFor', () => {
  it('shows other hands in full and only ids and knowledge for your own', () => {
    let s = game({ a: ['R1', 'Y1', 'R2', 'B5', 'W3'], b: ['G1', 'R1', 'G4', 'Y2', 'R3'] }, ['W1', 'W2']);
    s = act(s, hintColour('a', 'b', 'R'));
    s = act(s, hintColour('b', 'a', 'R'));

    const a = viewFor(s, 'a');
    const mine = a.players[0]!.hand;
    for (const card of mine) expect(Object.keys(card).sort()).toEqual(['drawnAt', 'id', 'knowledge']);
    expect(mine[0]!.knowledge).toEqual({ colour: 'R', notColours: [], notNumbers: [] });
    expect(a.players[1]!.hand[0]).toMatchObject({ colour: 'G', number: 1, knowledge: { notColours: ['R'] } });
    expect('deck' in a).toBe(false);
    expect(a).toMatchObject({ deckCount: 2, hints: 6, misplays: 0, score: 0, maxScore: 25, turnsLeft: null });
  });

  it('says what the viewer may do', () => {
    let s = game({ a: ['R1', 'Y1', 'R2', 'B5', 'W3'], b: ['G1', 'R1', 'G4', 'Y2', 'R3'] }, ['W1']);
    expect(viewFor(s, 'a').legal).toEqual({ hint: true, discard: false, play: true });
    expect(viewFor(s, 'b').legal).toEqual({ hint: false, discard: false, play: false });
    s = act(s, hintColour('a', 'b', 'R'));
    expect(viewFor(s, 'b').legal).toEqual({ hint: true, discard: true, play: true });
    s = { ...s, hints: 0 };
    expect(viewFor(s, 'b').legal).toEqual({ hint: false, discard: true, play: true });
    s = act(s, discard(s, 'b', 0));
    expect(viewFor(s, 'a').players[1]!.hand[0]).toMatchObject({ colour: 'W', number: 1 });
  });

  it('reveals every hand once the game is over', () => {
    let s = game({ a: ['R3', 'R4', 'R5', 'G1', 'G1'], b: ['Y3', 'Y4', 'Y5', 'G1', 'G1'] });
    s = { ...s, misplays: 2 };
    s = act(s, play(s, 'a', 0));
    const view = viewFor(s, 'a');
    expect(view.phase).toBe('over');
    expect(view.players[0]!.hand[0]).toMatchObject({ colour: 'R', number: 4 });
    expect(view.legal).toEqual({ hint: false, discard: false, play: false });
  });
});
