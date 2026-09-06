import { T as Transport, a as TransportOutput, F as FrameRateInput, b as TimeInput, c as Timeline, d as FrameInfo, K as Keyframe, e as TrackOptions, f as Track, C as CueEvent, g as TweenOptions, M as MotionValueShape, E as EasingInput, h as MotionValue, i as EasingFunction, j as TimelineItem, k as Tween, L as Line, l as animate, s as stagger, m as cubicBezier, n as spring } from './transport-NA0I1mIJ.cjs';
export { o as Clock, p as CueOptions, q as CycleSample, r as CycleSpec, D as Direction, t as Easing, u as EasingName, v as EasingTuple, w as FrameDriver, x as FrameRate, y as FrameRates, z as FrameScheduler, A as FrameTask, I as InertiaItem, B as InertiaItemOptions, G as InertiaOptions, H as InspectNode, J as Marker, N as MotionPrimitive, P as PhysicsSpringOptions, O as PropertyRange, R as RenderContext, S as SpringItem, Q as SpringItemOptions, U as SpringOptions, V as Timecode, W as TimelineOptions, X as TimelinePosition, Y as Trace, Z as TraceEntry, _ as TransportOptions, $ as TransportState, a0 as TweenState, a1 as VelocityShape, a2 as activeDuration, a3 as addFrames, a4 as clampWithRubberband, a5 as createTrace, a6 as defaultRenderContext, a7 as formatTime, a8 as formatTimecode, a9 as frameRate, aa as frameToMs, ab as framesToTimecode, ac as interpolate, ad as mix, ae as msToFrame, af as msToTimecode, ag as parseTime, ah as parseTimecode, ai as projectFling, aj as registerEasing, ak as resolveEasing, al as rubberband, am as sampleCycle, an as scheduler, ao as serializeEasing, ap as snapTo, aq as snapToFrame, ar as springDuration, as as steps, at as stiffnessFor, au as timecodeToFrames, av as timecodeToMs, aw as totalDuration, ax as track } from './transport-NA0I1mIJ.cjs';

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

