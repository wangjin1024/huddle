import { describe, expect, it } from 'vitest';
import { act, discard, errorOf, eventsOf, game, hand, play } from './helpers.js';

describe('playing a card', () => {
  it('damages the enemy, then the enemy attacks and the player discards to cover it', () => {
    let s = game({ a: ['D4', 'H9', 'S3'], b: ['C2'] });
    s = act(s, play('a', 'D4'));
    expect(s.enemy.damage).toBe(4);
    expect(s.phase).toBe('discard');
    expect(s.currentSeat).toBe(0);
    expect(s.played).toEqual(['D4']);

    expect(errorOf(s, discard('a', 'S3'))).toBe('NOT_ENOUGH_DAMAGE_COVER');
    s = act(s, discard('a', 'H9', 'S3'));
    expect(hand(s, 'a')).toEqual([]);
    expect(s.discard).toEqual(['H9', 'S3']);
    expect(s).toMatchObject({ phase: 'play', currentSeat: 1 });
  });

  it('rejects plays out of turn, out of phase, of cards not held, and illegal combos', () => {
    const s = game({ a: ['D4', 'H6', 'S6'], b: ['C2'] });
    expect(errorOf(s, play('b', 'C2'))).toBe('NOT_YOUR_TURN');
    expect(errorOf(s, play('a', 'C2'))).toBe('CARD_NOT_IN_HAND');
    expect(errorOf(s, play('a', 'H6', 'S6'))).toBe('SET_TOO_HIGH');
    expect(errorOf(s, discard('a', 'D4'))).toBe('WRONG_PHASE');
    expect(errorOf(s, { type: 'chooseNext', player: 'a', next: 'b' })).toBe('WRONG_PHASE');
    expect(errorOf(s, play('z', 'D4'))).toBe('UNKNOWN_PLAYER');
  });

  it('never mutates the input state', () => {
    const s = game({ a: ['D4', 'H9'], b: ['C2'] }, { tavern: ['S5'] });
    const before = structuredClone(s);
    act(s, play('a', 'D4'));
    expect(s).toEqual(before);
  });
});

