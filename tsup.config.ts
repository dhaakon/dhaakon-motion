import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/react.tsx',
    three: 'src/three.ts',
    audio: 'src/audio.ts',
    midi: 'src/midi.ts',
    testing: 'src/testing.ts',
    devtools: 'src/devtools.ts',
    gesture: 'src/gesture/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  external: ['@dhaakon/motion', 'react', 'react-dom', 'react/jsx-runtime', 'three'],
  outExtension({ format }) { return { js: format === 'cjs' ? '.cjs' : '.js' }; },
});
