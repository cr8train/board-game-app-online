import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  // Makes VITE_SERVER_URL available at build time
  envPrefix: 'VITE_',
});
