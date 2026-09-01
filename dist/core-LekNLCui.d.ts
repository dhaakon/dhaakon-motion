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
}
type TimelinePosition = number | '<' | '>' | string;
declare class Timeline {
    private entries;
    private labels;
    private cursor;
    private driver;
    readonly options: TimelineOptions;
    constructor(options?: TimelineOptions);
    get duration(): number;
    get state(): TweenState;
    get finished(): Promise<Tween<number>>;
    label(name: string, at?: number): this;
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

export { type CycleSample as C, type Direction as D, type EasingFunction as E, type FrameDriver as F, Line as L, MotionValue as M, type PropertyRange as P, type RenderContext as R, Tween as T, Timeline as a, animate as b, cubicBezier as c, spring as d, type CycleSpec as e, Easing as f, type EasingName as g, FrameScheduler as h, type FrameTask as i, type MotionPrimitive as j, type MotionValueShape as k, type TimelineItem as l, type TimelineOptions as m, type TweenOptions as n, type TweenState as o, activeDuration as p, defaultRenderContext as q, interpolate as r, stagger as s, mix as t, resolveEasing as u, sampleCycle as v, scheduler as w, totalDuration as x };
