import { expect, test } from 'vitest';
import { MotionValue } from '@dhaakon/motion';
import { createTestScheduler } from '@dhaakon/motion/testing';

test('MotionValue derives scalar and component velocity from timestamped writes', () => {
  const scalar = new MotionValue<number>(0);
  scalar.set(0, 0); scalar.set(40, 40);
  expect(scalar.velocity).toBe(1);
  expect(scalar.updatedAt).toBe(40);

  const vector = new MotionValue({ x: 0, y: 5 });
  vector.set({ x: 0, y: 5 }, 0); vector.set({ x: 20, y: -5 }, 10);
  expect(vector.velocity).toEqual({ x: 2, y: -1 });
});

test('setWithVelocity preserves analytic velocity and a tween hands velocity to physics', () => {
  const value = new MotionValue<number>(0);
  value.setWithVelocity(10, 2.5, 40);
  expect(value.velocity).toBe(2.5);

  const { driver, scheduler } = createTestScheduler();
  value.set(0, 0);
  value.animate(300, { duration: 300, easing: 'linear', scheduler });
  driver.step(150);
  expect(value.get()).toBe(150);
  expect(value.velocity).toBeCloseTo(1, 6);
});
