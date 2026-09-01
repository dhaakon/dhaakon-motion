import { FrameScheduler, scheduler, type FrameDriver } from './scheduler';
import type { Tween } from './core';
import type { MotionValueShape } from './interpolate';

/**
 * A fully controllable `FrameDriver`: nothing runs until `step`/`advance` is
 * called, so tests are deterministic and never wait on a real frame.
 */
export class ManualDriver implements FrameDriver {
  time = 0;
  requests = 0;
  private callback: ((time: number) => void) | null = null;

  now = () => this.time;

  request = (callback: (time: number) => void) => {
    this.callback = callback;
    this.requests += 1;
    return this.requests;
  };

  cancel = () => {
    this.callback = null;
  };

  /** Jump to an absolute time and run the pending frame callback once, if any is queued. */
  step(time: number) {
    this.time = time;
    const callback = this.callback;
    this.callback = null;
    callback?.(time);
  }

  /** Advance by a relative delta and run the pending frame callback once, if any is queued. */
  advance(delta: number) {
    this.step(this.time + delta);
  }
}

/** A `ManualDriver` paired with a `FrameScheduler` built on it. */
export function createTestScheduler(): { driver: ManualDriver; scheduler: FrameScheduler } {
  const driver = new ManualDriver();
  return { driver, scheduler: new FrameScheduler(driver) };
}

/**
 * Swap the shared global `scheduler`'s driver for the duration of a test, so
 * code that uses `motion.*`, `useTween`, or any other consumer of the default
 * scheduler becomes deterministic. Returns a function that restores the
 * scheduler's previous driver.
 */
export function installFrameDriver(driver: ManualDriver = new ManualDriver()): { driver: ManualDriver; restore: () => void } {
  const restore = installOnScheduler(scheduler, driver);
  return { driver, restore };
}

function installOnScheduler(target: FrameScheduler, driver: FrameDriver) {
  const previous = (target as unknown as { driver: FrameDriver }).driver;
  target.setDriver(driver);
  return () => target.setDriver(previous);
}

/** Wrap a tween's `onUpdate` and return the array its sampled values are pushed into, in order. */
export function recordValues<T extends MotionValueShape>(tween: Tween<T>): T[] {
  const values: T[] = [];
  const previous = tween.onUpdate;
  tween.onUpdate = (value, progress, instance) => {
    values.push(value);
    previous?.(value, progress, instance);
  };
  return values;
}