describe('suit powers', () => {
  it('♥ shuffles that many cards from the discard pile under the tavern deck', () => {
    const t = game({ a: ['H3', 'S10'], b: ['C2'] }, { castle: ['SJ', 'HQ'], tavern: ['C9'], discard: ['D2', 'D3', 'D4', 'D5', 'D6'] });
    const after = act(t, play('a', 'H3'));
    expect(after.tavern).toHaveLength(4);
    expect(after.tavern[0]).toBe('C9');
    expect(after.discard).toHaveLength(2);
    expect([...after.tavern.slice(1), ...after.discard].sort()).toEqual(['D2', 'D3', 'D4', 'D5', 'D6']);
  });

  it('♥ heals only what the discard pile holds', () => {
    const s = game({ a: ['H8', 'S10'], b: ['C2'] }, { castle: ['SJ', 'HQ'], discard: ['D2', 'D3'] });
    expect(eventsOf(s, play('a', 'H8'))).toContainEqual({ type: 'healed', count: 2 });
  });

  it('♦ deals cards one at a time clockwise from the player, skipping full hands and stopping when the deck runs out', () => {
    // 3 players: hand size 6. a plays one card (5 left), b is full, c holds 4.
    const s = game(
      { a: ['D5', 'S2', 'S3', 'S4', 'S6', 'S7'], b: ['C2', 'C3', 'C4', 'C5', 'C6', 'C7'], c: ['H2', 'H3', 'H4', 'H5'] },
      { castle: ['SJ', 'HQ'], tavern: ['H6', 'H7', 'H8', 'H9'] },
    );
    const events = eventsOf(s, play('a', 'D5'));
    expect(events).toContainEqual({ type: 'drew', draws: [{ player: 'a', count: 1 }, { player: 'c', count: 2 }] });
    const after = act(s, play('a', 'D5'));
    expect(hand(after, 'a')).toContain('H6');
    expect(hand(after, 'c')).toEqual(['H2', 'H3', 'H4', 'H5', 'H7', 'H8']);
    expect(after.tavern).toEqual(['H9']);

    const short = game({ a: ['D5', 'S10'], b: ['C2'] }, { castle: ['SJ', 'HQ'], tavern: ['H6'] });
    expect(eventsOf(short, play('a', 'D5'))).toContainEqual({ type: 'drew', draws: [{ player: 'a', count: 1 }] });
  });

  it('♠ lowers the enemy’s attack for the rest of the fight, stacking and never below 0', () => {
    let s = game({ a: ['S4', 'S8', 'C10'], b: ['S5', 'C3', 'D2'] });
    s = act(s, play('a', 'S4'));
    expect(s.enemy.shield).toBe(4);
    s = act(s, discard('a', 'C10'));
    s = act(s, play('b', 'S5'));
    // Attack 10 − 9 = 1: b covers it with the 3.
    expect(s.phase).toBe('discard');
    s = act(s, discard('b', 'C3'));
    s = act(s, play('a', 'S8'));
    // Shield 17 > 10: attack 0, so no discard; the turn passes.
    expect(s).toMatchObject({ phase: 'play', currentSeat: 1 });
  });

  it('♣ doubles the damage', () => {
    const s = act(game({ a: ['C7', 'H10'], b: ['C2'] }), play('a', 'C7'));
    expect(s.enemy.damage).toBe(14);
  });

  it('does nothing for the enemy’s own suit', () => {
    const s = game({ a: ['H5', 'S10'], b: ['C2'] }, { discard: ['D2', 'D3'] });
    const events = eventsOf(s, play('a', 'H5'));
    expect(events).toContainEqual({ type: 'immune', suit: 'H' });
    expect(events.some((e) => e.type === 'healed')).toBe(false);
  });

  it('resolves ♥ before ♦, so a heal can refill an empty deck before drawing', () => {
    // 5♥ + 5♦ against the Jack of Spades: heal 10 into an empty deck, then draw.
    const s = game({ a: ['H5', 'D5', 'S10'], b: ['C2'] }, { castle: ['SJ', 'HQ'], discard: ['C3', 'C4'] });
    const after = act(s, play('a', 'H5', 'D5'));
    expect(after.tavern).toEqual([]);
    expect([...hand(after, 'a'), ...hand(after, 'b')].sort()).toEqual(['C2', 'C3', 'C4', 'S10'].sort());
  });
});

describe('defeating an enemy', () => {
  it('puts an exactly killed enemy on top of the tavern deck, discards the played cards and passes the turn', () => {
    let t = game({ a: ['S10', 'C10', 'H9'], b: ['C5', 'D9'] }, { tavern: ['D2'] });
    t = act(t, play('a', 'S10')); // 10 damage, attack 0
    expect(t).toMatchObject({ phase: 'play', currentSeat: 1 });
    const events = eventsOf(t, play('b', 'C5'));
    expect(events).toContainEqual({ type: 'enemyDefeated', card: 'HJ', exact: true });
    expect(events).toContainEqual({ type: 'enemyRevealed', card: 'DJ' });
    t = act(t, play('b', 'C5'));
    expect(t.tavern).toEqual(['HJ', 'D2']);
    expect(t.tavernTopPublic).toBe(true);
    expect(t.discard).toEqual(['S10', 'C5']);
    expect(t.played).toEqual([]);
    expect(t.enemy).toEqual({ card: 'DJ', damage: 0, shield: 0, immunityCancelled: false });
    expect(t.defeated).toEqual([{ card: 'HJ', exact: true }]);
    expect(t).toMatchObject({ phase: 'play', currentSeat: 0 });
  });

  it('discards an overkilled enemy', () => {
    const s = game({ a: ['C10', 'H2'], b: ['C2'] });
    s.enemy.damage = 5;
    expect(eventsOf(s, play('a', 'C10'))).toContainEqual({ type: 'enemyDefeated', card: 'HJ', exact: false });
    const after = act(s, play('a', 'C10'));
    expect(after.discard).toEqual(['C10', 'HJ']);
    expect(after.defeated).toEqual([{ card: 'HJ', exact: false }]);
    expect(after.currentSeat).toBe(1);
  });

  it('lets a player draw the exact-killed enemy and use it for its attack value', () => {
    let s = game({ a: ['S10', 'D5', 'H2'], b: ['C5', 'S3'] }, { castle: ['HJ', 'SJ'], tavern: ['S2'] });
    s = act(s, play('a', 'S10')); // shield 10: attack 0
    s = act(s, play('b', 'C5')); // exact kill
    s = act(s, play('a', 'D5')); // ♦ 5 against the Jack of Spades: a draws the Jack of Hearts, b the 2
    expect(s.tavernTopPublic).toBe(false);
    expect(hand(s, 'a')).toEqual(['H2', 'HJ']);
    expect(hand(s, 'b')).toEqual(['S3', 'S2']);
    s = act(s, discard('a', 'HJ')); // worth 10, covers the attack of 10
    expect(s).toMatchObject({ phase: 'play', currentSeat: 1 });
  });

  it('wins when the last King falls', () => {
    const k = game({ a: ['C10', 'H9'], b: ['C2'] }, { castle: ['HK'] });
    k.enemy.damage = 25;
    const events = eventsOf(k, play('a', 'C10'));
    expect(events.slice(-2)).toEqual([{ type: 'enemyDefeated', card: 'HK', exact: false }, { type: 'gameWon' }]);
    expect(act(k, play('a', 'C10')).phase).toBe('won');
  });
});

