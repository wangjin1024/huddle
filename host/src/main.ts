import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHost, type GamePath } from './app.js';

const path = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

/** Each game's Vite build, served when it exists (production). */
const builds: Record<GamePath, string> = {
  '/boom-buster': path('../../games/bomb-busters/client/dist'),
  '/regicide': path('../../games/regicide/client/dist'),
  '/codenames': path('../../games/codenames/client/dist'),
  '/hanabi': path('../../games/hanabi/client/dist'),
};
const clients = Object.fromEntries(Object.entries(builds).filter(([, dir]) => existsSync(dir)));

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST || '0.0.0.0';
const { http } = createHost({ hubFile: path('../../hub/index.html'), clients });

http.listen(port, host, () => {
  console.log(`Huddle server on http://${host}:${port}`);
});
