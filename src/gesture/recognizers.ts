import type { PointerSample, PointerType } from './pointer';
import { VelocityEstimator } from './velocity';

export type Phase = 'possible' | 'began' | 'changed' | 'ended' | 'cancelled';
export interface Point { x: number; y: number }
export interface GestureEvent<K extends string = string> {
  kind: K; phase: Phase; time: number; pointerType: PointerType;
  origin: Point; point: Point; delta: Point; offset: Point; velocity: Point; pointers: number;
  scale?: number; rotation?: number; center?: Point; inertial?: boolean; count?: number;
  native: Event; preventDefault(): void;
}
export interface RecognizerSession { pointers: ReadonlyMap<number, PointerSample[]>; }
export type ArenaVerdict = 'claim' | 'yield' | 'wait';
export interface Recognizer<K extends string = string> {
  readonly kind: K; readonly priority: number; readonly preventsScroll: boolean; readonly propagate?: boolean;
  state: Phase;
  onDown(sample: PointerSample, session: RecognizerSession): void;
  onMove(sample: PointerSample, session: RecognizerSession): ArenaVerdict;
  onUp(sample: PointerSample, session: RecognizerSession): void;
  cancel(): void;
  subscribe(listener: (event: GestureEvent<K>) => void): () => void;
  attach?(element: Element): () => void;
}

interface BaseOptions { priority?: number; preventsScroll?: boolean; propagate?: boolean }

