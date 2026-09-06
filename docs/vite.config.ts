import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from '../package.json';
import { sourceAliases } from './source-aliases';

const docs = resolve(fileURLToPath(import.meta.url), '..');

export default defineConfig({
  root: docs,
  define: { __MOTION_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react()],
  resolve: {
    alias: sourceAliases,
    dedupe: ['react', 'react-dom'],
  },
  server: { port: 5175, allowedHosts: true },
  build: {
    outDir: 'dist', emptyOutDir: true, manifest: true,
    rollupOptions: { output: { manualChunks(id) { if (id.includes('/node_modules/three/')) return 'three-vendor'; } } },
  },
});
