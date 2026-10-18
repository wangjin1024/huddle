import { applyAction, createGameFromDeck, faceCode, type Action, type Colour, type GameState, type Num } from '../src/index.js';

/** Deterministic RNG (mulberry32). */
export function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A game with explicit hands, keyed by player id in seat order (each hand
 * left to right), then `deck` top first. Player one starts.
 */
export function game(hands: Record<string, string[]>, deck: string[] = [], firstSeat = 0): GameState {
  return createGameFromDeck({ playerIds: Object.keys(hands), deck: [...Object.values(hands).flat(), ...deck], firstSeat });
}

/** Applies an action that must succeed, returning the new state. */
export function act(state: GameState, action: Action): GameState {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(`Expected ${action.type} to succeed, got ${result.error}`);
  return result.state;
}

export function eventsOf(state: GameState, action: Action) {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(`Expected ${action.type} to succeed, got ${result.error}`);
  return result.events;
}

export function errorOf(state: GameState, action: Action): string | undefined {
  const result = applyAction(state, action);
  return result.ok ? undefined : result.error;
}

export const hand = (state: GameState, player: string) => state.players.find((p) => p.id === player)!.hand;
/** A hand as codes, left to right. */
export const codes = (state: GameState, player: string) => hand(state, player).map(faceCode);
/** The id of the card in `slot` (0 = leftmost). */
export const slot = (state: GameState, player: string, i: number) => hand(state, player)[i]!.id;

export const play = (state: GameState, player: string, i: number): Action => ({ type: 'play', player, cardId: slot(state, player, i) });
export const discard = (state: GameState, player: string, i: number): Action => ({ type: 'discard', player, cardId: slot(state, player, i) });
export const hintColour = (player: string, to: string, colour: Colour): Action => ({ type: 'hint', player, to, colour });
export const hintNumber = (player: string, to: string, number: Num): Action => ({ type: 'hint', player, to, number });
