import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', react: 'src/react.tsx' },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  external: ['@dhaakon/motion', 'react', 'react-dom', 'react/jsx-runtime'],
  outExtension({ format }) { return { js: format === 'cjs' ? '.cjs' : '.js' }; },
});
