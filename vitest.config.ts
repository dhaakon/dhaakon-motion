import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const src = resolve(__dirname, 'src');

const alias = [
  { find: /^@dhaakon\/motion\/react$/, replacement: resolve(src, 'react.tsx') },
  { find: /^@dhaakon\/motion\/three$/, replacement: resolve(src, 'three.ts') },
  { find: /^@dhaakon\/motion\/audio$/, replacement: resolve(src, 'audio.ts') },
  { find: /^@dhaakon\/motion\/midi$/, replacement: resolve(src, 'midi.ts') },
  { find: /^@dhaakon\/motion\/testing$/, replacement: resolve(src, 'testing.ts') },
  { find: /^@dhaakon\/motion\/devtools$/, replacement: resolve(src, 'devtools.ts') },
  { find: /^@dhaakon\/motion$/, replacement: resolve(src, 'index.ts') },
];

export default defineConfig({
  resolve: { alias, dedupe: ['react', 'react-dom'] },
  test: {
    projects: [
      {
        resolve: { alias, dedupe: ['react', 'react-dom'] },
        test: {
          name: 'core',
          environment: 'node',
          include: ['tests/core/**/*.test.ts'],
        },
      },
      {
        plugins: [react()],
        resolve: { alias, dedupe: ['react', 'react-dom'] },
        test: {
          name: 'react',
          environment: 'jsdom',
          include: ['tests/react/**/*.test.tsx'],
          setupFiles: ['tests/react/setup.ts'],
        },
      },
    ],
  },
});
