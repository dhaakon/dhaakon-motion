import { describe, expect, test, vi } from 'vitest';
import {
  FrameScheduler, InertiaItem, MotionValue, Tween, cubicBezier, registerEasing,
  resolveEasing, sampleCycle, serializeEasing, spring, steps,
  type Direction, type EasingInput,
} from '@dhaakon/motion';
import { ManualDriver } from '@dhaakon/motion/testing';

describe('RW-02: scheduler callback isolation', () => {
  test('reports a failed task, runs later tasks, and retries on the next frame', () => {
    const driver = new ManualDriver();
    const scheduler = new FrameScheduler(driver);
    const error = new Error('transient update failure');
    const report = vi.fn();
    scheduler.onError = report;
    const seen: string[] = [];
    const failing = (time: number) => {
      seen.push(`first:${time}`);
      if (time === 10) throw error;
      return false;
    };
    scheduler.add(failing);
    scheduler.add((time) => { seen.push(`second:${time}`); return time < 20; });
    expect(() => driver.step(10)).not.toThrow();
    expect(report).toHaveBeenCalledWith(error, failing);
    expect(seen).toEqual(['first:10', 'second:10']);
    expect(driver.requests).toBe(2);
    driver.step(20);
    expect(seen).toEqual(['first:10', 'second:10', 'first:20', 'second:20']);
    expect(scheduler.size).toBe(0);
    expect(driver.requests).toBe(2);
  });

  test('an error reporter cannot strand unrelated callbacks or the next frame', () => {
    const driver = new ManualDriver();
    const scheduler = new FrameScheduler(driver);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reportError = new Error('reporter failure');
    scheduler.onError = () => { throw reportError; };
    const seen: number[] = [];
    scheduler.add((time) => { if (time === 10) throw new Error('task failure'); return false; });
    scheduler.add((time) => { seen.push(time); return time < 20; });
    try {
      expect(() => driver.step(10)).not.toThrow();
      driver.step(20);
      expect(seen).toEqual([10, 20]);
      expect(consoleError).toHaveBeenCalledWith(reportError);
      expect(scheduler.size).toBe(0);
    } finally { scheduler.clear(); consoleError.mockRestore(); }
  });

  test('the error hook can remove a failed task while preserving snapshot cancellation', () => {
    const driver = new ManualDriver();
    const scheduler = new FrameScheduler(driver);
    const canceled = vi.fn();
    scheduler.onError = (_error, task) => { scheduler.delete(task); scheduler.delete(canceled); };
    scheduler.add(() => { throw new Error('remove me'); });
    scheduler.add(canceled);
    driver.step(10);
    expect(canceled).not.toHaveBeenCalled();
    expect(scheduler.size).toBe(0);
    expect(driver.requests).toBe(1);
  });
});

describe('RW-04: signed sample-local tween velocity', () => {
  test.each([
    ['normal', 250, .1], ['reverse', 250, -.1],
    ['alternate', 1250, -.1], ['alternate-reverse', 1250, .1],
  ] as const)('%s at %s ms has velocity %s', (direction, time, expected) => {
    const tween = new Tween({ from: 0, to: 100, duration: 1000, repeat: 1, direction, easing: 'linear' });
    tween.sampleAt(time - .01);
    const before = tween.value;
    tween.sampleAt(time + .01);
    const after = tween.value;
    tween.sampleAt(time);
    expect(tween.instantaneousVelocity()).toBeCloseTo(expected, 8);
    expect(tween.instantaneousVelocity()).toBeCloseTo((after - before) / .02, 8);
    expect(tween.elapsed).toBe(0); // sampleAt is not a seek of the standalone clock.
  });

  test.each([-10, 0, 99, 1100, 1150, 2300, 2400])('holds have zero velocity at %s ms', (time) => {
    const tween = new Tween({ from: 0, to: 100, delay: 100, duration: 1000, repeat: 1, repeatDelay: 200, easing: 'linear' });
    tween.sampleAt(time);
    expect(tween.instantaneousVelocity()).toBe(0);
  });

  test('runtime reversal and compound channels retain signed velocity', () => {
    const tween = new Tween({ from: { x: 0, y: 100 }, to: { x: 100, y: 0 }, duration: 1000, easing: 'linear' });
    tween.seekTime(250).reverse();
    const velocity = tween.instantaneousVelocity() as { x: number; y: number };
    expect(velocity.x).toBeCloseTo(-.1, 8);
    expect(velocity.y).toBeCloseTo(.1, 8);
  });

  test('MotionValue hands reversed velocity to a new spring', () => {
    const driver = new ManualDriver();
    const scheduler = new FrameScheduler(driver);
    const value = new MotionValue<number>(0);
    value.animate(100, { duration: 1000, direction: 'reverse', easing: 'linear', scheduler });
    driver.step(250);
    const next = value.spring(0, { scheduler });
    expect(next.initialVelocity).toBeCloseTo(-.1, 8);
    value.stop();
    // Let autoplay registration finish without leaving a queued animation.
    return Promise.resolve().then(() => { next.cancel(); scheduler.clear(); });
  });
});

