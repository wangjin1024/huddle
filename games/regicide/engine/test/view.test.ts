import { describe, expect, it } from 'vitest';
import { viewFor } from '../src/index.js';
import { act, game, play } from './helpers.js';

describe('viewFor', () => {
  it('shows only your own hand, sorted, and other hands as counts', () => {
    const s = game({ a: ['H9', 'C2', 'X1'], b: ['D5', 'S7'] }, { tavern: ['H2', 'H3'] });
    const v = viewFor(s, 'a');
    expect(v.hand).toEqual(['C2', 'H9', 'X1']);
    expect(v.players).toEqual([
      { id: 'a', handCount: 3 },
      { id: 'b', handCount: 2 },
    ]);
    expect(v.tavernCount).toBe(2);
    expect(v.tavernTop).toBeNull();
    const raw = JSON.stringify(v);
    for (const hidden of ['D5', 'S7', 'H2', 'H3']) expect(raw).not.toContain(`"${hidden}"`);
  });

  it('describes the enemy with health and attack after shields', () => {
    const s = act(game({ a: ['S4', 'H9', 'C3'], b: ['D2'] }), play('a', 'S4'));
    expect(viewFor(s, 'b').enemy).toEqual({
      card: 'HJ',
      damage: 4,
      shield: 4,
      immunityCancelled: false,
      hp: 16,
      maxHp: 20,
      baseAttack: 10,
      attack: 6,
    });
    expect(viewFor(s, 'b').castleLeft).toEqual({ J: 3, Q: 4, K: 4 });
  });

  it('shows the top tavern card only after an exact kill puts it there', () => {
    let s = game({ a: ['S10', 'H2'], b: ['C5', 'D3'] }, { tavern: ['D9'] });
    s = act(s, play('a', 'S10'));
    s = act(s, play('b', 'C5'));
    const v = viewFor(s, 'a');
    expect(v.tavernTop).toBe('HJ');
    expect(v.defeated).toEqual([{ card: 'HJ', exact: true }]);
    expect(JSON.stringify(v)).not.toContain('"D9"');
  });

  it('tells only the current player what they may do', () => {
    let s = game({ a: ['D4', 'H9', 'S3'], b: ['C2'] });
    expect(viewFor(s, 'a').legal).toEqual({ play: true, discard: null, chooseNext: false });
    expect(viewFor(s, 'b').legal).toEqual({ play: false, discard: null, chooseNext: false });
    s = act(s, play('a', 'D4'));
    expect(viewFor(s, 'a').legal).toEqual({ play: false, discard: 10, chooseNext: false });
    expect(viewFor(s, 'b').legal.discard).toBeNull();
  });
});
