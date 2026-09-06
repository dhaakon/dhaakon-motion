import { test, expect } from 'vitest';
import { sampleCycle, activeDuration, totalDuration } from '@dhaakon/motion';

test('sampleCycle produces the midpoint progress for a plain run', () => {
  const spec = { duration: 100, delay: 0, repeat: 0, repeatDelay: 0, direction: 'normal' as const, reversed: false };
  expect(sampleCycle(spec, 50).progress).toBe(0.5);
  expect(sampleCycle(spec, 0).progress).toBe(0);
  expect(sampleCycle(spec, 100).progress).toBe(1);
});

test('sampleCycle honors delay before starting', () => {
  const spec = { duration: 100, delay: 20, repeat: 0, repeatDelay: 0, direction: 'normal' as const, reversed: false };
  expect(sampleCycle(spec, 10).progress).toBe(0);
  expect(sampleCycle(spec, 70).progress).toBe(0.5);
});

test('sampleCycle treats an infinite content duration as one unbounded iteration', () => {
  const spec = { duration: Infinity, delay: 0, repeat: 0, repeatDelay: 0, direction: 'normal' as const, reversed: false };
  expect(sampleCycle(spec, 75)).toEqual({ iteration: 0, cycleTime: 75, progress: 0, active: 75 });
});

test('activeDuration and totalDuration account for repeats and delay', () => {
  const cycle = { duration: 100, repeat: 2, repeatDelay: 10 };
  expect(activeDuration(cycle)).toBe(100 * 3 + 10 * 2);
  expect(totalDuration({ ...cycle, delay: 20 })).toBe(20 + 100 * 3 + 10 * 2);
  expect(activeDuration({ duration: 100, repeat: Infinity, repeatDelay: 0 })).toBe(Infinity);
});
