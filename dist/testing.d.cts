import { F as FrameDriver, k as FrameScheduler, n as MotionValueShape, T as Tween } from './core-Cr8UG3gM.cjs';

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

export { ManualDriver, createTestScheduler, installFrameDriver, recordValues };
