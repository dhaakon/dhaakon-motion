import React from 'react';
import { CueOptions, TimelinePosition, CueEvent, MotionValueShape, TweenOptions, Tween as Tween$1, EasingFunction, EasingName, MotionStyle, FrameRateInput, TrackOptions, MotionValue, Keyframe, TransportOptions, Clock, TransportOutput, Transport as Transport$1, TransportState, SceneState, ApplySceneOptions, Timeline } from '@dhaakon/motion';
export { MotionStyle } from '@dhaakon/motion';

interface MotionTransition {
    duration?: number;
    delay?: number;
    repeat?: number;
    repeatDelay?: number;
    yoyo?: boolean;
    easing?: EasingFunction | EasingName;
}
interface MotionConfigValue {
    transition?: MotionTransition;
    reducedMotion?: 'user' | 'always' | 'never';
}
declare function MotionConfig({ children, ...value }: MotionConfigValue & {
    children: React.ReactNode;
}): React.JSX.Element;
declare function useReducedMotion(): boolean;
interface InViewOptions {
    once?: boolean;
    amount?: number | 'some' | 'all';
    margin?: string;
    disabled?: boolean;
}
declare function useInView<T extends Element = HTMLElement>({ once, amount, margin, disabled }?: InViewOptions): readonly [React.RefObject<T | null>, boolean];
declare function useMotionValue<T extends MotionValueShape>(initial: T): MotionValue<T>;
declare function useMotionValueState<T extends MotionValueShape>(value: MotionValue<T>): T;
declare function useTween<T extends MotionValueShape>(from: T, to: T, options?: Omit<TweenOptions<T>, 'from' | 'to'>): {
    value: T;
    motionValue: MotionValue<T>;
    controls: React.RefObject<Tween$1<T> | null>;
};
declare function useTimeline(factory: () => Timeline, dependencies?: React.DependencyList): React.RefObject<Timeline | null>;
interface MotionRenderProps<T extends MotionValueShape> extends Omit<TweenOptions<T>, 'from' | 'to'> {
    from: T;
    to: T;
    children: (value: T, controls: React.RefObject<Tween$1<T> | null>) => React.ReactNode;
}
declare function Motion<T extends MotionValueShape>({ from, to, children, ...options }: MotionRenderProps<T>): React.JSX.Element;
type NativeProps<T extends React.ElementType> = Omit<React.ComponentPropsWithoutRef<T>, 'style'>;
type MotionElementProps<T extends React.ElementType> = NativeProps<T> & {
    initial?: MotionStyle | false;
    animate?: MotionStyle;
    transition?: MotionTransition;
    style?: React.CSSProperties;
    whileInView?: MotionStyle;
    viewport?: InViewOptions;
    onMotionStart?: () => void;
    onMotionComplete?: () => void;
    as?: React.ElementType;
};
declare function createMotionComponent<T extends React.ElementType>(tag: T): React.ForwardRefExoticComponent<MotionElementProps<T> & React.RefAttributes<HTMLElement>>;
type MotionFactory = {
    div: React.ForwardRefExoticComponent<MotionElementProps<'div'> & React.RefAttributes<HTMLElement>>;
    span: React.ForwardRefExoticComponent<MotionElementProps<'span'> & React.RefAttributes<HTMLElement>>;
    button: React.ForwardRefExoticComponent<MotionElementProps<'button'> & React.RefAttributes<HTMLElement>>;
    section: React.ForwardRefExoticComponent<MotionElementProps<'section'> & React.RefAttributes<HTMLElement>>;
    article: React.ForwardRefExoticComponent<MotionElementProps<'article'> & React.RefAttributes<HTMLElement>>;
    [key: string]: React.ComponentType<any>;
};
declare const motion: MotionFactory;
interface RevealProps extends Omit<MotionElementProps<'div'>, 'initial' | 'animate' | 'whileInView' | 'viewport'> {
    from?: MotionStyle;
    to?: MotionStyle;
    once?: boolean;
    amount?: InViewOptions['amount'];
    margin?: string;
}
declare function Reveal({ from, to, once, amount, margin, ...props }: RevealProps): React.JSX.Element;
interface TransportProps {
    children?: React.ReactNode;
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
declare function Transport(props: TransportProps): React.ReactElement;
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
declare function useCue(at: TimelinePosition, handler: (e: CueEvent) => void, deps?: React.DependencyList): void;
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
    repeatDelay?: number;
    yoyo?: boolean;
    frameRate?: FrameRateInput;
    snap?: boolean;
    onComplete?(): void;
    children?: React.ReactNode;
}
/** A nested `Timeline`: everything inside registers into it instead of its parent, at `at` within the parent. */
declare function Sequence({ name, at, repeat, repeatDelay, yoyo, frameRate, snap, onComplete, children }: SequenceProps): React.ReactElement;
type SceneTargets = Record<string, MotionValue<any> | ((value: any) => void)>;
/** A React-visible copy of a set of `MotionValue`/setter targets, plus a setter that writes them back (optionally as a `transition`). */
declare function useSceneState(targets: SceneTargets): [SceneState, (next: SceneState, transition?: ApplySceneOptions['transition']) => void];

export { Cue, type CueElementProps, type InViewOptions, Marker, type MarkerElementProps, Motion, MotionConfig, type MotionConfigValue, type MotionElementProps, type MotionRenderProps, type MotionTransition, Region, type RegionElementProps, Reveal, type RevealProps, Sequence, type SequenceProps, Track, type TrackProps, Transport, type TransportProps, Tween, type TweenElementProps, createMotionComponent, motion, useCue, useInView, useMotionValue, useMotionValueState, usePlayhead, usePlayheadValue, useReducedMotion, useSceneState, useTimeline, useTransport, useTransportState, useTween };
