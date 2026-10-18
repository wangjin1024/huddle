import { randomBytes } from 'node:crypto';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  applyAction,
  createGame,
  viewFor,
  isCard,
  type Action,
  type Card,
  type GameState,
  type Rng,
} from '@regicide/engine';
import {
  NAME_MAX,
  NAME_MIN,
  type ClientAction,
  type ErrorCode,
  type Joined,
  type LogEntry,
  type RoomView,
} from './protocol.js';

export interface Member {
  id: string;
  token: string;
  name: string;
  connected: boolean;
  /** Left after a finished game; dropped when the host starts the next one. */
  left?: boolean;
}

export interface Room {
  code: string;
  members: Member[];
  hostId: string;
  game: GameState | null;
  log: LogEntry[];
}

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: ErrorCode };

// No 0/O, 1/I/L, so codes are easy to read out on a call.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** No legal play or discard uses more cards than the biggest hand. */
const MAX_CARDS = 8;

const fail = (error: ErrorCode) => ({ ok: false as const, error });

const isLive = (room: Room) => room.game !== null && room.game.phase !== 'won' && room.game.phase !== 'lost';

/** In-memory rooms and the rules for joining, leaving and playing in them. No sockets here. */
export class RoomManager {
  readonly rooms = new Map<string, Room>();

  constructor(private readonly rng: Rng = Math.random) {}

  create(rawName: string): Result<Joined> {
    const name = cleanName(rawName);
    if (!name) return fail('NAME_INVALID');
    let code: string;
    do {
      code = Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(this.rng() * CODE_ALPHABET.length)]).join('');
    } while (this.rooms.has(code));
    const member = newMember(name);
    this.rooms.set(code, { code, members: [member], hostId: member.id, game: null, log: [] });
    return { ok: true, code, playerId: member.id, token: member.token };
  }

  /** Join by name, or rejoin an existing seat with its token. */
  join(rawCode: string, rawName?: string, token?: string): Result<Joined> {
    const code = String(rawCode ?? '').trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return fail('ROOM_NOT_FOUND');

    const existing = token ? room.members.find((m) => m.token === token && !m.left) : undefined;
    if (existing) return { ok: true, code, playerId: existing.id, token: existing.token };

    if (room.game) return fail('GAME_IN_PROGRESS');
    if (room.members.length >= MAX_PLAYERS) return fail('ROOM_FULL');
    const name = cleanName(rawName);
    if (!name) return fail('NAME_INVALID');
    if (room.members.some((m) => m.name.toLowerCase() === name.toLowerCase())) return fail('NAME_TAKEN');
    const member = newMember(name);
    room.members.push(member);
    return { ok: true, code, playerId: member.id, token: member.token };
  }

  /**
   * In the lobby, leaving frees the seat. During a live game the seat is kept
   * (the game waits for them). After a finished game the player stays visible on
   * the result screen and is dropped when the host goes back to the lobby.
   */
  leave(code: string, playerId: string): Result {
    const room = this.rooms.get(code);
    if (!room) return fail('ROOM_NOT_FOUND');
    const member = room.members.find((m) => m.id === playerId);
    if (!member) return fail('NOT_IN_ROOM');
    member.connected = false;
    if (isLive(room)) return { ok: true };
    if (room.game) member.left = true;
    else room.members = room.members.filter((m) => m !== member);
    const remaining = room.members.filter((m) => !m.left);
    if (remaining.length === 0) this.rooms.delete(code);
    else if (room.hostId === playerId) room.hostId = remaining[0]!.id;
    return { ok: true };
  }

  setConnected(code: string, playerId: string, connected: boolean) {
    const member = this.rooms.get(code)?.members.find((m) => m.id === playerId);
    if (member) member.connected = connected;
  }

  start(code: string, playerId: string): Result {
    const r = this.hostRoom(code, playerId);
    if (!r.ok) return r;
    const { room } = r;
    if (room.game) return fail('GAME_IN_PROGRESS');
    if (room.members.length < MIN_PLAYERS) return fail('NOT_ENOUGH_PLAYERS');
    room.game = createGame({ playerIds: room.members.map((m) => m.id), rng: this.rng });
    room.log = [];
    return { ok: true };
  }

  /** Host sends everyone back to the lobby, keeping seats, to start again. */
  playAgain(code: string, playerId: string): Result {
    const r = this.hostRoom(code, playerId);
    if (!r.ok) return r;
    if (!r.room.game) return fail('NO_GAME');
    if (isLive(r.room)) return fail('GAME_IN_PROGRESS');
    r.room.game = null;
    r.room.log = [];
    r.room.members = r.room.members.filter((m) => !m.left);
    return { ok: true };
  }

  act(code: string, playerId: string, input: ClientAction): Result {
    const room = this.rooms.get(code);
    if (!room) return fail('ROOM_NOT_FOUND');
    if (!room.members.some((m) => m.id === playerId)) return fail('NOT_IN_ROOM');
    if (!room.game) return fail('NO_GAME');
    const action = toAction(input, playerId);
    if (!action) return fail('BAD_REQUEST');
    const result = applyAction(room.game, action, this.rng);
    if (!result.ok) return result;
    room.game = result.state;
    for (const event of result.events) {
      if (event.type !== 'turnStarted') room.log.push({ seq: room.log.length + 1, event });
    }
    return { ok: true };
  }

  viewFor(code: string, playerId: string): RoomView | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    return {
      code,
      you: playerId,
      hostId: room.hostId,
      players: room.members.map(({ id, name, connected }) => ({ id, name, connected })),
      game: room.game ? viewFor(room.game, playerId) : null,
      log: room.log,
    };
  }

  private hostRoom(code: string, playerId: string): Result<{ room: Room }> {
    const room = this.rooms.get(code);
    if (!room) return fail('ROOM_NOT_FOUND');
    if (room.hostId !== playerId) return fail('NOT_HOST');
    return { ok: true, room };
  }
}

function newMember(name: string): Member {
  return { id: randomBytes(6).toString('hex'), token: randomBytes(18).toString('base64url'), name, connected: false };
}

function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/\s+/g, ' ');
  return name.length >= NAME_MIN && name.length <= NAME_MAX ? name : null;
}

const cardList = (cards: unknown): Card[] | null =>
  Array.isArray(cards) && cards.length <= MAX_CARDS && cards.every(isCard) ? [...cards] : null;

/** Copies only known fields, so a malformed client message can't smuggle anything into the engine. */
function toAction(input: ClientAction, player: string): Action | null {
  if (!input || typeof input !== 'object') return null;
  switch (input.type) {
    case 'play':
    case 'discard': {
      const cards = cardList(input.cards);
      return cards ? { type: input.type, player, cards } : null;
    }
    case 'chooseNext':
      return typeof input.next === 'string' ? { type: 'chooseNext', player, next: input.next } : null;
    default:
      return null;
  }
}
