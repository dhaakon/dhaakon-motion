import { test, expect } from 'vitest';
import { Timeline, Tween } from '@dhaakon/motion';
import { createTestScheduler, stepFrames, runUntil, expectSample, sample, snapshotTimeline } from '@dhaakon/motion/testing';

test('stepFrames advances a ManualDriver by exactly n frames at a given rate', () => {
  const { driver, scheduler: loop } = createTestScheduler();
  const tween = new Tween({ from: 0, to: 24, duration: 1000, easing: 'linear', scheduler: loop }).play();
  stepFrames(driver, 12, 24); // 12 frames @ 24fps = 500ms
  expect(tween.value).toBeCloseTo(12, 6);
});

test('runUntil steps a driver until a predicate is true, and throws if it never is', () => {
  const { driver, scheduler: loop } = createTestScheduler();
  const tween = new Tween({ from: 0, to: 1, duration: 1000, easing: 'linear', scheduler: loop }).play();
  runUntil(driver, () => tween.progress >= 0.5, { frameRate: 60 });
  expect(tween.progress).toBeGreaterThanOrEqual(0.5);

  expect(() => runUntil(driver, () => false, { maxFrames: 5, frameRate: 60 })).toThrow(/predicate was still false/);
});

test('expectSample passes for a matching value and reports the ASCII timeline on mismatch', () => {
  const a = new Tween({ from: 0, to: 100, duration: 100, easing: 'linear' });
  a.name = 'a';
  const timeline = new Timeline().add(a, 0);
  expect(() => expectSample(timeline, 50, { a: 50 })).not.toThrow();
  expect(() => expectSample(timeline, 50, { a: 999 })).toThrow(/expected 999, got 50/);
});

test('sample() and snapshotTimeline() report named tween values across a set of times', () => {
  const a = new Tween({ from: 0, to: 10, duration: 100, easing: 'linear' });
  a.name = 'a';
  const timeline = new Timeline().add(a, 0);
  const rows = sample(timeline, [0, 50, 100]);
  expect(rows.map((r) => r.values.a)).toEqual([0, 5, 10]);

  const snapshot = snapshotTimeline(timeline);
  expect(snapshot.ascii).toContain('a');
  expect(snapshot.inspect.children[0].name).toBe('a');
});
