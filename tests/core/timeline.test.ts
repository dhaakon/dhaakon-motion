import { test, expect } from 'vitest';
import { Tween, Timeline, FrameScheduler } from '@dhaakon/motion';
import { ManualDriver } from '@dhaakon/motion/testing';

test('timeline samples overlapping children from one clock', () => {
  const driver = new ManualDriver();
  const loop = new FrameScheduler(driver);
  const a = new Tween({ from: 0, to: 10, duration: 100, easing: 'linear' });
  const b = new Tween({ from: 10, to: 30, duration: 100, easing: 'linear' });
  const timeline = new Timeline({ scheduler: loop }).add(a).add(b, '<').play();
  expect(timeline.duration).toBe(100);
  driver.step(50);
  expect(a.value).toBe(5);
  expect(b.value).toBe(20);
  driver.step(100);
  expect(a.value).toBe(10);
  expect(b.value).toBe(30);
});
