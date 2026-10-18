import { randomBytes } from 'node:crypto';
import {
  DIFFICULTIES,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_WORDS_EACH,
  applyAction,
  checkPlayerWord,
  createGame,
  dropPick,
  overlaps,
  viewFor,
  type Action,
  type Difficulty,
  type GameState,
  type Lang,
  type Rng,
} from '@codenames/engine';
import {
  CHAT_KEEP,
  CHAT_RATE,
  CHAT_TEXT_MAX,
  NAME_MAX,
  NAME_MIN,
  type ChatLine,
  type ClientAction,
  type ErrorCode,
  type Joined,
  type PublicEvent,
  type RoomView,
} from './protocol.js';

type NewChatLine = { kind: 'msg'; from: string; text: string } | { kind: 'event'; event: PublicEvent };

export interface Member {
  id: string;
  token: string;
  name: string;
  connected: boolean;
  /** Left after a finished game; dropped when the host starts the next one. */
  left?: boolean;
  /** Words this player added for the next game (Chinese rooms). */
  words: string[];
  /** When their recent chat messages were sent, for the rate limit. */
  sent: number[];
}

export interface Room {
  code: string;
  members: Member[];
  hostId: string;
  spymaster: string;
  lang: Lang;
  difficulty: Difficulty;
  game: GameState | null;
  /** The current round's chat. Emptied when a turn ends, a game starts, or on Play again. */
  chat: ChatLine[];
  seq: number;
  /** The last board's words, kept off the next board when possible. */
  lastWords: string[];
}

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: ErrorCode };

// No 0/O, 1/I/L, so codes are easy to read out on a call.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const fail = (error: ErrorCode) => ({ ok: false as const, error });

const isLive = (room: Room) => room.game !== null && room.game.phase !== 'won' && room.game.phase !== 'lost';

const isLang = (lang: unknown): lang is Lang => lang === 'en' || lang === 'zh';

/** In-memory rooms and the rules for joining, leaving, chatting and playing in them. No sockets here. */
export class RoomManager {
  readonly rooms = new Map<string, Room>();

  constructor(
    private readonly rng: Rng = Math.random,
    private readonly now: () => number = Date.now,
  ) {}

