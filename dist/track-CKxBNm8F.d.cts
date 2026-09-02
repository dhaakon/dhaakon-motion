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
    [key: string]: MotionValueShape | undefined;
};
declare const mix: (from: number, to: number, progress: number) => number;
declare function interpolate<T extends MotionValueShape>(from: T, to: T, progress: number): T;

type EasingFunction = (progress: number) => number;
/** How an easing function was built, so `serializeEasing` can recover a JSON-safe description of it. */
type EasingTuple = ['cubicBezier', number, number, number, number] | ['spring', {
    stiffness?: number;
    damping?: number;
    mass?: number;
}] | ['steps', number];
/** Anything that can describe an easing curve: a built-in or registered name, a tuple that builds one, or a function directly. */
type EasingInput = EasingFunction | EasingTuple | string;
declare function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFunction;
interface SpringOptions {
    stiffness?: number;
    damping?: number;
    mass?: number;
}
declare function spring(options?: SpringOptions): EasingFunction;
/** A stepped ("hold") easing: `count` discrete plateaus across the curve. */
declare function steps(count: number, position?: 'start' | 'end'): EasingFunction;
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
/** Register a custom easing under a name, so it can be used as a string (e.g. in a cue sheet) and round-trip through `serializeEasing`. */
declare function registerEasing(name: string, fn: EasingFunction): EasingFunction;
/** Resolve any `EasingInput` — a built-in or registered name, a `['cubicBezier', ...]`/`['spring', ...]`/`['steps', n]` tuple, or a function — into a function. */
declare function resolveEasing(easing?: EasingFunction | EasingName | EasingInput): EasingFunction;
/**
 * The inverse of `resolveEasing`: recover a JSON-safe description of an
 * easing function — its registered/built-in name if it has one, else the
 * tuple it was built from (`cubicBezier`/`spring`/`steps` all tag their
 * result), else `undefined` for an anonymous function.
 */
declare function serializeEasing(input: EasingInput | undefined): EasingInput | undefined;

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
    name?: string;
    from?: T;
    to?: T;
    curve?: [T, T] | Line;
    properties?: Record<string, PropertyRange>;
    node?: HTMLElement | null;
    /** Milliseconds, seconds (`'1.5s'`), frames (`'36f'`), or SMPTE timecode. Frame forms inherit their parent Transport/Timeline rate unless `frameRate` is explicit. */
    duration?: TimeInput;
    delay?: TimeInput;
    repeat?: number;
    repeatDelay?: TimeInput;
    yoyo?: boolean;
    direction?: Direction;
    frameRate?: FrameRateInput;
    easing?: EasingInput | EasingName;
    ease?: EasingInput | EasingName;
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
    name?: string;
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
    private durationInput;
    private delayInput;
    private repeatDelayInput;
    private explicitRateInput?;
    private inheritedRateInput?;
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
    setDuration(duration: TimeInput, rate?: FrameRateInput): this;
    /** Effective timebase for authored frame/SMPTE fields. A standalone `;` timecode provisionally implies 29.97df until attached. */
    get frameRate(): FrameRate;
    /** Called by Timeline/Transport attachment. An explicit `frameRate` option is never overwritten. */
    bindFrameRate(rate: FrameRateInput): void;
    /** The frame index the tween's active time falls in, at `rate` (default 60 fps). Floor-based: matches which frame is on screen. */
    frameAt(rate?: FrameRateInput): number;
    /** The SMPTE timecode for the tween's active time, at `rate`. */
    timecodeAt(rate: FrameRateInput): Timecode;
    getCurrentFrame(fps?: number): number;
    /**
     * A two-keyframe `Track` equivalent to this tween's `from`/`to`/`duration`/`easing`/`repeat`/`repeatDelay`/`direction`.
     * Its `apply` forwards sampled values to this tween's own `onUpdate` (progress is not recomputed — read `value` from the callback).
     */
    toTrack(): Track<T>;
    get activeDuration(): number;
    get totalDuration(): number;
    sampleAt(milliseconds: number, _ctx?: RenderContext): T;
    private advance;
    private resolveTiming;
    private newFinishedPromise;
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

