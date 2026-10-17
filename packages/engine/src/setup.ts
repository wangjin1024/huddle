import { BLUE_COPIES, BLUE_VALUES } from './rules.js';
import type { Difficulty, GameState, Rng, WireColor } from './types.js';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 5;

export const DIFFICULTY: Record<Difficulty, { red: number; yellow: number }> = {
  simple: { red: 1, yellow: 0 },
  medium: { red: 1, yellow: 2 },
  hard: { red: 2, yellow: 2 },
};

export interface NewGameOptions {
  playerIds: string[];
  difficulty: Difficulty;
  rng?: Rng;
}

type WireSpec = { color: WireColor; value: number };

function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** `count` distinct integers from 1–11, so X.1 / X.5 sort between blue wires. */
function pickBases(count: number, rng: Rng): number[] {
  const bases = Array.from({ length: BLUE_VALUES - 1 }, (_, i) => i + 1);
  return shuffle(bases, rng).slice(0, count);
}

/** Deals a new game: all 48 blue wires plus the difficulty's yellow and red wires. */
export function createGame({ playerIds, difficulty, rng = Math.random }: NewGameOptions): GameState {
  const { red, yellow } = DIFFICULTY[difficulty];
  const deck: WireSpec[] = [];
  for (let v = 1; v <= BLUE_VALUES; v++) {
    for (let c = 0; c < BLUE_COPIES; c++) deck.push({ color: 'blue', value: v });
  }
  for (const base of pickBases(yellow, rng)) deck.push({ color: 'yellow', value: base + 0.1 });
  for (const base of pickBases(red, rng)) deck.push({ color: 'red', value: base + 0.5 });

  // Deal round-robin so racks differ in size by at most one.
  const hands: WireSpec[][] = playerIds.map(() => []);
  shuffle(deck, rng).forEach((w, i) => hands[i % playerIds.length]!.push(w));

  return createGameFromHands({
    playerIds,
    hands,
    difficulty,
    firstSeat: Math.floor(rng() * playerIds.length),
  });
}

export interface FromHandsOptions {
  playerIds: string[];
  hands: WireSpec[][];
  difficulty: Difficulty;
  firstSeat?: number;
}

/** Builds a game from explicit hands (sorted here). Used by `createGame` and by tests. */
export function createGameFromHands({
  playerIds,
  hands,
  difficulty,
  firstSeat = 0,
}: FromHandsOptions): GameState {
  if (playerIds.length < MIN_PLAYERS || playerIds.length > MAX_PLAYERS) {
    throw new Error(`Bomb Busters needs ${MIN_PLAYERS}–${MAX_PLAYERS} players`);
  }
  if (new Set(playerIds).size !== playerIds.length) throw new Error('Player ids must be unique');
  if (hands.length !== playerIds.length) throw new Error('One hand per player');

  const players = playerIds.map((id, seat) => {
    const rack = [...hands[seat]!]
      .sort((a, b) => a.value - b.value)
      .map((w, i) => ({ id: `${seat}-${i}`, ...w, cut: false, marked: false }));
    // A player with no blue wire has nothing to reveal.
    return { id, rack, revealDone: !rack.some((w) => w.color === 'blue') };
  });

  return {
    difficulty,
    players,
    phase: players.every((p) => p.revealDone) ? 'playing' : 'reveal',
    currentSeat: firstSeat,
    mistakes: 0,
    mistakesAllowed: playerIds.length + 1,
  };
}
