import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** Inject hashed Vite assets into the service worker APP_SHELL at build time. */
function mekssPwaPrecache() {
  return {
    name: 'mekss-pwa-precache',
    apply: 'build',
    closeBundle() {
      const distDir = path.resolve(rootDir, 'dist');
      const swPath = path.join(distDir, 'sw.js');
      const indexPath = path.join(distDir, 'index.html');
      if (!fs.existsSync(swPath) || !fs.existsSync(indexPath)) return;

      const html = fs.readFileSync(indexPath, 'utf8');
      const assets = [...html.matchAll(/\b(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
      const unique = [...new Set(assets)];
      const injection = unique.map((url) => `  '${url}',`).join('\n');
      const sw = fs.readFileSync(swPath, 'utf8');
      if (!sw.includes('/* __PRECACHE_ASSETS__ */')) return;
      fs.writeFileSync(swPath, sw.replace('  /* __PRECACHE_ASSETS__ */', injection || '  /* no assets */'));
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), mekssPwaPrecache()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          heroui: ['@heroui/react'],
          router: ['react-router-dom'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
});
