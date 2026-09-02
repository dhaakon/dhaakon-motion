import { w as FrameDriver, z as FrameScheduler, e as Timeline, f as TimeInput, M as MotionValueShape, l as Tween, F as FrameRateInput, I as InspectNode } from './track-CKxBNm8F.cjs';

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
/**
 * Sample `timeline` at `at` and assert every key in `expected` matches (numbers
 * within `tolerance`, default 1e-6; everything else by deep equality via
 * JSON). On failure the error includes the timeline's ASCII rendering, so a
 * failing assertion shows the whole composition, not just one wrong number.
 */
declare function expectSample(timeline: Timeline, at: TimeInput, expected: Record<string, unknown>, options?: {
    tolerance?: number;
}): void;
declare class FakeAudioParam {
    value: number;
    calls: Array<{
        type: 'ramp' | 'target';
        value: number;
        time: number;
    }>;
    linearRampToValueAtTime(value: number, time: number): void;
    setTargetAtTime(value: number, time: number): void;
}
declare class FakeGainNode {
    gain: FakeAudioParam;
    connect(): this;
    disconnect(): void;
}
declare class FakeBufferSource {
    buffer: unknown;
    loop: boolean;
    playbackRate: FakeAudioParam;
    started: boolean;
    stopped: boolean;
    startTime: number;
    startOffset: number;
    connect(): this;
    disconnect(): void;
    start(when?: number, offset?: number): void;
    stop(): void;
}
declare class FakeAudioContext {
    currentTime: number;
    state: 'running' | 'suspended' | 'closed';
    destination: {};
    sources: FakeBufferSource[];
    createBufferSource(): FakeBufferSource;
    createGain(): FakeGainNode;
    resume(): Promise<void>;
}
declare class FakeOfflineAudioContext extends FakeAudioContext {
    readonly length: number;
    readonly sampleRate: number;
    constructor(length?: number, sampleRate?: number);
    startRendering(): Promise<{
        length: number;
        sampleRate: number;
        duration: number;
    }>;
}
/** A fake `AudioContext`, typed loosely enough to pass to `audioOutput`/`AudioClip`/`paramTrack` in a test. */
declare function fakeAudioContext(): FakeAudioContext;
/** A fake `OfflineAudioContext` for testing `renderAudio`. */
declare function fakeOfflineAudioContext(length?: number, sampleRate?: number): FakeOfflineAudioContext;
/** `{ duration }` — enough of an `AudioBuffer` for `AudioClip`. */
declare function fakeAudioBuffer(durationSeconds: number): {
    duration: number;
};
declare class FakeMIDIOutput {
    sent: Array<{
        data: number[];
        timestamp?: number;
    }>;
    send(data: number[] | Uint8Array, timestamp?: number): void;
}
/** A fake `MIDIOutput` for testing `midiOutput`/`noteCue`: recorded sends land in `.sent`. */
declare function fakeMidiPort(): FakeMIDIOutput;

export { FakeAudioContext, FakeAudioParam, FakeBufferSource, FakeGainNode, FakeMIDIOutput, FakeOfflineAudioContext, ManualDriver, createTestScheduler, expectSample, fakeAudioBuffer, fakeAudioContext, fakeMidiPort, fakeOfflineAudioContext, installFrameDriver, recordValues, runUntil, sample, snapshotTimeline, stepFrames };
