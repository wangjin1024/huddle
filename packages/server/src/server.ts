import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { Server } from 'socket.io';
import { BASE_PATH, SOCKET_PATH, type ClientToServerEvents, type ServerToClientEvents } from './protocol.js';
import { RoomManager } from './rooms.js';

interface SocketData {
  code?: string;
  playerId?: string;
}

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export interface ServerOptions {
  /** Built client to serve under BASE_PATH (packages/client/dist). Omit in dev, where Vite serves it. */
  staticDir?: string;
  /** The game-picker page served at `/` (hub/index.html). */
  hubFile?: string;
  rooms?: RoomManager;
  /** How long a room with nobody connected is kept before it's deleted. */
  emptyRoomTtlMs?: number;
}

export function createServer({
  staticDir,
  hubFile,
  rooms = new RoomManager(),
  emptyRoomTtlMs = 30 * 60_000,
}: ServerOptions = {}) {
  const http = createHttpServer((req, res) => route(req.url ?? '/', res, staticDir, hubFile));
  const io: IO = new Server(http, { path: SOCKET_PATH });
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

  return { http, io, rooms };
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

type Res = import('node:http').ServerResponse;

/**
 * `/` → the game picker; `/boom-buster/...` → the built client, falling back
 * to its index.html so /boom-buster/r/CODE links work. Socket.IO handles its
 * own path before this runs.
 */
function route(url: string, res: Res, staticDir?: string, hubFile?: string) {
  let path: string;
  try {
    path = decodeURIComponent(url.split('?')[0]!);
  } catch {
    return notFound(res);
  }
  if (path === '/' || path === '/index.html') return hubFile ? sendFile(hubFile, res) : notFound(res);
  if (path === BASE_PATH) {
    res.writeHead(301, { Location: `${BASE_PATH}/` }).end();
    return;
  }
  if (!staticDir || !path.startsWith(`${BASE_PATH}/`)) return notFound(res);

  const root = resolve(staticDir);
  const file = normalize(join(root, path.slice(BASE_PATH.length)));
  const safe = file.startsWith(root + '/') && existsSync(file) && statSync(file).isFile();
  sendFile(safe ? file : join(root, 'index.html'), res);
}

function sendFile(file: string, res: Res) {
  if (!existsSync(file)) return notFound(res);
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}

function notFound(res: Res) {
  res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
}

export type { HttpServer };
