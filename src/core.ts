import { type EasingFunction, type EasingInput, type EasingName, resolveEasing } from './easing';
import { interpolate, type MotionValueShape } from './interpolate';
import { scheduler, type FrameScheduler, type FrameTask } from './scheduler';
import { sampleCycle, type Direction } from './cycle';
import type { RenderContext, TimelineItem } from './items';
import { frameRate, msToFrame, parseTime, type FrameRate, type FrameRateInput, type TimeInput } from './time';
import { msToTimecode, type Timecode } from './timecode';
import { Track } from './track';
import { InertiaItem, SpringItem, type InertiaOptions, type PhysicsSpringOptions } from './physics';

export type TweenState = 'idle' | 'delayed' | 'running' | 'paused' | 'finished' | 'cancelled';
export interface PropertyRange { start: number; end: number; unit?: string; }
export interface TweenOptions<T extends MotionValueShape = number> {
  name?: string;
  from?: T; to?: T; curve?: [T, T] | Line; properties?: Record<string, PropertyRange>; node?: HTMLElement | null;
  /** Milliseconds, seconds (`'1.5s'`), frames (`'36f'`), or SMPTE timecode. Frame forms inherit their parent Transport/Timeline rate unless `frameRate` is explicit. */
  duration?: TimeInput; delay?: TimeInput; repeat?: number; repeatDelay?: TimeInput; yoyo?: boolean; direction?: Direction;
  frameRate?: FrameRateInput;
  easing?: EasingInput | EasingName; ease?: EasingInput | EasingName; autoplay?: boolean;
  onBegin?: (tween: Tween<T>) => void; onStart?: (tween: Tween<T>) => void;
  onUpdate?: (value: T, progress: number, tween: Tween<T>) => void;
  onEnd?: (tween: Tween<T>) => void; onComplete?: (tween: Tween<T>) => void;
  scheduler?: FrameScheduler;
}

export class Line {
  readonly curves: [number[], number[]];
  constructor(start: number[], end: number[]) {
    if (start.length !== end.length) throw new Error(`Uneven amount of lines: ${start.length} != ${end.length}`);
    this.curves = [start.slice(), end.slice()];
  }
  value(progress: number) { return interpolate(this.curves[0], this.curves[1], progress); }
}

export class Tween<T extends MotionValueShape = number> implements TimelineItem {
  static Line = Line;
  readonly kind = 'tween' as const;
  name?: string;
  duration = 300; delay = 0; repeat = 0; repeatDelay = 0; direction: Direction = 'normal';
  state: TweenState = 'idle'; isAnimating = false; isPaused = false; isReversed = false;
  node: HTMLElement | null = null; properties?: Record<string, PropertyRange>;
  from: T = 0 as T; toValue: T = 1 as T; easing: EasingFunction = resolveEasing();
  onBegin?: TweenOptions<T>['onBegin']; onStart?: TweenOptions<T>['onStart']; onUpdate?: TweenOptions<T>['onUpdate'];
  onEnd?: TweenOptions<T>['onEnd']; onComplete?: TweenOptions<T>['onComplete'];
  value: T = this.from; progress = 0; elapsed = 0;
  private sampledTime = 0;
  private durationInput: TimeInput = 300;
  private delayInput: TimeInput = 0;
  private repeatDelayInput: TimeInput = 0;
  private explicitRateInput?: FrameRateInput;
  private inheritedRateInput?: FrameRateInput;
  private frameLoop: FrameScheduler = scheduler; private startedAt = 0; private removeFrame?: () => void;
  private resolveFinished!: (tween: this) => void; finished: Promise<this>;

  constructor(options: TweenOptions<T> = {}) {
    this.finished = this.newFinishedPromise(); this.configure(options);
    if (options.autoplay) queueMicrotask(() => this.play());
  }

