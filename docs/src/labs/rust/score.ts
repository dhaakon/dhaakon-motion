import type { EasingInput, MotionValueShape } from '@dhaakon/motion';
import type { CompiledTrackInput } from '@dhaakon/motion/compiled';

export const SCORE_FPS = 60;
/** Playback/export uses the half-open interval 0–720: exactly 720 frames. */
export const SCORE_FRAMES = 720;
export const SCORE_ACTS = [
  {
    id: 'cartography',
    label: 'Cartography',
    startFrame: 0,
    endFrame: 144,
    detail: 'Construction lines become a dimensional instrument.',
    accent: '#d5ff5f',
  },
  {
    id: 'aperture',
    label: 'Aperture',
    startFrame: 144,
    endFrame: 288,
    detail: 'A moving mask reveals the identity beneath its outlines.',
    accent: '#78ebea',
  },
  {
    id: 'matter',
    label: 'Matter',
    startFrame: 288,
    endFrame: 432,
    detail: 'The mark separates into material, depth and orbital traces.',
    accent: '#ff956c',
  },
  {
    id: 'interference',
    label: 'Interference',
    startFrame: 432,
    endFrame: 576,
    detail: 'Phase-shifted ribbons cross a sliced, chromatic field.',
    accent: '#78ebea',
  },
  {
    id: 'resolve',
    label: 'Resolve',
    startFrame: 576,
    endFrame: 720,
    detail: 'Every layer converges into a single signed frame.',
    accent: '#d5ff5f',
  },
] as const;

type ScoreValue = Record<string, number | string>;
type ScoreKey = readonly [frame: number, value: ScoreValue, easing?: EasingInput];

function track(
  id: string,
  keys: readonly ScoreKey[],
  easing: EasingInput = 'dhaakon',
): CompiledTrackInput {
  return {
    id,
    frameRate: SCORE_FPS,
    easing,
    keyframes: keys.map(([frame, value, segmentEasing]) => ({
      at: `${frame}f`,
      value: { ...value },
      ...(segmentEasing ? { easing: segmentEasing } : {}),
    })),
  };
}

/**
 * Pure authoring, shared unchanged by the JS reference and actual Wasm runtime.
 * Every group has a fixed portable shape. SVG geometry is a host renderer: this
 * score does not imply a Rust GPU renderer or compile arbitrary SVG into Wasm.
 */
