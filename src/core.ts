import { type EasingFunction, type EasingName, resolveEasing } from './easing';
import { interpolate, type MotionValueShape } from './interpolate';
import { scheduler, type FrameScheduler, type FrameTask } from './scheduler';

export type TweenState = 'idle' | 'delayed' | 'running' | 'paused' | 'finished' | 'cancelled';
export type Direction = 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
export interface PropertyRange { start: number; end: number; unit?: string; }
export interface TweenOptions<T extends MotionValueShape = number> {
  from?: T; to?: T; curve?: [T, T] | Line; properties?: Record<string, PropertyRange>; node?: HTMLElement | null;
  duration?: number; delay?: number; repeat?: number; repeatDelay?: number; yoyo?: boolean; direction?: Direction;
  easing?: EasingFunction | EasingName; ease?: EasingFunction | EasingName; autoplay?: boolean;
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

export class Tween<T extends MotionValueShape = number> {
  static Line = Line;
  duration = 300; delay = 0; repeat = 0; repeatDelay = 0; direction: Direction = 'normal';
  state: TweenState = 'idle'; isAnimating = false; isPaused = false; isReversed = false;
  node: HTMLElement | null = null; properties?: Record<string, PropertyRange>;
  from: T = 0 as T; toValue: T = 1 as T; easing: EasingFunction = resolveEasing();
  onBegin?: TweenOptions<T>['onBegin']; onStart?: TweenOptions<T>['onStart']; onUpdate?: TweenOptions<T>['onUpdate'];
  onEnd?: TweenOptions<T>['onEnd']; onComplete?: TweenOptions<T>['onComplete'];
  value: T = this.from; progress = 0; elapsed = 0;
  private frameLoop: FrameScheduler = scheduler; private startedAt = 0; private removeFrame?: () => void;
  private resolveFinished!: (tween: this) => void; finished: Promise<this>;

  constructor(options: TweenOptions<T> = {}) {
    this.finished = this.newFinishedPromise(); this.configure(options);
    if (options.autoplay) queueMicrotask(() => this.play());
  }

  configure(options: TweenOptions<T>) {
    for (const [key, value] of Object.entries(options)) if (value !== undefined) (this as any)[key] = value;
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
    this.elapsed = this.delay + Math.max(0, this.activeDuration - active);
    if (this.isAnimating) this.startedAt = this.frameLoop.now() - this.elapsed;
    this.sampleAt(this.elapsed); return this;
  }
  seek(progress: number) { return this.seekTime(this.delay + Math.max(0, Math.min(1, progress)) * this.activeDuration); }
  seekTime(milliseconds: number) { this.elapsed = Math.max(0, Math.min(this.totalDuration, milliseconds)); this.sampleAt(this.elapsed); if (this.isAnimating) this.startedAt = this.frameLoop.now() - this.elapsed; return this; }
  setDuration(duration: number) { this.duration = Math.max(0, duration); return this; }
  getCurrentFrame(fps = 60) { return Math.ceil((Math.max(0, this.elapsed - this.delay) / 1000) * fps); }
  get activeDuration() { return this.duration * (this.repeat + 1) + this.repeatDelay * this.repeat; }
  get totalDuration() { return this.delay + this.activeDuration; }

  sampleAt(milliseconds: number, notify = true) {
    const active = Math.max(0, milliseconds - this.delay);
    const cycleDuration = this.duration + this.repeatDelay;
    const iteration = this.duration === 0 ? this.repeat : Math.min(this.repeat, Math.floor(active / Math.max(1, cycleDuration)));
    const cycleTime = Math.min(this.duration, Math.max(0, active - iteration * cycleDuration));
    let raw = this.duration === 0 ? 1 : cycleTime / this.duration;
    const alternating = this.direction === 'alternate' || this.direction === 'alternate-reverse';
    const startsReverse = this.direction === 'reverse' || this.direction === 'alternate-reverse';
    if (startsReverse !== (alternating && iteration % 2 === 1) !== this.isReversed) raw = 1 - raw;
    this.progress = Math.max(0, Math.min(1, raw));
    this.value = interpolate(this.from, this.toValue, this.easing(this.progress));
    if (this.node && this.properties && typeof this.value === 'object' && !Array.isArray(this.value)) {
      for (const [key, value] of Object.entries(this.value)) this.node.style.setProperty(key, `${value}${this.properties[key]?.unit ?? ''}`);
    }
    if (notify) this.onUpdate?.(this.value, this.progress, this);
    return this.value;
  }

