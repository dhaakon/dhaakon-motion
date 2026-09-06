import { MotionValue, InertiaItem, clampWithRubberband, snapTo, scheduler, frameToMs, parseTime,
  type InertiaOptions, type PhysicsSpringOptions, type TimeInput, type Transport,
} from '@dhaakon/motion';
import { GestureArena } from './arena';
import { installDragKeyboard } from './keyboard';
import { createPointerSession, type SessionOptions } from './pointer';
import { hoverRecognizer, panRecognizer, pressRecognizer, type GestureEvent } from './recognizers';

type Axis = 'x' | 'y' | 'any' | 'lock';
type Bounds = { min?: number; max?: number } | { x?: [number, number]; y?: [number, number] };
export interface DragOptions {
  axis?: Axis; bounds?: Bounds | Element | (() => Bounds); elastic?: number | false;
  momentum?: boolean | InertiaOptions<number>; snap?: number[] | { step: number; offset?: number } | ((projected: number) => number);
  snapTransition?: PhysicsSpringOptions<number>; threshold?: number; propagate?: boolean; capture?: boolean; touchAction?: SessionOptions['touchAction']; immediate?: boolean; predict?: boolean; cursor?: boolean; keyboard?: boolean; step?: number; ariaLabel?: string;
  /** Start when the draggable itself receives pointerdown. Set false for a separate handle. */
  dragListener?: boolean;
  cues?: { at: number | number[]; name: string }[];
  onStart?(event: GestureEvent<'pan'>): void; onMove?(event: GestureEvent<'pan'>): void;
  onEnd?(event: GestureEvent<'pan'>, outcome: { settled: Promise<unknown>; target: number }): void;
}
export interface DragControls { dispose(): void; start(nativeEvent: PointerEvent): void; cancel(): void; isDragging: MotionValue<boolean> }

function reduced() { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; }
function isMotionValue(value: unknown): value is MotionValue<number> {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MotionValue<number>>;
  return typeof candidate.get === 'function' && typeof candidate.set === 'function' && typeof candidate.subscribe === 'function'
    && typeof candidate.stop === 'function' && typeof candidate.spring === 'function' && typeof candidate.decay === 'function';
}
function numericBounds(bounds: DragOptions['bounds'], element: Element, axis: 'x' | 'y'): [number, number] {
  const resolved = typeof bounds === 'function' ? bounds() : bounds;
  if (!resolved) return [-Infinity, Infinity];
  if (resolved instanceof Element) {
    const container = resolved.getBoundingClientRect(); const item = element.getBoundingClientRect();
    return axis === 'x' ? [container.left - item.left, container.right - item.right] : [container.top - item.top, container.bottom - item.bottom];
  }
  if ('min' in resolved || 'max' in resolved) return [resolved.min ?? -Infinity, resolved.max ?? Infinity];
  return (resolved as { x?: [number, number]; y?: [number, number] })[axis] ?? [-Infinity, Infinity];
}
function cueThresholds(options: DragOptions) { return (options.cues ?? []).flatMap((cue) => (Array.isArray(cue.at) ? cue.at : [cue.at]).map((at) => ({ at, name: cue.name }))); }

