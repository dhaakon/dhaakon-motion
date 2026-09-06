import type { CueSheet, TrackSheetItem } from '@dhaakon/motion';

export const ADVANCED_CUE_FRAMES = 576;
export const CUE_FPS = 24;
export const CUE_VIDEO = '/media/dhaakon-ink-signal-v2-1920x1080-24fps.mp4';
export const cueActs = [
  { name: 'CONSTRUCT', from: 0, to: 96, subtitle: 'Every signal begins with a line.' },
  { name: 'REVEAL', from: 96, to: 216, subtitle: 'Light finds the surface.' },
  { name: 'TRANSFORM', from: 216, to: 336, subtitle: 'A constant identity. A changing state.' },
  { name: 'FRACTURE', from: 336, to: 444, subtitle: 'Order, briefly undone.' },
  { name: 'RESOLVE', from: 444, to: 576, subtitle: 'Everything in its own time.' },
] as const;
export const initialCueStates = {
  field: { opacity: 0, frequency: 0.004, displacement: 0, drift: 0 },
  grid: { opacity: 0, rotate: -3, scale: 1.1, y: 0 },
  scene: { x: 0, y: 0, scale: 0.86, rotate: -3 },
  finish: { vignette: 0.6, border: 0.2, exposure: 1 },
  orbit: { opacity: 0, rotate: -90, scale: 0.6, dash: 1 },
  particles: { opacity: 0, spread: 0, rotate: 0, scale: 1 },
  light: { opacity: 0, x: -150, width: 60, energy: 0 },
  pulse: { opacity: 0, radius: 0.5 },
  trace: { opacity: 0, dash: 1, glow: 0 },
  echoes: { opacity: 0, spread: 0, blur: 0, scale: 1 },
  ink: { opacity: 0, reveal: 0, scale: 1, y: 0, gradient: 0 },
  warp: { opacity: 0, amount: 0, frequency: 0.01, x: 0 },
  slices: { opacity: 0, spread: 0, shear: 0, lift: 0 },
  type: { opacity: 0, x: 0, y: 0, tracking: 7, reveal: 0 },
  blueprint: { opacity: 0, draw: 0, spread: 1 },
  ribbons: { opacity: 0, phase: 0, amplitude: 0.2, twist: 0 },
  contours: { opacity: 0, morph: 0, rotate: 0, spread: 1 },
  shards: { opacity: 0, explode: 0, rotate: 0, depth: 0 },
  glyphs: { opacity: 0, reveal: 0, spread: 1, tilt: 22 },
  title: { opacity: 0, reveal: 0, tracking: 16, y: 18 },
  aperture: { opacity: 0, open: 0, rotate: 0 },
  depth: { opacity: 0, distance: 0, angle: 0 },
  stars: { opacity: 0, travel: 0, stretch: 1 },
};
export type CueTarget = keyof typeof initialCueStates;
export type CueState = Record<string, number>;
type Beat = [number, CueState, string?];

