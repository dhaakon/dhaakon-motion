import { MotionValue, InertiaOptions, PhysicsSpringOptions, TimeInput, Transport, FrameRateInput, Track } from '@dhaakon/motion';
import { ManualDriver } from './testing.js';
import '@dhaakon/motion/gesture';

type PointerType = 'mouse' | 'touch' | 'pen';
interface PointerSample {
    id: number;
    type: PointerType;
    x: number;
    y: number;
    t: number;
    pressure: number;
    buttons: number;
    isPrimary: boolean;
    predicted?: boolean;
    native?: PointerEvent;
}
interface SessionOptions {
    element: Element;
    /** Attach the element's own pointerdown listener. Disable for handle-only controls. */
    listen?: boolean;
    capture?: boolean;
    touchAction?: 'auto' | 'none' | 'pan-x' | 'pan-y' | 'manipulation' | 'inherit';
    passive?: boolean;
    predict?: boolean;
    coalesce?: boolean;
    secondaryButtons?: boolean;
    onSample(sample: PointerSample, pointers: ReadonlyMap<number, PointerSample[]>): void;
    onEnd(sample: PointerSample, cancelled: boolean): void;
}
interface PointerSession {
    dispose(): void;
    pointers: ReadonlyMap<number, PointerSample[]>;
    preventScroll(active: boolean): void;
    /** Adopt a pointer that began on another element, such as a drag handle. */
    start(event: PointerEvent): void;
}
declare function createPointerSession(options: SessionOptions): PointerSession;

interface VelocityEstimatorOptions {
    window?: number;
    maxSamples?: number;
    axes?: 1 | 2;
}
/** Windowed, exponentially weighted least-squares pointer velocity in px/ms. */
declare class VelocityEstimator {
    readonly window: number;
    readonly maxSamples: number;
    readonly axes: 1 | 2;
    private samples;
    constructor(options?: VelocityEstimatorOptions);
    push(x: number, y: number, t: number): this | undefined;
    velocity(now?: number): {
        x: number;
        y: number;
    };
    reset(): void;
    private trim;
}

type Phase = 'possible' | 'began' | 'changed' | 'ended' | 'cancelled';
interface Point {
    x: number;
    y: number;
}
interface GestureEvent<K extends string = string> {
    kind: K;
    phase: Phase;
    time: number;
    pointerType: PointerType;
    origin: Point;
    point: Point;
    delta: Point;
    offset: Point;
    velocity: Point;
    pointers: number;
    scale?: number;
    rotation?: number;
    center?: Point;
    inertial?: boolean;
    count?: number;
    native: Event;
    preventDefault(): void;
}
interface RecognizerSession {
    pointers: ReadonlyMap<number, PointerSample[]>;
}
type ArenaVerdict = 'claim' | 'yield' | 'wait';
interface Recognizer<K extends string = string> {
    readonly kind: K;
    readonly priority: number;
    readonly preventsScroll: boolean;
    readonly propagate?: boolean;
    state: Phase;
    onDown(sample: PointerSample, session: RecognizerSession): void;
    onMove(sample: PointerSample, session: RecognizerSession): ArenaVerdict;
    onUp(sample: PointerSample, session: RecognizerSession): void;
    cancel(): void;
    subscribe(listener: (event: GestureEvent<K>) => void): () => void;
    attach?(element: Element): () => void;
}
interface BaseOptions {
    priority?: number;
    preventsScroll?: boolean;
    propagate?: boolean;
}
interface TapOptions extends BaseOptions {
    maxDuration?: number;
    threshold?: number;
    count?: number;
}
interface LongPressOptions extends BaseOptions {
    duration?: number;
    threshold?: number;
}
interface PanOptions extends BaseOptions {
    axis?: 'x' | 'y' | 'any' | 'lock';
    threshold?: number;
}
declare const tapRecognizer: (options?: TapOptions) => Recognizer<"tap">;
declare const longPressRecognizer: (options?: LongPressOptions) => Recognizer<"longPress">;
declare const pressRecognizer: (options?: BaseOptions) => Recognizer<"press">;
declare const panRecognizer: (options?: PanOptions) => Recognizer<"pan">;
declare const swipeRecognizer: (options?: PanOptions & {
    minSpeed?: number;
    minDistance?: number;
}) => Recognizer<"swipe">;
declare const pinchRecognizer: (options?: BaseOptions & {
    threshold?: number;
}) => Recognizer<"pinch">;
declare const rotateRecognizer: (options?: BaseOptions & {
    threshold?: number;
}) => Recognizer<"rotate">;
declare const hoverRecognizer: (options?: BaseOptions) => Recognizer<"hover">;
declare const wheelRecognizer: (options?: BaseOptions) => Recognizer<"wheel">;

declare class GestureArena {
    readonly element: Element;
    readonly recognizers: Recognizer[];
    readonly session: PointerSession;
    private winner?;
    private disposed;
    private extras;
    constructor(element: Element, recognizers: Recognizer[], options?: Omit<Partial<SessionOptions>, 'element' | 'onSample' | 'onEnd'>);
    settle(recognizer: Recognizer): void;
    dispose(): void;
    cancel(except?: Recognizer): void;
    private handleSample;
    private handleEnd;
    private claim;
}
declare function createGestureArena(element: Element, recognizers: Recognizer[], options?: Omit<Partial<SessionOptions>, 'element' | 'onSample' | 'onEnd'>): GestureArena;
declare function cooperateWithScroll(recognizer: Recognizer<'pan'>, scroller: Element, options: {
    edge: 'top' | 'bottom' | 'both';
}): Recognizer<"pan">;