export function drag(target: MotionValue<number> | { x: MotionValue<number>; y: MotionValue<number> }, element: Element, options: DragOptions = {}): DragControls {
  const scalarTarget = isMotionValue(target) ? target : undefined;
  const axesTarget = scalarTarget ? undefined : target as { x: MotionValue<number>; y: MotionValue<number> };
  const axis = options.axis ?? (scalarTarget ? 'x' : 'any'); const pan = panRecognizer({ axis, threshold: options.threshold, propagate: options.propagate });
  const arena = new GestureArena(element, [pan], { listen: options.dragListener, capture: options.capture, touchAction: options.touchAction ?? (axis === 'x' ? 'pan-y' : axis === 'y' ? 'pan-x' : 'none'), predict: options.predict });
  const isDragging = new MotionValue<boolean>(false); const values: Partial<Record<'x' | 'y', MotionValue<number>>> = scalarTarget ? { [axis === 'y' ? 'y' : 'x']: scalarTarget } : axesTarget!;
  let start = { x: values.x?.get() ?? 0, y: values.y?.get() ?? 0 }; let origin = start; let bounds = { x: [-Infinity, Infinity] as [number, number], y: [-Infinity, Infinity] as [number, number] }; let pending: { x?: number; y?: number } | null = null; let removeFrame: (() => void) | undefined; let last = start;
  const flush = () => { if (!pending) return false; if (pending.x != null) values.x?.set(pending.x); if (pending.y != null) values.y?.set(pending.y); pending = null; return false; };
  const write = (next: { x?: number; y?: number }) => { pending = { ...pending, ...next }; if (options.immediate) flush(); else if (!removeFrame) removeFrame = scheduler.add(() => { removeFrame = undefined; return flush(); }); };
  const crossCues = (previous: number, current: number) => { for (const cue of cueThresholds(options)) if ((previous < cue.at && current >= cue.at) || (previous > cue.at && current <= cue.at)) element.dispatchEvent(new CustomEvent('dhaakon-motion:cue', { detail: { ...cue, direction: current >= previous ? 1 : -1 } })); };
  const settleAxis = (key: 'x' | 'y', velocity: number): { target: number; settled: Promise<unknown> } => {
    const value = values[key]; if (!value) return { target: 0, settled: Promise.resolve() };
    const [min, max] = bounds[key]; const noMotion = reduced(); const momentum = noMotion ? false : options.momentum ?? true;
    const projectedTarget = options.snap ? snapTo(options.snap, value.get(), velocity, typeof momentum === 'object' ? momentum.timeConstant : undefined) : Math.max(min, Math.min(max, value.get()));
    if (options.snap || value.get() < min || value.get() > max) {
      const target_ = Math.max(min, Math.min(max, projectedTarget)); if (noMotion) { value.set(target_); return { target: target_, settled: Promise.resolve() }; }
      const spring = value.spring(target_, options.snapTransition); return { target: target_, settled: spring.finished };
    }
    if (momentum) { const item = value.decay({ ...(typeof momentum === 'object' ? momentum : {}), velocity, min, max }); return { target: item.target as number, settled: item.finished }; }
    return { target: value.get(), settled: Promise.resolve() };
  };
  const unsubscribe = pan.subscribe((event) => {
    if (event.phase === 'began') {
      values.x?.stop(); values.y?.stop(); start = { x: values.x?.get() ?? 0, y: values.y?.get() ?? 0 }; origin = start; last = start;
      bounds = { x: numericBounds(options.bounds, element, 'x'), y: numericBounds(options.bounds, element, 'y') }; isDragging.set(true); if (options.cursor) (element as HTMLElement).style.cursor = 'grabbing'; options.onStart?.(event);
    }
    if (event.phase === 'began' || event.phase === 'changed') {
      const next: { x?: number; y?: number } = {};
      if (values.x) next.x = clampWithRubberband(start.x + event.offset.x, ...bounds.x, reduced() ? false : options.elastic ?? .55, Math.max(1, (element as HTMLElement).offsetWidth || 300));
      if (values.y) next.y = clampWithRubberband(start.y + event.offset.y, ...bounds.y, reduced() ? false : options.elastic ?? .55, Math.max(1, (element as HTMLElement).offsetHeight || 300));
      if (next.x != null) crossCues(last.x, next.x); if (next.y != null) crossCues(last.y, next.y); last = { x: next.x ?? last.x, y: next.y ?? last.y }; write(next); options.onMove?.(event);
    }
    if (event.phase === 'ended' || event.phase === 'cancelled') {
      flush(); isDragging.set(false); if (options.cursor) (element as HTMLElement).style.cursor = 'grab';
      if (event.phase === 'cancelled') { values.x?.spring(origin.x, options.snapTransition); values.y?.spring(origin.y, options.snapTransition); return; }
      const key: 'x' | 'y' = values.y && !values.x ? 'y' : 'x'; const outcome = settleAxis(key, event.velocity[key]); options.onEnd?.(event, outcome);
      if (values.x && values.y) settleAxis('y', event.velocity.y);
    }
  });
  if (options.cursor) (element as HTMLElement).style.cursor = 'grab';
  const oneDimensional = scalarTarget ?? (axis === 'y' ? axesTarget!.y : axesTarget!.x);
  const keyboardDispose = options.keyboard === false || !oneDimensional ? () => {} : installDragKeyboard(element, oneDimensional, { axis: axis === 'y' ? 'y' : 'x', min: numericBounds(options.bounds, element, axis === 'y' ? 'y' : 'x')[0], max: numericBounds(options.bounds, element, axis === 'y' ? 'y' : 'x')[1], step: options.step, label: options.ariaLabel, onCancel: () => { oneDimensional.spring(axis === 'y' ? origin.y : origin.x, options.snapTransition); } });
  return { isDragging, start(nativeEvent) { arena.session.start(nativeEvent); }, cancel() { arena.cancel(); values.x?.spring(origin.x, options.snapTransition); values.y?.spring(origin.y, options.snapTransition); }, dispose() { unsubscribe(); keyboardDispose(); arena.dispose(); removeFrame?.(); if (options.cursor) (element as HTMLElement).style.cursor = ''; } };
}

