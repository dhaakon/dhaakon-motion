import { u as FrameDriver, x as FrameScheduler, B as MotionValueShape, i as Tween, F as FrameRateInput, e as Timeline, f as TimeInput, I as InspectNode } from './track-cepHoOcR.cjs';

/**
 * A fully controllable `FrameDriver`: nothing runs until `step`/`advance` is
 * called, so tests are deterministic and never wait on a real frame.
 */
declare class ManualDriver implements FrameDriver {
    time: number;
    requests: number;
    private callback;
    now: () => number;
    request: (callback: (time: number) => void) => number;
    cancel: () => void;
    /** Jump to an absolute time and run the pending frame callback once, if any is queued. */
    step(time: number): void;
    /** Advance by a relative delta and run the pending frame callback once, if any is queued. */
    advance(delta: number): void;
}
/** A `ManualDriver` paired with a `FrameScheduler` built on it. */
declare function createTestScheduler(): {
    driver: ManualDriver;
    scheduler: FrameScheduler;
};
/**
 * Swap the shared global `scheduler`'s driver for the duration of a test, so
 * code that uses `motion.*`, `useTween`, or any other consumer of the default
 * scheduler becomes deterministic. Returns a function that restores the
 * scheduler's previous driver.
 */
declare function installFrameDriver(driver?: ManualDriver): {
    driver: ManualDriver;
    restore: () => void;
};
/** Wrap a tween's `onUpdate` and return the array its sampled values are pushed into, in order. */
declare function recordValues<T extends MotionValueShape>(tween: Tween<T>): T[];
/** Advance a `ManualDriver` by exactly `n` frames at `frameRate`, stepping the scheduler once per frame. */
declare function stepFrames(driver: ManualDriver, n: number, frameRateInput: FrameRateInput): void;
/** Step `driver` (at most `maxFrames` frames of `frameRateInput`) until `predicate()` is true. Throws if it never is. */
declare function runUntil(driver: ManualDriver, predicate: () => boolean, options?: {
    maxFrames?: number;
    frameRate?: FrameRateInput;
}): void;
/**
 * Sample every `Tween` in a timeline's tree at each of `times` (absolute, or
 * any `TimeInput` form given `frameRateInput`/the timeline's own frame rate),
 * keyed by name (or a positional path when unnamed). A stopgap until phase 5's
 * bound `Track`/cue-sheet targets make named sampling exact.
 */
declare function sample(timeline: Timeline, times: TimeInput[], frameRateInput?: FrameRateInput): Array<{
    time: number;
    values: Record<string, unknown>;
}>;
/** A snapshot-friendly view of a timeline: its ASCII rendering, inspection tree, and a value table at `times` (default: start, mid, end). */
declare function snapshotTimeline(timeline: Timeline, times?: TimeInput[]): {
    ascii: string;
    inspect: InspectNode;
    samples: {
        time: number;
        values: Record<string, unknown>;
    }[];
};

export { ManualDriver, createTestScheduler, installFrameDriver, recordValues, runUntil, sample, snapshotTimeline, stepFrames };
