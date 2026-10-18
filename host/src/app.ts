import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { attach as attachBombBusters } from '@bomb-busters/server';
import { BASE_PATH as BOMB_BUSTERS_PATH } from '@bomb-busters/server/protocol';
import { attach as attachRegicide } from '@regicide/server';
import { BASE_PATH as REGICIDE_PATH } from '@regicide/server/protocol';

export interface HostOptions {
  /** The game-picker page served at `/` (hub/index.html). */
  hubFile?: string;
  /** Each game's built client, by base path. Omit in dev, where Vite serves them. */
  clients?: Partial<Record<GamePath, string>>;
}

export type GamePath = typeof BOMB_BUSTERS_PATH | typeof REGICIDE_PATH;
export const GAME_PATHS: GamePath[] = [BOMB_BUSTERS_PATH, REGICIDE_PATH];

/** One HTTP server for all of Huddle: the hub, each game's client, and each game's Socket.IO. */
export function createHost({ hubFile, clients = {} }: HostOptions = {}) {
  const http = createServer((req, res) => route(req.url ?? '/', res, hubFile, clients));
  const bombBusters = attachBombBusters(http);
  const regicide = attachRegicide(http);
  return {
    http,
    bombBusters,
    regicide,
    close() {
      bombBusters.io.close();
      regicide.io.close();
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