  private advance: FrameTask = (time) => {
    this.elapsed = Math.min(this.totalDuration, Math.max(0, time - this.startedAt));
    this.state = this.elapsed < this.delay ? 'delayed' : 'running'; this.sampleAt(this.elapsed);
    if (this.elapsed < this.totalDuration) return true;
    this.isAnimating = false; this.isPaused = false; this.state = 'finished';
    this.onEnd?.(this); this.onComplete?.(this); this.resolveFinished(this); return false;
  };
  private newFinishedPromise() { return new Promise<this>((resolve) => { this.resolveFinished = resolve; }); }
}

export interface TimelineOptions { repeat?: number; yoyo?: boolean; autoplay?: boolean; onUpdate?: (time: number, progress: number) => void; onComplete?: () => void; scheduler?: FrameScheduler; }
type TimelinePosition = number | '<' | '>' | string;
interface TimelineEntry { tween: Tween<MotionValueShape>; start: number; end: number; }

export class Timeline {
  private entries: TimelineEntry[] = []; private labels = new Map<string, number>(); private cursor = 0; private driver: Tween<number>;
  readonly options: TimelineOptions;
  constructor(options: TimelineOptions = {}) {
    this.options = options;
    this.driver = new Tween({ from: 0, to: 0, duration: 0, easing: 'linear', repeat: options.repeat, yoyo: options.yoyo, scheduler: options.scheduler,
      onUpdate: (time) => this.render(time), onComplete: () => options.onComplete?.() });
    if (options.autoplay) queueMicrotask(() => this.play());
  }
  get duration() { return this.cursor; }
  get state() { return this.driver.state; }
  get finished() { return this.driver.finished; }
  label(name: string, at = this.cursor) { this.labels.set(name, at); return this; }
  add<T extends MotionValueShape>(tween: Tween<T>, at?: TimelinePosition) {
    const previous = this.entries.at(-1); const start = this.resolvePosition(at, previous);
    const end = start + tween.totalDuration; this.entries.push({ tween: tween as unknown as Tween<MotionValueShape>, start, end }); this.cursor = Math.max(this.cursor, end); return this;
  }
  addTween<T extends MotionValueShape>(tween: Tween<T>, at?: TimelinePosition) { return this.add(tween, at); }
  addTweens(tweens: Tween<MotionValueShape>[]) { tweens.forEach((tween) => this.add(tween)); return this; }
  play() {
    const playback: TweenOptions<number> = { from: 0, to: this.duration, duration: this.duration };
    if (this.options.repeat != null) playback.repeat = this.options.repeat;
    if (this.options.yoyo != null) playback.yoyo = this.options.yoyo;
    this.driver.configure(playback).play(); return this;
  }
  start() { return this.play(); }
  pause() { this.driver.pause(); return this; }
  stop() { this.driver.stop(); this.render(0); return this; }
  reverse() { this.driver.reverse(); return this; }
  seek(progress: number) { this.driver.seek(progress); return this; }
  loop(value = true) { this.driver.repeat = value ? Infinity : 0; return this; }
  render(time: number) { for (const entry of this.entries) entry.tween.sampleAt(time - entry.start); this.options.onUpdate?.(time, this.duration ? time / this.duration : 1); }
  private resolvePosition(at: TimelinePosition | undefined, previous?: TimelineEntry) {
    if (at == null || at === '>') return previous?.end ?? 0;
    if (at === '<') return previous?.start ?? 0;
    if (typeof at === 'number') return Math.max(0, at);
    const match = at.match(/^([^+-]+)([+-]=)(\d+(?:\.\d+)?)$/); const base = this.labels.get(match?.[1] ?? at);
    if (base == null) throw new Error(`Unknown timeline label: ${at}`);
    return Math.max(0, base + (match ? Number(match[3]) * (match[2] === '+=' ? 1 : -1) : 0));
  }
}

export class MotionValue<T extends MotionValueShape> {
  private listeners = new Set<() => void>(); private animation?: Tween<T>;
  constructor(private current: T) {}
  get() { return this.current; }
  set(value: T) { if (Object.is(value, this.current)) return; this.current = value; for (const listener of this.listeners) listener(); }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  animate(to: T, options: Omit<TweenOptions<T>, 'from' | 'to' | 'onUpdate'> = {}) { this.stop(); this.animation = new Tween({ ...options, from: this.current, to, onUpdate: (value) => this.set(value) }).play(); return this.animation; }
  stop() { this.animation?.cancel(); this.animation = undefined; }
}

export function animate<T extends MotionValueShape>(from: T, to: T, options: Omit<TweenOptions<T>, 'from' | 'to'> = {}) { return new Tween({ ...options, from, to }).play(); }
export function stagger(interval = 60, { start = 0 } = {}) { return (index: number) => start + index * interval; }