type SheetDirection = 'normal' | 'alternate';
interface SheetMarker {
    name: string;
    at: TimeInput;
    color?: string;
    payload?: unknown;
}
interface SheetCue {
    name: string;
    at: TimeInput;
    payload?: unknown;
    once?: boolean;
}
interface SheetRegion {
    name: string;
    from: TimeInput;
    to: TimeInput;
    payload?: unknown;
    once?: boolean;
}
interface TweenSheetItem {
    type: 'tween';
    name?: string;
    at?: TimeInput;
    target?: string;
    from: MotionValueShape;
    to: MotionValueShape;
    duration?: TimeInput;
    delay?: TimeInput;
    repeat?: number;
    repeatDelay?: TimeInput;
    yoyo?: boolean;
    easing?: EasingInput;
}
interface TrackSheetItem {
    type: 'track';
    name?: string;
    at?: TimeInput;
    target?: string;
    repeat?: number;
    repeatDelay?: TimeInput;
    direction?: SheetDirection;
    easing?: EasingInput;
    keyframes: Array<{
        at: TimeInput;
        value: MotionValueShape;
        easing?: EasingInput;
    }>;
}
interface TimelineSheetItem {
    type: 'timeline';
    name?: string;
    at?: TimeInput;
    frameRate?: FrameRateInput;
    repeat?: number;
    repeatDelay?: TimeInput;
    direction?: SheetDirection;
    markers?: SheetMarker[];
    cues?: SheetCue[];
    regions?: SheetRegion[];
    items: SheetItem[];
}
interface SpringSheetItem {
    type: 'spring';
    name?: string;
    at?: TimeInput;
    target?: string;
    from: MotionValueShape;
    to: MotionValueShape;
    velocity?: number | MotionValueShape;
    stiffness?: number;
    damping?: number;
    mass?: number;
    restDelta?: number;
    restSpeed?: number;
    bounce?: number;
    duration?: TimeInput;
}
interface InertiaSheetItem {
    type: 'inertia';
    name?: string;
    at?: TimeInput;
    target?: string;
    from: number;
    velocity: number;
    power?: number;
    timeConstant?: number;
    min?: number;
    max?: number;
    restDelta?: number;
}
interface ExtensionSheetItem {
    type: string;
    name?: string;
    at?: TimeInput;
    [key: string]: unknown;
}
type SheetItem = TweenSheetItem | TrackSheetItem | TimelineSheetItem | SpringSheetItem | InertiaSheetItem | ExtensionSheetItem;
interface CueSheet {
    $schema: 'dhaakon-motion/cue-sheet/1';
    name?: string;
    frameRate?: FrameRateInput;
    duration?: TimeInput;
    repeat?: number;
    repeatDelay?: TimeInput;
    direction?: SheetDirection;
    markers?: SheetMarker[];
    cues?: SheetCue[];
    regions?: SheetRegion[];
    items: SheetItem[];
}
interface SheetBindings {
    /** Named write targets a `tween`/`track` item's `target` resolves against. */
    targets?: Record<string, MotionValue<any> | ((value: any) => void)>;
    /** Handlers for named cues; a cue without one still fires (and its payload still reaches a `signalOutput`/`midiOutput`). */
    cues?: Record<string, (e: CueEvent) => void>;
    /** Registered under their own name for the duration of this load, in addition to the global easing registry. */
    easings?: Record<string, EasingFunction>;
    /** Escape hatch for item types the core doesn't know natively (e.g. `'audio'`, built from `./audio`'s `AudioClip`). */
    createItem?: (item: SheetItem, ctx: {
        bindings: SheetBindings;
        strict: boolean;
    }) => TimelineItem | undefined;
}
/** Build a live `Timeline` (with a nested `Timeline`/`Tween`/`Track` for every item) from a `CueSheet`. */
declare function loadSheet(sheet: CueSheet | string, bindings?: SheetBindings, options?: {
    strict?: boolean;
}): Timeline;
/** `loadSheet`'s inverse: read a `Timeline` back into a `CueSheet`. Positions are saved as milliseconds; target bindings round-trip if the timeline was itself built with `loadSheet`. */
declare function saveSheet(timeline: Timeline): CueSheet;
interface ValidationError {
    path: string;
    message: string;
}
type ValidationResult = {
    ok: true;
    sheet: CueSheet;
} | {
    ok: false;
    errors: ValidationError[];
};
/** Hand-rolled structural validation: shape, frame rate legality, resolvable easings, and keyframe ordering (where checkable without a frame-rate context). */
declare function validateSheet(input: unknown): ValidationResult;
type SceneState = Record<string, MotionValueShape>;
interface SceneFile {
    $schema: 'dhaakon-motion/scene/1';
    states: Record<string, SceneState>;
}
type TargetMap = SheetBindings['targets'];
/** Read the current value of every `MotionValue` target (a plain setter has nothing to read back, so it's skipped). */
declare function captureScene(targets: TargetMap): SceneState;
interface ApplySceneOptions {
    transition?: Omit<TweenOptions<MotionValueShape>, 'from' | 'to' | 'onUpdate'> & {
        stagger?: number | ((id: string, index: number) => number);
    };
}
/** Write a captured (or hand-authored) scene onto its targets: immediately, or (with `transition`) as a playing `Timeline` of one `Tween` per target. */
declare function applyScene(state: SceneState, targets: TargetMap, options?: ApplySceneOptions): Timeline | void;
interface SceneTransitionOptions {
    duration?: TimeInput;
    easing?: EasingInput;
    delay?: TimeInput;
    stagger?: number | ((id: string, index: number) => number);
}
/** A `Timeline` (not auto-played) of one `Tween` per key present in `from` or `to`, ready to attach to a transport or `.play()`. */
declare function sceneTransition(from: SceneState, to: SceneState, targets: TargetMap, options?: SceneTransitionOptions): Timeline;
interface SceneSheetOptions {
    hold?: TimeInput;
    transition?: TimeInput;
    easing?: EasingInput;
}
/** Turn a named sequence of scene states into a `CueSheet`: one `track` item per key (a keyframe per state it appears in) plus a marker at each state's start. */
declare function sceneSheet(states: Record<string, SceneState>, order: string[], options?: SceneSheetOptions): CueSheet;

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

export { type ApplySceneOptions, CueEvent, type CueSheet, EasingFunction, EasingInput, type ExtensionSheetItem, FrameInfo, FrameRateInput, type InertiaSheetItem, Keyframe, Line, type MotionStyle, MotionValue, MotionValueShape, OfflineTransport, type RenderFramesOptions, type SceneFile, type SceneSheetOptions, type SceneState, type SceneTransitionOptions, type SheetBindings, type SheetCue, type SheetDirection, type SheetItem, type SheetMarker, type SheetRegion, type SpringSheetItem, TimeInput, Timeline, TimelineItem, type TimelineSheetItem, Track, TrackOptions, type TrackSheetItem, Transport, TransportOutput, Tween, TweenOptions, type TweenSheetItem, type ValidationError, type ValidationResult, animate, applyScene, captureScene, cubicBezier, _default as default, drawOutput, frames, loadSheet, readStyle, renderFrames, saveSheet, sceneSheet, sceneTransition, signalOutput, spring, stagger, styleTrack, validateSheet, writeStyle };
