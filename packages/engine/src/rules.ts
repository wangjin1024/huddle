import type { GameState, Guess, Player, Wire } from './types.js';

export const BLUE_VALUES = 12;
export const BLUE_COPIES = 4;

/** The value a player names to cut this wire. Red wires can't be named. */
export function guessOf(wire: Wire): Guess | null {
  if (wire.color === 'blue') return wire.value;
  if (wire.color === 'yellow') return 'yellow';
  return null;
}

export function matches(wire: Wire, guess: Guess): boolean {
  return guessOf(wire) === guess;
}

export function isValidGuess(guess: unknown): guess is Guess {
  return (
    guess === 'yellow' ||
    (typeof guess === 'number' && Number.isInteger(guess) && guess >= 1 && guess <= BLUE_VALUES)
  );
}

export function allWires(state: GameState): Wire[] {
  return state.players.flatMap((p) => p.rack);
}

export function uncutMatching(wires: Wire[], guess: Guess): Wire[] {
  return wires.filter((w) => !w.cut && matches(w, guess));
}

export function allBlueCut(state: GameState): boolean {
  return allWires(state).every((w) => w.color !== 'blue' || w.cut);
}

/** Win: every blue and yellow wire is cut. */
export function isWon(state: GameState): boolean {
  return allWires(state).every((w) => w.color === 'red' || w.cut);
}

/** Values the player can name in a dual cut (they hold an uncut matching wire). */
export function dualCutGuesses(state: GameState, player: Player): Guess[] {
  const hasTarget = state.players.some((p) => p !== player && p.rack.some((w) => !w.cut));
  if (!hasTarget) return [];
  const guesses = new Set<Guess>();
  for (const w of player.rack) {
    const g = guessOf(w);
    if (!w.cut && g !== null) guesses.add(g);
  }
  return [...guesses];
}

/**
 * Solo cut V is allowed when the player holds every remaining uncut V wire.
 * Blue wires are only ever cut in pairs or as a full set, so this covers both
 * "all 4" and "the last 2 after 2 were cut". Yellow additionally requires every
 * blue wire to be cut, so the yellows are the final cut of the game.
 */
export function canSoloCut(state: GameState, player: Player, value: Guess): boolean {
  const mine = uncutMatching(player.rack, value);
  if (mine.length === 0) return false;
  if (mine.length !== uncutMatching(allWires(state), value).length) return false;
  return value !== 'yellow' || allBlueCut(state);
}

export function soloCutValues(state: GameState, player: Player): Guess[] {
  const values: Guess[] = [];
  for (let v = 1; v <= BLUE_VALUES; v++) if (canSoloCut(state, player, v)) values.push(v);
  if (canSoloCut(state, player, 'yellow')) values.push('yellow');
  return values;
}

export interface LegalActions {
  dualCut: Guess[];
  soloCut: Guess[];
  /** True when the player has no other action and must pass. */
  mustPass: boolean;
}

/** Legal actions for a player right now (all empty when it isn't their turn). */
export function legalActions(state: GameState, playerId: string): LegalActions {
  const none: LegalActions = { dualCut: [], soloCut: [], mustPass: false };
  const seat = state.players.findIndex((p) => p.id === playerId);
  if (state.phase !== 'playing' || seat !== state.currentSeat) return none;
  const player = state.players[seat]!;
  const dualCut = dualCutGuesses(state, player);
  const soloCut = soloCutValues(state, player);
  return { dualCut, soloCut, mustPass: dualCut.length === 0 && soloCut.length === 0 };
}
