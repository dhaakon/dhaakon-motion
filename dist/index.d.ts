import { d as Transport, a as TransportOutput, F as FrameRateInput, f as TimeInput, e as Timeline, g as FrameInfo, K as Keyframe, b as TrackOptions, c as Track, h as CueEvent, i as Tween, L as Line, M as MotionValue, j as animate, s as stagger, E as EasingFunction, k as cubicBezier, l as spring } from './track-cepHoOcR.js';
export { C as Clock, m as CueOptions, n as CycleSample, o as CycleSpec, D as Direction, p as Easing, q as EasingInput, r as EasingName, t as EasingTuple, u as FrameDriver, v as FrameRate, w as FrameRates, x as FrameScheduler, y as FrameTask, I as InspectNode, z as Marker, A as MotionPrimitive, B as MotionValueShape, P as PropertyRange, R as RenderContext, S as SpringOptions, G as Timecode, T as TimelineItem, H as TimelineOptions, J as TimelinePosition, N as Trace, O as TraceEntry, Q as TransportOptions, U as TransportState, V as TweenOptions, W as TweenState, X as activeDuration, Y as addFrames, Z as createTrace, _ as defaultRenderContext, $ as formatTime, a0 as formatTimecode, a1 as frameRate, a2 as frameToMs, a3 as framesToTimecode, a4 as interpolate, a5 as mix, a6 as msToFrame, a7 as msToTimecode, a8 as parseTime, a9 as parseTimecode, aa as registerEasing, ab as resolveEasing, ac as sampleCycle, ad as scheduler, ae as serializeEasing, af as snapToFrame, ag as steps, ah as timecodeToFrames, ai as timecodeToMs, aj as totalDuration, ak as track } from './track-cepHoOcR.js';

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

type MotionStyle = Record<string, number | string>;
/** Write a `MotionStyle` value onto a DOM node: transform keys (`x`, `rotate`, `scale`, ...) collapse into one `transform`, everything else is a CSS custom/standard property. */
declare function writeStyle(node: HTMLElement, values: MotionStyle): void;
/** Read a `MotionStyle`-shaped starting point off a node's computed style (transform keys read as their identity value: 0, or 1 for scale). */
declare function readStyle(node: HTMLElement, target: MotionStyle): MotionStyle;
/** A `Track` whose `apply` writes `MotionStyle` keyframes onto a DOM node, for plain (non-React) code. */
declare function styleTrack(node: HTMLElement, keyframes: Keyframe<MotionStyle>[], options?: Omit<TrackOptions<MotionStyle>, 'keyframes' | 'apply' | 'target'>): Track<MotionStyle>;

/** Wrap a plain "draw once after every value has been written" function as a `TransportOutput` — for Canvas, a custom renderer, or anything else that just needs one call per tick. */
declare function drawOutput(draw: (info: FrameInfo) => void, options?: {
    name?: string;
}): TransportOutput;
/**
 * Route every cue fired anywhere in the tree to `send`. The routing key is
 * the cue's own payload — conventionally `{ signal: <whatever the receiving
 * system understands> }`, in which case `send` receives just that inner
 * value; a payload without a `signal` property is forwarded as-is.
 */
declare function signalOutput(send: (signal: unknown, cue: CueEvent, info: FrameInfo) => void, options?: {
    filter?: (cue: CueEvent) => boolean;
    name?: string;
}): TransportOutput;

declare const _default: {
    Tween: typeof Tween;
    Timeline: typeof Timeline;
    Transport: typeof Transport;
    Track: typeof Track;
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

export { CueEvent, EasingFunction, FrameInfo, FrameRateInput, Keyframe, Line, type MotionStyle, MotionValue, OfflineTransport, type RenderFramesOptions, TimeInput, Timeline, Track, TrackOptions, Transport, TransportOutput, Tween, animate, cubicBezier, _default as default, drawOutput, frames, readStyle, renderFrames, signalOutput, spring, stagger, styleTrack, writeStyle };
