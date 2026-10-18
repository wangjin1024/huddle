import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Served under huddle.kinddot.net/codenames/. Must match BASE_PATH in games/codenames/server/src/protocol.ts.
  base: '/codenames/',
  server: {
    // Bomb Busters' Vite uses 5173 and Regicide's 5174. In dev, Vite serves the UI and forwards the socket to the host.
    port: 5175,
    proxy: { '/codenames/socket.io': { target: 'http://localhost:3001', ws: true } },
  },
});
