import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from '../package.json';

const docs = resolve(fileURLToPath(import.meta.url), '..');
const source = resolve(docs, '..', 'src');

export default defineConfig({
  root: docs,
  define: { __MOTION_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@dhaakon\/motion\/react$/, replacement: resolve(source, 'react.tsx') },
      { find: /^@dhaakon\/motion\/testing$/, replacement: resolve(source, 'testing.ts') },
      { find: /^@dhaakon\/motion$/, replacement: resolve(source, 'index.ts') },
    ],
    dedupe: ['react', 'react-dom'],
  },
  server: { port: 5175, allowedHosts: true },
  build: { outDir: 'dist', emptyOutDir: true },
});
