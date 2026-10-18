import { applyAction, createGameFromHands, type Action, type Difficulty, type GameState } from '../src/index.js';

export const b = (value: number) => ({ color: 'blue' as const, value });
export const y = (base: number) => ({ color: 'yellow' as const, value: base + 0.1 });
export const r = (base: number) => ({ color: 'red' as const, value: base + 0.5 });

type Hand = ReturnType<typeof b | typeof y | typeof r>[];

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
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(`Expected ${action.type} to succeed, got ${result.error}`);
  return result.state;
}

export function errorOf(state: GameState, action: Action): string | undefined {
  const result = applyAction(state, action);
  return result.ok ? undefined : result.error;
}

/** Wire id for `player`'s wire at `index` in the sorted rack. */
export const wid = (state: GameState, player: string, index: number) =>
  state.players.find((p) => p.id === player)!.rack[index]!.id;

export const wire = (state: GameState, id: string) =>
  state.players.flatMap((p) => p.rack).find((w) => w.id === id)!;

/**
 * A game already past the setup reveal. Each player marks their leftmost blue wire
 * unless `reveal` is false, in which case markers are cleared afterwards.
 */
export function playing(
  hands: Record<string, Hand>,
  { difficulty = 'hard' as Difficulty, firstSeat = 0, reveal = false } = {},
): GameState {
  const playerIds = Object.keys(hands);
  let state = createGameFromHands({ playerIds, hands: Object.values(hands), difficulty, firstSeat });
  for (const p of state.players) {
    if (p.revealDone) continue;
    const blue = p.rack.find((w) => w.color === 'blue')!;
    state = act(state, { type: 'reveal', player: p.id, wireId: blue.id });
  }
  if (!reveal) for (const w of state.players.flatMap((p) => p.rack)) w.marked = false;
  return state;
}
