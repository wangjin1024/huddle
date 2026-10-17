import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from './server.js';

const dist = fileURLToPath(new URL('../../client/dist', import.meta.url));
const hub = fileURLToPath(new URL('../../../hub/index.html', import.meta.url));
const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST || '0.0.0.0';
const { http } = createServer({ staticDir: existsSync(dist) ? dist : undefined, hubFile: hub });

http.listen(port, host, () => {
  console.log(`Bomb Busters server on http://${host}:${port}`);
});