  configure(options: TweenOptions<T>) {
    const timingKeys = new Set(['duration', 'delay', 'repeatDelay', 'frameRate']);
    for (const [key, value] of Object.entries(options)) if (value !== undefined && !timingKeys.has(key)) (this as any)[key] = value;
    if (options.duration !== undefined) this.durationInput = options.duration;
    if (options.delay !== undefined) this.delayInput = options.delay;
    if (options.repeatDelay !== undefined) this.repeatDelayInput = options.repeatDelay;
    if (options.frameRate !== undefined) this.explicitRateInput = options.frameRate;
    this.resolveTiming();
    if (options.scheduler) this.frameLoop = options.scheduler;
    if (options.ease || options.easing) this.easing = resolveEasing(options.ease ?? options.easing);
    if (options.yoyo) this.direction = 'alternate';
    if (options.curve instanceof Line) { this.from = options.curve.curves[0] as T; this.toValue = options.curve.curves[1] as T; }
    else if (options.curve) [this.from, this.toValue] = options.curve;
    if (options.from !== undefined) this.from = options.from;
    if (options.to !== undefined) this.toValue = options.to;
    if (options.properties) {
      this.properties = options.properties;
      this.from = Object.fromEntries(Object.entries(options.properties).map(([key, range]) => [key, range.start])) as T;
      this.toValue = Object.fromEntries(Object.entries(options.properties).map(([key, range]) => [key, range.end])) as T;
    }
    this.value = this.from; return this;
  }

  to(options: TweenOptions<T>) { this.stop(); return this.configure(options); }
  play(options?: TweenOptions<T>) {
    if (options) this.configure(options);
    if (this.isAnimating) return this;
    if (this.state === 'finished' || this.state === 'cancelled') { this.elapsed = 0; this.finished = this.newFinishedPromise(); }
    this.isAnimating = true; this.isPaused = false; this.state = this.elapsed < this.delay ? 'delayed' : 'running';
    this.startedAt = this.frameLoop.now() - this.elapsed;
    if (this.elapsed === 0) { this.onBegin?.(this); this.onStart?.(this); }
    this.removeFrame = this.frameLoop.add(this.advance); return this;
  }
  pause() { if (!this.isAnimating) return this; this.removeFrame?.(); this.isAnimating = false; this.isPaused = true; this.state = 'paused'; return this; }
  stop() { this.removeFrame?.(); this.isAnimating = false; this.isPaused = false; this.state = 'idle'; this.elapsed = 0; this.sampleAt(0); return this; }
  cancel() { this.removeFrame?.(); this.isAnimating = false; this.isPaused = false; this.state = 'cancelled'; this.resolveFinished(this); return this; }
  reverse() {
    const active = Math.max(0, this.elapsed - this.delay); this.isReversed = !this.isReversed;
    if (this.repeat === Infinity) {
      const cycleDuration = this.duration + this.repeatDelay;
      const iteration = cycleDuration > 0 ? Math.floor(active / cycleDuration) : 0;
      const cycleTime = Math.min(this.duration, Math.max(0, active - iteration * cycleDuration));
      this.elapsed = this.delay + iteration * cycleDuration + Math.max(0, this.duration - cycleTime);
    } else this.elapsed = this.delay + Math.max(0, this.activeDuration - active);
    if (this.isAnimating) this.startedAt = this.frameLoop.now() - this.elapsed;
    this.sampleAt(this.elapsed); return this;
  }
  seek(progress: number) {
    const seekDuration = this.repeat === Infinity ? this.duration : this.activeDuration;
    return this.seekTime(this.delay + Math.max(0, Math.min(1, progress)) * seekDuration);
  }
  seekTime(milliseconds: number) {
    if (!Number.isFinite(milliseconds)) return this;
    this.elapsed = Math.max(0, Math.min(this.totalDuration, milliseconds)); this.sampleAt(this.elapsed); if (this.isAnimating) this.startedAt = this.frameLoop.now() - this.elapsed; return this;
  }
  setDuration(duration: TimeInput, rate?: FrameRateInput) {
    this.durationInput = duration;
    if (rate !== undefined) this.explicitRateInput = rate;
    this.resolveTiming();
    return this;
  }
  /** Effective timebase for authored frame/SMPTE fields. A standalone `;` timecode provisionally implies 29.97df until attached. */
  get frameRate(): FrameRate {
    const authored = [this.durationInput, this.delayInput, this.repeatDelayInput];
    const provisional = authored.some((input) => typeof input === 'string' && input.includes(';')) ? '29.97df' : 60;
    return frameRate(this.explicitRateInput ?? this.inheritedRateInput ?? provisional);
  }
  /** Called by Timeline/Transport attachment. An explicit `frameRate` option is never overwritten. */
  bindFrameRate(rate: FrameRateInput) { this.inheritedRateInput = rate; this.resolveTiming(); }
  /** The frame index the tween's active time falls in, at `rate` (default 60 fps). Floor-based: matches which frame is on screen. */
  frameAt(rate: FrameRateInput = 60) { return msToFrame(Math.max(0, this.elapsed - this.delay), frameRate(rate)); }
  /** The SMPTE timecode for the tween's active time, at `rate`. */
  timecodeAt(rate: FrameRateInput): Timecode { return msToTimecode(Math.max(0, this.elapsed - this.delay), frameRate(rate)); }
  getCurrentFrame(fps = 60) { return this.frameAt(fps); }
  /** Derivative for increasing sampled local time, in units/ms; stationary phases return zero. */
  instantaneousVelocity(): T | number {
    if (!(this.duration > 0) || !Number.isFinite(this.duration) || this.sampledTime < this.delay || this.sampledTime >= this.totalDuration) return 0;
    const { active, iteration } = sampleCycle(
      { duration: this.duration, delay: this.delay, repeat: this.repeat, repeatDelay: this.repeatDelay, direction: this.direction, reversed: this.isReversed },
      this.sampledTime,
    );
    if (active - iteration * (this.duration + this.repeatDelay) >= this.duration) return 0;
    const alternating = this.direction === 'alternate' || this.direction === 'alternate-reverse';
    const startsReverse = this.direction === 'reverse' || this.direction === 'alternate-reverse';
    const reversed = startsReverse !== (alternating && iteration % 2 === 1) !== this.isReversed;
    const epsilon = 1e-4;
    const before = this.easing(Math.max(0, this.progress - epsilon));
    const after = this.easing(Math.min(1, this.progress + epsilon));
    const span = Math.min(1, this.progress + epsilon) - Math.max(0, this.progress - epsilon);
    const slope = span > 0 ? (after - before) / span : 0;
    return scaleVelocity(velocityBetween(this.from, this.toValue, this.duration), reversed ? -slope : slope) as T | number;
  }
  /**
   * A two-keyframe `Track` equivalent to this tween's `from`/`to`/`duration`/`easing`/`repeat`/`repeatDelay`/`direction`.
   * Its `apply` forwards sampled values to this tween's own `onUpdate` (progress is not recomputed — read `value` from the callback).
   */
  toTrack() {
    return new Track<T>({
      name: this.name,
      keyframes: [{ at: this.delay, value: this.from }, { at: this.delay + this.duration, value: this.toValue, easing: this.easing }],
      repeat: this.repeat, repeatDelay: this.repeatDelay, direction: this.direction,
      apply: (value) => { this.value = value; this.onUpdate?.(value, this.progress, this); },
    });
  }
  get activeDuration() { return this.repeat === Infinity ? Infinity : this.duration * (this.repeat + 1) + this.repeatDelay * this.repeat; }
  get totalDuration() { return this.delay + this.activeDuration; }

