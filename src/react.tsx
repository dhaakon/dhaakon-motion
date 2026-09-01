import React, { createContext, forwardRef, useContext, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  MotionValue, Timeline, Tween as CoreTween, Track as CoreTrack, Transport as CoreTransport,
  writeStyle, readStyle,
  type TweenOptions, type TrackOptions, type Keyframe, type EasingFunction, type EasingInput, type EasingName,
  type MotionValueShape, type MotionStyle, type TimelineItem, type TimelinePosition, type TimelineOptions,
  type CueEvent, type CueOptions, type TransportOptions, type TransportOutput, type TransportState, type Clock,
  type FrameRateInput,
  captureScene, applyScene, type SceneState, type ApplySceneOptions,
} from '@dhaakon/motion';

export type { MotionStyle };
// Note: this entry's `Tween`/`Track` exports are the React components below (JSX elements), not the
// core classes — import those from '@dhaakon/motion' directly when you need them imperatively.

export interface MotionTransition { duration?: number; delay?: number; repeat?: number; repeatDelay?: number; yoyo?: boolean; easing?: EasingFunction | EasingName; }
export interface MotionConfigValue { transition?: MotionTransition; reducedMotion?: 'user' | 'always' | 'never'; }
const MotionContext = createContext<MotionConfigValue>({ reducedMotion: 'user' });

export function MotionConfig({ children, ...value }: MotionConfigValue & { children: React.ReactNode }) {
  const parent = useContext(MotionContext);
  return <MotionContext.Provider value={useMemo(() => ({ ...parent, ...value, transition: { ...parent.transition, ...value.transition } }), [parent, value.transition, value.reducedMotion])}>{children}</MotionContext.Provider>;
}

export function useReducedMotion() {
  const setting = useContext(MotionContext).reducedMotion;
  const query = useMemo(() => typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null, []);
  const system = useSyncExternalStore(
    (listener) => { query?.addEventListener('change', listener); return () => query?.removeEventListener('change', listener); },
    () => query?.matches ?? false, () => false,
  );
  return setting === 'always' || (setting !== 'never' && system);
}

export interface InViewOptions {
  once?: boolean;
  amount?: number | 'some' | 'all';
  margin?: string;
  disabled?: boolean;
}

