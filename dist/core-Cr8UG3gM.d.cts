type EasingFunction = (progress: number) => number;
declare function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFunction;
declare function spring({ stiffness, damping, mass }?: {
    stiffness?: number | undefined;
    damping?: number | undefined;
    mass?: number | undefined;
}): EasingFunction;
declare const Easing: {
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
type EasingName = keyof typeof Easing;
declare function resolveEasing(easing?: EasingFunction | EasingName): EasingFunction;

/** A rational frame rate: `num / den` frames per second, with an optional SMPTE drop-frame flag. */
interface FrameRate {
    readonly num: number;
    readonly den: number;
    readonly dropFrame: boolean;
    readonly fps: number;
    readonly label: string;
}
type FrameRateInput = number | string | FrameRate | {
    num: number;
    den?: number;
    dropFrame?: boolean;
};
/** Named presets for the common broadcast and film frame rates. */
declare const FrameRates: {
    readonly '23.976': FrameRate;
    readonly '24': FrameRate;
    readonly '25': FrameRate;
    readonly '29.97': FrameRate;
    readonly '29.97df': FrameRate;
    readonly '30': FrameRate;
    readonly '50': FrameRate;
    readonly '59.94': FrameRate;
    readonly '59.94df': FrameRate;
    readonly '60': FrameRate;
};
/** Normalize a frame rate input (a plain number, a preset string like `'29.97df'`, or an explicit `{num, den}`) into a `FrameRate`. */
declare function frameRate(input: FrameRateInput): FrameRate;
/** Convert a frame index into milliseconds at a given rate. */
declare function frameToMs(frame: number, rate: FrameRate): number;
/** Convert milliseconds into the frame index that contains that instant (floor, with a small epsilon to absorb float error). */
declare function msToFrame(ms: number, rate: FrameRate): number;
/** Quantize milliseconds down to the start of its containing frame. */
declare function snapToFrame(ms: number, rate: FrameRate): number;
/**
 * A time value as authored: plain milliseconds, or a string with a unit —
 * `'12f'` (frames, needs a rate), `'1.5s'` (seconds), `'500ms'`, or a SMPTE
 * timecode (`'HH:MM:SS:FF'` / `'HH:MM:SS;FF'`, needs a rate).
 */
type TimeInput = number | string;
/** Resolve any `TimeInput` form into milliseconds. Frame and timecode forms require `rate`. */
declare function parseTime(input: TimeInput, rate?: FrameRateInput): number;
/** Format milliseconds for display. `'frames'` and `'timecode'` styles require `rate`. */
declare function formatTime(ms: number, rate?: FrameRateInput, style?: 'ms' | 'seconds' | 'frames' | 'timecode'): string;

type MotionPrimitive = number | string;
type MotionValueShape = MotionPrimitive | MotionPrimitive[] | {
    [key: string]: MotionValueShape;
};
declare const mix: (from: number, to: number, progress: number) => number;
declare function interpolate<T extends MotionValueShape>(from: T, to: T, progress: number): T;

type FrameTask = (time: number) => boolean | void;
interface FrameDriver {
    request(callback: (time: number) => void): unknown;
    cancel(id: unknown): void;
    now(): number;
}
declare class FrameScheduler {
    private driver;
    private tasks;
    private frame;
    constructor(driver?: FrameDriver);
    get size(): number;
    now(): number;
    add(task: FrameTask): () => void;
    delete(task: FrameTask): void;
    flush(time?: number): void;
    clear(): void;
    /** Swap the underlying time/frame source (used by tests). Cancels any pending frame and re-wakes on the new driver if tasks are active. */
    setDriver(driver: FrameDriver): void;
    private wake;
    private tick;
}
declare const scheduler: FrameScheduler;

type Direction = 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
interface CycleSpec {
    duration: number;
    delay: number;
    repeat: number;
    repeatDelay: number;
    direction: Direction;
    reversed: boolean;
}
interface CycleSample {
    iteration: number;
    cycleTime: number;
    progress: number;
    active: number;
}
/** Total time a cycle spends actively running, excluding its leading delay. `Infinity` when `repeat` is `Infinity`. */
declare function activeDuration(spec: Pick<CycleSpec, 'duration' | 'repeat' | 'repeatDelay'>): number;
/** Total time a cycle occupies, including its leading delay. */
declare function totalDuration(spec: Pick<CycleSpec, 'duration' | 'delay' | 'repeat' | 'repeatDelay'>): number;
/**
 * Pure repeat/yoyo/direction sampler shared by `Tween` and offline rendering.
 * Extracted from the original `Tween.sampleAt` math; must stay bit-for-bit identical.
 */
declare function sampleCycle(spec: CycleSpec, milliseconds: number): CycleSample;

/**
 * The shared contract every timeline participant implements: tweens, tracks,
 * nested timelines, cues, markers, and audio clips. A `Timeline` holds a flat
 * list of these and drives them from one local clock.
 */
interface TimelineItem {
    readonly kind: string;
    name?: string;
    /** Total occupied time in milliseconds, including delay and repeats. `Infinity` is allowed. */
    readonly totalDuration: number;
    /** Write values (and fire cues) for a local time. `ctx` carries direction and, when driven by a transport, frame/transport info. */
    sampleAt(localMs: number, ctx?: RenderContext): void;
    /** Clear any "already fired" state (cue `once`, crossing history) so the next sample starts fresh. */
    reset?(): void;
}
interface RenderContext {
    direction: 1 | -1;
    fireCues: boolean;
    frame?: unknown;
    transport?: unknown;
}
declare const defaultRenderContext: RenderContext;

interface Timecode {
    hours: number;
    minutes: number;
    seconds: number;
    frames: number;
    dropFrame: boolean;
}
/** Parse `'HH:MM:SS:FF'` (`;` before FF marks drop-frame) and validate it against `rate`. */
declare function parseTimecode(text: string, rate: FrameRate): Timecode;
/** Convert a timecode into an absolute frame index, applying the SMPTE drop-frame correction when `rate.dropFrame` is set. */
declare function timecodeToFrames(tc: Timecode, rate: FrameRate): number;
/** Convert an absolute frame index into a timecode, applying the SMPTE drop-frame correction when `rate.dropFrame` is set. */
declare function framesToTimecode(frame: number, rate: FrameRate): Timecode;
/** Format a `Timecode` as `'HH:MM:SS:FF'`, or `'HH:MM:SS;FF'` when it is drop-frame. */
declare function formatTimecode(tc: Timecode): string;
/** Convert milliseconds into a `Timecode` at `rate`. */
declare function msToTimecode(ms: number, rate: FrameRate): Timecode;
/** Convert a timecode (string or parsed `Timecode`) into milliseconds at `rate`. */
declare function timecodeToMs(input: string | Timecode, rate: FrameRate): number;
/** Add (or subtract, with a negative count) a number of frames to a timecode. */
declare function addFrames(tc: Timecode, frames: number, rate: FrameRate): Timecode;

type TweenState = 'idle' | 'delayed' | 'running' | 'paused' | 'finished' | 'cancelled';
interface PropertyRange {
    start: number;
    end: number;
    unit?: string;
}
interface TweenOptions<T extends MotionValueShape = number> {
    from?: T;
    to?: T;
    curve?: [T, T] | Line;
    properties?: Record<string, PropertyRange>;
    node?: HTMLElement | null;
    duration?: number;
    delay?: number;
    repeat?: number;
    repeatDelay?: number;
    yoyo?: boolean;
    direction?: Direction;
    easing?: EasingFunction | EasingName;
    ease?: EasingFunction | EasingName;
    autoplay?: boolean;
    onBegin?: (tween: Tween<T>) => void;
    onStart?: (tween: Tween<T>) => void;
    onUpdate?: (value: T, progress: number, tween: Tween<T>) => void;
    onEnd?: (tween: Tween<T>) => void;
    onComplete?: (tween: Tween<T>) => void;
    scheduler?: FrameScheduler;
}
declare class Line {
    readonly curves: [number[], number[]];
    constructor(start: number[], end: number[]);
    value(progress: number): number[];
}
declare class Tween<T extends MotionValueShape = number> implements TimelineItem {
    static Line: typeof Line;
    readonly kind: "tween";
    duration: number;
    delay: number;
    repeat: number;
    repeatDelay: number;
    direction: Direction;
    state: TweenState;
    isAnimating: boolean;
    isPaused: boolean;
    isReversed: boolean;
    node: HTMLElement | null;
    properties?: Record<string, PropertyRange>;
    from: T;
    toValue: T;
    easing: EasingFunction;
    onBegin?: TweenOptions<T>['onBegin'];
    onStart?: TweenOptions<T>['onStart'];
    onUpdate?: TweenOptions<T>['onUpdate'];
    onEnd?: TweenOptions<T>['onEnd'];
    onComplete?: TweenOptions<T>['onComplete'];
    value: T;
    progress: number;
    elapsed: number;
    private frameLoop;
    private startedAt;
    private removeFrame?;
    private resolveFinished;
    finished: Promise<this>;
    constructor(options?: TweenOptions<T>);
    configure(options: TweenOptions<T>): this;
    to(options: TweenOptions<T>): this;
    play(options?: TweenOptions<T>): this;
    pause(): this;
    stop(): this;
    cancel(): this;
    reverse(): this;
    seek(progress: number): this;
    seekTime(milliseconds: number): this;
    setDuration(duration: number): this;
    /** The frame index the tween's active time falls in, at `rate` (default 60 fps). Floor-based: matches which frame is on screen. */
    frameAt(rate?: FrameRateInput): number;
    /** The SMPTE timecode for the tween's active time, at `rate`. */
    timecodeAt(rate: FrameRateInput): Timecode;
    getCurrentFrame(fps?: number): number;
    get activeDuration(): number;
    get totalDuration(): number;
    sampleAt(milliseconds: number, _ctx?: RenderContext): T;
    private advance;
    private newFinishedPromise;
}
interface TimelineOptions {
    repeat?: number;
    yoyo?: boolean;
    autoplay?: boolean;
    onUpdate?: (time: number, progress: number) => void;
    onComplete?: () => void;
    scheduler?: FrameScheduler;
    /** Frame rate used to resolve frame ('12f') and timecode positions, and by `.frames`/`.timecode()`. Defaults to 60 fps. */
    frameRate?: FrameRateInput;
    /** Quantize every rendered time to a frame boundary before sampling children. */
    snap?: boolean;
}
type TimelinePosition = number | '<' | '>' | string;
declare class Timeline {
    private entries;
    private labels;
    private cursor;
    private driver;
    readonly options: TimelineOptions;
    private readonly rateInput?;
    constructor(options?: TimelineOptions);
    get duration(): number;
    get state(): TweenState;
    get finished(): Promise<Tween<number>>;
    /** The timeline's own frame rate (default 60 fps), used for `.frames`, `.timecode()`, `snap`, and frame/timecode positions. */
    get frameRate(): FrameRate;
    get frames(): number;
    timecode(ms?: number): Timecode;
    label(name: string, at?: TimelinePosition): this;
    add<T extends MotionValueShape>(tween: Tween<T>, at?: TimelinePosition): this;
    addTween<T extends MotionValueShape>(tween: Tween<T>, at?: TimelinePosition): this;
    addTweens(tweens: Tween<MotionValueShape>[]): this;
    play(): this;
    start(): this;
    pause(): this;
    stop(): this;
    reverse(): this;
    seek(progress: number): this;
    loop(value?: boolean): this;
    render(time: number): void;
    private resolvePosition;
}
declare class MotionValue<T extends MotionValueShape> {
    private current;
    private listeners;
    private animation?;
    constructor(current: T);
    get(): T;
    set(value: T): void;
    subscribe: (listener: () => void) => () => void;
    animate(to: T, options?: Omit<TweenOptions<T>, 'from' | 'to' | 'onUpdate'>): Tween<T>;
    stop(): void;
}
declare function animate<T extends MotionValueShape>(from: T, to: T, options?: Omit<TweenOptions<T>, 'from' | 'to'>): Tween<T>;
declare function stagger(interval?: number, { start }?: {
    start?: number | undefined;
}): (index: number) => number;

export { formatTimecode as A, frameRate as B, type CycleSample as C, type Direction as D, type EasingFunction as E, type FrameDriver as F, frameToMs as G, framesToTimecode as H, interpolate as I, mix as J, msToFrame as K, Line as L, MotionValue as M, msToTimecode as N, parseTime as O, type PropertyRange as P, parseTimecode as Q, type RenderContext as R, resolveEasing as S, Tween as T, sampleCycle as U, scheduler as V, snapToFrame as W, timecodeToFrames as X, timecodeToMs as Y, totalDuration as Z, Timeline as a, animate as b, cubicBezier as c, spring as d, type CycleSpec as e, Easing as f, type EasingName as g, type FrameRate as h, type FrameRateInput as i, FrameRates as j, FrameScheduler as k, type FrameTask as l, type MotionPrimitive as m, type MotionValueShape as n, type TimeInput as o, type Timecode as p, type TimelineItem as q, type TimelineOptions as r, stagger as s, type TimelinePosition as t, type TweenOptions as u, type TweenState as v, activeDuration as w, addFrames as x, defaultRenderContext as y, formatTime as z };
