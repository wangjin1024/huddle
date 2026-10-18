// Messages between client and server. Imported by the client as types only.
import type { ActionError, Colour, GameEvent, GameView, Num } from '@hanabi/engine';

export interface RoomPlayer {
  id: string;
  name: string;
  connected: boolean;
}

/** Every engine event is public: a played or discarded card is face up once it leaves the hand. */
export type PublicEvent = GameEvent;

export interface LogEntry {
  seq: number;
  /** The turn it happened on (0-based). */
  turn: number;
  event: PublicEvent;
}

/** Everything one player is allowed to know about their room. */
export interface RoomView {
  code: string;
  you: string;
  hostId: string;
  /** Seat order = turn order. */
  players: RoomPlayer[];
  game: GameView | null;
  log: LogEntry[];
}

/** A turn action as the client sends it; the server fills in the player. */
export type ClientAction =
  | { type: 'hint'; to: string; colour: Colour }
  | { type: 'hint'; to: string; number: Num }
  | { type: 'play'; cardId: string }
  | { type: 'discard'; cardId: string };

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
  'room:create': (req: { name: string }, ack: Ack<Joined>) => void;
  'room:join': (req: { code: string; name?: string; token?: string }, ack: Ack<Joined>) => void;
  'room:leave': (ack: Ack) => void;
  'game:start': (ack: Ack) => void;
  'game:action': (action: ClientAction, ack: Ack) => void;
  'game:playAgain': (ack: Ack) => void;
}

export interface ServerToClientEvents {
  'room:state': (view: RoomView) => void;
}

/**
 * The game is served under this path (huddle.kinddot.net/hanabi/). The
 * client's Vite `base` in games/hanabi/client/vite.config.ts must match it.
 */
export const BASE_PATH = '/hanabi';
export const SOCKET_PATH = `${BASE_PATH}/socket.io`;

export const NAME_MIN = 2;
export const NAME_MAX = 16;