interface KeyboardOptions {
    axis?: 'x' | 'y';
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    reducedMotion?: boolean;
    onCancel?(): void;
    onChange?(value: number): void;
}
/** Automatic keyboard and ARIA semantics for a one-dimensional draggable value. */
declare function installDragKeyboard(element: Element, value: MotionValue<number>, options?: KeyboardOptions): () => void;

type Axis = 'x' | 'y' | 'any' | 'lock';
type Bounds = {
    min?: number;
    max?: number;
} | {
    x?: [number, number];
    y?: [number, number];
};
interface DragOptions {
    axis?: Axis;
    bounds?: Bounds | Element | (() => Bounds);
    elastic?: number | false;
    momentum?: boolean | InertiaOptions<number>;
    snap?: number[] | {
        step: number;
        offset?: number;
    } | ((projected: number) => number);
    snapTransition?: PhysicsSpringOptions<number>;
    threshold?: number;
    propagate?: boolean;
    capture?: boolean;
    touchAction?: SessionOptions['touchAction'];
    immediate?: boolean;
    predict?: boolean;
    cursor?: boolean;
    keyboard?: boolean;
    step?: number;
    ariaLabel?: string;
    /** Start when the draggable itself receives pointerdown. Set false for a separate handle. */
    dragListener?: boolean;
    cues?: {
        at: number | number[];
        name: string;
    }[];
    onStart?(event: GestureEvent<'pan'>): void;
    onMove?(event: GestureEvent<'pan'>): void;
    onEnd?(event: GestureEvent<'pan'>, outcome: {
        settled: Promise<unknown>;
        target: number;
    }): void;
}
interface DragControls {
    dispose(): void;
    start(nativeEvent: PointerEvent): void;
    cancel(): void;
    isDragging: MotionValue<boolean>;
}
declare function drag(target: MotionValue<number> | {
    x: MotionValue<number>;
    y: MotionValue<number>;
}, element: Element, options?: DragOptions): DragControls;
interface TransformGestureOptions {
    scale?: MotionValue<number>;
    rotation?: MotionValue<number>;
    x?: MotionValue<number>;
    y?: MotionValue<number>;
    scaleBounds?: [number, number];
    elastic?: number;
    momentum?: boolean;
    doubleTapZoom?: number | false;
}
declare function transformGesture(element: Element, options: TransformGestureOptions): {
    dispose(): void;
};
interface ScrubOptions {
    axis?: 'x' | 'y';
    pixelsPerFrame?: number;
    pixelsPerMs?: number;
    momentum?: boolean | InertiaOptions<number>;
    snapToMarkers?: boolean | {
        within: TimeInput;
    };
    snapToFrames?: boolean;
    cues?: 'fire' | 'skip';
    resumeAfter?: boolean;
}
declare function scrub(transport: Transport, element: Element, options?: ScrubOptions): {
    dispose: () => void;
};
declare function press(element: Element, options?: {
    onChange?(pressed: boolean): void;
}): {
    isPressed: MotionValue<boolean>;
    dispose(): void;
};
declare function hover(element: Element, options?: {
    onChange?(hovered: boolean): void;
}): {
    isHovered: MotionValue<boolean>;
    dispose(): void;
};

interface GestureSample {
    id: number;
    type: string;
    kind: 'down' | 'move' | 'up' | 'cancel';
    x: number;
    y: number;
    t: number;
    pressure?: number;
}
interface GestureRecording {
    $schema: 'dhaakon-motion/gesture/1';
    frameRate?: FrameRateInput;
    element?: {
        width: number;
        height: number;
    };
    samples: GestureSample[];
}
declare function record(element: Element, options?: {
    normalize?: boolean;
    frameRate?: FrameRateInput;
}): {
    stop(): GestureRecording;
};
declare function replay(recording: GestureRecording, element: Element, options?: {
    driver?: ManualDriver;
    speed?: number;
    from?: number;
    to?: number;
}): Promise<void>;
declare function gestureToTrack(recording: GestureRecording, options: {
    pointerId?: number;
    frameRate: FrameRateInput;
    axis?: 'x' | 'y' | 'both';
    simplify?: number;
}): Track<any>;

export { type ArenaVerdict, type DragControls, type DragOptions, GestureArena, type GestureEvent, type GestureRecording, type GestureSample, type KeyboardOptions, type LongPressOptions, type PanOptions, type Phase, type Point, type PointerSample, type PointerSession, type PointerType, type Recognizer, type RecognizerSession, type ScrubOptions, type SessionOptions, type TapOptions, type TransformGestureOptions, VelocityEstimator, type VelocityEstimatorOptions, cooperateWithScroll, createGestureArena, createPointerSession, drag, gestureToTrack, hover, hoverRecognizer, installDragKeyboard, longPressRecognizer, panRecognizer, pinchRecognizer, press, pressRecognizer, record, replay, rotateRecognizer, scrub, swipeRecognizer, tapRecognizer, transformGesture, wheelRecognizer };