interface InspectNode {
    kind: string;
    name?: string;
    start: number;
    end: number;
    duration: number;
    totalDuration: number;
    repeat: number;
    direction: string;
    startTimecode?: string;
    children: InspectNode[];
    markers: readonly Marker[];
    cues: readonly {
        name: string;
        time: number;
    }[];
}
interface TimelineOptions {
    name?: string;
    repeat?: number;
    repeatDelay?: TimeInput;
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
/**
 * A local clock that samples a flat list of children (tweens, tracks, nested
 * timelines, audio clips) from one position, plus named markers and cues.
 * A root timeline (one with no parent) lazily owns a private `Transport`
 * that its `play`/`pause`/`seek`/... methods forward to.
 */
declare class Timeline implements TimelineItem {
    readonly kind: "timeline";
    name?: string;
    readonly options: TimelineOptions;
    private entries;
    private labels;
    private cursor;
    /** The furthest a marker/cue/region reaches; a cue-only timeline (no content) still has a real, sampleable duration. */
    private markerCursor;
    private explicitRateInput?;
    private inheritedRateInput?;
    private points;
    private markerMeta;
    private lastCycleTime;
    private lastIteration;
    private parentTimeline?;
    private ownTransport?;
    constructor(options?: TimelineOptions);
    /** Content length: the furthest a child, marker, cue, or region reaches, before this timeline's own repeat/yoyo is applied. */
    get duration(): number;
    /** Content length including this timeline's own repeat/repeatDelay. `Infinity` when `repeat` is `Infinity`. */
    get totalDuration(): number;
    get frameRate(): FrameRate;
    private get repeatDelay();
    get frames(): number;
    timecode(ms?: number): Timecode;
    get parent(): Timeline | undefined;
    get items(): ReadonlyArray<{
        item: TimelineItem;
        start: number;
        end: number;
    }>;
    /** Walks up to the outermost timeline and returns its private transport, if it has been played. */
    get rootTransport(): Transport | undefined;
    /** Called by a `Transport`'s constructor when it adopts this timeline as its `root` (including its own default root). Not usually called directly. */
    bindTransport(transport: Transport): void;
    /** Adopt a containing timeline/transport timebase and remeasure every descendant item. Explicit timeline rates still win. */
    bindFrameRate(rate: FrameRateInput): void;
    label(name: string, at?: TimelinePosition): this;
    add(item: TimelineItem, at?: TimelinePosition): this;
    /** @deprecated kept for the pre-0.4 API; identical to `add`. */
    addTween<T extends MotionValueShape>(tween: Tween<T>, at?: TimelinePosition): this;
    addTweens(tweens: Tween<MotionValueShape>[]): this;
    remove(item: TimelineItem): this;
    clear(): this;
    get markers(): readonly Marker[];
    get cues(): readonly {
        name: string;
        time: number;
    }[];
    marker(name: string, at?: TimelinePosition, options?: {
        color?: string;
        payload?: unknown;
    }): this;
    cue(name: string, at: TimelinePosition, handler: (e: CueEvent) => void, options?: CueOptions): this;
    region(name: string, from: TimelinePosition, to: TimelinePosition, options?: CueOptions): this;
    private insertPoint;
    seekToMarker(name: string): this;
    nextMarker(fromMs?: number): Marker | undefined;
    previousMarker(fromMs?: number): Marker | undefined;
    inspect(): InspectNode;
    private inspectAsChild;
    /** A stable, human-readable rendering of the tree, its markers, and its cues. */
    toAscii(options?: {
        width?: number;
        frameRate?: FrameRateInput;
        labels?: boolean;
    }): string;
    /** How a position string resolved: its absolute time, and (for a label/anchor form) the base it was measured from. */
    explain(position: TimelinePosition): {
        ms: number;
        frame: number;
        timecode: string;
        base?: string;
        offset?: number;
    };
    private nestedError;
    private get transport();
    get state(): TransportState;
    get finished(): Promise<Transport>;
    play(): this;
    start(): this;
    pause(): this;
    stop(): this;
    reverse(): this;
    /** `progress` is a 0..1 fraction of `totalDuration`, matching the pre-0.4 API. */
    seek(progress: number): this;
    loop(value?: boolean): this;
    sampleAt(localMs: number, ctx?: RenderContext): number;
    /** Alias of `sampleAt` for absolute (not delay-relative) callers, matching the pre-0.4 API. */
    render(time: number): void;
    reset(): void;
    private iterationReversed;
    private fireCrossings;
    private fireSegment;
    private resolvePosition;
}

interface TraceEntry {
    tick: number;
    time: number;
    frame: number;
    rate: number;
    state: TransportState;
    cues: string[];
    /** Wall-clock milliseconds since the previous tick's `onTick` (a cheap proxy for actual frame cadence). */
    durationMs: number;
}
interface Trace extends TransportOutput {
    entries: TraceEntry[];
    clear(): void;
    toText(): string;
}
/** A ring-buffer `TransportOutput` that records every tick for inspection. Attach via `transport.trace()`. */
declare function createTrace(options?: {
    capacity?: number;
}): Trace;

/** A source of "now", in milliseconds. Swap it to make something other than the scheduler's driver the master clock (e.g. an `AudioContext`). */
interface Clock {
    now(): number;
}
type TransportState = 'idle' | 'playing' | 'paused' | 'finished';
interface TransportOptions {
    /** Tick source. Defaults to the shared global scheduler. */
    scheduler?: FrameScheduler;
    /** Time source. Defaults to the scheduler's own clock. */
    clock?: Clock;
    /** Used for `.frame`, `.timecode`, `snap`, and to resolve frame/timecode inputs. Default 60 fps. */
    frameRate?: FrameRateInput;
    /** Quantize every rendered time to a frame boundary. */
    snap?: boolean;
    /** Playback rate. Negative plays backwards. Default 1. */
    rate?: number;
    /** `true` loops the whole duration; `[from, to]` loops just that region. */
    loop?: boolean | [TimeInput, TimeInput];
    /** Overrides `root.totalDuration` (needed when the root repeats infinitely on its own but the transport should still have a bound). */
    duration?: TimeInput;
    /** Use this timeline as the root instead of creating an empty one. */
    root?: Timeline;
}
interface FrameInfo {
    time: number;
    frame: number;
    timecode: string;
    delta: number;
    rate: number;
    direction: 1 | -1;
    frameRate: FrameRate;
    /** Every cue that fired earlier in this same tick (populated as they fire; a handler sees only cues that fired before it). */
    cues?: CueEvent[];
}
interface TransportOutput {
    name?: string;
    onAttach?(transport: Transport): void;
    onTick?(info: FrameInfo): void;
    onStateChange?(state: TransportState, transport: Transport): void;
    onSeek?(info: FrameInfo): void;
    onRateChange?(rate: number): void;
    onDetach?(): void;
    /** `false` means this output cannot be driven by `renderFrames`/offline rendering (e.g. live audio). Default `true`. */
    supportsOffline?: boolean;
}
/**
 * One clock authority for a composition. Timelines render into it; outputs
 * (DOM, Three.js, Canvas, audio, hardware) draw or send once per tick, after
 * every value has been written for that instant.
 */
declare class Transport {
    readonly frameRate: FrameRate;
    root: Timeline;
    onError: (err: unknown) => void;
    private schedulerRef;
    private clock;
    private _time;
    private lastRenderedTime;
    private _rate;
    private _state;
    private snap;
    private anchorClock;
    private anchorTime;
    private loopRegion;
    private explicitDuration?;
    private removeFrame?;
    private outputs;
    private pendingCues;
    private listeners;
    private loopListeners;
    private resolveFinished;
    finished: Promise<this>;
    constructor(options?: TransportOptions);
    get time(): number;
    get rate(): number;
    get state(): TransportState;
    get duration(): number;
    get frame(): number;
    get timecode(): string;
    get progress(): number;
    add(item: TimelineItem, at?: TimelinePosition): this;
    attach(output: TransportOutput): () => void;
    subscribe(listener: (info: FrameInfo, transport: Transport) => void): () => void;
    /** Notified once per lap when a loop region wraps. */
    onLoop(listener: () => void): () => void;
    /** Attach a ring-buffer trace output that records every tick (and the cues that fired during it). */
    trace(options?: {
        capacity?: number;
    }): Trace;
    play(): this;
    pause(): this;
    stop(): this;
    toggle(): this;
    seek(to: TimeInput, options?: {
        cues?: 'fire' | 'skip';
    }): this;
    seekFrame(frame: number): this;
    seekTimecode(tc: string): this;
    step(frames?: number): this;
    setRate(rate: number): this;
    reverse(): this;
    setLoop(loop: TransportOptions['loop']): this;
    /** Follow an external clock (an LTC/MTC decoder, an OSC message, another transport). Hard-seeks past `threshold`; otherwise nudges rate to converge. */
    chase(externalMs: number, options?: {
        smoothing?: number;
        threshold?: number;
    }): this;
    /** Manually drive the transport from an absolute clock value. Used by offline rendering and tests. */
    tick(now: number): void;
    dispose(): void;
    private onFrame;
    private advance;
    private advanceTo;
    private renderAt;
    /** Records that a cue fired during the current tick (called by `Timeline`). Not usually called directly. */
    noteCue(event: CueEvent): void;
    private frameSnap;
    private emitSeek;
    private emitStateChange;
    private fireLoop;
    private boundedDuration;
    private finish;
    private newFinished;
}

/**
 * The shared contract every timeline participant implements: tweens, tracks,
 * nested timelines, and audio clips. A `Timeline` holds a flat list of these
 * and drives them from one local clock.
 */
interface TimelineItem {
    readonly kind: string;
    name?: string;
    /** Total occupied time in milliseconds, including delay and repeats. `Infinity` is allowed. */
    readonly totalDuration: number;
    /** Write values (and, for timelines, fire cues) for a local time. `ctx` carries direction and, when driven by a transport, frame/transport info. */
    sampleAt(localMs: number, ctx?: RenderContext): void;
    /** Adopt a parent timeline/transport timebase for authored frame and SMPTE literals. Explicit item rates still win. */
    bindFrameRate?(rate: FrameRateInput): void;
    /** Clear any "already fired" state (cue `once`, crossing history) so the next sample starts fresh. */
    reset?(): void;
}
interface RenderContext {
    direction: 1 | -1;
    fireCues: boolean;
    frame?: FrameInfo;
    transport?: Transport;
}
declare const defaultRenderContext: RenderContext;
/** A named, zero-duration position on a timeline. Labels created with `.label()` are markers too. */
interface Marker {
    kind: 'marker';
    name: string;
    time: number;
    color?: string;
    payload?: unknown;
}
/** What a cue or region handler receives when it fires. */
interface CueEvent {
    name: string;
    time: number;
    direction: 1 | -1;
    payload: unknown;
    timeline: Timeline;
    frame: FrameInfo | undefined;
}
interface CueOptions {
    payload?: unknown;
    /** Fire at most once; call `timeline.reset()` (or replay from the start) to re-arm it. */
    once?: boolean;
    onEnter?(e: CueEvent): void;
    onExit?(e: CueEvent): void;
}

/** One value at a point in time. `easing` describes the segment *ending* at this key (ignored on the first key). */
interface Keyframe<T> {
    at: TimeInput;
    value: T;
    easing?: EasingInput;
}
interface TrackOptions<T extends MotionValueShape> {
    keyframes: Keyframe<T>[];
    /** How a sampled value is written. Required unless `target` is given. */
    apply?: (value: T, ctx?: RenderContext) => void;
    /** Convenience for `apply: (v) => target.set(v)`. */
    target?: MotionValue<T>;
    name?: string;
    /** Resolves frame/timecode `at` values. */
    frameRate?: FrameRateInput;
    repeat?: number;
    repeatDelay?: TimeInput;
    direction?: Direction;
    /** Default easing for every segment that doesn't specify its own. */
    easing?: EasingInput;
}
/** A multi-keyframe animation track — the N-keyframe generalization of a two-key `Tween`. */
declare class Track<T extends MotionValueShape> implements TimelineItem {
    readonly kind: "track";
    name?: string;
    private resolvedKeyframes;
    private authoredKeyframes;
    private segments;
    private apply;
    private repeat;
    private repeatDelay;
    private repeatDelayInput;
    private direction;
    private explicitRateInput?;
    private inheritedRateInput?;
    private defaultEasing?;
    constructor(options: TrackOptions<T>);
    get keyframes(): readonly {
        at: number;
        value: T;
    }[];
    get frameRate(): FrameRate;
    bindFrameRate(rate: FrameRateInput): void;
    private resolveTiming;
    /** Content length: the last keyframe's time. */
    get duration(): number;
    get totalDuration(): number;
    /** Pure: the interpolated value at a content-local time, without writing it anywhere. */
    valueAt(ms: number): T;
    sampleAt(localMs: number, ctx?: RenderContext): void;
}
/** `new Track({ target, keyframes, ...options })`, accepting either a `MotionValue` or a plain setter as the first argument. */
declare function track<T extends MotionValueShape>(target: MotionValue<T> | ((value: T) => void), keyframes: Keyframe<T>[], options?: Omit<TrackOptions<T>, 'keyframes' | 'apply' | 'target'>): Track<T>;

export { formatTime as $, type FrameTask as A, type Marker as B, type Clock as C, type Direction as D, type EasingInput as E, type FrameRateInput as F, type MotionPrimitive as G, type Timecode as H, type InspectNode as I, type TimelineOptions as J, type Keyframe as K, Line as L, type MotionValueShape as M, type TimelinePosition as N, type Trace as O, type PropertyRange as P, type TraceEntry as Q, type RenderContext as R, type SpringOptions as S, type TimelineItem as T, type TransportOptions as U, type TransportState as V, type TweenState as W, activeDuration as X, addFrames as Y, createTrace as Z, defaultRenderContext as _, type TransportOutput as a, formatTimecode as a0, frameRate as a1, frameToMs as a2, framesToTimecode as a3, interpolate as a4, mix as a5, msToFrame as a6, msToTimecode as a7, parseTime as a8, parseTimecode as a9, registerEasing as aa, resolveEasing as ab, sampleCycle as ac, scheduler as ad, serializeEasing as ae, snapToFrame as af, steps as ag, timecodeToFrames as ah, timecodeToMs as ai, totalDuration as aj, track as ak, type TrackOptions as b, Track as c, Transport as d, Timeline as e, type TimeInput as f, type FrameInfo as g, type CueEvent as h, type TweenOptions as i, MotionValue as j, type EasingFunction as k, Tween as l, animate as m, cubicBezier as n, spring as o, type CueOptions as p, type CycleSample as q, type CycleSpec as r, stagger as s, Easing as t, type EasingName as u, type EasingTuple as v, type FrameDriver as w, type FrameRate as x, FrameRates as y, FrameScheduler as z };