  create(rawName: string, lang?: Lang): Result<Joined> {
    const name = cleanName(rawName);
    if (!name) return fail('NAME_INVALID');
    let code: string;
    do {
      code = Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(this.rng() * CODE_ALPHABET.length)]).join('');
    } while (this.rooms.has(code));
    const member = newMember(name);
    this.rooms.set(code, {
      code,
      members: [member],
      hostId: member.id,
      spymaster: member.id,
      lang: isLang(lang) ? lang : 'en',
      difficulty: 'medium',
      game: null,
      chat: [],
      seq: 0,
      lastWords: [],
    });
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
    this.setConnected(code, playerId, false);
    if (isLive(room)) return { ok: true };
    if (room.game) member.left = true;
    else room.members = room.members.filter((m) => m !== member);
    const remaining = room.members.filter((m) => !m.left);
    if (remaining.length === 0) {
      this.rooms.delete(code);
      return { ok: true };
    }
    if (room.hostId === playerId) room.hostId = remaining[0]!.id;
    if (!room.game && room.spymaster === playerId) room.spymaster = remaining[0]!.id;
    return { ok: true };
  }

  /** Going offline also clears that player's pick, so they can't hold up agreement. */
  setConnected(code: string, playerId: string, connected: boolean) {
    const room = this.rooms.get(code);
    const member = room?.members.find((m) => m.id === playerId);
    if (!room || !member) return;
    member.connected = connected;
    if (!connected && room.game && isLive(room)) room.game = dropPick(room.game, playerId);
  }

  settings(code: string, playerId: string, req: { lang?: unknown; difficulty?: unknown; spymaster?: unknown }): Result {
    const r = this.lobbyRoom(code, playerId);
    if (!r.ok) return r;
    const { room } = r;
    if (req?.lang !== undefined) {
      if (!isLang(req.lang)) return fail('BAD_REQUEST');
      room.lang = req.lang;
    }
    if (req?.difficulty !== undefined) {
      if (!DIFFICULTIES.includes(req.difficulty as Difficulty)) return fail('BAD_REQUEST');
      room.difficulty = req.difficulty as Difficulty;
    }
    if (req?.spymaster !== undefined) {
      if (req.spymaster === 'random') {
        room.spymaster = room.members[Math.floor(this.rng() * room.members.length)]!.id;
      } else if (typeof req.spymaster === 'string' && room.members.some((m) => m.id === req.spymaster)) {
        room.spymaster = req.spymaster;
      } else {
        return fail('BAD_REQUEST');
      }
    }
    return { ok: true };
  }

  addWord(code: string, playerId: string, raw: unknown): Result {
    const room = this.rooms.get(code);
    if (!room) return fail('ROOM_NOT_FOUND');
    const member = room.members.find((m) => m.id === playerId);
    if (!member) return fail('NOT_IN_ROOM');
    if (room.game) return fail('NOT_LOBBY');
    if (room.lang !== 'zh') return fail('WORDS_ZH_ONLY');
    const word = checkPlayerWord(raw);
    if (!word) return fail('WORD_INVALID');
    if (member.words.length >= PLAYER_WORDS_EACH) return fail('WORDS_FULL');
    if (room.members.some((m) => m.words.some((w) => overlaps(w, word, 'zh')))) return fail('WORD_OVERLAP');
    member.words.push(word);
    return { ok: true };
  }

  removeWord(code: string, playerId: string, word: unknown): Result {
    const room = this.rooms.get(code);
    if (!room) return fail('ROOM_NOT_FOUND');
    if (!room.members.some((m) => m.id === playerId)) return fail('NOT_IN_ROOM');
    if (room.game) return fail('NOT_LOBBY');
    const owner = room.members.find((m) => m.words.includes(word as string));
    if (!owner) return fail('WORD_NOT_FOUND');
    if (owner.id !== playerId && room.hostId !== playerId) return fail('NOT_HOST');
    owner.words = owner.words.filter((w) => w !== word);
    return { ok: true };
  }

  chat(code: string, playerId: string, raw: unknown): Result {
    const room = this.rooms.get(code);
    if (!room) return fail('ROOM_NOT_FOUND');
    const member = room.members.find((m) => m.id === playerId);
    if (!member) return fail('NOT_IN_ROOM');
    if (isLive(room) && room.game!.spymaster === playerId) return fail('SPYMASTER_SILENT');
    const text = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
    if (!text || [...text].length > CHAT_TEXT_MAX) return fail('MESSAGE_INVALID');
    const now = this.now();
    member.sent = member.sent.filter((t) => now - t < CHAT_RATE.windowMs);
    if (member.sent.length >= CHAT_RATE.count) return fail('TOO_FAST');
    member.sent.push(now);
    this.pushChat(room, { kind: 'msg', from: playerId, text });
    return { ok: true };
  }

  start(code: string, playerId: string): Result {
    const r = this.lobbyRoom(code, playerId);
    if (!r.ok) return r;
    const { room } = r;
    if (room.members.length < MIN_PLAYERS) return fail('NOT_ENOUGH_PLAYERS');
    if (!room.members.some((m) => m.id === room.spymaster)) room.spymaster = room.members[0]!.id;
    room.game = createGame({
      playerIds: room.members.map((m) => m.id),
      spymaster: room.spymaster,
      lang: room.lang,
      difficulty: room.difficulty,
      extraWords: room.lang === 'zh' ? room.members.flatMap((m) => m.words) : [],
      avoidWords: room.lastWords,
      rng: this.rng,
    });
    room.lastWords = [...room.game.words];
    // Added words last for this game only.
    for (const m of room.members) m.words = [];
    room.chat = [];
    return { ok: true };
  }

  /** Host sends everyone back to the lobby, keeping seats; the Spymaster role passes to the next seat. */
  playAgain(code: string, playerId: string): Result {
    const r = this.hostRoom(code, playerId);
    if (!r.ok) return r;
    const { room } = r;
    if (!room.game) return fail('NO_GAME');
    if (isLive(room)) return fail('GAME_IN_PROGRESS');
    const seat = room.members.findIndex((m) => m.id === room.game!.spymaster);
    const next = room.members.slice(seat + 1).concat(room.members.slice(0, seat + 1)).find((m) => !m.left);
    room.game = null;
    room.chat = [];
    room.members = room.members.filter((m) => !m.left);
    room.spymaster = next?.id ?? room.members[0]!.id;
    return { ok: true };
  }

  act(code: string, playerId: string, input: ClientAction): Result {
    const room = this.rooms.get(code);
    if (!room) return fail('ROOM_NOT_FOUND');
    if (!room.members.some((m) => m.id === playerId)) return fail('NOT_IN_ROOM');
    if (!room.game) return fail('NO_GAME');
    const action = toAction(input, playerId, this.connected(room));
    if (!action) return fail('BAD_REQUEST');
    const result = applyAction(room.game, action);
    if (!result.ok) return result;
    room.game = result.state;
    for (const event of result.events) {
      // A round is one clue and its guessing: the chat starts over when the turn ends.
      if (event.type === 'turnEnded') room.chat = [];
      else this.pushChat(room, { kind: 'event', event });
    }
    return { ok: true };
  }

  viewFor(code: string, playerId: string): RoomView | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const me = room.members.find((m) => m.id === playerId);
    const isHost = room.hostId === playerId;
    return {
      code,
      you: playerId,
      hostId: room.hostId,
      spymaster: room.spymaster,
      lang: room.lang,
      difficulty: room.difficulty,
      players: room.members.map(({ id, name, connected }) => ({ id, name, connected })),
      game: room.game ? viewFor(room.game, playerId, this.connected(room)) : null,
      chat: room.chat,
      words: {
        mine: me ? [...me.words] : [],
        count: room.members.reduce((n, m) => n + m.words.length, 0),
        all: isHost ? room.members.flatMap((m) => m.words.map((word) => ({ word, by: m.id }))) : null,
      },
    };
  }

  private connected(room: Room) {
    return room.members.filter((m) => m.connected).map((m) => m.id);
  }

  private pushChat(room: Room, line: NewChatLine) {
    room.chat.push({ seq: ++room.seq, ...line });
    if (room.chat.length > CHAT_KEEP) room.chat.splice(0, room.chat.length - CHAT_KEEP);
  }

  private hostRoom(code: string, playerId: string): Result<{ room: Room }> {
    const room = this.rooms.get(code);
    if (!room) return fail('ROOM_NOT_FOUND');
    if (room.hostId !== playerId) return fail('NOT_HOST');
    return { ok: true, room };
  }

  private lobbyRoom(code: string, playerId: string): Result<{ room: Room }> {
    const r = this.hostRoom(code, playerId);
    if (r.ok && r.room.game) return fail('GAME_IN_PROGRESS');
    return r;
  }
}

function newMember(name: string): Member {
  return {
    id: randomBytes(6).toString('hex'),
    token: randomBytes(18).toString('base64url'),
    name,
    connected: false,
    words: [],
    sent: [],
  };
}

function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/\s+/g, ' ');
  return name.length >= NAME_MIN && name.length <= NAME_MAX ? name : null;
}

/** Copies only known fields, so a malformed client message can't smuggle anything into the engine. */
function toAction(input: ClientAction, player: string, connected: string[]): Action | null {
  if (!input || typeof input !== 'object') return null;
  switch (input.type) {
    case 'clue':
      return typeof input.word === 'string' && typeof input.number === 'number'
        ? { type: 'clue', player, word: input.word.slice(0, 64), number: input.number }
        : null;
    case 'pick': {
      const p = input.pick;
      return p === null || p === 'stop' || Number.isInteger(p) ? { type: 'pick', player, pick: p } : null;
    }
    case 'confirm':
      return { type: 'confirm', player, connected };
    default:
      return null;
  }
}
