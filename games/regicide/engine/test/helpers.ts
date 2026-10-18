import { applyAction, createGameFromHands, type Action, type Card, type GameState } from '../src/index.js';

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

/** Applies an action that must succeed, returning the new state. */
export function act(state: GameState, action: Action): GameState {
  const result = applyAction(state, action, seeded(1));
  if (!result.ok) throw new Error(`Expected ${action.type} to succeed, got ${result.error}`);
  return result.state;
}

export function eventsOf(state: GameState, action: Action) {
  const result = applyAction(state, action, seeded(1));
  if (!result.ok) throw new Error(`Expected ${action.type} to succeed, got ${result.error}`);
  return result.events;
}

export function errorOf(state: GameState, action: Action): string | undefined {
  const result = applyAction(state, action, seeded(1));
  return result.ok ? undefined : result.error;
}

/**
 * A game with explicit hands, keyed by player id in seat order. The castle
 * defaults to J♥ first; pass `castle` (current enemy first) to change it.
 */
export function game(
  hands: Record<string, Card[]>,
  opts: { tavern?: Card[]; castle?: Card[]; discard?: Card[]; firstSeat?: number } = {},
): GameState {
  return createGameFromHands({ playerIds: Object.keys(hands), hands: Object.values(hands), ...opts });
}

export const hand = (state: GameState, player: string) => state.players.find((p) => p.id === player)!.hand;

export const play = (player: string, ...cards: Card[]): Action => ({ type: 'play', player, cards });
export const discard = (player: string, ...cards: Card[]): Action => ({ type: 'discard', player, cards });
