import { expect, test } from 'vitest';
import { InertiaItem, SpringItem, Timeline, loadSheet, projectFling, rubberband, saveSheet, snapTo } from '@dhaakon/motion';

test('closed-form spring starts continuously and settles at its target', () => {
  const spring = new SpringItem({ from: 10, to: 100, velocity: 1.25, stiffness: 170, damping: 26 });
  spring.sampleAt(0);
  expect(spring.value).toBeCloseTo(10, 8);
  expect(spring.velocity).toBeCloseTo(1.25, 8);
  expect(spring.totalDuration).toBeGreaterThan(0);
  spring.sampleAt(spring.totalDuration);
  expect(spring.value).toBe(100);
  expect(spring.velocity).toBe(0);
});

test('inertia projection, snapping, and sampling share the exponential endpoint', () => {
  expect(projectFling(20, 1, 325)).toBe(345);
  expect(snapTo([0, 100, 200, 300], 20, .8, 325)).toBe(300);
  const inertia = new InertiaItem({ from: 20, velocity: 1, power: 1, timeConstant: 325 });
  inertia.sampleAt(inertia.totalDuration);
  expect(inertia.value).toBeCloseTo(345, 6);
});

test('rubberband is monotonic and remains within one dimension of the boundary', () => {
  const values = [101, 120, 180, 400].map((value) => rubberband(value, 0, 100, .55, 300));
  expect(values).toEqual([...values].sort((a, b) => a - b));
  expect(values.every((value) => value > 100 && value < 400)).toBe(true);
});

test('physics items are timeline-scrubbable and round-trip through cue sheets', () => {
  const target = { set: (_value: number) => {} };
  const timeline = loadSheet({
    $schema: 'dhaakon-motion/cue-sheet/1', frameRate: 24,
    items: [
      { type: 'spring', target: 'x', from: 0, to: 100, velocity: 1 },
      { type: 'inertia', target: 'y', from: 0, velocity: .5, power: 1 },
    ],
  }, { targets: { x: target.set, y: target.set } });
  expect(timeline).toBeInstanceOf(Timeline);
  timeline.sampleAt(timeline.duration / 2);
  const saved = saveSheet(timeline);
  expect(saved.items.map((item) => item.type)).toEqual(['spring', 'inertia']);
  expect(saveSheet(loadSheet(saved, { targets: { x: target.set, y: target.set } }))).toEqual(saved);
});
