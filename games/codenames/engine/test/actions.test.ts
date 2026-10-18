import { describe, expect, it } from 'vitest';
import { applyAction, createGameFromBoard, dropPick } from '../src/index.js';
import { KEY, PLAYERS, WORDS, act, agree, at, clue, confirm, errorOf, eventsOf, game, pick } from './helpers.js';

describe('clue', () => {
  it('spends a token, assigns the captain and starts guessing', () => {
    const g = act(game(), clue('ocean', 3));
    expect(g.phase).toBe('guess');
    expect(g.tokens).toBe(8);
    expect(g.clues).toEqual([{ word: 'OCEAN', number: 3, captain: 'A', reveals: [] }]);
  });

  it('is only for the Spymaster, in the clue phase, with a number 1–9', () => {
    expect(errorOf(game(), clue('ocean', 2, 'A'))).toBe('NOT_SPYMASTER');
    expect(errorOf(game(), clue('ocean', 0))).toBe('CLUE_NUMBER');
    expect(errorOf(game(), clue('ocean', 10))).toBe('CLUE_NUMBER');
    expect(errorOf(game(), clue('ocean', 1.5))).toBe('CLUE_NUMBER');
    expect(errorOf(act(game(), clue('ocean', 2)), clue('sea', 2))).toBe('WRONG_PHASE');
  });

  it('enforces the clue word rules', () => {
    expect(errorOf(game(), clue('islands', 2))).toBe('CLUE_ON_BOARD');
    expect(errorOf(game(), clue('deep sea', 2))).toBe('CLUE_NOT_ONE_WORD');
  });

  it('rotates the captain one clue at a time', () => {
    let g = game();
    const captains: string[] = [];
    for (const word of ['sea', 'king', 'space', 'glass']) {
      g = act(g, clue(word, 1));
      captains.push(g.clues.at(-1)!.captain);
      g = agree(g, ['WHALE', 'CROWN', 'ROCKET', 'MIRROR'][captains.length - 1]!, g.clues.at(-1)!.captain);
      g = agree(g, 'stop', captains.at(-1)!);
    }
    expect(captains).toEqual(['A', 'B', 'C', 'A']);
  });
});

describe('picks and agreement', () => {
  const guessing = () => act(game(), clue('ocean', 3));

  it('replaces and clears a pick', () => {
    let g = act(guessing(), pick('A', 'WHALE'));
    g = act(g, pick('A', 'SHELL'));
    expect(g.picks).toEqual({ A: at('SHELL') });
    expect(act(g, pick('A', null)).picks).toEqual({});
  });

  it('refuses picks from the Spymaster, of revealed cards, or out of range', () => {
    const g = guessing();
    expect(errorOf(g, pick('S', 'WHALE'))).toBe('NOT_OPERATIVE');
    expect(errorOf(g, pick('A', 25))).toBe('BAD_PICK');
    expect(errorOf(g, pick('A', -1))).toBe('BAD_PICK');
    expect(errorOf(agree(g, 'WHALE', 'A'), pick('A', 'WHALE'))).toBe('BAD_PICK');
    expect(errorOf(act(game(), clue('sea', 1)), pick('A', 'WHALE'))).toBeUndefined();
    expect(errorOf(game(), pick('A', 'WHALE'))).toBe('WRONG_PHASE');
  });

  it('only offers Stop after the first reveal', () => {
    expect(errorOf(guessing(), pick('A', 'stop'))).toBe('STOP_TOO_EARLY');
    expect(errorOf(agree(guessing(), 'WHALE', 'A'), pick('A', 'stop'))).toBeUndefined();
  });

  it('refuses Confirm until every connected Operative picks the same', () => {
    let g = act(guessing(), pick('A', 'SHELL'));
    g = act(g, pick('B', 'SHELL'));
    expect(errorOf(g, confirm('A'))).toBe('NOT_AGREED');
    g = act(g, pick('C', 'WAVE'));
    expect(errorOf(g, confirm('A'))).toBe('NOT_AGREED');
    g = act(g, pick('C', 'SHELL'));
    expect(errorOf(g, confirm('A'))).toBeUndefined();
  });

  it('only lets the captain confirm', () => {
    let g = guessing();
    for (const p of ['A', 'B', 'C']) g = act(g, pick(p, 'SHELL'));
    expect(errorOf(g, confirm('B'))).toBe('NOT_CAPTAIN');
    expect(errorOf(g, confirm('S'))).toBe('NOT_OPERATIVE');
  });

  it('refuses Confirm if a pick changed just before', () => {
    let g = guessing();
    for (const p of ['A', 'B', 'C']) g = act(g, pick(p, 'SHELL'));
    g = act(g, pick('B', null));
    expect(errorOf(g, confirm('A'))).toBe('NOT_AGREED');
  });

  it('clears all picks after a confirm', () => {
    expect(agree(guessing(), 'WHALE', 'A').picks).toEqual({});
  });

  it('ignores offline Operatives and hands the captaincy on', () => {
    let g = guessing();
    g = act(g, pick('B', 'SHELL'));
    g = act(g, pick('C', 'SHELL'));
    // A (the captain) is offline: B takes over, and A's missing pick doesn't count.
    const online = ['S', 'B', 'C'];
    expect(errorOf(g, confirm('A', online))).toBe('NOT_CAPTAIN');
    expect(applyAction(g, confirm('B', online))).toMatchObject({ ok: true });
  });

  it('lets a lone Operative pick and confirm', () => {
    let g = act(game(['S', 'A']), clue('ocean', 1));
    g = act(g, pick('A', 'WHALE'));
    expect(eventsOf(g, confirm('A', ['S', 'A']))[0]).toMatchObject({ type: 'revealed', word: 'WHALE', card: 'agent' });
  });

  it('dropPick clears one player', () => {
    const g = act(guessing(), pick('A', 'SHELL'));
    expect(dropPick(g, 'A').picks).toEqual({});
    expect(dropPick(g, 'B')).toBe(g);
  });
});

