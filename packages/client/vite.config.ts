import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // In dev, Vite serves the UI and forwards the socket to the game server.
    proxy: { '/socket.io': { target: 'http://localhost:3001', ws: true } },
  },
});
