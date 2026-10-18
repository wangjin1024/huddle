import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Served under huddle.kinddot.net/hanabi/. Must match BASE_PATH in games/hanabi/server/src/protocol.ts.
  base: '/hanabi/',
  server: {
    // Bomb Busters' Vite uses 5173, Regicide's 5174 and Codenames' 5175. In dev, Vite serves the UI and forwards the socket to the host.
    port: 5176,
    proxy: { '/hanabi/socket.io': { target: 'http://localhost:3001', ws: true } },
  },
});
