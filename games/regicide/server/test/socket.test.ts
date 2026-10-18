import type { AddressInfo } from 'node:net';
import { createServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { SOCKET_PATH, type ClientToServerEvents, type RoomView, type ServerToClientEvents } from '../src/protocol.js';
import { attach } from '../src/server.js';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const cleanups: (() => void)[] = [];
afterEach(() => cleanups.splice(0).forEach((fn) => fn()));

async function start() {
  const http = createServer();
  const server = attach(http);
  await new Promise<void>((r) => http.listen(0, r));
  const url = `http://localhost:${(http.address() as AddressInfo).port}`;
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
  it('never sends a player another hand, the tavern deck order or a seat token', async () => {
    const { server, url } = await start();
    const a = client(url);
    const b = client(url);

    const created = await a.socket.emitWithAck('room:create', { name: 'Lin' });
    if (!created.ok) throw new Error(created.error);
    expect((await b.socket.emitWithAck('room:join', { code: created.code, name: 'Ben' })).ok).toBe(true);
    expect((await a.socket.emitWithAck('game:start')).ok).toBe(true);
    await until(() => Boolean(a.latest()?.game && b.latest()?.game));

    // Whoever's turn it is plays their lowest card, so state changes at least once more.
    const room = server.rooms.rooms.get(created.code)!;
    const current = [a, b].find((c) => c.latest().game!.currentPlayer === c.latest().you)!;
    const card = current.latest().game!.hand[0]!;
    expect((await current.socket.emitWithAck('game:action', { type: 'play', cards: [card] })).ok).toBe(true);
    await until(() => a.latest().log.length > 0 && b.latest().log.length > 0);

    for (const c of [a, b]) {
      const you = c.latest().you;
      const hidden = [
        ...room.game!.players.filter((p) => p.id !== you).flatMap((p) => p.hand),
        ...room.game!.tavern,
      ];
      for (const raw of c.received) {
        const view: RoomView = JSON.parse(raw);
        if (!view.game) continue;
        for (const p of view.game.players) expect(Object.keys(p).sort()).toEqual(['handCount', 'id']);
        expect('tavern' in view.game).toBe(false);
      }
      // The last payload is the current state: none of the hidden cards appear in it.
      const last = c.received.at(-1)!;
      for (const h of hidden) expect(last).not.toContain(`"${h}"`);
      for (const m of room.members) expect(c.received.join()).not.toContain(m.token);
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
    expect(b2.latest().game?.hand).toHaveLength(7);
  });

  it('rejects room actions from a socket that has not joined', async () => {
    const { url } = await start();
    const c = client(url);
    expect(await c.socket.emitWithAck('game:start')).toEqual({ ok: false, error: 'NOT_IN_ROOM' });
  });
});
