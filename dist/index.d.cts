import { T as Transport, a as TransportOutput, F as FrameRateInput, b as TimeInput, c as Timeline, d as FrameInfo, e as Tween, L as Line, M as MotionValue, f as animate, s as stagger, E as EasingFunction, g as cubicBezier, h as spring } from './core-BQhuD_zO.cjs';
export { C as Clock, i as CueEvent, j as CueOptions, k as CycleSample, l as CycleSpec, D as Direction, m as Easing, n as EasingName, o as FrameDriver, p as FrameRate, q as FrameRates, r as FrameScheduler, t as FrameTask, I as InspectNode, u as Marker, v as MotionPrimitive, w as MotionValueShape, P as PropertyRange, R as RenderContext, x as Timecode, y as TimelineItem, z as TimelineOptions, A as TimelinePosition, B as Trace, G as TraceEntry, H as TransportOptions, J as TransportState, K as TweenOptions, N as TweenState, O as activeDuration, Q as addFrames, S as createTrace, U as defaultRenderContext, V as formatTime, W as formatTimecode, X as frameRate, Y as frameToMs, Z as framesToTimecode, _ as interpolate, $ as mix, a0 as msToFrame, a1 as msToTimecode, a2 as parseTime, a3 as parseTimecode, a4 as resolveEasing, a5 as sampleCycle, a6 as scheduler, a7 as snapToFrame, a8 as timecodeToFrames, a9 as timecodeToMs, aa as totalDuration } from './core-BQhuD_zO.cjs';

/**
 * A `Transport` meant for offline export rather than real-time playback: it
 * is never `play()`ed, never touches the scheduler or `performance.now`, and
 * `attach()` skips (with one warning) any output whose `supportsOffline` is
 * `false` — e.g. live audio, which has nothing meaningful to do offline.
 */
declare class OfflineTransport extends Transport {
    attach(output: TransportOutput): () => void;
}
interface RenderFramesOptions {
    frameRate?: FrameRateInput;
    from?: TimeInput;
    to?: TimeInput;
    outputs?: TransportOutput[];
    signal?: AbortSignal;
    /** Frames between forced `await` yields to the event loop (default 0 = never yield beyond what `onFrame` itself awaits). */
    yieldEvery?: number;
}
/**
 * Render every frame in `[from, to]` (default the whole duration) at an exact,
 * accumulation-free frame clock, calling `onFrame` once per frame after every
 * value has been written and every attached output has drawn. Deterministic:
 * running it twice, or resuming it on the same transport from where a prior
 * call left off, produces identical output. Resuming is detected by `from > 0`,
 * which skips the reset-and-clear-cue-state a fresh run performs at `from <= 0`.
 */
declare function renderFrames(source: Transport | Timeline, onFrame: (info: FrameInfo) => void | Promise<void>, options?: RenderFramesOptions): Promise<{
    frames: number;
    from: number;
    to: number;
}>;
/** A synchronous, pull-based equivalent of `renderFrames`: each `next()` renders and returns the next frame. */
declare function frames(source: Transport | Timeline, options?: {
    frameRate?: FrameRateInput;
    from?: TimeInput;
    to?: TimeInput;
}): Generator<FrameInfo, void, unknown>;

declare const _default: {
    Tween: typeof Tween;
    Timeline: typeof Timeline;
    Transport: typeof Transport;
    Line: typeof Line;
    MotionValue: typeof MotionValue;
    animate: typeof animate;
    stagger: typeof stagger;
    Easing: {
        linear: (t: number) => number;
        easeInQuad: (t: number) => number;
        easeOutQuad: (t: number) => number;
        easeInOutQuad: (t: number) => number;
        easeInCubic: (t: number) => number;
        easeOutCubic: (t: number) => number;
        easeInOutCubic: (t: number) => number;
        easeInQuart: (t: number) => number;
        easeOutQuart: (t: number) => number;
        easeInOutQuart: (t: number) => number;
        easeOutBack: (t: number) => number;
        dhaakon: EasingFunction;
    };
    cubicBezier: typeof cubicBezier;
    spring: typeof spring;
};

export { EasingFunction, FrameInfo, FrameRateInput, Line, MotionValue, OfflineTransport, type RenderFramesOptions, TimeInput, Timeline, Transport, TransportOutput, Tween, animate, cubicBezier, _default as default, frames, renderFrames, spring, stagger };
