// Messages between client and server. Imported by the client as types only.
import type { ActionError, Difficulty, GameEvent, GameView, Guess } from '@bomb-busters/engine';

export interface RoomPlayer {
  id: string;
  name: string;
  connected: boolean;
}

/**
 * Log entries are broadcast to everyone, so they carry only public events.
 * Setup reveals drop the value: reveals stay secret until everyone has chosen.
 */
export type PublicEvent =
  | Exclude<GameEvent, { type: 'revealed' | 'turnStarted' }>
  | { type: 'revealed'; player: string };

export interface LogEntry {
  seq: number;
  event: PublicEvent;
}

/** Everything one player is allowed to know about their room. */
export interface RoomView {
  code: string;
  you: string;
  hostId: string;
  difficulty: Difficulty;
  /** Seat order = turn order. */
  players: RoomPlayer[];
  game: GameView | null;
  log: LogEntry[];
}

/** A turn action as the client sends it; the server fills in the player. */
export type ClientAction =
  | { type: 'reveal'; wireId: string }
  | { type: 'dualCut'; targetWireId: string; guess: Guess; ownWireId?: string }
  | { type: 'soloCut'; value: Guess }
  | { type: 'pass' };

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
  'room:setDifficulty': (difficulty: Difficulty, ack: Ack) => void;
  'game:start': (ack: Ack) => void;
  'game:action': (action: ClientAction, ack: Ack) => void;
  'game:playAgain': (ack: Ack) => void;
}

export interface ServerToClientEvents {
  'room:state': (view: RoomView) => void;
}

export const NAME_MIN = 2;
export const NAME_MAX = 16;