// Expand partial authoring values to complete JSON objects. One full-show
// writer per target makes arbitrary backwards seeks independent of history.
function track(target: CueTarget, beats: Beat[]): TrackSheetItem {
  let state: CueState = { ...initialCueStates[target] };
  const keyframes: TrackSheetItem['keyframes'] = [{ at: '0f', value: { ...state } }];
  for (const [frame, patch, easing = 'dhaakon'] of beats) {
    state = { ...state, ...patch };
    keyframes.push({ at: `${frame}f`, value: { ...state }, easing });
  }
  if (beats.at(-1)?.[0] !== ADVANCED_CUE_FRAMES)
    keyframes.push({ at: `${ADVANCED_CUE_FRAMES}f`, value: { ...state } });
  return { type: 'track', name: target, target, at: '0f', keyframes };
}
export const advancedCueSheet: CueSheet = {
  $schema: 'dhaakon-motion/cue-sheet/1',
  name: 'INK / SIGNAL — FIVE ACTS',
  frameRate: CUE_FPS,
  markers: [
    ...cueActs.map((act, index) => ({
      name: act.name,
      at: `${act.from}f`,
      color: ['#97baff', '#f6b975', '#a8a0ff', '#ff704e', '#d9ff91'][index],
    })),
    { name: 'LOCK', at: '168f', color: '#f4efe6' },
    { name: 'BREAK', at: '372f', color: '#ff704e' },
    { name: 'OUT', at: '575f', color: '#d9ff91' },
  ].sort((a, b) => Number.parseInt(a.at) - Number.parseInt(b.at)),
  cues: cueActs.map((act) => ({
    name: act.name,
    at: `${act.from}f`,
    payload: { effect: act.subtitle },
  })),
  regions: cueActs.map((act) => ({ name: act.name, from: `${act.from}f`, to: `${act.to}f` })),
  items: [
    {
      type: 'timeline',
      name: '01 / ATMOSPHERE + CAMERA',
      at: '0f',
      frameRate: 24,
      items: [
        track('field', [
          [36, { opacity: 0.16 }],
          [96, { opacity: 0.2, frequency: 0.006, drift: 20 }],
          [168, { opacity: 0.12, drift: 40 }],
          [264, { opacity: 0.32, frequency: 0.012, displacement: 24, drift: 80 }],
          [336, { opacity: 0.14 }],
          [372, { opacity: 0.27, frequency: 0.019, displacement: 40 }],
          [444, { opacity: 0.08, frequency: 0.004, displacement: 0 }],
          [540, { opacity: 0.1, drift: 100 }],
          [576, { opacity: 0 }],
        ]),
        track('grid', [
          [24, { opacity: 0.35 }],
          [72, { opacity: 0.45, rotate: 0, scale: 1 }],
          [120, { opacity: 0.08 }],
          [216, { opacity: 0.06 }],
          [336, { opacity: 0.26, rotate: 0 }],
          [396, { opacity: 0.1, rotate: 5 }],
          [468, { opacity: 0.04, rotate: 0 }],
          [576, { opacity: 0 }],
        ]),
        track('scene', [
          [72, { scale: 0.94, rotate: 0 }],
          [168, { scale: 1.04 }],
          [216, { scale: 0.98 }],
          [300, { scale: 0.9, rotate: -4, x: 8 }],
          [336, { scale: 0.96, rotate: 0, x: 0 }],
          [360, { scale: 1.05 }],
          [396, { scale: 0.82, rotate: 6 }],
          [468, { scale: 1, rotate: 0 }],
          [540, { scale: 1.02 }],
          [576, { scale: 1.02 }],
        ]),
        track('finish', [
          [72, { vignette: 0.3, border: 0.5 }],
          [168, { vignette: 0.25, border: 0.24 }],
          [300, { vignette: 0.2 }],
          [372, { vignette: 0.1, border: 0.7, exposure: 1.08 }],
          [444, { vignette: 0.3, border: 0.2, exposure: 1 }],
          [576, { vignette: 0.4 }],
        ]),
        track('stars', [
          [36, { opacity: 0.55 }],
          [168, { opacity: 0.24, travel: 0.35 }],
          [300, { opacity: 0.5, travel: 0.75, stretch: 2 }],
          [372, { opacity: 0.8, travel: 1, stretch: 7 }],
          [444, { opacity: 0.35, travel: 1.3, stretch: 1 }],
          [576, { opacity: 0.2, travel: 1.5 }],
        ]),
      ],
    },
    {
      type: 'timeline',
      name: '02 / VECTOR ARCHITECTURE',
      at: '0f',
      frameRate: 24,
      items: [
        track('blueprint', [
          [12, { opacity: 0.8 }],
          [60, { draw: 1, spread: 0 }],
          [84, { opacity: 0.65 }],
          [120, { opacity: 0 }],
          [336, { opacity: 0 }],
          [354, { opacity: 0.5, draw: 1, spread: 0 }],
          [396, { opacity: 0.25, spread: 0.6 }],
          [444, { opacity: 0 }],
        ]),
        track('orbit', [
          [36, { opacity: 0.35, scale: 0.9, dash: 0.7 }],
          [84, { opacity: 0.75, scale: 1, rotate: 0, dash: 0 }],
          [168, { opacity: 0.25, rotate: 30 }],
          [264, { opacity: 0.65, rotate: 120, scale: 1.1 }],
          [336, { opacity: 0.45, rotate: 180, scale: 1 }],
          [396, { opacity: 0.75, rotate: 240, scale: 1.13 }],
          [468, { opacity: 0.12, rotate: 300, scale: 1 }],
          [576, { opacity: 0.08, rotate: 330 }],
        ]),
        track('ribbons', [
          [168, { opacity: 0 }],
          [228, { opacity: 0.45, phase: 1, amplitude: 0.4 }],
          [288, { opacity: 0.85, phase: 3, amplitude: 1, twist: 1 }, 'linear'],
          [336, { opacity: 0.45, phase: 4.5, amplitude: 0.6, twist: 2 }],
          [384, { opacity: 0.2, phase: 6, amplitude: 1.3 }],
          [444, { opacity: 0, phase: 7 }],
        ]),
        track('contours', [
          [192, { opacity: 0 }],
          [228, { opacity: 0.65, morph: 0.2 }],
          [288, { opacity: 0.9, morph: 1, rotate: 75, spread: 1.1 }],
          [336, { opacity: 0.4, morph: 0.4, rotate: 120, spread: 0.9 }],
          [384, { opacity: 0.8, morph: 1.5, rotate: 165, spread: 1.2 }],
          [444, { opacity: 0, morph: 0, rotate: 220, spread: 1 }],
        ]),
        track('aperture', [
          [84, { opacity: 0, open: 0 }],
          [96, { opacity: 0.9, open: 0.05 }],
          [132, { opacity: 0.65, open: 0.8, rotate: 30 }],
          [168, { opacity: 0, open: 1, rotate: 50 }],
          [336, { opacity: 0, open: 1 }],
          [354, { opacity: 0.6, open: 0.8 }],
          [396, { opacity: 0.25, open: 1, rotate: 120 }],
          [444, { opacity: 0 }],
        ]),
        track('pulse', [
          [96, { opacity: 0 }],
          [108, { opacity: 0.5, radius: 0.8 }],
          [150, { opacity: 0, radius: 2.5 }],
          [348, { opacity: 0, radius: 0.4 }],
          [372, { opacity: 0.65, radius: 1.2 }],
          [408, { opacity: 0, radius: 3 }],
        ]),
      ],
    },
    {
      type: 'timeline',
      name: '03 / LOGO MATERIAL PASSES',
      at: '0f',
      frameRate: 24,
      items: [
        track('trace', [
          [12, { opacity: 0.9 }],
          [72, { dash: 0, glow: 0.1 }],
          [96, { opacity: 0.8 }],
          [168, { opacity: 0.2 }],
          [264, { opacity: 0.7, glow: 0.25 }],
          [336, { opacity: 0.8, glow: 0 }],
          [372, { opacity: 0 }],
          [444, { opacity: 0.6, dash: 0 }],
          [492, { opacity: 0.12 }],
        ]),
        track('glyphs', [
          [36, { opacity: 0 }],
          [60, { opacity: 0.8, reveal: 0.25, spread: 0.7 }],
          [96, { opacity: 0.7, reveal: 1, spread: 0, tilt: 0 }],
          [144, { opacity: 0 }],
          [420, { opacity: 0, reveal: 0, spread: 0.6, tilt: -20 }],
          [444, { opacity: 0.9, reveal: 0.15 }],
          [480, { opacity: 0, reveal: 1, spread: 0, tilt: 0 }],
        ]),
        track('ink', [
          [96, { opacity: 0, reveal: 0, scale: 0.98 }],
          [132, { opacity: 0.95, reveal: 0.6, gradient: 30 }],
          [168, { opacity: 1, reveal: 1, scale: 1, gradient: 80 }],
          [216, { opacity: 1, gradient: 160 }],
          [288, { opacity: 0.8, gradient: 400 }],
          [336, { opacity: 0.8, gradient: 560 }],
          [360, { opacity: 0 }],
          [444, { opacity: 0, reveal: 0, scale: 1, gradient: 0 }],
          [480, { opacity: 1, reveal: 1, gradient: 160 }],
          [540, { opacity: 1, gradient: 190 }],
          [576, { opacity: 1 }],
        ]),
        track('depth', [
          [108, { opacity: 0 }],
          [168, { opacity: 0.65, distance: 1.2, angle: 0.6 }],
          [288, { opacity: 0.7, distance: 2.5, angle: 2 }],
          [336, { opacity: 0.6, distance: 1.5, angle: 3 }],
          [360, { opacity: 0 }],
          [468, { opacity: 0, distance: 1, angle: 0.6 }],
          [492, { opacity: 0.6 }],
          [576, { opacity: 0.55 }],
        ]),
        track('light', [
          [108, { opacity: 0, x: 160 }],
          [144, { opacity: 0.8, x: 440, width: 100 }],
          [192, { opacity: 0, x: 920 }],
          [252, { opacity: 0, x: 100 }],
          [288, { opacity: 0.7, x: 480, width: 130 }],
          [324, { opacity: 0, x: 930 }],
          [468, { opacity: 0, x: 160 }],
          [504, { opacity: 0.7, x: 550, width: 90 }],
          [540, { opacity: 0, x: 940 }],
        ]),
        track('echoes', [
          [204, { opacity: 0 }],
          [240, { opacity: 0.35, spread: 6, blur: 1 }],
          [288, { opacity: 0.5, spread: 12, scale: 1.01 }],
          [336, { opacity: 0.15, spread: 2 }],
          [360, { opacity: 0.7, spread: 28, blur: 3 }],
          [396, { opacity: 0, spread: 60 }],
          [576, { opacity: 0 }],
        ]),
        track('warp', [
          [228, { opacity: 0 }],
          [264, { opacity: 0.2, amount: 12, frequency: 0.008 }],
          [300, { opacity: 0.3, amount: 24, frequency: 0.015 }],
          [336, { opacity: 0, amount: 0 }],
          [360, { opacity: 0.3, amount: 28 }],
          [384, { opacity: 0, amount: 0 }],
        ]),
      ],
    },
    {
      type: 'timeline',
      name: '04 / FRACTURE + PARTICLES',
      at: '0f',
      frameRate: 24,
      items: [
        track('slices', [
          [336, { opacity: 0 }],
          [348, { opacity: 0.8, spread: 0.1, shear: 1 }],
          [360, { opacity: 0.5, spread: 0.8, shear: 5, lift: 1 }],
          [384, { opacity: 0, spread: 1.5 }],
          [444, { opacity: 0, spread: 0, shear: 0, lift: 0 }],
        ]),
        track('shards', [
          [348, { opacity: 0 }],
          [360, { opacity: 1, explode: 0.15 }],
          [396, { opacity: 1, explode: 1, rotate: 32, depth: 0.65 }],
          [420, { opacity: 0.9, explode: 0.75, rotate: 22, depth: 0.4 }],
          [456, { opacity: 1, explode: 0, rotate: 0, depth: 0 }],
          [480, { opacity: 0 }],
        ]),
        track('particles', [
          [108, { opacity: 0 }],
          [132, { opacity: 0.65, spread: 0.8, rotate: 10 }],
          [192, { opacity: 0, spread: 2, rotate: 65 }],
          [348, { opacity: 0, spread: 0, rotate: 90 }],
          [372, { opacity: 1, spread: 0.8, rotate: 110 }],
          [420, { opacity: 0.5, spread: 3, rotate: 180, scale: 0.5 }],
          [468, { opacity: 0, spread: 3.6 }],
        ]),
      ],
    },
    {
      type: 'timeline',
      name: '05 / KINETIC TYPOGRAPHY',
      at: '0f',
      frameRate: 24,
      items: [
        track('type', [
          [24, { opacity: 0 }],
          [72, { opacity: 0.8, reveal: 1, tracking: 3 }],
          [96, { opacity: 0.4 }],
          [168, { opacity: 1, reveal: 1, tracking: 4 }],
          [336, { opacity: 0.8 }],
          [372, { opacity: 0.3, tracking: 8 }],
          [444, { opacity: 0.5, tracking: 4 }],
          [492, { opacity: 1 }],
          [576, { opacity: 1 }],
        ]),
        track('title', [
          [444, { opacity: 0 }],
          [468, { opacity: 1, reveal: 0.2 }],
          [504, { opacity: 1, reveal: 1, tracking: 4, y: 0 }],
          [576, { opacity: 1 }],
        ]),
      ],
    },
  ],
};
const effects: Record<CueTarget, string> = {
  field: 'SEEDED SVG TURBULENCE',
  grid: 'DRAFTING GRID',
  scene: 'CAMERA TRANSFORM',
  finish: 'EXPOSURE + VIGNETTE',
  orbit: 'INSTRUMENT RINGS',
  particles: 'ANALYTIC BURST',
  light: 'CLIPPED SPECULAR SWEEP',
  pulse: 'RADIAL SHOCKWAVE',
  trace: 'PATH TRIM',
  echoes: 'CHROMATIC SEPARATION',
  ink: 'SKEWED MASK REVEAL',
  warp: 'SVG DISPLACEMENT',
  slices: 'HORIZONTAL CLIP STRIPS',
  type: 'CHAPTER TELEMETRY',
  blueprint: 'DIMENSION DRAW-ON',
  ribbons: 'PARAMETRIC STREAMLINES',
  contours: 'CONTOUR PATH MORPH',
  shards: '48 CLIPPED FRAGMENTS',
  glyphs: 'STAGGERED LOGO SECTIONS',
  title: 'PER-CHARACTER REVEAL',
  aperture: 'IRIS BLADES',
  depth: 'LAYERED VECTOR EXTRUSION',
  stars: 'SEEDED DEPTH FIELD',
};
export const advancedCueLayers = advancedCueSheet.items
  .flatMap((group) => (group as { items: TrackSheetItem[] }).items)
  .map((item, index) => {
    const target = item.target as CueTarget;
    const first = item.keyframes.findIndex((key) => (key.value as CueState).opacity > 0);
    const last = item.keyframes.findLastIndex((key) => (key.value as CueState).opacity > 0);
    return {
      target,
      label: target.toUpperCase(),
      effect: effects[target],
      from: first >= 0 ? Number.parseInt(String(item.keyframes[Math.max(0, first - 1)].at)) : 0,
      to:
        last >= 0
          ? Number.parseInt(
              String(item.keyframes[Math.min(item.keyframes.length - 1, last + 1)].at),
            )
          : 576,
      color: ['#97baff', '#a8a0ff', '#f6b975', '#d9ff91', '#ff704e'][index % 5],
      keyframes: item.keyframes.map((key) => Number.parseInt(String(key.at))),
    };
  });
export const advancedCueSheetSource = JSON.stringify(advancedCueSheet, null, 2);