export interface TransformGestureOptions { scale?: MotionValue<number>; rotation?: MotionValue<number>; x?: MotionValue<number>; y?: MotionValue<number>; scaleBounds?: [number, number]; elastic?: number; momentum?: boolean; doubleTapZoom?: number | false }
export function transformGesture(element: Element, options: TransformGestureOptions) {
  const scale = options.scale ?? new MotionValue<number>(1); const rotation = options.rotation ?? new MotionValue<number>(0); const x = options.x ?? new MotionValue<number>(0); const y = options.y ?? new MotionValue<number>(0);
  let initial: { span: number; angle: number; center: { x: number; y: number }; scale: number; rotation: number; x: number; y: number } | undefined;
  const session = createPointerSession({ element, touchAction: 'none', onSample: (_sample, pointers) => { const pair = [...pointers.values()].map((history) => history.at(-1)!).filter(Boolean); if (pair.length < 2) { initial = undefined; return; } const a = pair[0]; const b = pair[1]; const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; const span = Math.hypot(b.x - a.x, b.y - a.y); const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI; if (!initial) { initial = { span, angle, center, scale: scale.get(), rotation: rotation.get(), x: x.get(), y: y.get() }; return; } const ratio = span / Math.max(1, initial.span); const nextScale = clampWithRubberband(initial.scale * ratio, ...(options.scaleBounds ?? [1, 4]), options.elastic ?? .35, 2); scale.set(nextScale); rotation.set(initial.rotation + angle - initial.angle); x.set(initial.x + center.x - initial.center.x + (1 - ratio) * (initial.center.x - element.getBoundingClientRect().left)); y.set(initial.y + center.y - initial.center.y + (1 - ratio) * (initial.center.y - element.getBoundingClientRect().top)); }, onEnd: () => { if (session.pointers.size <= 2) initial = undefined; } });
  const onWheel = (event: WheelEvent) => { event.preventDefault(); const rect = element.getBoundingClientRect(); const old = scale.get(); const next = Math.max(options.scaleBounds?.[0] ?? 1, Math.min(options.scaleBounds?.[1] ?? 4, old * Math.exp(-event.deltaY * .002))); const ratio = next / old; x.set(x.get() + (1 - ratio) * (event.clientX - rect.left)); y.set(y.get() + (1 - ratio) * (event.clientY - rect.top)); scale.set(next); };
  const onDouble = (event: MouseEvent) => { if (options.doubleTapZoom === false) return; const target = Math.abs(scale.get() - 1) < .01 ? options.doubleTapZoom ?? 2 : 1; const rect = element.getBoundingClientRect(); const ratio = target / scale.get(); x.set(x.get() + (1 - ratio) * (event.clientX - rect.left)); y.set(y.get() + (1 - ratio) * (event.clientY - rect.top)); scale.spring(target); };
  element.addEventListener('wheel', onWheel as EventListener, { passive: false }); element.addEventListener('dblclick', onDouble as EventListener);
  return { dispose() { session.dispose(); element.removeEventListener('wheel', onWheel as EventListener); element.removeEventListener('dblclick', onDouble as EventListener); } };
}

