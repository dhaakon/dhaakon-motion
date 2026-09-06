import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
/** Bundle authoritative source once, preserving a single canonical engine identity. */
export async function sourceMotion() {
  const result = await build({
    absWorkingDir: root,
    stdin: {
      contents:
        "export * from './src/index.ts'; export * from './src/compiled.ts'; export { advancedCueSheet } from './docs/src/advancedCueSheet.ts';",
      resolveDir: root,
      loader: 'ts',
    },
    alias: { '@dhaakon/motion': root + 'src/index.ts' },
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    logLevel: 'silent',
  });
  const source = result.outputFiles[0].text;
  return {
    motion: await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64')),
    sourceSha256: createHash('sha256').update(source).digest('hex'),
  };
}
export const compoundValue = (end) => ({
  position: { x: end ? 800 : 0, y: end ? 400 : 10, z: end ? 10 : 1 },
  opacity: end ? 1 : 0,
  color: end ? '#ff5a1f' : '#102030',
  width: end ? '800px' : '100px',
});
export function inputs(count, compound = false, keys = 2) {
  return Array.from({ length: count }, (_, i) => ({
    id: `track-${i}`,
    easing: 'dhaakon',
    keyframes: Array.from({ length: keys }, (_, k) => ({
      at: (k * 2000) / (keys - 1),
      value: compound ? compoundValue(k % 2) : k % 2 ? 1000 : 0,
    })),
  }));
}
export function parityInputs() {
  const curves = [
    'linear',
    'easeInQuad',
    'easeOutQuad',
    'easeInOutQuad',
    'easeInCubic',
    'easeOutCubic',
    'easeInOutCubic',
    'easeInQuart',
    'easeOutQuart',
    'easeInOutQuart',
    'easeOutBack',
    'dhaakon',
    ['cubicBezier', 0.2, -0.1, 0.6, 1.2],
    ['spring', { stiffness: 180, damping: 14, mass: 1 }],
    ['spring', { stiffness: 170, damping: 26, mass: 1 }],
    ['steps', 5],
    ['steps', 5, 'start'],
  ];
  const directions = ['normal', 'reverse', 'alternate', 'alternate-reverse'];
  return curves.flatMap((easing, i) =>
    directions.map((direction, j) => ({
      id: `curve-${i}-${j}`,
      easing,
      direction,
      repeat: j === 3 ? Infinity : 3,
      repeatDelay: 25,
      keyframes: [
        { at: 0, value: compoundValue(false) },
        { at: 500, value: compoundValue(true) },
        { at: 500, value: compoundValue(false) },
        { at: 2000, value: compoundValue(true) },
      ],
    })),
  );
}