export function createScoreInputs(): CompiledTrackInput[] {
  return [
    track('aperture', [
      [0, { radius: 34, squash: 0.12, rotation: -26 }],
      [100, { radius: 170, squash: 0.16, rotation: -16 }],
      [160, { radius: 195, squash: 0.2, rotation: 0 }],
      [252, { radius: 370, squash: 0.94, rotation: 18 }],
      [350, { radius: 400, squash: 1, rotation: 0 }],
      [480, { radius: 260, squash: 0.68, rotation: -12 }],
      [620, { radius: 410, squash: 1, rotation: 0 }],
      [720, { radius: 410, squash: 1, rotation: 0 }],
    ]),
    track('spectrum', [
      [0, { hot: '#d5ff5f', cold: '#78ebea', opacity: 0.6 }],
      [240, { hot: '#78ebea', cold: '#d5ff5f', opacity: 0.95 }],
      [340, { hot: '#ff956c', cold: '#d5ff5f', opacity: 1 }],
      [480, { hot: '#78ebea', cold: '#ff956c', opacity: 1 }],
      [640, { hot: '#d5ff5f', cold: '#78ebea', opacity: 0.82 }],
      [720, { hot: '#d5ff5f', cold: '#78ebea', opacity: 0.82 }],
    ]),
    track('scan', [
      [0, { x: 130, opacity: 0, width: 1 }],
      [144, { x: 220, opacity: 0.8, width: 1 }],
      [285, { x: 820, opacity: 0.75, width: 12 }, 'linear'],
      [288, { x: 180, opacity: 0, width: 1 }],
      [430, { x: 820, opacity: 0, width: 1 }],
      [440, { x: 160, opacity: 0.8, width: 3 }],
      [565, { x: 840, opacity: 0.6, width: 22 }, 'linear'],
      [600, { x: 870, opacity: 0, width: 1 }],
      [720, { x: 870, opacity: 0, width: 1 }],
    ]),
    track('orbital', [
      [0, { rotation: -35, radius: 190, opacity: 0.22, arc: 0.12 }],
      [100, { rotation: 20, radius: 214, opacity: 0.75, arc: 0.82 }],
      [288, { rotation: 120, radius: 232, opacity: 0.65, arc: 0.6 }, 'linear'],
      [432, { rotation: 235, radius: 253, opacity: 0.92, arc: 0.96 }, 'linear'],
      [576, { rotation: 370, radius: 218, opacity: 0.6, arc: 0.4 }, 'linear'],
      [650, { rotation: 405, radius: 224, opacity: 0.35, arc: 0.72 }],
      [720, { rotation: 405, radius: 224, opacity: 0.35, arc: 0.72 }],
    ]),
    track(
      'gyroscope',
      [
        [0, { rotation: 18, tilt: 0.32, opacity: 0.22 }],
        [144, { rotation: -25, tilt: 0.58, opacity: 0.7 }],
        [288, { rotation: -80, tilt: 0.42, opacity: 0.4 }],
        [396, { rotation: -135, tilt: 0.88, opacity: 0.9 }],
        [540, { rotation: -235, tilt: 0.2, opacity: 0.55 }],
        [660, { rotation: -270, tilt: 0.52, opacity: 0.2 }],
        [720, { rotation: -270, tilt: 0.52, opacity: 0.2 }],
      ],
      'easeInOutCubic',
    ),
    track('exploded', [
      [0, { spread: 0, skew: 0, opacity: 0 }],
      [264, { spread: 0, skew: 0, opacity: 0 }],
      [335, { spread: 1, skew: -16, opacity: 0.78 }],
      [405, { spread: 0.8, skew: 10, opacity: 0.6 }],
      [480, { spread: 0.15, skew: 0, opacity: 0.24 }],
      [605, { spread: 0, skew: 0, opacity: 0 }],
      [720, { spread: 0, skew: 0, opacity: 0 }],
    ]),
    track(
      'lattice',
      [
        [0, { opacity: 0.22, bend: 8, shift: 0 }],
        [130, { opacity: 0.62, bend: 24, shift: 16 }],
        [260, { opacity: 0.23, bend: 10, shift: 28 }],
        [380, { opacity: 0.5, bend: 68, shift: -10 }],
        [510, { opacity: 0.68, bend: -46, shift: -28 }],
        [630, { opacity: 0.18, bend: 12, shift: 0 }],
        [720, { opacity: 0.18, bend: 12, shift: 0 }],
      ],
      'easeInOutCubic',
    ),
    track('ribbons', [
      [0, { opacity: 0, phase: 0, amplitude: 10, separation: 4 }],
      [275, { opacity: 0, phase: 0, amplitude: 10, separation: 4 }],
      [340, { opacity: 0.3, phase: 1.4, amplitude: 42, separation: 6 }],
      [432, { opacity: 0.6, phase: 3.2, amplitude: 70, separation: 9 }],
      [520, { opacity: 0.82, phase: 6.4, amplitude: 95, separation: 4 }, 'linear'],
      [610, { opacity: 0, phase: 8, amplitude: 18, separation: 2 }],
      [720, { opacity: 0, phase: 8, amplitude: 18, separation: 2 }],
    ]),
    track('particles', [
      [0, { opacity: 0.16, phase: 0, radius: 150, scatter: 0 }],
      [144, { opacity: 0.5, phase: 0.8, radius: 240, scatter: 0.25 }],
      [288, { opacity: 0.7, phase: 1.8, radius: 220, scatter: 0.5 }, 'linear'],
      [396, { opacity: 1, phase: 3.2, radius: 310, scatter: 1 }],
      [540, { opacity: 0.8, phase: 5.7, radius: 210, scatter: 0.6 }, 'linear'],
      [650, { opacity: 0.38, phase: 6.8, radius: 235, scatter: 0.05 }],
      [720, { opacity: 0.38, phase: 6.8, radius: 235, scatter: 0.05 }],
    ]),
    track('echoes', [
      [0, { opacity: 0, offset: 0, scale: 1 }],
      [276, { opacity: 0, offset: 0, scale: 1 }],
      [345, { opacity: 0.52, offset: 22, scale: 1.018 }],
      [432, { opacity: 0.18, offset: -9, scale: 1.008 }],
      [510, { opacity: 0.42, offset: 8, scale: 1.012 }],
      [615, { opacity: 0, offset: 0, scale: 1 }],
      [720, { opacity: 0, offset: 0, scale: 1 }],
    ]),
    track('logo', [
      [0, { opacity: 0.22, scale: 0.76, y: 18, rotation: -4 }],
      [135, { opacity: 0.5, scale: 0.9, y: 6, rotation: 0 }],
      [252, { opacity: 1, scale: 1, y: 0, rotation: 0 }],
      [345, { opacity: 0.78, scale: 0.86, y: -10, rotation: -7 }],
      [420, { opacity: 0.9, scale: 0.94, y: 0, rotation: 4 }],
      [530, { opacity: 1, scale: 1.03, y: 0, rotation: 0 }],
      [640, { opacity: 1, scale: 1, y: 0, rotation: 0 }],
      [720, { opacity: 1, scale: 1, y: 0, rotation: 0 }],
    ]),
    track('logoSlices', [
      [0, { amount: 0, phase: 0, opacity: 0 }],
      [300, { amount: 0, phase: 0, opacity: 0 }],
      [350, { amount: 36, phase: 1, opacity: 0.5 }],
      [420, { amount: 8, phase: 2, opacity: 0.2 }],
      [456, { amount: 40, phase: 4, opacity: 0.8 }, ['steps', 8]],
      [525, { amount: 20, phase: 9, opacity: 0.65 }, ['steps', 12]],
      [580, { amount: 0, phase: 12, opacity: 0 }, ['steps', 8]],
      [720, { amount: 0, phase: 12, opacity: 0 }],
    ]),
    track('logoStroke', [
      [0, { opacity: 0.8, width: '0.6px', reveal: 0.18 }],
      [125, { opacity: 0.95, width: '1.2px', reveal: 1 }],
      [245, { opacity: 0.42, width: '0.7px', reveal: 1 }],
      [345, { opacity: 0.85, width: '1px', reveal: 0.92 }],
      [510, { opacity: 0.65, width: '0.6px', reveal: 1 }],
      [640, { opacity: 0.25, width: '0.45px', reveal: 1 }],
      [720, { opacity: 0.25, width: '0.45px', reveal: 1 }],
    ]),
    track('logoShadow', [
      [0, { depth: 1, opacity: 0.2 }],
      [250, { depth: 5, opacity: 0.3 }],
      [345, { depth: 30, opacity: 0.8 }],
      [420, { depth: 12, opacity: 0.5 }],
      [530, { depth: 8, opacity: 0.4 }],
      [640, { depth: 3, opacity: 0.28 }],
      [720, { depth: 3, opacity: 0.28 }],
    ]),
    track('datum', [
      [0, { opacity: 0.7, length: 0.25, spread: 0 }],
      [120, { opacity: 0.85, length: 1, spread: 0 }],
      [280, { opacity: 0.5, length: 0.9, spread: 0 }],
      [350, { opacity: 0.85, length: 1, spread: 54 }],
      [530, { opacity: 0.6, length: 0.85, spread: 20 }],
      [650, { opacity: 0.48, length: 1, spread: 0 }],
      [720, { opacity: 0.48, length: 1, spread: 0 }],
    ]),
    track('annotation', [
      [0, { opacity: 0.25, offset: 12, count: 0 }],
      [100, { opacity: 0.85, offset: 0, count: 144 }],
      [288, { opacity: 0.55, offset: 0, count: 288 }, 'linear'],
      [432, { opacity: 0.95, offset: -8, count: 432 }, 'linear'],
      [576, { opacity: 0.65, offset: 0, count: 576 }, 'linear'],
      [650, { opacity: 0.8, offset: 0, count: 720 }],
      [720, { opacity: 0.8, offset: 0, count: 720 }],
    ]),
    track('field', [
      [0, { opacity: 0.2, rotation: 0, spacing: 1 }],
      [144, { opacity: 0.45, rotation: 2, spacing: 1.08 }],
      [288, { opacity: 0.25, rotation: 0, spacing: 1 }],
      [396, { opacity: 0.75, rotation: -5, spacing: 1.25 }],
      [525, { opacity: 0.5, rotation: 5, spacing: 0.92 }],
      [650, { opacity: 0.2, rotation: 0, spacing: 1 }],
      [720, { opacity: 0.2, rotation: 0, spacing: 1 }],
    ]),
    track('shutters', [
      [0, { open: 0.25, opacity: 0.65 }],
      [130, { open: 0.46, opacity: 0.5 }],
      [245, { open: 1, opacity: 0.15 }],
      [420, { open: 1, opacity: 0 }],
      [475, { open: 0.7, opacity: 0.4 }],
      [590, { open: 1, opacity: 0 }],
      [720, { open: 1, opacity: 0 }],
    ]),
    track(
      'witness',
      [
        [0, { opacity: 0.16, turn: 0, progress: 0 }],
        [720, { opacity: 0.65, turn: 720, progress: 1 }, 'linear'],
      ],
      'linear',
    ),
    track(
      'flash',
      [
        [0, { opacity: 0, radius: 12 }],
        [575, { opacity: 0, radius: 12 }],
        [585, { opacity: 0.5, radius: 210 }],
        [620, { opacity: 0, radius: 430 }],
        [720, { opacity: 0, radius: 430 }],
      ],
      'easeOutCubic',
    ),
  ];
}

/** Initial authored values, not a borrowed evaluator buffer or live resource. */
export const SCORE_INITIAL_VALUES: Record<string, unknown> = Object.fromEntries(
  createScoreInputs().map(({ id, keyframes }) => [
    id,
    Object.freeze({ ...(keyframes[0].value as ScoreValue) }),
  ]),
);

export function scoreValue(
  values: Record<string, unknown>,
  id: string,
): Record<string, number | string> {
  return (values[id] ?? SCORE_INITIAL_VALUES[id]) as Record<string, number | string>;
}

/** A fresh detached value bag is suitable for React state after group sampling. */
export function scoreSnapshot(
  get: (id: string) => MotionValueShape | undefined,
): Record<string, unknown> {
  return Object.fromEntries(Object.keys(SCORE_INITIAL_VALUES).map((id) => [id, get(id)]));
}