export function useInView<T extends Element = HTMLElement>({ once = true, amount = 'some', margin = '0px', disabled = false }: InViewOptions = {}) {
  const ref = useRef<T | null>(null); const reduced = useReducedMotion();
  const [inView, setInView] = useState(disabled || reduced);
  useEffect(() => {
    if (disabled || reduced || typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const threshold = amount === 'all' ? 1 : amount === 'some' ? 0.15 : Math.max(0, Math.min(1, amount));
    const observer = new IntersectionObserver(([entry]) => {
      const visible = entry.isIntersecting && entry.intersectionRatio >= threshold;
      if (visible) { setInView(true); if (once) observer.disconnect(); }
      else if (!once) setInView(false);
    }, { rootMargin: margin, threshold });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [once, amount, margin, disabled, reduced]);
  return [ref, inView] as const;
}

export function useMotionValue<T extends MotionValueShape>(initial: T) {
  const ref = useRef<MotionValue<T> | null>(null);
  if (!ref.current) ref.current = new MotionValue(initial);
  useEffect(() => () => ref.current?.stop(), []);
  return ref.current;
}

export function useMotionValueState<T extends MotionValueShape>(value: MotionValue<T>) {
  return useSyncExternalStore(value.subscribe, () => value.get(), () => value.get());
}

export function useTween<T extends MotionValueShape>(from: T, to: T, options: Omit<TweenOptions<T>, 'from' | 'to'> = {}) {
  const motionValue = useMotionValue(from); const tween = useRef<CoreTween<T> | null>(null); const reduced = useReducedMotion();
  const transition = useContext(MotionContext).transition;
  const fromKey = stableKey(from); const toKey = stableKey(to);
  useEffect(() => {
    motionValue.set(from);
    tween.current = motionValue.animate(to, { ...transition, ...options, duration: reduced ? 0 : options.duration ?? transition?.duration });
    return () => { tween.current?.cancel(); };
  }, [motionValue, fromKey, toKey, reduced, options.duration, options.delay, options.repeat, options.repeatDelay, options.yoyo, options.easing, options.ease]);
  return { value: useMotionValueState(motionValue), motionValue, controls: tween };
}

export function useTimeline(factory: () => Timeline, dependencies: React.DependencyList = []) {
  const timeline = useRef<Timeline | null>(null);
  useEffect(() => { timeline.current = factory(); return () => { timeline.current?.stop(); timeline.current = null; }; }, dependencies);
  return timeline;
}

export interface MotionRenderProps<T extends MotionValueShape> extends Omit<TweenOptions<T>, 'from' | 'to'> {
  from: T; to: T; children: (value: T, controls: React.RefObject<CoreTween<T> | null>) => React.ReactNode;
}
export function Motion<T extends MotionValueShape>({ from, to, children, ...options }: MotionRenderProps<T>) {
  const result = useTween(from, to, options); return <>{children(result.value, result.controls)}</>;
}

type NativeProps<T extends React.ElementType> = Omit<React.ComponentPropsWithoutRef<T>, 'style'>;
export type MotionElementProps<T extends React.ElementType> = NativeProps<T> & {
  initial?: MotionStyle | false; animate?: MotionStyle; transition?: MotionTransition; style?: React.CSSProperties;
  whileInView?: MotionStyle; viewport?: InViewOptions;
  onMotionStart?: () => void; onMotionComplete?: () => void; as?: React.ElementType;
};

export function createMotionComponent<T extends React.ElementType>(tag: T) {
  const Component = forwardRef<HTMLElement, MotionElementProps<any>>(function DhaakonMotionElement(rawProps, forwardedRef) {
    const { as, initial, animate: target, whileInView, viewport, transition, style, onMotionStart, onMotionComplete, ...props } = rawProps as MotionElementProps<T>;
    const localRef = useRef<HTMLElement | null>(null); const config = useContext(MotionContext); const reduced = useReducedMotion();
    const [inViewRef, inView] = useInView<HTMLElement>({ ...viewport, disabled: !whileInView });
    const hasAnimated = useRef(false);
    useImperativeHandle(forwardedRef, () => localRef.current as HTMLElement);
    const initialKey = stableKey(initial); const targetKey = stableKey(target); const viewKey = stableKey(whileInView);
    useLayoutEffect(() => { if (localRef.current && initial) writeStyle(localRef.current, initial); }, [initialKey]);
    useEffect(() => {
      const node = localRef.current; const activeTarget = whileInView ? (inView ? whileInView : (initial || undefined)) : target;
      if (!node || !activeTarget) return;
      const from = hasAnimated.current || initial === false ? readStyle(node, activeTarget) : { ...(initial || readStyle(node, activeTarget)) };
      hasAnimated.current = true;
      if (reduced) { writeStyle(node, activeTarget); onMotionComplete?.(); return; }
      const tween = new CoreTween<MotionStyle>({ ...config.transition, ...transition, from, to: activeTarget,
        onStart: () => onMotionStart?.(), onUpdate: (value) => writeStyle(node, value), onComplete: () => onMotionComplete?.() }).play();
      return () => { tween.cancel(); };
    }, [initialKey, targetKey, viewKey, inView, reduced, transition?.duration, transition?.delay, transition?.repeat, transition?.repeatDelay, transition?.yoyo, transition?.easing]);
    return React.createElement(as || tag, { ...props, style, ref: (node: HTMLElement | null) => { localRef.current = node; inViewRef.current = node; } });
  });
  return Component as React.ForwardRefExoticComponent<MotionElementProps<T> & React.RefAttributes<HTMLElement>>;
}

function stableKey(value: unknown) { try { return JSON.stringify(value); } catch { return String(value); } }

type MotionFactory = {
  div: React.ForwardRefExoticComponent<MotionElementProps<'div'> & React.RefAttributes<HTMLElement>>;
  span: React.ForwardRefExoticComponent<MotionElementProps<'span'> & React.RefAttributes<HTMLElement>>;
  button: React.ForwardRefExoticComponent<MotionElementProps<'button'> & React.RefAttributes<HTMLElement>>;
  section: React.ForwardRefExoticComponent<MotionElementProps<'section'> & React.RefAttributes<HTMLElement>>;
  article: React.ForwardRefExoticComponent<MotionElementProps<'article'> & React.RefAttributes<HTMLElement>>;
  [key: string]: React.ComponentType<any>;
};
const cache = new Map<string, React.ComponentType<any>>();
export const motion = new Proxy({} as MotionFactory, { get: (_, tag: string) => { if (!cache.has(tag)) cache.set(tag, createMotionComponent(tag as React.ElementType)); return cache.get(tag); } });

export interface RevealProps extends Omit<MotionElementProps<'div'>, 'initial' | 'animate' | 'whileInView' | 'viewport'> {
  from?: MotionStyle; to?: MotionStyle; once?: boolean; amount?: InViewOptions['amount']; margin?: string;
}
export function Reveal({ from = { y: 28, opacity: 0 }, to = { y: 0, opacity: 1 }, once = true, amount = 'some', margin = '0px 0px -8% 0px', ...props }: RevealProps) {
  return <motion.div {...props} initial={from} whileInView={to} viewport={{ once, amount, margin }} />;
}

// ============================================================================
// Transport composition: <Transport>, <Sequence>, and the item/cue components
// that register into whichever is nearest, rebuilding on a microtask so many
// changes in one render pass become one timeline rebuild.
// ============================================================================

interface RegisteredEntry { item: TimelineItem; at?: TimelinePosition; order: number; }
interface RegisteredCue { name: string; at: TimelinePosition; handler: (e: CueEvent) => void; options?: CueOptions; }
interface RegisteredMarker { name: string; at: TimelinePosition; options?: { color?: string; payload?: unknown }; }
interface RegisteredRegion { name: string; from: TimelinePosition; to: TimelinePosition; options?: CueOptions; }

interface SequenceContextValue {
  timeline: Timeline;
  register(key: string, item: TimelineItem, at?: TimelinePosition): void;
  unregister(key: string): void;
  registerCue(key: string, spec: RegisteredCue): void;
  unregisterCue(key: string): void;
  registerMarker(key: string, spec: RegisteredMarker): void;
  unregisterMarker(key: string): void;
  registerRegion(key: string, spec: RegisteredRegion): void;
  unregisterRegion(key: string): void;
  invalidate(): void;
}

const SequenceContext = createContext<SequenceContextValue | null>(null);
const TransportContext = createContext<CoreTransport | null>(null);

function requireSequence(componentName: string): SequenceContextValue {
  const value = useContext(SequenceContext);
  if (!value) throw new Error(`<${componentName}> (or use${componentName}()) must be used inside <Transport>, directly or nested inside a <Sequence>.`);
  return value;
}

/** One registration table (content items, cues, markers, regions) for one `Timeline`, rebuilding it on a debounced microtask. Shared by `<Transport>`'s root and every `<Sequence>`. */
function createSequenceValue(timeline: Timeline, onRebuilt: () => void): SequenceContextValue {
  const items = new Map<string, RegisteredEntry>();
  const cues = new Map<string, RegisteredCue>();
  const markers = new Map<string, RegisteredMarker>();
  const regions = new Map<string, RegisteredRegion>();
  let orderCounter = 0;
  let scheduled = false;

  const rebuild = () => {
    timeline.clear();
    const sorted = [...items.values()].sort((a, b) => a.order - b.order);
    for (const entry of sorted) timeline.add(entry.item, entry.at);
    for (const marker of markers.values()) timeline.marker(marker.name, marker.at, marker.options);
    for (const cue of cues.values()) timeline.cue(cue.name, cue.at, cue.handler, cue.options);
    for (const region of regions.values()) timeline.region(region.name, region.from, region.to, region.options);
    onRebuilt();
  };
  const invalidate = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; rebuild(); });
  };

  return {
    timeline,
    register(key, item, at) {
      const existing = items.get(key);
      items.set(key, { item, at, order: existing?.order ?? orderCounter++ });
      invalidate();
    },
    unregister(key) { if (items.delete(key)) invalidate(); },
    registerCue(key, spec) { cues.set(key, spec); invalidate(); },
    unregisterCue(key) { if (cues.delete(key)) invalidate(); },
    registerMarker(key, spec) { markers.set(key, spec); invalidate(); },
    unregisterMarker(key) { if (markers.delete(key)) invalidate(); },
    registerRegion(key, spec) { regions.set(key, spec); invalidate(); },
    unregisterRegion(key) { if (regions.delete(key)) invalidate(); },
    invalidate,
  };
}

