import * as React from 'react';
import React__default, { ReactNode } from 'react';
import { TimeInput, EasingFunction, EasingName, FrameRateInput, CueOptions, TimelinePosition, CueEvent, MotionValueShape, TweenOptions, Tween as Tween$1, MotionStyle, TrackOptions, MotionValue, Keyframe, TransportOptions, Clock, TransportOutput, Transport as Transport$1, TransportState, SceneState, ApplySceneOptions, Timeline } from '@dhaakon/motion';
export { MotionStyle } from '@dhaakon/motion';
import { DragOptions, DragControls, GestureEvent, Recognizer, TransformGestureOptions, ScrubOptions } from '@dhaakon/motion/gesture';
import { CssMotionTokens, CssTarget, CssTransition, CssPlayback, CssPlaybackResult } from '@dhaakon/motion/css';

interface MotionTransition {
    duration?: TimeInput;
    delay?: TimeInput;
    repeat?: number;
    repeatDelay?: TimeInput;
    yoyo?: boolean;
    easing?: EasingFunction | EasingName;
    frameRate?: FrameRateInput;
}
interface MotionConfigValue {
    transition?: MotionTransition;
    reducedMotion?: 'user' | 'always' | 'never';
    frameRate?: FrameRateInput;
}
declare function MotionConfig({ children, ...value }: MotionConfigValue & {
    children: ReactNode;
}): React.JSX.Element;
declare function useReducedMotion(): boolean;

type CssVariants = Readonly<Record<string, CssTarget>>;
interface CssMotionProps {
    initial?: CssTarget | string | false;
    animate: CssTarget | string;
    variants?: CssVariants;
    transition?: CssTransition | string;
    onMotionStart?: (playback: CssPlayback) => void;
    onMotionComplete?: (result: CssPlaybackResult) => void;
}
declare function CssMotionConfig({ tokens, children, }: {
    tokens: CssMotionTokens;
    children: React__default.ReactNode;
}): React__default.JSX.Element;
/** Additive CSS-native API. Existing numeric motion/gesture semantics remain unchanged. */
declare function createCssMotionComponent<T extends React__default.ElementType>(tag: T): React__default.ForwardRefExoticComponent<React__default.PropsWithoutRef<Omit<React__default.PropsWithoutRef<React__default.ComponentProps<T>>, keyof CssMotionProps> & CssMotionProps> & React__default.RefAttributes<HTMLElement>>;
declare const cssMotion: {
    div: React__default.ForwardRefExoticComponent<Omit<Omit<React__default.DetailedHTMLProps<React__default.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref">, keyof CssMotionProps> & CssMotionProps & React__default.RefAttributes<HTMLElement>>;
    section: React__default.ForwardRefExoticComponent<Omit<Omit<React__default.DetailedHTMLProps<React__default.HTMLAttributes<HTMLElement>, HTMLElement>, "ref">, keyof CssMotionProps> & CssMotionProps & React__default.RefAttributes<HTMLElement>>;
    article: React__default.ForwardRefExoticComponent<Omit<Omit<React__default.DetailedHTMLProps<React__default.HTMLAttributes<HTMLElement>, HTMLElement>, "ref">, keyof CssMotionProps> & CssMotionProps & React__default.RefAttributes<HTMLElement>>;
    span: React__default.ForwardRefExoticComponent<Omit<Omit<React__default.DetailedHTMLProps<React__default.HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>, "ref">, keyof CssMotionProps> & CssMotionProps & React__default.RefAttributes<HTMLElement>>;
    button: React__default.ForwardRefExoticComponent<Omit<Omit<React__default.DetailedHTMLProps<React__default.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>, "ref">, keyof CssMotionProps> & CssMotionProps & React__default.RefAttributes<HTMLElement>>;
};

