// Messages between client and server. Imported by the client as types only, plus constants.
import type { ActionError, Difficulty, GameEvent, GameView, Lang, Pick } from '@codenames/engine';

export interface RoomPlayer {
  id: string;
  name: string;
  connected: boolean;
}

/** Engine events shown in the chat. `turnEnded` isn't one: it clears the chat instead. */
export type PublicEvent = Exclude<GameEvent, { type: 'turnEnded' }>;

export type ChatLine =
  | { seq: number; kind: 'msg'; from: string; text: string }
  | { seq: number; kind: 'event'; event: PublicEvent };

/** Player-added words (Chinese rooms), as one player may see them before the game. */
export interface WordsView {
  /** Your own words. */
  mine: string[];
  /** How many words the whole room has added. */
  count: number;
  /** Everyone's words: host only, so they can remove one. Null for everyone else. */
  all: { word: string; by: string }[] | null;
}

/** Everything one player is allowed to know about their room. */
export interface RoomView {
  code: string;
  you: string;
  hostId: string;
  /** Spymaster for the next (or current) game. */
  spymaster: string;
  /** Board language. */
  lang: Lang;
  /** Timer tokens for the next game: easy 9, medium 7, hard 5. */
  difficulty: Difficulty;
  /** Seat order. */
  players: RoomPlayer[];
  game: GameView | null;
  /** The current round's chat only (PRD §5.6). */
  chat: ChatLine[];
  words: WordsView;
}

/** A turn action as the client sends it; the server fills in the player (and presence). */
export type ClientAction =
  | { type: 'clue'; word: string; number: number }
  | { type: 'pick'; pick: Pick | null }
  | { type: 'confirm' };

export type RoomError =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'GAME_IN_PROGRESS'
  | 'NAME_INVALID'
  | 'NAME_TAKEN'
  | 'NOT_IN_ROOM'
  | 'NOT_HOST'
  | 'NOT_ENOUGH_PLAYERS'
  | 'NO_GAME'
  | 'NOT_LOBBY'
  | 'WORDS_ZH_ONLY'
  | 'WORD_INVALID'
  | 'WORD_OVERLAP'
  | 'WORDS_FULL'
  | 'WORD_NOT_FOUND'
  | 'SPYMASTER_SILENT'
  | 'MESSAGE_INVALID'
  | 'TOO_FAST'
  | 'BAD_REQUEST';

export type ErrorCode = RoomError | ActionError;

export type Ack<T = object> = (result: ({ ok: true } & T) | { ok: false; error: ErrorCode }) => void;

export interface Joined {
  code: string;
  playerId: string;
  /** Secret; the client keeps it to rejoin its seat after a refresh. */
  token: string;
}

export interface ClientToServerEvents {
  'room:create': (req: { name: string; lang?: Lang }, ack: Ack<Joined>) => void;
  'room:join': (req: { code: string; name?: string; token?: string }, ack: Ack<Joined>) => void;
  'room:leave': (ack: Ack) => void;
  /** Host, in the lobby: board language, difficulty and/or Spymaster (a player id, or `random`). */
  'room:settings': (req: { lang?: Lang; difficulty?: Difficulty; spymaster?: string }, ack: Ack) => void;
  'words:add': (req: { word: string }, ack: Ack) => void;
  /** Your own word, or (host) anyone's. */
  'words:remove': (req: { word: string }, ack: Ack) => void;
  'chat:send': (req: { text: string }, ack: Ack) => void;
  'game:start': (ack: Ack) => void;
  'game:action': (action: ClientAction, ack: Ack) => void;
  'game:playAgain': (ack: Ack) => void;
}

export interface ServerToClientEvents {
  'room:state': (view: RoomView) => void;
}

/**
 * The game is served under this path (huddle.kinddot.net/codenames/). The
 * client's Vite `base` in games/codenames/client/vite.config.ts must match it.
 */
export const BASE_PATH = '/codenames';
export const SOCKET_PATH = `${BASE_PATH}/socket.io`;

export const NAME_MIN = 2;
export const NAME_MAX = 16;

export const CHAT_TEXT_MAX = 200;
/** Only the latest lines are kept (messages and game lines alike), to keep memory small. */
export const CHAT_KEEP = 10;
/** At most this many messages per player per window. */
export const CHAT_RATE = { count: 5, windowMs: 5000 };
