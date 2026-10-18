import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Served under huddle.kinddot.net/regicide/. Must match BASE_PATH in games/regicide/server/src/protocol.ts.
  base: '/regicide/',
  server: {
    // Bomb Busters' Vite uses 5173. In dev, Vite serves the UI and forwards the socket to the host.
    port: 5174,
    proxy: { '/regicide/socket.io': { target: 'http://localhost:3001', ws: true } },
  },
});