describe('RW-05: scalar inertia retargeting', () => {
  test.each([10, -10, 200])('retargeting to %s is continuous, monotonic and ends at rest', (target) => {
    const item = new InertiaItem({ from: 0, velocity: 1, power: 1, timeConstant: 100, modifyTarget: () => target });
    expect(item.sampleAt(0)).toBe(0);
    expect(item.velocity).toBeCloseTo(target / 100, 8);
    expect(item.sampleAt(100)).toBeCloseTo(target * (1 - Math.exp(-1)), 8);
    let previous = 0;
    for (let index = 1; index <= 100; index += 1) {
      const value = item.sampleAt(item.totalDuration * index / 100);
      expect(Math.sign(target) * (value - previous)).toBeGreaterThanOrEqual(-1e-10);
      expect(Math.abs(value)).toBeLessThanOrEqual(Math.abs(target) + 1e-10);
      previous = value;
    }
    expect(item.sampleAt(item.totalDuration - .001)).toBeCloseTo(target, 6);
    expect(item.sampleAt(item.totalDuration)).toBe(target);
    expect(item.velocity).toBe(0);
  });

  test('retargeting to the initial value is stationary', () => {
    const item = new InertiaItem({ from: 12, velocity: 1, modifyTarget: () => 12 });
    expect(item.totalDuration).toBe(0);
    expect(item.sampleAt(0)).toBe(12);
    expect(item.velocity).toBe(0);
  });

  test('retargeted settling matches position and velocity at both tail boundaries', () => {
    const item = new InertiaItem({ from: 0, velocity: 1, power: 1, timeConstant: 100, modifyTarget: () => 10 });
    const tailStart = 100 * Math.log(10);
    const epsilon = .0001;
    const before = item.sampleAt(tailStart - epsilon);
    const beforeVelocity = item.velocity as number;
    const after = item.sampleAt(tailStart + epsilon);
    expect(after - before).toBeCloseTo(.01 * epsilon * 2, 8);
    expect(item.velocity).toBeCloseTo(beforeVelocity, 7);
    item.sampleAt(item.totalDuration - epsilon);
    expect(item.velocity).toBeCloseTo(0, 7);
    expect(item.value).toBeCloseTo(10, 10);
  });

  test('unmodified exponential trajectories and cutoff duration stay unchanged', () => {
    const item = new InertiaItem({ from: 20, velocity: 1, power: 1, timeConstant: 100 });
    expect(item.totalDuration).toBeCloseTo(100 * Math.log(100), 8);
    expect(item.sampleAt(100)).toBeCloseTo(20 + 100 * (1 - Math.exp(-1)), 8);
    expect(item.velocity).toBeCloseTo(Math.exp(-1), 8);
    expect(item.sampleAt(item.totalDuration)).toBe(120);
  });

  test('bounce:false stops continuously at the first boundary', () => {
    const item = new InertiaItem({ from: 0, velocity: 1, power: 1, timeConstant: 100, max: 10, bounce: false });
    const crossing = -100 * Math.log(.9);
    expect(item.totalDuration).toBeCloseTo(crossing, 8);
    expect(item.target).toBe(10);
    expect(item.sampleAt(crossing - .001)).toBeCloseTo(10, 2);
    expect(item.sampleAt(crossing)).toBe(10);
    expect(item.velocity).toBe(0);
  });

  test('negative hard-bound motion stops at min without overshoot', () => {
    const item = new InertiaItem({ from: 0, velocity: -1, power: 1, timeConstant: 100, min: -10, bounce: false });
    expect(item.target).toBe(-10);
    expect(item.sampleAt(item.totalDuration / 2)).toBeGreaterThan(-10);
    expect(item.sampleAt(item.totalDuration)).toBe(-10);
    expect(item.velocity).toBe(0);
  });

  test('retargeted bounce uses the retargeted curve at its spring handoff', () => {
    const item = new InertiaItem({ from: 0, velocity: 1, power: 1, timeConstant: 100, modifyTarget: () => 20, max: 10 });
    const crossing = 100 * Math.log(2);
    expect(item.sampleAt(crossing - .001)).toBeCloseTo(10, 3);
    expect(item.sampleAt(crossing)).toBeCloseTo(10, 8);
    expect(item.velocity).toBeCloseTo(.1, 8);
    expect(item.sampleAt(item.totalDuration)).toBe(10);
  });

  test('nonfinite modified targets fail at construction', () => {
    expect(() => new InertiaItem({ from: 0, modifyTarget: () => NaN })).toThrow(/finite/i);
  });

  test('nonnumeric inertia keeps its existing stationary compatibility behavior', () => {
    const value = { x: 1 };
    const item = new InertiaItem({ from: value, velocity: { x: 2 } });
    expect(item.sampleAt(100)).toBe(value);
  });
});

