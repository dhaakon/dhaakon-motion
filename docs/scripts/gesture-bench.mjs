import { VelocityEstimator } from '../../dist/gesture.js';

// Exercise the shipped implementation, not a copied estimator or a sibling repo.
// Synthetic numerical error is not pointer-to-paint latency.
let seed = 0x5eed;
const jitter = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
  return ((seed >>> 0) / 4294967296 - 0.5) * 2;
};
const sample = (position, pause = 0) => {
  const points = [];
  for (let frame = 0; frame <= 24; frame++) {
    const t = (frame * 1000) / 120;
    points.push({ t: t + jitter(), x: position(t) + jitter() * 0.5 });
  }
  if (pause) points.push({ t: 200 + pause, x: position(200) });
  return points;
};
const run = (points, truth) => {
  const estimator = new VelocityEstimator({ axes: 1 });
  for (const point of points) estimator.push(point.x, 0, point.t);
  const now = points.at(-1).t;
  const estimated = estimator.velocity(now).x;
  const lastSample = (points.at(-1).x - points.at(-2).x) / (points.at(-1).t - points.at(-2).t);
  return {
    truth,
    estimated,
    lastSample,
    absoluteError: Math.abs(estimated - truth),
    lastSampleError: Math.abs(lastSample - truth),
  };
};
console.log(
  JSON.stringify(
    {
      implementation: 'dist/gesture.js / VelocityEstimator',
      units: 'px/ms',
      sampleRate: 120,
      seed: '0x5eed',
      note: 'Synthetic seeded position/timestamp noise. Not a rendering or event-latency benchmark.',
      cases: {
        constant: run(
          sample((t) => 0.8 * t),
          0.8,
        ),
        deceleration: run(
          sample((t) => 1.2 * t - 0.0015 * t * t),
          0.6,
        ),
        wobble: run(
          sample((t) => 0.55 * t + 2 * Math.sin(t / 18)),
          0.55 + (2 / 18) * Math.cos(200 / 18),
        ),
        pause: run(
          sample((t) => 0.8 * t, 80),
          0,
        ),
      },
    },
    null,
    2,
  ),
);
