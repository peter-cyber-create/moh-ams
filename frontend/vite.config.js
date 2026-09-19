import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    host: true,
    port: 3010,
    proxy: {
      '/api/v1': { target: 'http://localhost:3020', changeOrigin: true },
      '/api/auth': { target: 'http://localhost:3000', changeOrigin: true },
      '/health': { target: 'http://localhost:3020', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3020', changeOrigin: true },
    },
  },
});
