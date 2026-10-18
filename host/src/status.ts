// `npm run status`: asks the running Huddle server whether any game is in
// progress, e.g. before a restart (rooms live in memory, so a restart ends them).
// Exit code: 0 = no game in progress, 1 = games in progress, 2 = server unreachable.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { STATUS_PATH, type HostStatus } from './app.js';

/** PORT/HOST from the environment, else from .env (as run.sh and PM2 use). */
function setting(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  const env = fileURLToPath(new URL('../../.env', import.meta.url));
  if (!existsSync(env)) return undefined;
  const line = readFileSync(env, 'utf8')
    .split('\n')
    .find((l) => l.trim().startsWith(`${key}=`));
  return line?.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') || undefined;
}

const host = setting('HOST');
const base =
  process.argv[2] ?? `http://${!host || host === '0.0.0.0' ? '127.0.0.1' : host}:${setting('PORT') ?? 3001}`;

let status: HostStatus;
try {
  const res = await fetch(base + STATUS_PATH, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  status = (await res.json()) as HostStatus;
} catch (err) {
  console.error(`Could not reach the Huddle server at ${base} (${(err as Error).message}).`);
  process.exit(2);
}

console.log(`Huddle at ${base}\n`);
console.log('game          playing  lobbies  finished  players (connected)');
for (const [path, g] of Object.entries(status.games)) {
  console.log(
    `${path.padEnd(14)}${String(g.playing).padStart(7)}  ${String(g.lobbies).padStart(7)}  ${String(g.finished).padStart(8)}  ${String(g.players).padStart(7)} (${g.connected})`,
  );
}
console.log(
  status.ongoing === 0
    ? '\nNo game in progress. Safe to restart.'
    : `\n${status.ongoing} game${status.ongoing === 1 ? '' : 's'} in progress. Restarting now would end ${status.ongoing === 1 ? 'it' : 'them'}.`,
);
process.exit(status.ongoing === 0 ? 0 : 1);
