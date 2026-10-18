import { MAX_HINTS, fullDeck, parseFace } from './cards.js';
import type { Card, Face, GameState, Player, Rng } from './types.js';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 5;

/** Cards per hand by player count. */
export const HAND_SIZE: Record<number, number> = { 2: 5, 3: 5, 4: 4, 5: 4 };

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function handSizeFor(players: number): number {
  const size = HAND_SIZE[players];
  if (!size) throw new Error(`Hanabi needs ${MIN_PLAYERS}–${MAX_PLAYERS} players, got ${players}`);
  return size;
}

export interface NewGameOptions {
  playerIds: string[];
  rng?: Rng;
}

/** Shuffles the 50 cards, deals the hands and picks a random first player. */
export function createGame({ playerIds, rng = Math.random }: NewGameOptions): GameState {
  const deck = shuffle(fullDeck(), rng);
  return deal(playerIds, deck, Math.floor(rng() * playerIds.length));
}

export interface FromDeckOptions {
  playerIds: string[];
  /** Top first, as codes (`R1`). Dealt one hand at a time, in seat order. */
  deck: string[];
  firstSeat?: number;
}

/** A game from an explicit deck order. Used by tests. */
export function createGameFromDeck({ playerIds, deck, firstSeat = 0 }: FromDeckOptions): GameState {
  return deal(playerIds, deck.map(parseFace), firstSeat);
}

/** Takes the top card as a new Card, or null when the deck is empty. */
export function drawCard(state: GameState): Card | null {
  const face = state.deck.shift();
  if (!face) return null;
  return { ...face, id: `c${state.drawn++}`, drawnAt: state.turn, knowledge: { notColours: [], notNumbers: [] } };
}

function deal(playerIds: string[], deck: Face[], firstSeat: number): GameState {
  const size = handSizeFor(playerIds.length);
  const state: GameState = {
    players: [],
    phase: 'play',
    currentSeat: firstSeat,
    turn: -1,
    deck: [...deck],
    drawn: 0,
    hints: MAX_HINTS,
    misplays: 0,
    fireworks: { R: 0, Y: 0, G: 0, B: 0, W: 0 },
    discard: [],
    turnsLeft: null,
  };
  state.players = playerIds.map((id): Player => {
    // Dealt left to right, so a test deck reads in hand order. Later draws go on the left.
    const hand: Card[] = [];
    for (let i = 0; i < size; i++) {
      const card = drawCard(state);
      if (card) hand.push(card);
    }
    return { id, hand };
  });
  state.turn = 0;
  return state;
}
