import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../src/', import.meta.url));
/** Used by Vite and Vitest: all adapters resolve to source, never stale dist. */
export const sourceAliases = Object.entries({
  react: 'react.tsx',
  three: 'three.ts',
  audio: 'audio.ts',
  midi: 'midi.ts',
  testing: 'testing.ts',
  devtools: 'devtools.ts',
  gesture: 'gesture/index.ts',
  compiled: 'compiled.ts',
  '': 'index.ts',
}).map(([entry, file]) => ({
  find: new RegExp(`^@dhaakon/motion${entry ? '/' + entry : ''}$`),
  replacement: resolve(source, file),
}));
