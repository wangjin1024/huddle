import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { get as httpGet } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SOCKET_PATH, type ClientToServerEvents, type RoomView, type ServerToClientEvents } from '../src/protocol.js';
import { createServer } from '../src/server.js';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const cleanups: (() => void)[] = [];
afterEach(() => cleanups.splice(0).forEach((fn) => fn()));

async function start(options: Parameters<typeof createServer>[0] = {}) {
  const server = createServer(options);
  await new Promise<void>((r) => server.http.listen(0, r));
  const url = `http://localhost:${(server.http.address() as AddressInfo).port}`;
  cleanups.push(() => server.io.close());
  return { server, url };
}

/** A client that records every raw room:state payload it receives. */
function client(url: string) {
  const socket: Client = connect(url, { path: SOCKET_PATH, transports: ['websocket'], forceNew: true });
  const received: string[] = [];
  let latest: RoomView | null = null;
  socket.on('room:state', (view) => {
    received.push(JSON.stringify(view));
    latest = view;
  });
  cleanups.push(() => socket.close());
  return { socket, received, latest: () => latest! };
}

const until = async (check: () => boolean) => {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
  expect(check()).toBe(true);
};

describe('socket server', () => {
  it('plays through reveal without ever sending a player another player’s hidden wires', async () => {
    const { server, url } = await start();
    const a = client(url);
    const b = client(url);

    const created = await a.socket.emitWithAck('room:create', { name: 'Lin' });
    if (!created.ok) throw new Error(created.error);
    const joined = await b.socket.emitWithAck('room:join', { code: created.code, name: 'Ben' });
    expect(joined.ok).toBe(true);
    expect((await a.socket.emitWithAck('room:setDifficulty', 'hard')).ok).toBe(true);
    expect((await a.socket.emitWithAck('game:start')).ok).toBe(true);
    await until(() => a.latest()?.game?.phase === 'reveal' && b.latest()?.game?.phase === 'reveal');

    for (const c of [a, b]) {
      const me = c.latest().game!.players.find((p) => p.id === c.latest().you)!;
      const blue = me.rack.find((w) => w.color === 'blue')!;
      expect((await c.socket.emitWithAck('game:action', { type: 'reveal', wireId: blue.id })).ok).toBe(true);
    }
    await until(() => a.latest().game!.phase === 'playing' && b.latest().game!.phase === 'playing');

    // Compare every payload each client ever received with the real game state.
    const game = server.rooms.rooms.get(created.code)!.game!;
    for (const c of [a, b]) {
      const you = c.latest().you;
      for (const raw of c.received) {
        const view: RoomView = JSON.parse(raw);
        for (const p of view.game?.players ?? []) {
          if (p.id === you) continue;
          for (const w of p.rack) {
            const real = game.players.find((gp) => gp.id === p.id)!.rack.find((gw) => gw.id === w.id)!;
            if (!real.cut) expect(w.color).toBeUndefined();
            if (!real.cut) expect(w.value).toBeUndefined();
          }
        }
      }
      // Rejoin tokens are secret: they come back only in the join ack, never in broadcasts.
      for (const m of server.rooms.rooms.get(created.code)!.members) {
        expect(c.received.join()).not.toContain(m.token);
      }
    }
  });

  it('marks a player disconnected and restores their seat with the token', async () => {
    const { url } = await start();
    const a = client(url);
    const b = client(url);
    const created = await a.socket.emitWithAck('room:create', { name: 'Lin' });
    if (!created.ok) throw new Error(created.error);
    const joined = await b.socket.emitWithAck('room:join', { code: created.code, name: 'Ben' });
    if (!joined.ok) throw new Error(joined.error);
    await a.socket.emitWithAck('game:start');

    b.socket.close();
    await until(() => a.latest().players.find((p) => p.id === joined.playerId)?.connected === false);

    const b2 = client(url);
    const rejoined = await b2.socket.emitWithAck('room:join', { code: created.code, token: joined.token });
    expect(rejoined).toMatchObject({ ok: true, playerId: joined.playerId });
    await until(() => a.latest().players.find((p) => p.id === joined.playerId)?.connected === true);
    expect(b2.latest().game?.players.find((p) => p.id === joined.playerId)?.rack[0]).toHaveProperty('color');
  });

  it('rejects room actions from a socket that has not joined', async () => {
    const { url } = await start();
    const c = client(url);
    expect(await c.socket.emitWithAck('game:start')).toEqual({ ok: false, error: 'NOT_IN_ROOM' });
  });

  it('serves the hub at / and the game under /boom-buster/', async () => {
    const dist = mkdtempSync(join(tmpdir(), 'bb-dist-'));
    writeFileSync(join(dist, 'index.html'), '<p>game</p>');
    writeFileSync(join(dist, 'app.js'), 'console.log(1)');
    const hubFile = join(dist, 'hub.html');
    writeFileSync(hubFile, '<p>hub</p>');
    const { url } = await start({ staticDir: dist, hubFile });
    const get = (path: string) => fetch(url + path, { redirect: 'manual' });

    expect(await (await get('/')).text()).toBe('<p>hub</p>');
    const bare = await get('/boom-buster');
    expect(bare.status).toBe(301);
    expect(bare.headers.get('location')).toBe('/boom-buster/');
    expect(await (await get('/boom-buster/')).text()).toBe('<p>game</p>');
    expect(await (await get('/boom-buster/r/K7QX')).text()).toBe('<p>game</p>');
    const js = await get('/boom-buster/app.js');
    expect(js.headers.get('content-type')).toBe('text/javascript');
    expect((await get('/r/K7QX')).status).toBe(404);
    expect((await get('/other-game/')).status).toBe(404);
    // fetch would normalise '..' away, so send the raw path to check it can't escape dist.
    const raw = await new Promise<string>((resolve) =>
      httpGet({ host: 'localhost', port: new URL(url).port, path: '/boom-buster/../../etc/passwd' }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve(body));
      }),
    );
    expect(raw).toBe('<p>game</p>');
  });
});
