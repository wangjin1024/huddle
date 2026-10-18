import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { attach as attachBombBusters } from '@bomb-busters/server';
import { BASE_PATH as BOMB_BUSTERS_PATH } from '@bomb-busters/server/protocol';
import { attach as attachRegicide } from '@regicide/server';
import { BASE_PATH as REGICIDE_PATH } from '@regicide/server/protocol';
import { attach as attachCodenames } from '@codenames/server';
import { BASE_PATH as CODENAMES_PATH } from '@codenames/server/protocol';
import { attach as attachHanabi } from '@hanabi/server';
import { BASE_PATH as HANABI_PATH } from '@hanabi/server/protocol';

export interface HostOptions {
  /** The game-picker page served at `/` (hub/index.html). */
  hubFile?: string;
  /** Each game's built client, by base path. Omit in dev, where Vite serves them. */
  clients?: Partial<Record<GamePath, string>>;
}

export const STATUS_PATH = '/api/status';

export type GamePath = typeof BOMB_BUSTERS_PATH | typeof REGICIDE_PATH | typeof CODENAMES_PATH | typeof HANABI_PATH;
export const GAME_PATHS: GamePath[] = [BOMB_BUSTERS_PATH, REGICIDE_PATH, CODENAMES_PATH, HANABI_PATH];

/** What every game's rooms have in common, enough to tell lobbies from games in progress. */
interface RoomLike {
  game: { phase: string } | null;
  members: { connected: boolean; left?: boolean }[];
}

export interface GameStatus {
  /** Rooms waiting in the lobby. */
  lobbies: number;
  /** Games started and not yet won or lost. */
  playing: number;
  /** Games over (won, lost, or Hanabi's `over`), still showing the result screen. */
  finished: number;
  players: number;
  connected: number;
}

export interface HostStatus {
  /** Games in progress across all of Huddle; a restart would end them. */
  ongoing: number;
  games: Record<GamePath, GameStatus>;
}

const FINISHED = new Set(['won', 'lost', 'over']);

function gameStatus(rooms: Map<string, RoomLike>): GameStatus {
  const status: GameStatus = { lobbies: 0, playing: 0, finished: 0, players: 0, connected: 0 };
  for (const room of rooms.values()) {
    if (!room.game) status.lobbies++;
    else if (FINISHED.has(room.game.phase)) status.finished++;
    else status.playing++;
    const members = room.members.filter((m) => !m.left);
    status.players += members.length;
    status.connected += members.filter((m) => m.connected).length;
  }
  return status;
}

/** One HTTP server for all of Huddle: the hub, each game's client, and each game's Socket.IO. */
export function createHost({ hubFile, clients = {} }: HostOptions = {}) {
  const http = createServer((req, res) => {
    // Counts only, never room codes: this path is as public as the rest of the site.
    if (req.url?.split('?')[0] === STATUS_PATH) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify(status()));
    }
    route(req.url ?? '/', res, hubFile, clients);
  });
  const bombBusters = attachBombBusters(http);
  const regicide = attachRegicide(http);
  const codenames = attachCodenames(http);
  const hanabi = attachHanabi(http);
  function status(): HostStatus {
    const games = {
      [BOMB_BUSTERS_PATH]: gameStatus(bombBusters.rooms.rooms),
      [REGICIDE_PATH]: gameStatus(regicide.rooms.rooms),
      [CODENAMES_PATH]: gameStatus(codenames.rooms.rooms),
      [HANABI_PATH]: gameStatus(hanabi.rooms.rooms),
    } as Record<GamePath, GameStatus>;
    return { ongoing: Object.values(games).reduce((n, g) => n + g.playing, 0), games };
  }
  return {
    status,
    http,
    bombBusters,
    regicide,
    codenames,
    hanabi,
    close() {
      bombBusters.io.close();
      regicide.io.close();
      codenames.io.close();
      hanabi.io.close();
    },
  };
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

/**
 * `/` → the game picker; `/<game>/...` → that game's built client, falling
 * back to its index.html so `/<game>/r/CODE` links work. Socket.IO handles
 * its own paths before this runs.
 */
function route(url: string, res: ServerResponse, hubFile: string | undefined, clients: HostOptions['clients'] = {}) {
  let path: string;
  try {
    path = decodeURIComponent(url.split('?')[0]!);
  } catch {
    return notFound(res);
  }
  if (path === '/' || path === '/index.html') return hubFile ? sendFile(hubFile, res) : notFound(res);

  for (const base of GAME_PATHS) {
    if (path === base) {
      res.writeHead(301, { Location: `${base}/` }).end();
      return;
    }
    if (!path.startsWith(`${base}/`)) continue;
    const dir = clients[base];
    if (!dir) return notFound(res);
    const root = resolve(dir);
    const file = normalize(join(root, path.slice(base.length)));
    const safe = file.startsWith(root + '/') && existsSync(file) && statSync(file).isFile();
    return sendFile(safe ? file : join(root, 'index.html'), res);
  }
  notFound(res);
}

function sendFile(file: string, res: ServerResponse) {
  if (!existsSync(file)) return notFound(res);
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}

function notFound(res: ServerResponse) {
  res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
}
