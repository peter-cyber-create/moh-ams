import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

const githubPages = process.env.GITHUB_PAGES === 'true';
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];

export default defineConfig({
  base: githubPages && repoName ? `/${repoName}/` : '/',
  plugins: [
    react(),
    {
      name: 'github-pages-spa-fallback',
      apply: 'build',
      closeBundle() {
        if (!githubPages) return;
        const dist = path.resolve(__dirname, 'dist');
        const indexPath = path.join(dist, 'index.html');
        if (!fs.existsSync(indexPath)) return;
        fs.copyFileSync(indexPath, path.join(dist, '404.html'));
        fs.writeFileSync(path.join(dist, '.nojekyll'), '');
      },
    },
  ],
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
