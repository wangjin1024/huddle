import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { SOCKET_PATH, type ClientToServerEvents, type ServerToClientEvents } from './protocol.js';
import { RoomManager } from './rooms.js';

interface SocketData {
  code?: string;
  playerId?: string;
}

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export interface ServerOptions {
  rooms?: RoomManager;
  /** How long a room with nobody connected is kept before it's deleted. */
  emptyRoomTtlMs?: number;
}

/**
 * Attaches the game's Socket.IO server to `http` under SOCKET_PATH. The host
 * (host/src/app.ts) owns the HTTP server and serves the built client.
 */
export function attach(http: HttpServer, { rooms = new RoomManager(), emptyRoomTtlMs = 30 * 60_000 }: ServerOptions = {}) {
  // Other games share this HTTP server; leave upgrades on their paths alone.
  const io: IO = new Server(http, { path: SOCKET_PATH, destroyUpgrade: false });
  const cleanup = new Map<string, NodeJS.Timeout>();

  async function broadcast(code: string) {
    for (const socket of await io.in(code).fetchSockets()) {
      const view = socket.data.playerId ? rooms.viewFor(code, socket.data.playerId) : null;
      if (view) socket.emit('room:state', view);
    }
  }

  async function refreshPresence(code: string, playerId: string) {
    const sockets = await io.in(code).fetchSockets();
    rooms.setConnected(code, playerId, sockets.some((s) => s.data.playerId === playerId));
    const room = rooms.rooms.get(code);
    if (!room) return;
    clearTimeout(cleanup.get(code));
    cleanup.delete(code);
    if (room.members.every((m) => !m.connected)) {
      cleanup.set(
        code,
        setTimeout(() => {
          rooms.rooms.delete(code);
          cleanup.delete(code);
        }, emptyRoomTtlMs).unref(),
      );
    }
  }

  io.on('connection', (socket) => {
    async function attach(code: string, playerId: string) {
      await detach();
      socket.data = { code, playerId };
      await socket.join(code);
      await refreshPresence(code, playerId);
      await broadcast(code);
    }

    async function detach() {
      const { code, playerId } = socket.data;
      if (!code || !playerId) return;
      socket.data = {};
      await socket.leave(code);
      await refreshPresence(code, playerId);
      await broadcast(code);
    }

    /** Runs a room operation for this socket's seat, then broadcasts on success. */
    function onRoom(op: (code: string, playerId: string) => { ok: boolean }) {
      return async (ack: (r: any) => void) => {
        const { code, playerId } = socket.data;
        if (!code || !playerId) return ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        const result = op(code, playerId);
        ack?.(result);
        if (result.ok) await broadcast(code);
      };
    }

    socket.on('room:create', async (req, ack) => {
      const result = rooms.create(req?.name);
      if (result.ok) await attach(result.code, result.playerId);
      ack?.(result);
    });

    socket.on('room:join', async (req, ack) => {
      const result = rooms.join(req?.code, req?.name, req?.token);
      if (result.ok) await attach(result.code, result.playerId);
      ack?.(result);
    });

    socket.on('room:leave', async (ack) => {
      const { code, playerId } = socket.data;
      if (!code || !playerId) return ack?.({ ok: false, error: 'NOT_IN_ROOM' });
      const result = rooms.leave(code, playerId);
      ack?.(result);
      socket.data = {};
      await socket.leave(code);
      if (rooms.rooms.has(code)) {
        await refreshPresence(code, playerId);
        await broadcast(code);
      }
    });

    socket.on('room:setDifficulty', (difficulty, ack) =>
      onRoom((code, id) => rooms.setDifficulty(code, id, difficulty))(ack),
    );
    socket.on('game:start', (ack) => onRoom((code, id) => rooms.start(code, id))(ack));
    socket.on('game:action', (action, ack) => onRoom((code, id) => rooms.act(code, id, action))(ack));
    socket.on('game:playAgain', (ack) => onRoom((code, id) => rooms.playAgain(code, id))(ack));

    socket.on('disconnect', () => {
      const { code, playerId } = socket.data;
      if (code && playerId) void refreshPresence(code, playerId).then(() => broadcast(code));
    });
  });

  return { io, rooms };
}
