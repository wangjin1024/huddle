import type { CardType, Difficulty, GameState, Lang, Rng } from './types.js';
import { WORDS, overlaps } from './words.js';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const BOARD_SIZE = 25;
/** Timer tokens by difficulty (PRD §5.1): one clue each, for 9 agents. */
export const TOKENS: Record<Difficulty, number> = { easy: 9, medium: 7, hard: 5 };
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
/** The key card's split (PRD §5.1): 9 of ours, 8 rival, 7 bystanders, 1 assassin. */
export const KEY_COUNTS: Record<CardType, number> = { agent: 9, rival: 8, bystander: 7, assassin: 1 };

export interface NewGameOptions {
  /** Seat order. */
  playerIds: string[];
  spymaster: string;
  lang: Lang;
  difficulty?: Difficulty;
  /** Player-added words: every one is placed on the board. */
  extraWords?: string[];
  /** Words to keep off this board when the list has enough others (the last game's). */
  avoidWords?: string[];
  rng?: Rng;
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Operatives in seat order, starting from the seat after the Spymaster. */
function operativesOf(playerIds: string[], spymaster: string) {
  const at = playerIds.indexOf(spymaster);
  return [...playerIds.slice(at + 1), ...playerIds.slice(0, at)];
}

/** Picks 25 words: all extras, then built-in words that don't overlap them, avoiding `avoid` when possible. */
export function drawWords(lang: Lang, extras: string[], avoid: string[], rng: Rng): string[] {
  const chosen = extras.slice(0, BOARD_SIZE);
  const usable = WORDS[lang].filter((w) => !chosen.some((x) => x === w || overlaps(x, w, lang)));
  const avoided = new Set(avoid);
  const fresh = usable.filter((w) => !avoided.has(w));
  const pool = fresh.length >= BOARD_SIZE - chosen.length ? fresh : usable;
  return shuffle([...chosen, ...shuffle(pool, rng).slice(0, BOARD_SIZE - chosen.length)], rng);
}

export function createGame({
  playerIds,
  spymaster,
  lang,
  difficulty = 'medium',
  extraWords = [],
  avoidWords = [],
  rng = Math.random,
}: NewGameOptions): GameState {
  if (playerIds.length < MIN_PLAYERS || playerIds.length > MAX_PLAYERS) throw new Error('Codenames needs 2–8 players');
  if (!playerIds.includes(spymaster)) throw new Error('The Spymaster must be a player');
  const types = Object.entries(KEY_COUNTS).flatMap(([type, n]) => Array<CardType>(n).fill(type as CardType));
  return createGameFromBoard({
    playerIds,
    spymaster,
    lang,
    difficulty,
    words: drawWords(lang, extraWords, avoidWords, rng),
    key: shuffle(types, rng),
  });
}

export interface FromBoardOptions {
  playerIds: string[];
  spymaster: string;
  lang?: Lang;
  difficulty?: Difficulty;
  words: string[];
  key: CardType[];
}

/** A game with an explicit board and key. Tests use it. */
export function createGameFromBoard({ playerIds, spymaster, lang = 'en', difficulty = 'easy', words, key }: FromBoardOptions): GameState {
  if (words.length !== BOARD_SIZE || key.length !== BOARD_SIZE) throw new Error('A board has 25 words and 25 key cards');
  return {
    lang,
    difficulty,
    words: [...words],
    key: [...key],
    revealed: Array<boolean>(BOARD_SIZE).fill(false),
    spymaster,
    operatives: operativesOf(playerIds, spymaster),
    phase: 'clue',
    tokens: TOKENS[difficulty],
    clues: [],
    guesses: 0,
    picks: {},
  };
}
