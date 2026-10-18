import { ENEMY_RANKS, NUMBER_RANKS, SUITS } from './cards.js';
import type { Card, Enemy, GameState, Rng } from './types.js';

export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 4;

/** Max hand size and Jesters in the tavern deck, by player count. */
export const PLAYER_SETUP: Record<number, { handSize: number; jesters: number }> = {
  1: { handSize: 8, jesters: 0 },
  2: { handSize: 7, jesters: 0 },
  3: { handSize: 6, jesters: 1 },
  4: { handSize: 5, jesters: 2 },
};

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export const newEnemy = (card: Card): Enemy => ({ card, damage: 0, shield: 0, immunityCancelled: false });

export interface NewGameOptions {
  playerIds: string[];
  rng?: Rng;
}

/** Castle: shuffled Jacks on top, then Queens, then Kings. Tavern: A–10 plus Jesters, dealt to max hand size. */
export function createGame({ playerIds, rng = Math.random }: NewGameOptions): GameState {
  const setup = setupFor(playerIds.length);
  const castle = ENEMY_RANKS.flatMap((rank) => shuffle(SUITS.map((s) => s + rank), rng));
  const jesters = Array.from({ length: setup.jesters }, (_, i) => `X${i + 1}`);
  const tavern = shuffle([...SUITS.flatMap((s) => NUMBER_RANKS.map((r) => s + r)), ...jesters], rng);
  const hands = playerIds.map(() => tavern.splice(0, setup.handSize));
  return build(playerIds, hands, tavern, castle, Math.floor(rng() * playerIds.length));
}

export interface FromHandsOptions {
  playerIds: string[];
  hands: Card[][];
  /** Top first. Defaults to empty. */
  tavern?: Card[];
  /** Current enemy first. Defaults to J, Q, K of each suit in ♥ ♦ ♠ ♣ order. */
  castle?: Card[];
  discard?: Card[];
  firstSeat?: number;
}

/** A game from explicit hands and decks. Used by tests. */
export function createGameFromHands({
  playerIds,
  hands,
  tavern = [],
  castle = ENEMY_RANKS.flatMap((rank) => SUITS.map((s) => s + rank)),
  discard = [],
  firstSeat = 0,
}: FromHandsOptions): GameState {
  const state = build(playerIds, hands, tavern, castle, firstSeat);
  state.discard = [...discard];
  return state;
}

function setupFor(players: number) {
  const setup = PLAYER_SETUP[players];
  if (!setup) throw new Error(`Regicide needs ${MIN_PLAYERS}–${MAX_PLAYERS} players, got ${players}`);
  return setup;
}

function build(playerIds: string[], hands: Card[][], tavern: Card[], castle: Card[], firstSeat: number): GameState {
  const setup = setupFor(playerIds.length);
  const [first, ...rest] = castle;
  if (!first) throw new Error('The castle needs at least one enemy');
  return {
    players: playerIds.map((id, i) => ({ id, hand: [...(hands[i] ?? [])] })),
    handSize: setup.handSize,
    jesters: setup.jesters,
    phase: 'play',
    currentSeat: firstSeat,
    enemy: newEnemy(first),
    castle: rest,
    tavern: [...tavern],
    tavernTopPublic: false,
    discard: [],
    played: [],
    defeated: [],
  };
}