interface InViewOptions {
    once?: boolean;
    amount?: number | 'some' | 'all';
    margin?: string;
    disabled?: boolean;
}
declare function useInView<T extends Element = HTMLElement>({ once, amount, margin, disabled }?: InViewOptions): readonly [React__default.RefObject<T | null>, boolean];
declare function useMotionValue<T extends MotionValueShape>(initial: T): MotionValue<T>;
declare function useMotionValueState<T extends MotionValueShape>(value: MotionValue<T>): T;
declare function useTween<T extends MotionValueShape>(from: T, to: T, options?: Omit<TweenOptions<T>, 'from' | 'to'>): {
    value: T;
    motionValue: MotionValue<T>;
    controls: React__default.RefObject<Tween$1<T> | null>;
};
declare function useTimeline(factory: () => Timeline, dependencies?: React__default.DependencyList): React__default.RefObject<Timeline | null>;
interface MotionRenderProps<T extends MotionValueShape> extends Omit<TweenOptions<T>, 'from' | 'to'> {
    from: T;
    to: T;
    children: (value: T, controls: React__default.RefObject<Tween$1<T> | null>) => React__default.ReactNode;
}
declare function Motion<T extends MotionValueShape>({ from, to, children, ...options }: MotionRenderProps<T>): React__default.JSX.Element;
type NativeProps<T extends React__default.ElementType> = Omit<React__default.ComponentPropsWithoutRef<T>, 'style'>;
type MotionElementProps<T extends React__default.ElementType> = NativeProps<T> & {
    initial?: MotionStyle | false;
    animate?: MotionStyle;
    transition?: MotionTransition;
    style?: React__default.CSSProperties;
    whileInView?: MotionStyle;
    viewport?: InViewOptions;
    whileHover?: MotionStyle;
    whileTap?: MotionStyle;
    whileDrag?: MotionStyle;
    whileFocus?: MotionStyle;
    drag?: boolean | 'x' | 'y';
    dragAxis?: DragOptions['axis'];
    dragBounds?: DragOptions['bounds'];
    dragElastic?: number | false;
    dragMomentum?: DragOptions['momentum'];
    dragSnap?: DragOptions['snap'];
    dragPropagation?: boolean;
    dragListener?: boolean;
    dragKeyboard?: boolean;
    dragControls?: ReturnType<typeof useDragControls>;
    onTap?: (event: GestureEvent<'tap'>) => void;
    onLongPress?: (event: GestureEvent<'longPress'>) => void;
    onPanStart?: (event: GestureEvent<'pan'>) => void;
    onPan?: (event: GestureEvent<'pan'>) => void;
    onPanEnd?: (event: GestureEvent<'pan'>) => void;
    onPinch?: (event: GestureEvent<'pinch'>) => void;
    onDragStart?: (event: GestureEvent<'pan'>) => void;
    onDrag?: (event: GestureEvent<'pan'>) => void;
    onDragEnd?: (event: GestureEvent<'pan'>) => void;
    onMotionStart?: () => void;
    onMotionComplete?: () => void;
    as?: React__default.ElementType;
};
declare function createMotionComponent<T extends React__default.ElementType>(tag: T): React__default.ForwardRefExoticComponent<MotionElementProps<T> & React__default.RefAttributes<HTMLElement>>;
type MotionFactory = {
    div: React__default.ForwardRefExoticComponent<MotionElementProps<'div'> & React__default.RefAttributes<HTMLElement>>;
    span: React__default.ForwardRefExoticComponent<MotionElementProps<'span'> & React__default.RefAttributes<HTMLElement>>;
    button: React__default.ForwardRefExoticComponent<MotionElementProps<'button'> & React__default.RefAttributes<HTMLElement>>;
    section: React__default.ForwardRefExoticComponent<MotionElementProps<'section'> & React__default.RefAttributes<HTMLElement>>;
    article: React__default.ForwardRefExoticComponent<MotionElementProps<'article'> & React__default.RefAttributes<HTMLElement>>;
    [key: string]: React__default.ComponentType<any>;
};
declare const motion: MotionFactory;
declare function useGesture<T extends Element>(ref: React__default.RefObject<T | null>, recognizers: Recognizer[]): void;
declare function useDrag<T extends Element>(ref: React__default.RefObject<T | null>, target: MotionValue<number> | {
    x: MotionValue<number>;
    y: MotionValue<number>;
}, options?: DragOptions): React__default.RefObject<DragControls | null>;
declare function usePinch<T extends Element>(ref: React__default.RefObject<T | null>, options: TransformGestureOptions): void;
declare function useScrub<T extends Element>(ref: React__default.RefObject<T | null>, transport?: Transport$1, options?: ScrubOptions): void;
interface ReactDragControls {
    start(event: PointerEvent): void;
    cancel(): void;
    _bind(control: DragControls): void;
    _unbind(control: DragControls): void;
}
declare function useDragControls(): ReactDragControls;
declare function useVelocity<T extends MotionValueShape>(value: MotionValue<T>): MotionValue<number | T>;
declare function useIsPressed<T extends Element>(ref: React__default.RefObject<T | null>): boolean;
declare function useIsHovered<T extends Element>(ref: React__default.RefObject<T | null>): boolean;
interface RevealProps extends Omit<MotionElementProps<'div'>, 'initial' | 'animate' | 'whileInView' | 'viewport'> {
    from?: MotionStyle;
    to?: MotionStyle;
    once?: boolean;
    amount?: InViewOptions['amount'];
    margin?: string;
}
declare function Reveal({ from, to, once, amount, margin, ...props }: RevealProps): React__default.JSX.Element;
interface TransportProps {
    children?: React__default.ReactNode;
    frameRate?: FrameRateInput;
    snap?: boolean;
    rate?: number;
    loop?: TransportOptions['loop'];
    /** Start playing once mounted (and whenever `paused` isn't otherwise controlling it). */
    autoplay?: boolean;
    /** Controlled play/pause; overrides `autoplay` reactively. */
    paused?: boolean;
    clock?: Clock;
    scheduler?: TransportOptions['scheduler'];
    outputs?: TransportOutput[];
    /** Use this transport instead of creating one (its lifecycle is then the caller's responsibility, not this component's). */
    transport?: Transport$1;
    /** When `false`, reduced-motion preference does not park the transport at its end. Default `true`. */
    respectReducedMotion?: boolean;
    onStateChange?(state: TransportState): void;
    onFinish?(): void;
}
/** Owns one `Transport` (unless `transport` is given) and provides it, plus a root item/cue registration table, to every `<Sequence>`/`<Track>`/`<Tween>`/`<Cue>`/`<Marker>`/`<Region>` beneath it. */
declare function Transport(props: TransportProps): React__default.ReactElement;
/** The nearest `<Transport>`'s live `Transport` instance. Throws outside one, naming which hook/component needs it. */
declare function useTransport(): Transport$1;
/** State/rate/duration/frameRate, updated only when one of them actually changes — not once per tick. */
declare function useTransportState(): {
    state: TransportState;
    rate: number;
    duration: number;
    frameRate: Transport$1['frameRate'];
};
/** The playhead, throttled to at most `fps` React updates per second (default 30) — for a scrubber or a timecode readout. */
declare function usePlayhead(options?: {
    fps?: number;
}): {
    time: number;
    frame: number;
    timecode: string;
    progress: number;
};
/** The playhead time as a `MotionValue`, updated every tick with no React render — bind it to the DOM via `motion.*`/`Motion`, or `.subscribe()` it directly. */
declare function usePlayheadValue(): MotionValue<number>;
/** Fire `handler` when the transport's playhead crosses `at`, forward or backward. Registers on the nearest `<Sequence>` (or `<Transport>`'s root). */
declare function useCue(at: TimelinePosition, handler: (e: CueEvent) => void, deps?: React__default.DependencyList): void;
interface TrackProps<T extends MotionValueShape> extends Omit<TrackOptions<T>, 'keyframes' | 'apply' | 'target'> {
    target: MotionValue<T> | ((value: T) => void);
    keyframes: Keyframe<T>[];
    at?: TimelinePosition;
}
/** A `Track` (multi-keyframe animation) as a timeline item: writes to `target` (a `MotionValue` or a plain setter) as the transport plays. Renders nothing. */
declare function Track<T extends MotionValueShape>({ target, keyframes, at, ...options }: TrackProps<T>): null;
interface TweenElementProps<T extends MotionValueShape> extends Omit<TweenOptions<T>, 'from' | 'to' | 'onUpdate'> {
    target: MotionValue<T> | ((value: T) => void);
    from: T;
    to: T;
    at?: TimelinePosition;
}
/** A `Tween` as a timeline item: writes to `target` as the transport plays. Renders nothing. */
declare function Tween<T extends MotionValueShape>({ target, from, to, at, ...options }: TweenElementProps<T>): null;
interface MarkerElementProps {
    name: string;
    at: TimelinePosition;
    color?: string;
    payload?: unknown;
}
/** A named position on the nearest `<Sequence>`/`<Transport>` root. Renders nothing. */
declare function Marker({ name, at, color, payload }: MarkerElementProps): null;
interface CueElementProps extends CueOptions {
    name: string;
    at: TimelinePosition;
    onFire: (e: CueEvent) => void;
}
/** A named cue point: `onFire` runs (forward or backward) whenever the playhead crosses `at`. Renders nothing. */
declare function Cue({ name, at, onFire, payload, once }: CueElementProps): null;
interface RegionElementProps extends Omit<CueOptions, 'onEnter' | 'onExit'> {
    name: string;
    from: TimelinePosition;
    to: TimelinePosition;
    onEnter?: (e: CueEvent) => void;
    onExit?: (e: CueEvent) => void;
}
/** A named span: `onEnter`/`onExit` run at its two boundaries, in either direction. Renders nothing. */
declare function Region({ name, from, to, onEnter, onExit, payload, once }: RegionElementProps): null;
interface SequenceProps {
    name?: string;
    at?: TimelinePosition;
    repeat?: number;
    repeatDelay?: TimeInput;
    yoyo?: boolean;
    frameRate?: FrameRateInput;
    snap?: boolean;
    onComplete?(): void;
    children?: React__default.ReactNode;
}
/** A nested `Timeline`: everything inside registers into it instead of its parent, at `at` within the parent. */
declare function Sequence({ name, at, repeat, repeatDelay, yoyo, frameRate, snap, onComplete, children }: SequenceProps): React__default.ReactElement;
type SceneTargets = Record<string, MotionValue<any> | ((value: any) => void)>;
/** A React-visible copy of a set of `MotionValue`/setter targets, plus a setter that writes them back (optionally as a `transition`). */
declare function useSceneState(targets: SceneTargets): [SceneState, (next: SceneState, transition?: ApplySceneOptions['transition']) => void];

export { CssMotionConfig, type CssMotionProps, type CssVariants, Cue, type CueElementProps, type InViewOptions, Marker, type MarkerElementProps, Motion, MotionConfig, type MotionConfigValue, type MotionElementProps, type MotionRenderProps, type MotionTransition, type ReactDragControls, Region, type RegionElementProps, Reveal, type RevealProps, Sequence, type SequenceProps, Track, type TrackProps, Transport, type TransportProps, Tween, type TweenElementProps, createCssMotionComponent, createMotionComponent, cssMotion, motion, useCue, useDrag, useDragControls, useGesture, useInView, useIsHovered, useIsPressed, useMotionValue, useMotionValueState, usePinch, usePlayhead, usePlayheadValue, useReducedMotion, useSceneState, useScrub, useTimeline, useTransport, useTransportState, useTween, useVelocity };