describe('RW-06: easing validation and descriptors', () => {
  test.each(['toString', '__proto__', 'constructor'])('rejects inherited name %s', (name) => {
    expect(() => resolveEasing(name)).toThrow(/Unknown easing/);
  });

  test('registered callback identity remains intact', () => {
    const fn = registerEasing('rw-06-custom', (value) => value);
    expect(resolveEasing('rw-06-custom')).toBe(fn);
  });

  test.each([
    ['cubicBezier', NaN, 0, 1, 1], ['cubicBezier', 0, 0, Infinity, 1],
    ['cubicBezier', 0, 0, 1], ['steps', Infinity], ['steps', NaN],
    ['steps', 4, 'invalid'], ['spring', { mass: 0 }],
    ['spring', { stiffness: Infinity }], ['spring', { damping: NaN }],
  ])('rejects invalid parameters %j', (...input) => {
    expect(() => resolveEasing(input as EasingInput)).toThrow();
  });

  test('direct easing factories validate numeric parameters', () => {
    expect(() => cubicBezier(0, NaN, 1, 1)).toThrow(/finite/i);
    expect(() => spring({ mass: Infinity })).toThrow(/finite/i);
    expect(() => steps(Infinity)).toThrow(/finite/i);
  });

  test('steps-start survives serialization without changing legacy end descriptors', () => {
    const start = steps(4, 'start');
    expect(serializeEasing(start)).toEqual(['steps', 4, 'start']);
    expect(serializeEasing(steps(4))).toEqual(['steps', 4]);
    const restored = resolveEasing(serializeEasing(start));
    for (const progress of [0, .01, .25, .3, .9, 1]) expect(restored(progress)).toBe(start(progress));
  });
});

describe('sub-millisecond and zero-duration cycle boundaries', () => {
  test('positive sub-millisecond durations fold without a one-millisecond floor', () => {
    expect(sampleCycle({ duration: .25, delay: 0, repeat: 3, repeatDelay: 0, direction: 'normal', reversed: false }, .375))
      .toEqual({ iteration: 1, cycleTime: .125, progress: .5, active: .375 });
  });

  test('infinite sub-millisecond tweens reverse without changing their current value', () => {
    const tween = new Tween({ from: 0, to: 1, duration: .25, repeat: Infinity, easing: 'linear' });
    tween.seekTime(.375);
    expect(tween.value).toBe(.5);
    tween.reverse();
    expect(tween.value).toBe(.5);
    expect(tween.instantaneousVelocity()).toBeCloseTo(-4, 8);
  });

  test('zero-duration finite alternate repeats keep their final-lap endpoint', () => {
    expect(sampleCycle({ duration: 0, delay: 0, repeat: 3, repeatDelay: 0, direction: 'alternate', reversed: false }, 0))
      .toEqual({ iteration: 3, cycleTime: 0, progress: 0, active: 0 });
  });

  test.each(['normal', 'reverse', 'alternate', 'alternate-reverse'] as Direction[])('zero-duration infinite %s has a finite endpoint sample', (direction) => {
    const sample = sampleCycle({ duration: 0, delay: 0, repeat: Infinity, repeatDelay: 0, direction, reversed: false }, 0);
    expect(sample).toEqual({ iteration: 0, cycleTime: 0, progress: direction.includes('reverse') ? 0 : 1, active: 0 });
  });
});
