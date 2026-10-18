import { applyAction, createGameFromBoard, type Action, type CardType, type GameState, type Pick } from '../src/index.js';

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

export const WORDS = [
  'WHALE', 'PIANO', 'ANCHOR', 'LEMON', 'CASTLE',
  'ROCKET', 'SHELL', 'GHOST', 'BRIDGE', 'PEPPER',
  'TIGER', 'MIRROR', 'WAVE', 'CROWN', 'SPIDER',
  'CLOCK', 'ISLAND', 'DIAMOND', 'FOREST', 'NEEDLE',
  'ROBOT', 'TEMPLE', 'SNOW', 'KNIGHT', 'CANDLE',
];

const A: CardType = 'agent';
const R: CardType = 'rival';
const B: CardType = 'bystander';
const X: CardType = 'assassin';
/** Agents: WHALE ANCHOR ROCKET SHELL MIRROR WAVE CROWN ISLAND FOREST. Assassin: DIAMOND. */
export const KEY: CardType[] = [
  A, R, A, R, B,
  A, A, R, B, R,
  R, A, A, A, B,
  R, A, X, A, B,
  R, B, B, B, R,
];

export const at = (word: string) => WORDS.indexOf(word);

/** Spymaster `S`, Operatives `A`, `B`, `C` (seat order S, A, B, C). */
export const PLAYERS = ['S', 'A', 'B', 'C'];

export function game(players: string[] = PLAYERS): GameState {
  return createGameFromBoard({ playerIds: players, spymaster: players[0]!, words: WORDS, key: KEY });
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

export const clue = (word: string, number: number, player = 'S'): Action => ({ type: 'clue', player, word, number });
export const pick = (player: string, choice: Pick | string | null): Action => ({
  type: 'pick',
  player,
  pick: typeof choice === 'string' && choice !== 'stop' ? at(choice) : (choice as Pick | null),
});
export const confirm = (player: string, connected: string[] = PLAYERS): Action => ({ type: 'confirm', player, connected });

/** Everyone in `voters` picks `choice`, then `captain` confirms. */
export function agree(state: GameState, choice: string, captain: string, voters = ['A', 'B', 'C']): GameState {
  for (const v of voters) state = act(state, pick(v, choice));
  return act(state, confirm(captain));
}
