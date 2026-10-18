import type { AddressInfo } from 'node:net';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { get as httpGet } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { io as connect } from 'socket.io-client';
import { SOCKET_PATH as BB_SOCKET } from '@bomb-busters/server/protocol';
import { SOCKET_PATH as RG_SOCKET } from '@regicide/server/protocol';
import { createHost, type HostOptions } from '../src/app.js';

const cleanups: (() => void)[] = [];
afterEach(() => cleanups.splice(0).forEach((fn) => fn()));

async function start(options: HostOptions = {}) {
  const host = createHost(options);
  await new Promise<void>((r) => host.http.listen(0, r));
  cleanups.push(() => host.close());
  return `http://localhost:${(host.http.address() as AddressInfo).port}`;
}

function dist(body: string) {
  const dir = mkdtempSync(join(tmpdir(), 'huddle-dist-'));
  writeFileSync(join(dir, 'index.html'), body);
  writeFileSync(join(dir, 'app.js'), 'console.log(1)');
  return dir;
}

describe('host', () => {
  it('serves the hub at / and each game under its own path', async () => {
    const hubFile = join(dist(''), 'hub.html');
    writeFileSync(hubFile, '<p>hub</p>');
    const url = await start({ hubFile, clients: { '/boom-buster': dist('<p>bb</p>'), '/regicide': dist('<p>rg</p>') } });
    const get = (path: string) => fetch(url + path, { redirect: 'manual' });

    expect(await (await get('/')).text()).toBe('<p>hub</p>');
    for (const [base, body] of [['/boom-buster', '<p>bb</p>'], ['/regicide', '<p>rg</p>']] as const) {
      const bare = await get(base);
      expect(bare.status).toBe(301);
      expect(bare.headers.get('location')).toBe(`${base}/`);
      expect(await (await get(`${base}/`)).text()).toBe(body);
      expect(await (await get(`${base}/r/K7QX`)).text()).toBe(body);
      expect((await get(`${base}/app.js`)).headers.get('content-type')).toBe('text/javascript');
    }
    expect((await get('/r/K7QX')).status).toBe(404);
    expect((await get('/other-game/')).status).toBe(404);
    // fetch would normalise '..' away, so send the raw path to check it can't escape dist.
    const raw = await new Promise<string>((resolve) =>
      httpGet({ host: 'localhost', port: new URL(url).port, path: '/regicide/../../etc/passwd' }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve(body));
      }),
    );
    expect(raw).toBe('<p>rg</p>');
  });

  it('runs both games’ sockets side by side', async () => {
    const url = await start();
    for (const path of [BB_SOCKET, RG_SOCKET]) {
      const socket = connect(url, { path, transports: ['websocket'], forceNew: true });
      cleanups.push(() => socket.close());
      const created = await socket.emitWithAck('room:create', { name: 'Lin' });
      expect(created).toMatchObject({ ok: true });
    }
  });
});
