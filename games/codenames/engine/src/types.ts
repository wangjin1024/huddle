/** The board's word language, chosen per room. Independent of the UI language. */
export type Lang = 'en' | 'zh';

/** Sets how many timer tokens (clues) the team gets. */
export type Difficulty = 'easy' | 'medium' | 'hard';

/** What a board position secretly is. `rival` is the other team's agent, kept from the key card. */
export type CardType = 'agent' | 'rival' | 'bystander' | 'assassin';

/**
 * `clue`: the Spymaster is choosing a clue.
 * `guess`: Operatives pick and the captain confirms, one reveal at a time.
 */
export type Phase = 'clue' | 'guess' | 'won' | 'lost';

/** `assassin`: the assassin was revealed. `time`: the last timer token's turn ended with agents hidden. */
export type LossReason = 'assassin' | 'time';

/** A board position (0–24), or `stop` to end the turn. */
export type Pick = number | 'stop';

export interface Clue {
  word: string;
  number: number;
  /** The Operative this clue's captaincy was assigned to (rotation). */
  captain: string;
  /** Board positions revealed under this clue, in order. */
  reveals: number[];
}

export interface GameState {
  lang: Lang;
  difficulty: Difficulty;
  /** 25 words, row by row. */
  words: string[];
  /** The secret key, by position. Only the Spymaster (and everyone after the game) may see it. */
  key: CardType[];
  revealed: boolean[];
  spymaster: string;
  /** Operatives in seat order, starting after the Spymaster. Captaincy rotates in this order. */
  operatives: string[];
  phase: Phase;
  /** Timer tokens left. One is spent per clue. */
  tokens: number;
  /** Every clue given; during `guess` the last one is current. */
  clues: Clue[];
  /** Reveals made under the current clue. */
  guesses: number;
  /** Each Operative's current pick. Cleared after every confirm. */
  picks: Record<string, Pick>;
  lossReason?: LossReason;
}

export type Action =
  | { type: 'clue'; player: string; word: string; number: number }
  /** `pick: null` clears the player's pick. */
  | { type: 'pick'; player: string; pick: Pick | null }
  /**
   * `connected` is who is online right now. The server knows presence; the
   * engine only uses it so disconnected Operatives can't block agreement.
   */
  | { type: 'confirm'; player: string; connected: string[] };

/** `miss`: a bystander or rival agent. `limit`: number + 1 reveals were used. */
export type TurnEnd = 'stop' | 'miss' | 'limit';

export type GameEvent =
  | { type: 'clueGiven'; player: string; word: string; number: number }
  | { type: 'revealed'; player: string; index: number; word: string; card: CardType }
  | { type: 'turnEnded'; reason: TurnEnd }
  | { type: 'gameWon' }
  | { type: 'gameLost'; reason: LossReason };

/** Why a clue can't be given. */
export type ClueError = 'CLUE_EMPTY' | 'CLUE_NOT_ONE_WORD' | 'CLUE_TOO_LONG' | 'CLUE_ON_BOARD' | 'CLUE_NUMBER';

export type ActionError =
  | ClueError
  | 'GAME_OVER'
  | 'INVALID_ACTION'
  | 'WRONG_PHASE'
  | 'NOT_SPYMASTER'
  | 'NOT_OPERATIVE'
  | 'NOT_CAPTAIN'
  | 'BAD_PICK'
  | 'STOP_TOO_EARLY'
  | 'NOT_AGREED';

export type ActionResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: ActionError };

/** Returns a float in [0, 1). Injectable so games are reproducible in tests. */
export type Rng = () => number;