describe('the Jester', () => {
  it('stops the attack, cancels immunity for the rest of the fight and lets its player choose who goes next', () => {
    let s = game({ a: ['X1', 'H9', 'S5'], b: ['H8', 'C3'], c: ['D2'] }, { discard: ['D3', 'D4'] });
    s = act(s, play('a', 'X1'));
    expect(s.phase).toBe('chooseNext');
    expect(s.enemy.immunityCancelled).toBe(true);
    expect(s.played).toEqual(['X1']);
    expect(errorOf(s, play('a', 'H9'))).toBe('WRONG_PHASE');
    expect(errorOf(s, { type: 'chooseNext', player: 'b', next: 'b' })).toBe('NOT_YOUR_TURN');
    expect(errorOf(s, { type: 'chooseNext', player: 'a', next: 'z' })).toBe('UNKNOWN_PLAYER');

    s = act(s, { type: 'chooseNext', player: 'a', next: 'b' });
    expect(s).toMatchObject({ phase: 'play', currentSeat: 1 });
    // Hearts now heal against the Jack of Hearts.
    expect(eventsOf(s, play('b', 'H8'))).toContainEqual({ type: 'healed', count: 2 });
  });

  it('may pick its own player to go again', () => {
    const s = act(game({ a: ['X1', 'H9'], b: ['C3'], c: ['D2'] }), play('a', 'X1'));
    expect(act(s, { type: 'chooseNext', player: 'a', next: 'a' })).toMatchObject({ phase: 'play', currentSeat: 0 });
  });
});

describe('losing', () => {
  it('loses at once when the hand can’t cover the attack', () => {
    const s = game({ a: ['D2', 'H3', 'S4'], b: ['C2'] });
    const events = eventsOf(s, play('a', 'D2'));
    expect(events.slice(-2)).toEqual([
      { type: 'enemyAttacked', player: 'a', attack: 10 },
      { type: 'gameLost', reason: 'attack', player: 'a' },
    ]);
    expect(act(s, play('a', 'D2'))).toMatchObject({ phase: 'lost', lossReason: 'attack' });
  });

  it('loses when a turn starts with an empty hand', () => {
    const s = game({ a: ['S10', 'H2'], b: [] });
    const after = act(s, play('a', 'S10'));
    expect(after).toMatchObject({ phase: 'lost', lossReason: 'emptyHand', currentSeat: 1 });
  });

  it('rejects actions after the game ends', () => {
    const s = act(game({ a: ['D2'], b: ['C2'] }), play('a', 'D2'));
    expect(errorOf(s, discard('a'))).toBe('GAME_OVER');
  });
});
