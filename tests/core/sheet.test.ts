import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect } from 'vitest';
import { MotionValue, Timeline, Transport, signalOutput } from '@dhaakon/motion';
import { loadSheet, saveSheet, validateSheet, captureScene, applyScene, sceneTransition, sceneSheet, type CueSheet } from '@dhaakon/motion';

const fixturesDir = fileURLToPath(new URL('../fixtures/sheets/', import.meta.url));
function fixture(name: string): CueSheet {
  return JSON.parse(readFileSync(`${fixturesDir}${name}`, 'utf8'));
}

test('validateSheet accepts both fixtures', () => {
  expect(validateSheet(fixture('minimal.json'))).toMatchObject({ ok: true });
  expect(validateSheet(fixture('nested-timecode.json'))).toMatchObject({ ok: true });
});

test('loadSheet builds a timeline that samples correctly, including frame-literal durations', () => {
  const camera = new MotionValue<{ position: number[]; fov: number }>({ position: [0, 0, 0], fov: 0 });
  const timeline = loadSheet(fixture('minimal.json'), { targets: { camera } });
  expect(timeline.name).toBe('minimal');
  expect(timeline.frameRate.fps).toBe(24);
  timeline.sampleAt(0);
  expect(camera.get().fov).toBeCloseTo(44, 6);
  timeline.sampleAt(timeline.duration); // 12f @ 24fps = 500ms
  expect(camera.get().fov).toBeCloseTo(31, 6);
});

test('a cue with no bound handler still fires and its payload still reaches a signal output', () => {
  const timeline = loadSheet(fixture('minimal.json'), {}, { strict: false });
  const signals: unknown[] = [];
  const transport = new Transport({ root: timeline, duration: timeline.explain('verse+=12f').ms + 50 });
  transport.attach(signalOutput((signal) => signals.push(signal)));
  transport.seek(0);
  transport.seek(transport.duration); // crosses the "blackout" cue, which has no bindings.cues handler
  expect(signals).toEqual([{ type: 'dmx', channel: 1, value: 0 }]);
});

test('nested timelines and tracks resolve timecode positions through the sheet\'s frame rate', () => {
  const title = new MotionValue<number>(0);
  const timeline = loadSheet(fixture('nested-timecode.json'), { targets: { opacity: () => {}, title: (v) => title.set(v as number) } });
  expect(timeline.frameRate.dropFrame).toBe(true);
  const intro = timeline.items.find((entry) => entry.item.name === 'intro')!;
  expect(intro).toBeDefined();
  expect((intro.item as Timeline).frameRate.dropFrame).toBe(true); // inherited from the sheet, not set on the nested item itself
});

test('saveSheet(loadSheet(sheet)) round-trips target bindings, easing, and structure', () => {
  const camera = new MotionValue<{ position: number[]; fov: number }>({ position: [0, 0, 0], fov: 0 });
  const original = fixture('minimal.json');
  const timeline = loadSheet(original, { targets: { camera } });
  const saved = saveSheet(timeline);
  expect(saved.name).toBe('minimal');
  expect(saved.items[0]).toMatchObject({ type: 'tween', target: 'camera', duration: 500, easing: 'dhaakon' });
});

test('saveSheet(loadSheet(...)) is a fixed point: reloading and re-saving produces the same sheet', () => {
  const targets = { targets: { camera: new MotionValue<{ position: number[]; fov: number }>({ position: [0, 0, 0], fov: 0 }) } };
  const once = saveSheet(loadSheet(fixture('minimal.json'), targets));
  const twice = saveSheet(loadSheet(once, { targets: { camera: new MotionValue<{ position: number[]; fov: number }>({ position: [0, 0, 0], fov: 0 }) } }));
  expect(twice).toEqual(once);
});

