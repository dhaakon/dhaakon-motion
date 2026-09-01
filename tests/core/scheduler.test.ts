import { test, expect } from 'vitest';
import { Tween } from '@dhaakon/motion';
import { FrameScheduler } from '@dhaakon/motion';
import { ManualDriver, createTestScheduler } from '@dhaakon/motion/testing';

test('many tweens share one requested animation frame', () => {
  const { driver, scheduler: loop } = createTestScheduler();
  new Tween({ from: 0, to: 1, duration: 100, scheduler: loop }).play();
  new Tween({ from: 0, to: 1, duration: 100, scheduler: loop }).play();
  expect(loop.size).toBe(2);
  expect(driver.requests).toBe(1);
});

test('setDriver swaps the time source without losing active tasks', () => {
  const first = new ManualDriver();
  const loop = new FrameScheduler(first);
  const seen: number[] = [];
  loop.add((time) => { seen.push(time); return true; });
  first.step(10);
  expect(seen).toEqual([10]);

  const second = new ManualDriver();
  loop.setDriver(second);
  first.step(999); // the old driver no longer has a pending callback; this is a no-op
  expect(seen).toEqual([10]);
  second.step(20);
  expect(seen).toEqual([10, 20]);
});
