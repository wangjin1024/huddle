/** Red, yellow, green, blue, white. */
export type Colour = 'R' | 'Y' | 'G' | 'B' | 'W';

export type Num = 1 | 2 | 3 | 4 | 5;

export interface Face {
  colour: Colour;
  number: Num;
}

/** What hints have said about one card. Public: everyone saw the hints. */
export interface Knowledge {
  colour?: Colour;
  number?: Num;
  /** Ruled out by a colour hint that didn't name this card. */
  notColours: Colour[];
  notNumbers: Num[];
}

export interface Card extends Face {
  /**
   * `c<n>`: the n-th card drawn from the deck. Draw order is public, so the id
   * says nothing about the card. Keep it that way.
   */
  id: string;
  /** The turn it was drawn on; -1 for the opening deal. */
  drawnAt: number;
  knowledge: Knowledge;
}

export interface Player {
  id: string;
  /** Leftmost (newest) first. Cards never move except to make room on the left. */
  hand: Card[];
}

export type Phase = 'play' | 'over';

/** `boom`: the third misplay. `perfect`: all five fireworks at 5. `deck`: the final round ended. */
export type EndReason = 'boom' | 'perfect' | 'deck';

export interface GameState {
  /** Seat order = turn order. */
  players: Player[];
  phase: Phase;
  currentSeat: number;
  /** Turns taken so far. */
  turn: number;
  /** Top first. Its order is never sent to a client. */
  deck: Face[];
  /** Cards drawn so far; the next card's id is `c<drawn>`. */
  drawn: number;
  hints: number;
  misplays: number;
  /** The top number of each firework, 0 when empty. */
  fireworks: Record<Colour, number>;
  /** Face up, in the order they were discarded or misplayed. */
  discard: Face[];
  /** Turns left in the final round, once the last card has been drawn. */
  turnsLeft: number | null;
  endReason?: EndReason;
}

export type HintValue = { colour: Colour; number?: never } | { number: Num; colour?: never };

export type Action =
  | ({ type: 'hint'; player: string; to: string } & HintValue)
  | { type: 'play'; player: string; cardId: string }
  | { type: 'discard'; player: string; cardId: string };

export type GameEvent =
  | { type: 'hinted'; player: string; to: string; colour?: Colour; number?: Num; cardIds: string[] }
  | { type: 'played'; player: string; cardId: string; colour: Colour; number: Num; placed: boolean; drew: boolean }
  | { type: 'discarded'; player: string; cardId: string; colour: Colour; number: Num; drew: boolean }
  /** A 5 was placed with fewer than 8 hint tokens: one comes back. */
  | { type: 'hintRegained' }
  | { type: 'finalRound'; turns: number }
  | { type: 'gameOver'; reason: EndReason; score: number };

export type ActionError =
  | 'GAME_OVER'
  | 'INVALID_ACTION'
  | 'NOT_YOUR_TURN'
  | 'UNKNOWN_PLAYER'
  | 'CARD_NOT_IN_HAND'
  | 'NO_HINTS'
  | 'HINTS_FULL'
  | 'SELF_HINT'
  | 'EMPTY_HINT';

export type ActionResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: ActionError };

/** Returns a float in [0, 1). Injectable so games are reproducible in tests. */
export type Rng = () => number;
