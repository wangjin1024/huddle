import { describe, expect, it } from 'vitest';
import { cardValue, playKind, previewPlay, sortCards, type Enemy } from '../src/index.js';

const kind = (...cards: string[]) => {
  const r = playKind(cards);
  return r.ok ? r.kind : r.error;
};

const jack = (over: Partial<Enemy> = {}): Enemy => ({ card: 'HJ', damage: 0, shield: 0, immunityCancelled: false, ...over });

describe('card values', () => {
  it('counts A as 1, numbers at face value, enemies at their attack and Jesters as 0', () => {
    expect(['HA', 'D7', 'S10', 'CJ', 'HQ', 'DK', 'X1'].map(cardValue)).toEqual([1, 7, 10, 10, 15, 20, 0]);
  });

  it('sorts a hand by value, then suit, with Jesters last', () => {
    expect(sortCards(['X1', 'C4', 'HJ', 'D4', 'SA', 'H9'])).toEqual(['SA', 'D4', 'C4', 'H9', 'HJ', 'X1']);
  });
});

describe('playKind', () => {
  it('allows any single card', () => {
    expect([kind('H7'), kind('CJ'), kind('SA')]).toEqual(['single', 'single', 'single']);
  });

  it('allows an Ace with exactly one other card, including another Ace or an enemy card', () => {
    expect(kind('HA', 'C8')).toBe('ace');
    expect(kind('HA', 'SA')).toBe('ace');
    expect(kind('DA', 'SQ')).toBe('ace');
    expect(kind('HA', 'C4', 'D4')).toBe('ACE_PAIR_ONLY');
    expect(kind('HA', 'SA', 'DA')).toBe('ACE_PAIR_ONLY');
  });

  it('allows sets of one number rank totalling 10 or less', () => {
    expect(kind('H2', 'D2', 'S2', 'C2')).toBe('set');
    expect(kind('H3', 'D3', 'S3')).toBe('set');
    expect(kind('H5', 'D5')).toBe('set');
    expect(kind('H6', 'D6')).toBe('SET_TOO_HIGH');
    expect(kind('H3', 'D3', 'S3', 'C3')).toBe('SET_TOO_HIGH');
    expect(kind('HJ', 'DJ')).toBe('SET_TOO_HIGH');
    expect(kind('H2', 'D3')).toBe('MIXED_RANKS');
  });

  it('plays a Jester only on its own', () => {
    expect(kind('X1')).toBe('jester');
    expect(kind('X1', 'H2')).toBe('JESTER_ALONE');
  });

  it('rejects empty, duplicate and unknown cards', () => {
    expect(kind()).toBe('NO_CARDS');
    expect(kind('H2', 'H2')).toBe('INVALID_CARDS');
    expect(kind('H11')).toBe('INVALID_CARDS');
    expect(kind('Z1')).toBe('INVALID_CARDS');
  });
});

describe('previewPlay', () => {
  const preview = (enemy: Enemy, ...cards: string[]) => {
    const r = previewPlay(enemy, cards);
    if (!r.ok) throw new Error(r.error);
    return r.preview;
  };

  it('doubles damage with Clubs and ignores the enemy’s own suit (7♣ + A♥ on J♥ at 16 HP is an exact kill)', () => {
    const p = preview(jack({ damage: 4 }), 'C7', 'HA');
    expect(p).toMatchObject({ kind: 'ace', base: 8, damage: 16, hpAfter: 0, outcome: 'exact' });
    expect(p.powers).toEqual([
      { suit: 'H', immune: true, amount: 8 },
      { suit: 'C', immune: false, amount: 16 },
    ]);
  });

  it('gives Clubs no effect against a Clubs enemy', () => {
    expect(preview(jack({ card: 'CJ' }), 'C9')).toMatchObject({ damage: 9, outcome: 'survives' });
  });

  it('applies the enemy’s own suit once a Jester cancelled its immunity', () => {
    expect(preview(jack({ card: 'CJ', immunityCancelled: true }), 'C9').damage).toBe(18);
  });

  it('shows the attack after a new shield, never below 0', () => {
    expect(preview(jack({ shield: 4 }), 'S3').attackAfter).toBe(3);
    expect(preview(jack({ shield: 4 }), 'S8').attackAfter).toBe(0);
    expect(preview(jack({ card: 'SJ' }), 'S8').attackAfter).toBe(10);
  });

  it('reports overkill and survival', () => {
    expect(preview(jack({ damage: 1 }), 'C10').outcome).toBe('overkill');
    expect(preview(jack(), 'D4', 'S4')).toMatchObject({ base: 8, damage: 8, hpAfter: 12, outcome: 'survives' });
  });

  it('previews a Jester as no damage', () => {
    expect(preview(jack({ damage: 5 }), 'X1')).toMatchObject({ damage: 0, hpAfter: 15, outcome: 'jester' });
  });
});