describe('reveals', () => {
  const guessing = (n = 3) => act(game(), clue('ocean', n));

  it('an agent keeps the turn going and records the clue', () => {
    const g = agree(guessing(), 'WHALE', 'A');
    expect(g.phase).toBe('guess');
    expect(g.guesses).toBe(1);
    expect(g.revealed[at('WHALE')]).toBe(true);
    expect(g.clues[0]!.reveals).toEqual([at('WHALE')]);
  });

  it('a bystander or rival ends the turn', () => {
    for (const word of ['CASTLE', 'PIANO']) {
      let g = guessing();
      for (const p of ['A', 'B', 'C']) g = act(g, pick(p, word));
      const events = eventsOf(g, confirm('A'));
      expect(events.map((e) => e.type)).toEqual(['revealed', 'turnEnded']);
      expect(events[1]).toEqual({ type: 'turnEnded', reason: 'miss' });
      expect(act(g, confirm('A')).phase).toBe('clue');
    }
  });

  it('the assassin loses at once', () => {
    let g = guessing();
    for (const p of ['A', 'B', 'C']) g = act(g, pick(p, 'DIAMOND'));
    const result = applyAction(g, confirm('A'));
    expect(result).toMatchObject({ ok: true, state: { phase: 'lost', lossReason: 'assassin' } });
    if (result.ok) expect(result.events.at(-1)).toEqual({ type: 'gameLost', reason: 'assassin' });
    if (result.ok) expect(errorOf(result.state, clue('sea', 1))).toBe('GAME_OVER');
  });

  it('allows number + 1 reveals, then ends the turn', () => {
    let g = guessing(1);
    g = agree(g, 'WHALE', 'A');
    expect(g.phase).toBe('guess');
    for (const p of ['A', 'B', 'C']) g = act(g, pick(p, 'SHELL'));
    expect(eventsOf(g, confirm('A')).at(-1)).toEqual({ type: 'turnEnded', reason: 'limit' });
  });

  it('ends the turn when everyone agrees to stop', () => {
    let g = agree(guessing(), 'WHALE', 'A');
    for (const p of ['A', 'B', 'C']) g = act(g, pick(p, 'stop'));
    expect(eventsOf(g, confirm('A'))).toEqual([{ type: 'turnEnded', reason: 'stop' }]);
  });

  it('wins the moment the 9th agent is revealed, mid-turn', () => {
    let g = game();
    const agents = ['WHALE', 'ANCHOR', 'ROCKET', 'SHELL', 'MIRROR', 'WAVE', 'CROWN', 'ISLAND', 'FOREST'];
    g = act(g, clue('stuff', 9));
    for (const w of agents.slice(0, 8)) g = agree(g, w, 'A');
    expect(g.phase).toBe('guess');
    for (const p of ['A', 'B', 'C']) g = act(g, pick(p, 'FOREST'));
    expect(eventsOf(g, confirm('A')).map((e) => e.type)).toEqual(['revealed', 'gameWon']);
    expect(act(g, confirm('A')).phase).toBe('won');
  });

  it('runs out sooner on hard: the 5th clue is the last', () => {
    let g = createGameFromBoard({ playerIds: PLAYERS, spymaster: 'S', difficulty: 'hard', words: WORDS, key: KEY });
    for (const [i, miss] of ['CASTLE', 'BRIDGE', 'SPIDER', 'NEEDLE'].entries()) {
      g = act(g, clue(`clue${'abcd'[i]}`, 1));
      g = agree(g, miss, g.clues.at(-1)!.captain);
    }
    g = act(g, clue('last', 1));
    expect(g.tokens).toBe(0);
    for (const p of ['A', 'B', 'C']) g = act(g, pick(p, 'TEMPLE'));
    expect(act(g, confirm(g.clues.at(-1)!.captain))).toMatchObject({ phase: 'lost', lossReason: 'time' });
  });

  it('loses when the last token’s turn ends with agents hidden', () => {
    let g = game();
    const misses = ['CASTLE', 'BRIDGE', 'SPIDER', 'NEEDLE', 'TEMPLE', 'SNOW', 'KNIGHT', 'PIANO'];
    for (const [i, miss] of misses.entries()) {
      g = act(g, clue(`clue${'abcdefgh'[i]}`, 1));
      g = agree(g, miss, g.clues.at(-1)!.captain);
      expect(g.phase).toBe('clue');
    }
    g = act(g, clue('last', 1));
    expect(g.tokens).toBe(0);
    const captain = g.clues.at(-1)!.captain;
    g = agree(g, 'WHALE', captain);
    for (const p of ['A', 'B', 'C']) g = act(g, pick(p, 'stop'));
    const result = applyAction(g, confirm(captain));
    expect(result).toMatchObject({ ok: true, state: { phase: 'lost', lossReason: 'time' } });
    if (result.ok) expect(result.events.map((e) => e.type)).toEqual(['turnEnded', 'gameLost']);
  });

  it('never mutates its input', () => {
    const g = guessing();
    const before = JSON.stringify(g);
    agree(g, 'WHALE', 'A');
    expect(JSON.stringify(g)).toBe(before);
  });

  it('rejects unknown actions', () => {
    expect(errorOf(game(), { type: 'cheat' } as never)).toBe('INVALID_ACTION');
  });
});
