export type Difficulty = 'simple' | 'medium' | 'hard';

export type WireColor = 'blue' | 'yellow' | 'red';

/** What a player can name in a dual cut, or solo cut: a blue value 1–12, or "yellow". */
export type Guess = number | 'yellow';

export interface Wire {
  /** Position-based id (`<seat>-<index>`), so it never leaks the wire's value. */
  id: string;
  color: WireColor;
  /** Sort key: blue = integer 1–12, yellow = X.1, red = X.5. */
  value: number;
  cut: boolean;
  /** A marker showing this wire's real value is next to it (setup reveal or wrong guess). */
  marked: boolean;
}

export interface Player {
  id: string;
  /** Sorted ascending by `value`. Order never changes after setup. */
  rack: Wire[];
  /** Has done the setup reveal. */
  revealDone: boolean;
}

export type Phase = 'reveal' | 'playing' | 'won' | 'lost';

export type LossReason = 'red-wire' | 'detonator';

export interface GameState {
  difficulty: Difficulty;
  /** Seat order; play goes clockwise in this order. */
  players: Player[];
  phase: Phase;
  /** Seat index of the active player (chosen at setup, used once play starts). */
  currentSeat: number;
  mistakes: number;
  /** Wrong guesses the team may make; the next one explodes the bomb. */
  mistakesAllowed: number;
  lossReason?: LossReason;
}

export type Action =
  | { type: 'reveal'; player: string; wireId: string }
  | { type: 'dualCut'; player: string; targetWireId: string; guess: Guess; ownWireId?: string }
  | { type: 'soloCut'; player: string; value: Guess }
  | { type: 'pass'; player: string };

export type GameEvent =
  | { type: 'revealed'; player: string; wireId: string; value: number }
  | { type: 'turnStarted'; player: string }
  | {
      type: 'dualCutSuccess';
      player: string;
      target: string;
      targetWireId: string;
      ownWireId: string;
      guess: Guess;
    }
  | {
      type: 'dualCutMiss';
      player: string;
      target: string;
      targetWireId: string;
      guess: Guess;
      actual: Guess;
      mistakes: number;
    }
  | { type: 'redWireCut'; player: string; target: string; targetWireId: string }
  | { type: 'soloCut'; player: string; value: Guess; wireIds: string[] }
  | { type: 'passed'; player: string }
  | { type: 'gameWon' }
  | { type: 'gameLost'; reason: LossReason };

export type ActionError =
  | 'GAME_OVER'
  | 'WRONG_PHASE'
  | 'NOT_YOUR_TURN'
  | 'UNKNOWN_PLAYER'
  | 'UNKNOWN_WIRE'
  | 'ALREADY_REVEALED'
  | 'NOT_A_BLUE_WIRE'
  | 'INVALID_GUESS'
  | 'TARGET_IS_OWN_WIRE'
  | 'TARGET_ALREADY_CUT'
  | 'GUESS_NOT_HELD'
  | 'OWN_WIRE_REQUIRED'
  | 'INVALID_OWN_WIRE'
  | 'SOLO_CUT_NOT_ALLOWED'
  | 'PASS_NOT_ALLOWED';

export type ActionResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: ActionError };

/** Returns a float in [0, 1). Injectable so games are reproducible in tests. */
export type Rng = () => number;
