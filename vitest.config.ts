import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { sourceAliases as alias } from './docs/source-aliases';

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
