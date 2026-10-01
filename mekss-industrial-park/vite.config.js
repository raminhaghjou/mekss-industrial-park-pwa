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

/**
 * Self-host onnxruntime-web's WASM runtime under /ort/ (served from node_modules in dev, copied
 * into dist at build) so the on-device plate OCR never depends on a CDN.
 */
function selfHostedOrt() {
  const ortDist = path.resolve(rootDir, 'node_modules/onnxruntime-web/dist');
  const isRuntimeFile = (name) => /^ort-wasm.*\.(wasm|mjs)$/.test(name);
  const mime = (name) => (name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
  return {
    name: 'mekss-self-hosted-ort',
    configureServer(server) {
      server.middlewares.use('/ort', (req, res, next) => {
        const name = decodeURIComponent((req.url || '').split('?')[0].replace(/^\/+/, ''));
        const file = path.join(ortDist, name);
        if (!isRuntimeFile(name) || !fs.existsSync(file)) return next();
        res.setHeader('Content-Type', mime(name));
        res.setHeader('Cache-Control', 'no-cache');
        fs.createReadStream(file).pipe(res);
        return undefined;
      });
    },
    closeBundle() {
      if (!fs.existsSync(ortDist)) return;
      const target = path.resolve(rootDir, 'dist/ort');
      fs.mkdirSync(target, { recursive: true });
      for (const name of fs.readdirSync(ortDist).filter(isRuntimeFile)) {
        fs.copyFileSync(path.join(ortDist, name), path.join(target, name));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), mekssPwaPrecache(), selfHostedOrt()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
      '/socket.io': { target: 'http://localhost:3000', changeOrigin: true, ws: true, secure: false },
    },
  },
  worker: {
    format: 'es',
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