export interface TransportProps {
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
  transport?: CoreTransport;
  /** When `false`, reduced-motion preference does not park the transport at its end. Default `true`. */
  respectReducedMotion?: boolean;
  onStateChange?(state: TransportState): void;
  onFinish?(): void;
}

/** Owns one `Transport` (unless `transport` is given) and provides it, plus a root item/cue registration table, to every `<Sequence>`/`<Track>`/`<Tween>`/`<Cue>`/`<Marker>`/`<Region>` beneath it. */
export function Transport(props: TransportProps): React.ReactElement {
  const reduced = useReducedMotion();
  const respect = props.respectReducedMotion !== false;
  const ownsInstance = useRef(false);
  const instanceRef = useRef<CoreTransport | null>(null);
  if (!instanceRef.current) {
    if (props.transport) { instanceRef.current = props.transport; ownsInstance.current = false; }
    else {
      instanceRef.current = new CoreTransport({ frameRate: props.frameRate, snap: props.snap, rate: props.rate, loop: props.loop, clock: props.clock, scheduler: props.scheduler });
      ownsInstance.current = true;
    }
  }
  const transport = instanceRef.current;

  useEffect(() => () => { if (ownsInstance.current) transport.dispose(); }, [transport]);

  useEffect(() => {
    const detachers = (props.outputs ?? []).map((output) => transport.attach(output));
    return () => { detachers.forEach((detach) => detach()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transport, stableKey(props.outputs?.map((o) => o.name))]);

  const onStateChangeRef = useRef(props.onStateChange); onStateChangeRef.current = props.onStateChange;
  useEffect(() => transport.attach({ onStateChange: (state) => onStateChangeRef.current?.(state) }), [transport]);

  const onFinishRef = useRef(props.onFinish); onFinishRef.current = props.onFinish;
  useEffect(() => {
    let cancelled = false;
    transport.finished.then(() => { if (!cancelled) onFinishRef.current?.(); });
    return () => { cancelled = true; };
  }, [transport, transport.state]);

  const controlled = props.paused !== undefined;
  const shouldRun = (props.autoplay || controlled) && props.paused !== true && !(respect && reduced);
  useEffect(() => {
    if (!props.autoplay && !controlled) return;
    if (respect && reduced) { transport.seek(transport.duration); return; }
    if (shouldRun) {
      for (const output of props.outputs ?? []) (output as { unlock?: () => Promise<void> }).unlock?.();
      transport.play();
    } else {
      transport.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transport, shouldRun, respect, reduced]);

  const sequenceValue = useMemo(
    () => createSequenceValue(transport.root, () => transport.seek(transport.time, { cues: 'skip' })),
    [transport],
  );

  return (
    <TransportContext.Provider value={transport}>
      <SequenceContext.Provider value={sequenceValue}>{props.children}</SequenceContext.Provider>
    </TransportContext.Provider>
  );
}

/** The nearest `<Transport>`'s live `Transport` instance. Throws outside one, naming which hook/component needs it. */
export function useTransport(): CoreTransport {
  const transport = useContext(TransportContext);
  if (!transport) throw new Error('useTransport() must be called inside <Transport>.');
  return transport;
}

/** State/rate/duration/frameRate, updated only when one of them actually changes — not once per tick. */
export function useTransportState(): { state: TransportState; rate: number; duration: number; frameRate: CoreTransport['frameRate'] } {
  const transport = useTransport();
  const snapshotRef = useRef({ state: transport.state, rate: transport.rate, duration: transport.duration, frameRate: transport.frameRate });
  const getSnapshot = () => {
    const prev = snapshotRef.current;
    if (prev.state !== transport.state || prev.rate !== transport.rate || prev.duration !== transport.duration || prev.frameRate !== transport.frameRate) {
      snapshotRef.current = { state: transport.state, rate: transport.rate, duration: transport.duration, frameRate: transport.frameRate };
    }
    return snapshotRef.current;
  };
  return useSyncExternalStore(
    (listener) => transport.attach({ onStateChange: () => listener(), onRateChange: () => listener() }),
    getSnapshot, getSnapshot,
  );
}

/** The playhead, throttled to at most `fps` React updates per second (default 30) — for a scrubber or a timecode readout. */
export function usePlayhead(options: { fps?: number } = {}): { time: number; frame: number; timecode: string; progress: number } {
  const transport = useTransport();
  const fps = Math.max(1, options.fps ?? 30);
  const [snapshot, setSnapshot] = useState(() => ({ time: transport.time, frame: transport.frame, timecode: transport.timecode, progress: transport.progress }));
  useEffect(() => {
    const minInterval = 1000 / fps;
    let last = 0;
    return transport.subscribe(() => {
      const now = globalThis.performance?.now?.() ?? Date.now();
      if (now - last < minInterval) return;
      last = now;
      setSnapshot({ time: transport.time, frame: transport.frame, timecode: transport.timecode, progress: transport.progress });
    });
  }, [transport, fps]);
  return snapshot;
}

/** The playhead time as a `MotionValue`, updated every tick with no React render — bind it to the DOM via `motion.*`/`Motion`, or `.subscribe()` it directly. */
export function usePlayheadValue(): MotionValue<number> {
  const transport = useTransport();
  const motionValue = useMotionValue(transport.time);
  useEffect(() => transport.subscribe((info) => motionValue.set(info.time)), [transport, motionValue]);
  return motionValue;
}

/** Fire `handler` when the transport's playhead crosses `at`, forward or backward. Registers on the nearest `<Sequence>` (or `<Transport>`'s root). */
export function useCue(at: TimelinePosition, handler: (e: CueEvent) => void, deps: React.DependencyList = []): void {
  const parent = requireSequence('Cue');
  const id = useId();
  const handlerRef = useRef(handler); handlerRef.current = handler;
  const stableHandler = useRef((e: CueEvent) => handlerRef.current(e)).current;
  useLayoutEffect(() => {
    parent.registerCue(id, { name: id, at, handler: stableHandler });
    return () => parent.unregisterCue(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parent, id, stableKey(at), ...deps]);
}

export interface TrackProps<T extends MotionValueShape> extends Omit<TrackOptions<T>, 'keyframes' | 'apply' | 'target'> {
  target: MotionValue<T> | ((value: T) => void);
  keyframes: Keyframe<T>[];
  at?: TimelinePosition;
}
/** A `Track` (multi-keyframe animation) as a timeline item: writes to `target` (a `MotionValue` or a plain setter) as the transport plays. Renders nothing. */
export function Track<T extends MotionValueShape>({ target, keyframes, at, ...options }: TrackProps<T>): null {
  const parent = requireSequence('Track');
  const id = useId();
  const key = `${stableKey(keyframes)}:${stableKey(options)}`;
  const built = useRef<{ item: CoreTrack<T>; key: string } | null>(null);
  if (!built.current || built.current.key !== key) {
    const item = target instanceof MotionValue
      ? new CoreTrack<T>({ ...options, keyframes, target })
      : new CoreTrack<T>({ ...options, keyframes, apply: target });
    built.current = { item, key };
  }
  useLayoutEffect(() => {
    parent.register(id, built.current!.item, at);
    return () => parent.unregister(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parent, id, stableKey(at), key]);
  return null;
}

export interface TweenElementProps<T extends MotionValueShape> extends Omit<TweenOptions<T>, 'from' | 'to' | 'onUpdate'> {
  target: MotionValue<T> | ((value: T) => void);
  from: T;
  to: T;
  at?: TimelinePosition;
}
/** A `Tween` as a timeline item: writes to `target` as the transport plays. Renders nothing. */
export function Tween<T extends MotionValueShape>({ target, from, to, at, ...options }: TweenElementProps<T>): null {
  const parent = requireSequence('Tween');
  const id = useId();
  const key = `${stableKey(from)}:${stableKey(to)}:${stableKey(options)}`;
  const built = useRef<{ item: CoreTween<T>; key: string } | null>(null);
  if (!built.current || built.current.key !== key) {
    const write = target instanceof MotionValue ? (value: T) => target.set(value) : target;
    built.current = { item: new CoreTween<T>({ ...options, from, to, onUpdate: (value) => write(value) }), key };
  }
  useLayoutEffect(() => {
    parent.register(id, built.current!.item, at);
    return () => parent.unregister(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parent, id, stableKey(at), key]);
  return null;
}

export interface MarkerElementProps { name: string; at: TimelinePosition; color?: string; payload?: unknown; }
/** A named position on the nearest `<Sequence>`/`<Transport>` root. Renders nothing. */
export function Marker({ name, at, color, payload }: MarkerElementProps): null {
  const parent = requireSequence('Marker');
  const id = useId();
  useLayoutEffect(() => {
    parent.registerMarker(id, { name, at, options: { color, payload } });
    return () => parent.unregisterMarker(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parent, id, name, stableKey(at), color, stableKey(payload)]);
  return null;
}

export interface CueElementProps extends CueOptions { name: string; at: TimelinePosition; onFire: (e: CueEvent) => void; }
/** A named cue point: `onFire` runs (forward or backward) whenever the playhead crosses `at`. Renders nothing. */
export function Cue({ name, at, onFire, payload, once }: CueElementProps): null {
  const parent = requireSequence('Cue');
  const id = useId();
  const handlerRef = useRef(onFire); handlerRef.current = onFire;
  const stableHandler = useRef((e: CueEvent) => handlerRef.current(e)).current;
  useLayoutEffect(() => {
    parent.registerCue(id, { name, at, handler: stableHandler, options: { payload, once } });
    return () => parent.unregisterCue(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parent, id, name, stableKey(at), stableKey(payload), once]);
  return null;
}

export interface RegionElementProps extends Omit<CueOptions, 'onEnter' | 'onExit'> {
  name: string; from: TimelinePosition; to: TimelinePosition;
  onEnter?: (e: CueEvent) => void; onExit?: (e: CueEvent) => void;
}
/** A named span: `onEnter`/`onExit` run at its two boundaries, in either direction. Renders nothing. */
export function Region({ name, from, to, onEnter, onExit, payload, once }: RegionElementProps): null {
  const parent = requireSequence('Region');
  const id = useId();
  const enterRef = useRef(onEnter); enterRef.current = onEnter;
  const exitRef = useRef(onExit); exitRef.current = onExit;
  const stableEnter = useRef((e: CueEvent) => enterRef.current?.(e)).current;
  const stableExit = useRef((e: CueEvent) => exitRef.current?.(e)).current;
  useLayoutEffect(() => {
    parent.registerRegion(id, { name, from, to, options: { payload, once, onEnter: stableEnter, onExit: stableExit } });
    return () => parent.unregisterRegion(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parent, id, name, stableKey(from), stableKey(to), stableKey(payload), once]);
  return null;
}

export interface SequenceProps {
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
export function Sequence({ name, at, repeat, repeatDelay, yoyo, frameRate, snap, onComplete, children }: SequenceProps): React.ReactElement {
  const parent = requireSequence('Sequence');
  const id = useId();
  const timelineRef = useRef<Timeline | null>(null);
  if (!timelineRef.current) timelineRef.current = new Timeline({ name, repeat, repeatDelay, yoyo, frameRate, snap, onComplete });
  const timeline = timelineRef.current;
  const valueRef = useRef<SequenceContextValue | null>(null);
  if (!valueRef.current) valueRef.current = createSequenceValue(timeline, () => parent.invalidate());

  useLayoutEffect(() => {
    parent.register(id, timeline, at);
    return () => parent.unregister(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parent, id, stableKey(at)]);

  return <SequenceContext.Provider value={valueRef.current}>{children}</SequenceContext.Provider>;
}

// ---- scene state hook -------------------------------------------------------

type SceneTargets = Record<string, MotionValue<any> | ((value: any) => void)>;

/** A React-visible copy of a set of `MotionValue`/setter targets, plus a setter that writes them back (optionally as a `transition`). */
export function useSceneState(targets: SceneTargets): [SceneState, (next: SceneState, transition?: ApplySceneOptions['transition']) => void] {
  const [state, setState] = useState<SceneState>(() => captureScene(targets));
  const targetsRef = useRef(targets); targetsRef.current = targets;
  const set = (next: SceneState, transition?: ApplySceneOptions['transition']) => {
    applyScene(next, targetsRef.current, transition ? { transition } : undefined);
    setState((prev) => ({ ...prev, ...next }));
  };
  return [state, set];
}
