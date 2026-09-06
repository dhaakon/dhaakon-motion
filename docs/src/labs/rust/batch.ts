import type { CompiledTrackInput } from '@dhaakon/motion/compiled';

export const BATCH_DURATION_MS = 8_000;
export const BATCH_COUNTS = [256, 1024, 2048] as const;
export const BATCH_CHANNELS = ['x', 'y', 'depth', 'radius', 'alpha', 'hue', 'twist'] as const;
export type BatchFps = 24 | 60;
export type BatchPoint = Record<(typeof BATCH_CHANNELS)[number], number>;
export const BATCH_ACTS = [
  { at: 0, label: 'Orbital assembly' },
  { at: 2_800, label: 'Identity / point type' },
  { at: 5_500, label: 'Interference field' },
  { at: 6_800, label: 'Toroidal collapse' },
] as const;

// Geometry is authored as data, not sampled from a canvas font or a random seed.
// That makes the exact same plan available to Node tests and both browser engines.
const glyphs: Record<string, string[]> = {
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
};
const typePoints = [...'DHAAKON'].flatMap((letter, column) =>
  glyphs[letter].flatMap((row, y) =>
    [...row].flatMap((pixel, x) => (pixel === '1' ? [[column * 6 + x, y] as const] : [])),
  ),
);
const TAU = Math.PI * 2;
const fraction = (n: number) => n - Math.floor(n);

function formation(
  index: number,
  count: number,
  act: 'orbit' | 'type' | 'wave' | 'knot',
  turn = 0,
): BatchPoint {
  const t = index / count;
  const seed = fraction(index * 0.6180339887498948);
  const lane = index % 7;
  const angle = TAU * (t * 7 + turn);
  let x: number, y: number, depth: number;
  if (act === 'type') {
    const [gx, gy] = typePoints[index % typePoints.length];
    const spread = count / typePoints.length > 1 ? 0.55 : 0;
    x = ((gx + (seed - 0.5) * spread) / 40 - 0.5) * 1.74;
    y = ((gy + (fraction(index * 0.414213562373095) - 0.5) * spread) / 6 - 0.5) * 0.53;
    depth = (seed - 0.5) * 0.3;
  } else if (act === 'wave') {
    const columns = Math.ceil(Math.sqrt(count * 2));
    const rows = Math.ceil(count / columns);
    x = ((index % columns) / (columns - 1) - 0.5) * 1.8;
    const row = Math.floor(index / columns) / Math.max(1, rows - 1);
    y = (row - 0.5) * 0.72 + Math.sin(x * 7 + row * 9) * 0.2;
    depth = Math.cos(x * 5 - row * 8) * 0.65;
  } else if (act === 'knot') {
    const major = TAU * t * 3;
    const minor = TAU * t * 19;
    const radius = 0.58 + Math.cos(minor) * 0.23;
    x = Math.cos(major) * radius;
    y = Math.sin(major) * radius * 0.65 + Math.sin(minor) * 0.18;
    depth = Math.sin(minor) * 0.8;
  } else {
    const radius = 0.28 + lane * 0.082 + Math.sin(angle * 3) * 0.022;
    x = Math.cos(angle) * radius;
    y = Math.sin(angle) * radius * 0.72;
    depth = Math.sin(angle + lane * 0.35) * 0.85;
  }
  return {
    x,
    y,
    depth,
    radius: act === 'type' ? 1.2 + seed * 0.6 : 0.65 + seed * 1.15,
    alpha: act === 'type' ? 0.7 + seed * 0.3 : 0.28 + seed * 0.66,
    hue: 165 + lane * 12 + (act === 'knot' ? 38 : 0),
    twist: angle + (act === 'wave' ? Math.PI * 0.5 : 0),
  };
}

/** Four formations / seven scalar channels per point, entirely portable authored Tracks. */
export function createBatchTracks(count: number): CompiledTrackInput<BatchPoint>[] {
  if (!(BATCH_COUNTS as readonly number[]).includes(count))
    throw new Error('Choose a bounded batch of 256, 1024 or 2048 points');
  return Array.from({ length: count }, (_, index) => {
    const orbit = formation(index, count, 'orbit');
    return {
      id: `point-${index}`,
      easing: 'easeInOutCubic',
      keyframes: [
        { at: 0, value: orbit },
        { at: 1_500, value: formation(index, count, 'orbit', 0.13), easing: 'linear' },
        { at: 2_800, value: formation(index, count, 'type') },
        { at: 4_000, value: formation(index, count, 'type') },
        {
          at: 5_500,
          value: formation(index, count, 'wave'),
          easing: ['cubicBezier', 0.22, 1, 0.36, 1],
        },
        {
          at: 6_800,
          value: formation(index, count, 'knot'),
          easing: ['spring', { stiffness: 100, damping: 14, mass: 1 }],
        },
        { at: BATCH_DURATION_MS, value: { ...orbit } },
      ],
    };
  });
}

export function batchFrameCount(fps: BatchFps): number {
  if (fps !== 24 && fps !== 60) throw new Error('Batch frame rate must be 24 or 60');
  return (BATCH_DURATION_MS * fps) / 1_000;
}

/** The displayed loop is half-open: its last frame is duration - one frame. */
export function batchFrameTime(frame: number, fps: BatchFps): number {
  const count = batchFrameCount(fps);
  if (!Number.isInteger(frame) || frame < 0 || frame >= count)
    throw new Error('Batch frame is outside the half-open frame range');
  return (frame * 1_000) / fps;
}

export function batchMaxDelta(left: readonly BatchPoint[], right: readonly BatchPoint[]): number {
  if (left.length !== right.length) return Infinity;
  let max = 0;
  for (let i = 0; i < left.length; i++) {
    if (!left[i] || !right[i]) return Infinity;
    for (const channel of BATCH_CHANNELS) {
      const delta = Math.abs(left[i][channel] - right[i][channel]);
      if (!Number.isFinite(delta)) return Infinity;
      max = Math.max(max, delta);
    }
  }
  return max;
}