  sampleAt(milliseconds: number, _ctx?: RenderContext) {
    this.sampledTime = milliseconds;
    const { progress } = sampleCycle(
      { duration: this.duration, delay: this.delay, repeat: this.repeat, repeatDelay: this.repeatDelay, direction: this.direction, reversed: this.isReversed },
      milliseconds,
    );
    this.progress = progress;
    this.value = interpolate(this.from, this.toValue, this.easing(this.progress));
    if (this.node && this.properties && typeof this.value === 'object' && !Array.isArray(this.value)) {
      for (const [key, value] of Object.entries(this.value)) this.node.style.setProperty(key, `${value}${this.properties[key]?.unit ?? ''}`);
    }
    this.onUpdate?.(this.value, this.progress, this);
    return this.value;
  }

  private advance: FrameTask = (time) => {
    this.elapsed = Math.min(this.totalDuration, Math.max(0, time - this.startedAt));
    this.state = this.elapsed < this.delay ? 'delayed' : 'running'; this.sampleAt(this.elapsed);
    if (this.elapsed < this.totalDuration) return true;
    this.isAnimating = false; this.isPaused = false; this.state = 'finished';
    this.onEnd?.(this); this.onComplete?.(this); this.resolveFinished(this); return false;
  };
  private resolveTiming() {
    const rate = this.frameRate;
    this.duration = Math.max(0, parseTime(this.durationInput, rate));
    this.delay = Math.max(0, parseTime(this.delayInput, rate));
    this.repeatDelay = Math.max(0, parseTime(this.repeatDelayInput, rate));
  }
  private newFinishedPromise() { return new Promise<this>((resolve) => { this.resolveFinished = resolve; }); }
}

