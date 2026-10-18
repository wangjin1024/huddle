import type { GameState, Pick } from './types.js';

export const agentsTotal = (state: GameState) => state.key.filter((k) => k === 'agent').length;

export const agentsFound = (state: GameState) => state.key.filter((k, i) => k === 'agent' && state.revealed[i]).length;

/** Reveals allowed under the current clue: its number + 1. */
export const maxGuesses = (state: GameState) => (state.clues.at(-1)?.number ?? 0) + 1;

/**
 * Who may confirm now: the current clue's captain, or if they're offline, the
 * next connected Operative after them in seat order.
 */
export function captainOf(state: GameState, connected: readonly string[]): string | null {
  const assigned = state.clues.at(-1)?.captain;
  if (state.phase !== 'guess' || !assigned) return null;
  const ops = state.operatives;
  const start = ops.indexOf(assigned);
  for (let i = 0; i < ops.length; i++) {
    const id = ops[(start + i) % ops.length]!;
    if (connected.includes(id)) return id;
  }
  return null;
}

/** The connected Operatives, whose picks must all match. */
export const voters = (state: GameState, connected: readonly string[]) => state.operatives.filter((id) => connected.includes(id));

/** The pick every connected Operative shares, or null if anyone differs or hasn't picked. */
export function agreedPick(state: GameState, connected: readonly string[]): Pick | null {
  const ids = voters(state, connected);
  if (ids.length === 0) return null;
  const first = state.picks[ids[0]!];
  if (first === undefined) return null;
  return ids.every((id) => state.picks[id] === first) ? first : null;
}
