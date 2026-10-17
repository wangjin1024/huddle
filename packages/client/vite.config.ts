import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Served under huddle.kinddot.net/boom-buster/. Must match BASE_PATH in packages/server/src/protocol.ts.
  base: '/boom-buster/',
  server: {
    // In dev, Vite serves the UI and forwards the socket to the game server.
    proxy: { '/boom-buster/socket.io': { target: 'http://localhost:3001', ws: true } },
  },
});