abstract class BaseRecognizer<K extends string> implements Recognizer<K> {
  abstract readonly kind: K;
  readonly priority: number; readonly preventsScroll: boolean; readonly propagate: boolean;
  state: Phase = 'possible';
  protected listeners = new Set<(event: GestureEvent<K>) => void>();
  protected origin: Point = { x: 0, y: 0 }; protected last: Point = { x: 0, y: 0 }; protected estimator = new VelocityEstimator(); protected pointerType: PointerType = 'mouse'; protected native: Event = new Event('gesture');
  constructor(options: BaseOptions = {}) { this.priority = options.priority ?? 0; this.preventsScroll = options.preventsScroll ?? false; this.propagate = options.propagate ?? false; }
  onDown(sample: PointerSample, _session: RecognizerSession) { this.state = 'possible'; this.origin = this.last = { x: sample.x, y: sample.y }; this.pointerType = sample.type; this.native = sample.native ?? this.native; this.estimator.reset(); this.estimator.push(sample.x, sample.y, sample.t); }
  abstract onMove(sample: PointerSample, session: RecognizerSession): ArenaVerdict;
  onUp(_sample: PointerSample, _session: RecognizerSession) {}
  cancel() { if (this.state === 'began' || this.state === 'changed') this.emit(this.last, this.last, 0, 'cancelled', 1); this.state = 'cancelled'; }
  subscribe(listener: (event: GestureEvent<K>) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  protected track(sample: PointerSample) { const previous = this.last; this.last = { x: sample.x, y: sample.y }; this.native = sample.native ?? this.native; if (!sample.predicted) this.estimator.push(sample.x, sample.y, sample.t); return previous; }
  protected emit(point: Point, previous: Point, time: number, phase: Phase, pointers: number, extra: Partial<GestureEvent<K>> = {}) {
    this.state = phase; const velocity = this.estimator.velocity(time); const native = this.native;
    const event = { kind: this.kind, phase, time, pointerType: this.pointerType, origin: this.origin, point, delta: { x: point.x - previous.x, y: point.y - previous.y }, offset: { x: point.x - this.origin.x, y: point.y - this.origin.y }, velocity, pointers, native, preventDefault: () => native.preventDefault(), ...extra } as GestureEvent<K>;
    for (const listener of this.listeners) listener(event);
  }
}

export interface TapOptions extends BaseOptions { maxDuration?: number; threshold?: number; count?: number }
class TapRecognizer extends BaseRecognizer<'tap'> {
  readonly kind = 'tap' as const; private started = 0; private valid = true; private taps = 0; private lastTap = -Infinity;
  constructor(private options: TapOptions = {}) { super({ priority: options.priority ?? 20, ...options }); }
  override onDown(sample: PointerSample, session: RecognizerSession) { super.onDown(sample, session); this.started = sample.t; this.valid = true; }
  onMove(sample: PointerSample) { this.track(sample); if (Math.hypot(sample.x - this.origin.x, sample.y - this.origin.y) > (this.options.threshold ?? 10)) { this.valid = false; return 'yield' as const; } return 'wait' as const; }
  onUp(sample: PointerSample) { this.track(sample); if (!this.valid || sample.t - this.started > (this.options.maxDuration ?? 250)) { this.state = 'cancelled'; return; } this.taps = sample.t - this.lastTap <= 300 ? this.taps + 1 : 1; this.lastTap = sample.t; if (this.taps >= (this.options.count ?? 1)) { this.emit(this.last, this.last, sample.t, 'ended', 1, { count: this.taps }); this.taps = 0; } }
}

export interface LongPressOptions extends BaseOptions { duration?: number; threshold?: number }
class LongPressRecognizer extends BaseRecognizer<'longPress'> {
  readonly kind = 'longPress' as const; private timer: ReturnType<typeof setTimeout> | undefined; private sample?: PointerSample;
  constructor(private options: LongPressOptions = {}) { super({ priority: options.priority ?? 15, ...options }); }
  override onDown(sample: PointerSample, session: RecognizerSession) { super.onDown(sample, session); this.sample = sample; this.timer = setTimeout(() => { if (this.state === 'possible' && this.sample) this.emit(this.last, this.last, this.sample.t + (this.options.duration ?? 400), 'began', 1); }, this.options.duration ?? 400); }
  onMove(sample: PointerSample) { const previous = this.track(sample); if (Math.hypot(sample.x - this.origin.x, sample.y - this.origin.y) > (this.options.threshold ?? 10)) { this.clear(); return 'yield'; } if (this.state === 'began') { this.emit(this.last, previous, sample.t, 'changed', 1); return 'claim'; } return 'wait'; }
  onUp(sample: PointerSample) { this.clear(); if (this.state === 'began' || this.state === 'changed') this.emit(this.last, this.last, sample.t, 'ended', 1); else this.state = 'cancelled'; }
  override cancel() { this.clear(); super.cancel(); }
  private clear() { if (this.timer) clearTimeout(this.timer); this.timer = undefined; }
}

class PressRecognizer extends BaseRecognizer<'press'> {
  readonly kind = 'press' as const;
  constructor(options: BaseOptions = {}) { super({ priority: -10, ...options }); }
  override onDown(sample: PointerSample, session: RecognizerSession) { super.onDown(sample, session); this.emit(this.origin, this.origin, sample.t, 'began', 1); }
  onMove(sample: PointerSample) { const previous = this.track(sample); this.emit(this.last, previous, sample.t, 'changed', 1); return 'wait' as const; }
  onUp(sample: PointerSample) { this.track(sample); this.emit(this.last, this.last, sample.t, 'ended', 1); }
}

export interface PanOptions extends BaseOptions { axis?: 'x' | 'y' | 'any' | 'lock'; threshold?: number }
class PanRecognizer extends BaseRecognizer<'pan'> {
  readonly kind = 'pan' as const; private locked?: 'x' | 'y'; scrollGuard?: (event: GestureEvent<'pan'>) => boolean;
  constructor(readonly options: PanOptions = {}) { super({ priority: options.priority ?? 10, preventsScroll: options.preventsScroll ?? true, ...options }); }
  override onDown(sample: PointerSample, session: RecognizerSession) { super.onDown(sample, session); this.locked = undefined; }
  onMove(sample: PointerSample, session: RecognizerSession): ArenaVerdict {
    const previous = this.track(sample); const dx = sample.x - this.origin.x; const dy = sample.y - this.origin.y; const distance = Math.hypot(dx, dy);
    if (this.state === 'possible') {
      const threshold = this.options.threshold ?? (sample.type === 'mouse' ? 3 : 10); if (distance < threshold) return 'wait';
      const dominant = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'; const axis = this.options.axis ?? 'any';
      if ((axis === 'x' || axis === 'y') && dominant !== axis) return 'yield'; this.locked = axis === 'lock' ? dominant : axis === 'any' ? undefined : axis;
      const event = this.makeEvent(sample, previous, 'began', session.pointers.size); if (this.scrollGuard && !this.scrollGuard(event)) return 'yield'; this.dispatch(event); return 'claim';
    }
    this.emitConstrained(sample, previous, 'changed', session.pointers.size); return 'claim';
  }
  onUp(sample: PointerSample, session: RecognizerSession) { const previous = this.track(sample); if (this.state === 'began' || this.state === 'changed') this.emitConstrained(sample, previous, 'ended', session.pointers.size); else this.state = 'cancelled'; }
  private makeEvent(sample: PointerSample, previous: Point, phase: Phase, pointers: number) { let point = this.last; if (this.locked === 'x') point = { x: this.last.x, y: this.origin.y }; if (this.locked === 'y') point = { x: this.origin.x, y: this.last.y }; const velocity = this.estimator.velocity(sample.t); if (this.locked === 'x') velocity.y = 0; if (this.locked === 'y') velocity.x = 0; const native = this.native; return { kind: this.kind, phase, time: sample.t, pointerType: this.pointerType, origin: this.origin, point, delta: { x: point.x - previous.x, y: point.y - previous.y }, offset: { x: point.x - this.origin.x, y: point.y - this.origin.y }, velocity, pointers, native, preventDefault: () => native.preventDefault() } as GestureEvent<'pan'>; }
  private dispatch(event: GestureEvent<'pan'>) { this.state = event.phase; for (const listener of this.listeners) listener(event); }
  private emitConstrained(sample: PointerSample, previous: Point, phase: Phase, pointers: number) { this.dispatch(this.makeEvent(sample, previous, phase, pointers)); }
}

class SwipeRecognizer extends BaseRecognizer<'swipe'> {
  readonly kind = 'swipe' as const;
  constructor(private options: PanOptions & { minSpeed?: number; minDistance?: number } = {}) { super({ priority: options.priority ?? 11, ...options }); }
  onMove(sample: PointerSample) { this.track(sample); return Math.hypot(sample.x - this.origin.x, sample.y - this.origin.y) >= (this.options.threshold ?? 10) ? 'claim' : 'wait'; }
  onUp(sample: PointerSample) { this.track(sample); const velocity = this.estimator.velocity(sample.t); const distance = Math.hypot(sample.x - this.origin.x, sample.y - this.origin.y); if (Math.hypot(velocity.x, velocity.y) >= (this.options.minSpeed ?? .5) && distance >= (this.options.minDistance ?? 30)) this.emit(this.last, this.last, sample.t, 'ended', 1); else this.state = 'cancelled'; }
}

abstract class MultiRecognizer<K extends 'pinch' | 'rotate'> extends BaseRecognizer<K> {
  protected initialSpan = 0; protected initialAngle = 0; protected lastScale = 1; protected lastRotation = 0;
  override onDown(sample: PointerSample, session: RecognizerSession) { super.onDown(sample, session); const pair = latestPair(session.pointers); if (pair) { this.initialSpan = span(pair); this.initialAngle = angle(pair); this.origin = center(pair); } }
  protected pair(session: RecognizerSession) { return latestPair(session.pointers); }
}
class PinchRecognizer extends MultiRecognizer<'pinch'> {
  readonly kind = 'pinch' as const; constructor(options: BaseOptions & { threshold?: number } = {}) { super({ priority: options.priority ?? 30, preventsScroll: true, ...options }); this.options = options; } private options: { threshold?: number };
  onMove(sample: PointerSample, session: RecognizerSession) { this.track(sample); const pair = this.pair(session); if (!pair || !this.initialSpan) return 'wait'; const current = span(pair); const scale = current / this.initialSpan; if (this.state === 'possible' && Math.abs(current - this.initialSpan) < (this.options.threshold ?? 5)) return 'wait'; const c = center(pair); this.emit(c, this.last, sample.t, this.state === 'possible' ? 'began' : 'changed', 2, { scale, center: c }); this.lastScale = scale; return 'claim'; }
  onUp(sample: PointerSample) { if (this.state === 'began' || this.state === 'changed') this.emit(this.last, this.last, sample.t, 'ended', 1, { scale: this.lastScale }); }
}
class RotateRecognizer extends MultiRecognizer<'rotate'> {
  readonly kind = 'rotate' as const; constructor(options: BaseOptions & { threshold?: number } = {}) { super({ priority: options.priority ?? 29, preventsScroll: true, ...options }); this.options = options; } private options: { threshold?: number };
  onMove(sample: PointerSample, session: RecognizerSession) { this.track(sample); const pair = this.pair(session); if (!pair) return 'wait'; const rotation = (angle(pair) - this.initialAngle) * 180 / Math.PI; if (this.state === 'possible' && Math.abs(rotation) < (this.options.threshold ?? 5)) return 'wait'; const c = center(pair); this.emit(c, this.last, sample.t, this.state === 'possible' ? 'began' : 'changed', 2, { rotation, center: c }); this.lastRotation = rotation; return 'claim'; }
  onUp(sample: PointerSample) { if (this.state === 'began' || this.state === 'changed') this.emit(this.last, this.last, sample.t, 'ended', 1, { rotation: this.lastRotation }); }
}

class HoverRecognizer extends BaseRecognizer<'hover'> {
  readonly kind = 'hover' as const; constructor(options: BaseOptions = {}) { super(options); }
  onMove() { return 'wait' as const; }
  attach(element: Element) { const enter = (native: PointerEvent) => { if (native.pointerType === 'touch') return; this.native = native; this.pointerType = native.pointerType as PointerType; this.origin = this.last = { x: native.clientX, y: native.clientY }; this.emit(this.last, this.last, native.timeStamp, 'began', 1); }; const leave = (native: PointerEvent) => { if (native.pointerType === 'touch') return; this.native = native; this.emit(this.last, this.last, native.timeStamp, 'ended', 0); }; element.addEventListener('pointerenter', enter as EventListener); element.addEventListener('pointerleave', leave as EventListener); return () => { element.removeEventListener('pointerenter', enter as EventListener); element.removeEventListener('pointerleave', leave as EventListener); }; }
}

class WheelRecognizer extends BaseRecognizer<'wheel'> {
  readonly kind = 'wheel' as const; private timer?: ReturnType<typeof setTimeout>; private previousMagnitude = Infinity; private active = false;
  constructor(options: BaseOptions = {}) { super(options); }
  onMove() { return 'wait' as const; }
  attach(element: Element) { const listener = (native: WheelEvent) => { const factor = native.deltaMode === 1 ? 16 : native.deltaMode === 2 ? globalThis.innerHeight || 800 : 1; const point = { x: native.clientX, y: native.clientY }; const magnitude = Math.hypot(native.deltaX, native.deltaY); const inertial = this.active && magnitude < this.previousMagnitude * .92; this.native = native; this.pointerType = 'mouse'; this.origin = this.active ? this.origin : point; this.last = point; this.emit(point, { x: point.x - native.deltaX * factor, y: point.y - native.deltaY * factor }, native.timeStamp, this.active ? 'changed' : 'began', 0, { inertial }); this.active = true; this.previousMagnitude = magnitude; if (this.timer) clearTimeout(this.timer); this.timer = setTimeout(() => { this.emit(this.last, this.last, native.timeStamp + 150, 'ended', 0, { inertial }); this.active = false; this.previousMagnitude = Infinity; }, 150); }; element.addEventListener('wheel', listener as EventListener, { passive: false }); return () => { element.removeEventListener('wheel', listener as EventListener); if (this.timer) clearTimeout(this.timer); }; }
}

function latestPair(pointers: ReadonlyMap<number, PointerSample[]>): [PointerSample, PointerSample] | undefined { const values = [...pointers.values()].map((history) => history.at(-1)!).filter(Boolean); return values.length >= 2 ? [values[0], values[1]] : undefined; }
function span([a, b]: [PointerSample, PointerSample]) { return Math.hypot(b.x - a.x, b.y - a.y); }
function angle([a, b]: [PointerSample, PointerSample]) { return Math.atan2(b.y - a.y, b.x - a.x); }
function center([a, b]: [PointerSample, PointerSample]) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

export const tapRecognizer = (options?: TapOptions): Recognizer<'tap'> => new TapRecognizer(options);
export const longPressRecognizer = (options?: LongPressOptions): Recognizer<'longPress'> => new LongPressRecognizer(options);
export const pressRecognizer = (options?: BaseOptions): Recognizer<'press'> => new PressRecognizer(options);
export const panRecognizer = (options?: PanOptions): Recognizer<'pan'> => new PanRecognizer(options);
export const swipeRecognizer = (options?: PanOptions & { minSpeed?: number; minDistance?: number }): Recognizer<'swipe'> => new SwipeRecognizer(options);
export const pinchRecognizer = (options?: BaseOptions & { threshold?: number }): Recognizer<'pinch'> => new PinchRecognizer(options);
export const rotateRecognizer = (options?: BaseOptions & { threshold?: number }): Recognizer<'rotate'> => new RotateRecognizer(options);
export const hoverRecognizer = (options?: BaseOptions): Recognizer<'hover'> => new HoverRecognizer(options);
export const wheelRecognizer = (options?: BaseOptions): Recognizer<'wheel'> => new WheelRecognizer(options);