export interface ScrubOptions { axis?: 'x' | 'y'; pixelsPerFrame?: number; pixelsPerMs?: number; momentum?: boolean | InertiaOptions<number>; snapToMarkers?: boolean | { within: TimeInput }; snapToFrames?: boolean; cues?: 'fire' | 'skip'; resumeAfter?: boolean }
export function scrub(transport: Transport, element: Element, options: ScrubOptions = {}) {
  let start = transport.time; let wasPlaying = false; const axis = options.axis ?? 'x'; const playhead = new MotionValue<number>(transport.time); const dragValue = new MotionValue<number>(0);
  const control = drag(dragValue, element, { axis, momentum: false, touchAction: axis === 'x' ? 'pan-y' : 'pan-x', onStart: () => { start = transport.time; dragValue.set(0); wasPlaying = transport.state === 'playing'; transport.pause(); }, onMove: (event) => { const delta = event.offset[axis]; const ms = options.pixelsPerMs ? delta / options.pixelsPerMs : frameToMs(delta / (options.pixelsPerFrame ?? 10), transport.frameRate); playhead.set(start + ms); transport.seek(playhead.get(), { cues: options.cues }); }, onEnd: (event) => { const velocityMs = options.pixelsPerMs ? event.velocity[axis] / options.pixelsPerMs : frameToMs(event.velocity[axis] / (options.pixelsPerFrame ?? 10), transport.frameRate); const momentum = reduced() ? false : options.momentum ?? true; const finish = () => { let target = playhead.get(); if (options.snapToFrames) target = frameToMs(Math.round(target / frameToMs(1, transport.frameRate)), transport.frameRate); if (options.snapToMarkers) { const within = typeof options.snapToMarkers === 'object' ? parseTime(options.snapToMarkers.within, transport.frameRate) : Infinity; const marker = transport.root.markers.reduce<{ time: number } | undefined>((best, item) => !best || Math.abs(item.time - target) < Math.abs(best.time - target) ? item : best, undefined); if (marker && Math.abs(marker.time - target) <= within) target = marker.time; } transport.seek(target, { cues: options.cues }); if (wasPlaying && options.resumeAfter) transport.play(); };
      if (momentum) { const inertia = new InertiaItem({ ...(typeof momentum === 'object' ? momentum : {}), from: playhead.get(), velocity: velocityMs, min: 0, max: transport.duration, onUpdate: (value) => { playhead.set(value); transport.seek(value, { cues: options.cues }); }, autoplay: true }); inertia.finished.then(finish); } else finish(); } });
  return { dispose: control.dispose };
}

export function press(element: Element, options: { onChange?(pressed: boolean): void } = {}) { const recognizer = pressRecognizer(); const isPressed = new MotionValue<boolean>(false); const unsubscribe = recognizer.subscribe((event) => { const value = event.phase === 'began' || event.phase === 'changed'; isPressed.set(value); options.onChange?.(value); }); const arena = new GestureArena(element, [recognizer], { touchAction: 'manipulation' }); return { isPressed, dispose() { unsubscribe(); arena.dispose(); } }; }
export function hover(element: Element, options: { onChange?(hovered: boolean): void } = {}) { const recognizer = hoverRecognizer(); const isHovered = new MotionValue<boolean>(false); const unsubscribe = recognizer.subscribe((event) => { const value = event.phase === 'began' || event.phase === 'changed'; isHovered.set(value); options.onChange?.(value); }); const arena = new GestureArena(element, [recognizer], { touchAction: 'inherit' }); return { isHovered, dispose() { unsubscribe(); arena.dispose(); } }; }