test('validateSheet reports a bad frame rate, dropFrame at an unsupported fps, unknown easing, and out-of-order keyframes', () => {
  const badFrameRate = validateSheet({ $schema: 'dhaakon-motion/cue-sheet/1', frameRate: -5, items: [] });
  expect(badFrameRate.ok).toBe(false);
  if (!badFrameRate.ok) expect(badFrameRate.errors[0].path).toBe('$.frameRate');

  const dropAt24 = validateSheet({ $schema: 'dhaakon-motion/cue-sheet/1', frameRate: { num: 24, den: 1, dropFrame: true }, items: [] });
  expect(dropAt24.ok).toBe(false);
  if (!dropAt24.ok) expect(dropAt24.errors[0].message).toMatch(/drop-frame/i);

  const unknownEasing = validateSheet({
    $schema: 'dhaakon-motion/cue-sheet/1',
    items: [{ type: 'tween', from: 0, to: 1, easing: 'not-a-real-easing' }],
  });
  expect(unknownEasing.ok).toBe(false);
  if (!unknownEasing.ok) expect(unknownEasing.errors[0].path).toBe('$.items[0].easing');

  const outOfOrder = validateSheet({
    $schema: 'dhaakon-motion/cue-sheet/1',
    items: [{ type: 'track', keyframes: [{ at: 100, value: 0 }, { at: 50, value: 1 }] }],
  });
  expect(outOfOrder.ok).toBe(false);
  if (!outOfOrder.ok) expect(outOfOrder.errors[0].path).toBe('$.items[0].keyframes[1].at');
});

test('loadSheet in strict mode throws on a missing target, naming it in the message', () => {
  expect(() => loadSheet(fixture('minimal.json'), {})).toThrow(/unknown target "camera"/);
});

test('loadSheet in non-strict mode warns and skips a missing target instead of throwing', () => {
  const warn = console.warn;
  const messages: string[] = [];
  console.warn = (msg: string) => messages.push(msg);
  try {
    const timeline = loadSheet(fixture('minimal.json'), {}, { strict: false });
    expect(timeline.items.length).toBe(1);
  } finally {
    console.warn = warn;
  }
  expect(messages.some((m) => m.includes('unknown target "camera"'))).toBe(true);
});

// ---- scene states -----------------------------------------------------------

test('captureScene reads every MotionValue target; applyScene writes them back immediately', () => {
  const x = new MotionValue<number>(0);
  const y = new MotionValue<number>(10);
  const captured = captureScene({ x, y });
  expect(captured).toEqual({ x: 0, y: 10 });
  x.set(99);
  applyScene(captured, { x, y });
  expect(x.get()).toBe(0);
  expect(y.get()).toBe(10);
});

test('applyScene with a transition produces a playing Timeline reaching the target values', () => {
  const x = new MotionValue<number>(0);
  const timeline = applyScene({ x: 100 }, { x }, { transition: { duration: 200, easing: 'linear' } });
  expect(timeline).toBeInstanceOf(Timeline);
  (timeline as Timeline).stop();
  (timeline as Timeline).seek(0.5);
  expect(x.get()).toBeCloseTo(50, 6);
});

test('sceneTransition produces the expected midpoint value without auto-playing', () => {
  const x = new MotionValue<number>(0);
  const timeline = sceneTransition({ x: 0 }, { x: 100 }, { x }, { duration: 200, easing: 'linear' });
  expect(timeline.state).toBe('idle');
  timeline.seek(0.5);
  expect(x.get()).toBeCloseTo(50, 6);
});

test('sceneSheet turns a state sequence into a cue sheet with a marker per state and one track per key', () => {
  const states = { rehearsal: { energy: 0.2 }, live: { energy: 1 } };
  const sheet = sceneSheet(states, ['rehearsal', 'live'], { hold: 0, transition: 500 });
  expect(sheet.markers?.map((m) => m.name)).toEqual(['rehearsal', 'live']);
  expect(sheet.items).toEqual([{ type: 'track', target: 'energy', keyframes: [{ at: 0, value: 0.2, easing: undefined }, { at: 500, value: 1, easing: undefined }] }]);
  const energy = { value: 0 };
  const timeline = loadSheet(sheet, { targets: { energy: (v) => { energy.value = v as number; } } }, { strict: false });
  timeline.sampleAt(0);
  expect(energy.value).toBeCloseTo(0.2, 6);
  timeline.sampleAt(500);
  expect(energy.value).toBeCloseTo(1, 6);
});
