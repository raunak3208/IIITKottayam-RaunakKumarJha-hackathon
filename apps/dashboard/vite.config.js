import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const gateway = process.env.GATEWAY_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/v1': gateway,
      '/health': gateway,
    },
  },
});