export class MotionValue<T extends MotionValueShape> {
  private listeners = new Set<() => void>(); private animation?: { cancel(): unknown };
  private previous: T; private previousAt: number; private explicitVelocity?: T | number;
  private updatedAtValue: number;
  constructor(private current: T) { this.previous = current; this.updatedAtValue = scheduler.now(); this.previousAt = this.updatedAtValue; }
  get() { return this.current; }
  get updatedAt() { return this.updatedAtValue; }
  get velocity(): T | number {
    if (this.explicitVelocity !== undefined) return this.explicitVelocity;
    const elapsed = this.updatedAt - this.previousAt;
    if (elapsed <= 0 || elapsed > 50) return 0;
    return velocityBetween(this.previous, this.current, elapsed) as T | number;
  }
  set(value: T, time = scheduler.now()) {
    const changed = !Object.is(value, this.current);
    this.previous = this.current; this.previousAt = this.updatedAt; this.current = value;
    this.updatedAtValue = time;
    this.explicitVelocity = undefined;
    if (changed) for (const listener of this.listeners) listener();
  }
  setWithVelocity(value: T, velocity: T | number, time = scheduler.now()) {
    const changed = !Object.is(value, this.current);
    this.previous = this.current; this.previousAt = this.updatedAt; this.current = value;
    this.updatedAtValue = time;
    this.explicitVelocity = velocity;
    if (changed) for (const listener of this.listeners) listener();
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  animate(to: T, options: Omit<TweenOptions<T>, 'from' | 'to' | 'onUpdate'> = {}): Tween<T> { this.stop(); const tween = new Tween({ ...options, from: this.current, to, onUpdate: (value, _progress, active) => this.setWithVelocity(value, active.instantaneousVelocity(), active.elapsed) }).play(); this.animation = tween; return tween; }
  spring(to: T, options: PhysicsSpringOptions<T> = {}) { this.stop(); const item = new SpringItem<T>({ ...options, from: this.current, to, velocity: options.velocity ?? this.velocity, onUpdate: (value, velocity, time) => this.setWithVelocity(value, velocity, time), autoplay: true }); this.animation = item; return item; }
  decay(options: InertiaOptions<T> = {}) { this.stop(); const item = new InertiaItem<T>({ ...options, from: this.current, velocity: options.velocity ?? this.velocity, onUpdate: (value, velocity, time) => this.setWithVelocity(value, velocity, time), autoplay: true }); this.animation = item; return item; }
  stop() { this.animation?.cancel(); this.animation = undefined; }
}

function velocityBetween(from: MotionValueShape, to: MotionValueShape, milliseconds: number): MotionValueShape | number {
  if (typeof from === 'number' && typeof to === 'number') return (to - from) / milliseconds;
  if (Array.isArray(from) && Array.isArray(to)) return from.map((value, index) => velocityBetween(value, to[index] ?? value, milliseconds)) as MotionValueShape;
  if (from && to && typeof from === 'object' && typeof to === 'object') {
    const output: Record<string, MotionValueShape> = {};
    for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
      const a = (from as Record<string, MotionValueShape | undefined>)[key]; const b = (to as Record<string, MotionValueShape | undefined>)[key];
      output[key] = a == null || b == null ? 0 : velocityBetween(a, b, milliseconds) as MotionValueShape;
    }
    return output;
  }
  return 0;
}

function scaleVelocity(value: MotionValueShape | number, scale: number): MotionValueShape | number {
  if (typeof value === 'number') return value * scale;
  if (Array.isArray(value)) return value.map((entry) => scaleVelocity(entry, scale)) as MotionValueShape;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, scaleVelocity(entry!, scale)])) as MotionValueShape;
  return 0;
}

export function animate<T extends MotionValueShape>(from: T, to: T, options: Omit<TweenOptions<T>, 'from' | 'to'> = {}) { return new Tween({ ...options, from, to }).play(); }
export function stagger(interval = 60, { start = 0 } = {}) { return (index: number) => start + index * interval; }
