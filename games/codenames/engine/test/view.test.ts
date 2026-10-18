import { describe, expect, it } from 'vitest';
import { viewFor } from '../src/index.js';
import { PLAYERS, act, agree, at, clue, game, pick } from './helpers.js';

describe('viewFor', () => {
  const g = agree(act(game(), clue('ocean', 3)), 'WHALE', 'A');

  it('gives the Spymaster the key and Operatives only revealed types', () => {
    expect(viewFor(g, 'S', PLAYERS).key).toHaveLength(25);
    const op = viewFor(g, 'B', PLAYERS);
    expect(op.key).toBeNull();
    expect(op.revealed.filter((r) => r !== null)).toEqual(['agent']);
    expect(op.revealed[at('WHALE')]).toBe('agent');
    expect(JSON.stringify(op)).not.toContain('assassin');
  });

  it('shows everyone the key once the game is over', () => {
    let lost = act(g, pick('A', 'DIAMOND'));
    lost = agree(lost, 'DIAMOND', 'A');
    expect(viewFor(lost, 'B', PLAYERS).key).toHaveLength(25);
  });

  it('reports picks, the captain, agreement and what the viewer may do', () => {
    let s = act(g, pick('A', 'SHELL'));
    s = act(s, pick('B', 'SHELL'));
    expect(viewFor(s, 'A', PLAYERS)).toMatchObject({ captain: 'A', agreed: null, guesses: 1, maxGuesses: 4 });
    s = act(s, pick('C', 'SHELL'));
    expect(viewFor(s, 'A', PLAYERS)).toMatchObject({ agreed: at('SHELL'), legal: { confirm: true, pick: true, stop: true, clue: false } });
    expect(viewFor(s, 'B', PLAYERS).legal.confirm).toBe(false);
    expect(viewFor(s, 'S', PLAYERS).legal).toEqual({ clue: false, pick: false, stop: false, confirm: false });
  });

  it('hands the captaincy on when the captain is offline', () => {
    expect(viewFor(g, 'B', ['S', 'B', 'C']).captain).toBe('B');
  });
});
