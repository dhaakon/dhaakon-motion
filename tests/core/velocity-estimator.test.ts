import { expect, test } from 'vitest';
import { VelocityEstimator } from '@dhaakon/motion/gesture';

test('weighted least-squares estimator recovers constant velocity with timestamp jitter', () => {
  const estimator = new VelocityEstimator();
  [0, 16.4, 32.1, 49.2, 65.7, 83.1].forEach((t) => estimator.push(2 * t, -.5 * t, t));
  expect(estimator.velocity(83.1).x).toBeCloseTo(2, 4);
  expect(estimator.velocity(83.1).y).toBeCloseTo(-.5, 4);
});

test('lift rule zeroes stale velocity after a pause', () => {
  const estimator = new VelocityEstimator();
  estimator.push(0, 0, 0); estimator.push(40, 0, 40);
  expect(estimator.velocity(40).x).toBeCloseTo(1, 6);
  expect(estimator.velocity(101)).toEqual({ x: 0, y: 0 });
});

