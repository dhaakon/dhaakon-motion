import { FrameScheduler, scheduler, type FrameDriver } from './scheduler';
import { Tween } from './core';
import type { MotionValueShape } from './interpolate';
import { Timeline } from './timeline';
import { frameRate, parseTime, type FrameRateInput, type TimeInput } from './time';

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

/** Advance a `ManualDriver` by exactly `n` frames at `frameRate`, stepping the scheduler once per frame. */
export function stepFrames(driver: ManualDriver, n: number, frameRateInput: FrameRateInput) {
  const rate = frameRate(frameRateInput);
  for (let i = 1; i <= n; i += 1) driver.advance(1000 * rate.den / rate.num);
}

/** Step `driver` (at most `maxFrames` frames of `frameRateInput`) until `predicate()` is true. Throws if it never is. */
export function runUntil(driver: ManualDriver, predicate: () => boolean, options: { maxFrames?: number; frameRate?: FrameRateInput } = {}) {
  const maxFrames = options.maxFrames ?? 10000;
  const rate = frameRate(options.frameRate ?? 60);
  for (let i = 0; i < maxFrames; i += 1) {
    if (predicate()) return;
    driver.advance(1000 * rate.den / rate.num);
  }
  if (!predicate()) throw new Error(`runUntil: predicate was still false after ${maxFrames} frames`);
}

/**
 * Sample every `Tween` in a timeline's tree at each of `times` (absolute, or
 * any `TimeInput` form given `frameRateInput`/the timeline's own frame rate),
 * keyed by name (or a positional path when unnamed). A stopgap until phase 5's
 * bound `Track`/cue-sheet targets make named sampling exact.
 */
export function sample(timeline: Timeline, times: TimeInput[], frameRateInput?: FrameRateInput): Array<{ time: number; values: Record<string, unknown> }> {
  const rate = frameRateInput ? frameRate(frameRateInput) : timeline.frameRate;
  return times.map((input) => {
    const ms = typeof input === 'number' ? input : parseTime(input, rate);
    timeline.sampleAt(ms);
    return { time: ms, values: collectTweenValues(timeline, '') };
  });
}

function collectTweenValues(timeline: Timeline, prefix: string): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  timeline.items.forEach((entry, index) => {
    const key = entry.item.name ?? `${prefix}${index}`;
    if (entry.item instanceof Timeline) Object.assign(values, collectTweenValues(entry.item, `${key}.`));
    else if (entry.item instanceof Tween) values[key] = entry.item.value;
  });
  return values;
}

/** A snapshot-friendly view of a timeline: its ASCII rendering, inspection tree, and a value table at `times` (default: start, mid, end). */
export function snapshotTimeline(timeline: Timeline, times?: TimeInput[]) {
  const duration = Number.isFinite(timeline.totalDuration) ? timeline.totalDuration : timeline.duration;
  const sampleTimes = times ?? [0, duration / 2, duration];
  return {
    ascii: timeline.toAscii(),
    inspect: timeline.inspect(),
    samples: sample(timeline, sampleTimes),
  };
}
