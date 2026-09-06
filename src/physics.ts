import type { MotionValueShape } from './interpolate';
import type { TimelineItem } from './items';
import { scheduler, type FrameScheduler, type FrameTask } from './scheduler';
import { frameRate, parseTime, type FrameRateInput, type TimeInput } from './time';

export type VelocityShape<T> = T extends number ? number : T extends readonly unknown[] ? { [K in keyof T]: number } : T extends object ? { [K in keyof T]: number } : number;

export interface PhysicsSpringOptions<T = number> {
  stiffness?: number;
  damping?: number;
  mass?: number;
  velocity?: number | T;
  restDelta?: number;
  /** Units per millisecond. */
  restSpeed?: number;
  bounce?: number;
  duration?: TimeInput;
  frameRate?: FrameRateInput;
  scheduler?: FrameScheduler;
}

export interface InertiaOptions<T = number> {
  velocity?: number | T;
  power?: number;
  timeConstant?: number;
  min?: number;
  max?: number;
  /** Bounds spring by default; false stops at the first bound without overshoot. */
  bounce?: PhysicsSpringOptions<T> | false;
  restDelta?: number;
  /**
   * Changes the exponential amplitude to target - from (and therefore its initial
   * velocity). A changed, unbounded target gets a continuous two-time-constant
   * settling tail; unchanged targets retain the legacy exponential cutoff.
   */
  modifyTarget?(projected: number): number;
  scheduler?: FrameScheduler;
}

type ScalarState = { value: number; velocity: number };

function springConstants(options: PhysicsSpringOptions<unknown>, distance = 1) {
  const mass = Math.max(.0001, options.mass ?? 1);
  const bounce = Math.max(0, Math.min(1, options.bounce ?? 0));
  const duration = options.duration == null ? undefined : Math.max(1, parseTime(options.duration, frameRate(options.frameRate ?? 60)));
  const stiffness = duration == null ? Math.max(.0001, options.stiffness ?? 170) : stiffnessFor(duration, bounce, mass);
  const damping = options.damping ?? (duration == null ? 26 : 2 * (1 - bounce * .82) * Math.sqrt(stiffness * mass));
  return { mass, stiffness, damping: Math.max(0, damping), distance };
}

function scalarSpring(from: number, to: number, velocityMs: number, milliseconds: number, options: PhysicsSpringOptions<unknown>): ScalarState {
  const t = Math.max(0, milliseconds) / 1000;
  const v0 = velocityMs * 1000;
  const y0 = from - to;
  const { mass, stiffness, damping } = springConstants(options, Math.abs(y0));
  const omega0 = Math.sqrt(stiffness / mass);
  const alpha = damping / (2 * mass);
  let y: number;
  let velocity: number;
  if (alpha < omega0 - 1e-7) {
    const wd = Math.sqrt(omega0 * omega0 - alpha * alpha);
    const b = (v0 + alpha * y0) / wd;
    const cos = Math.cos(wd * t); const sin = Math.sin(wd * t); const decay = Math.exp(-alpha * t);
    y = decay * (y0 * cos + b * sin);
    velocity = decay * ((-alpha * y0 + b * wd) * cos + (-alpha * b - y0 * wd) * sin);
  } else if (alpha > omega0 + 1e-7) {
    const root = Math.sqrt(alpha * alpha - omega0 * omega0);
    const r1 = -alpha + root; const r2 = -alpha - root;
    const a = (v0 - r2 * y0) / (r1 - r2); const b = y0 - a;
    y = a * Math.exp(r1 * t) + b * Math.exp(r2 * t);
    velocity = a * r1 * Math.exp(r1 * t) + b * r2 * Math.exp(r2 * t);
  } else {
    const b = v0 + alpha * y0; const decay = Math.exp(-alpha * t);
    y = (y0 + b * t) * decay;
    velocity = (b - alpha * (y0 + b * t)) * decay;
  }
  return { value: to + y, velocity: velocity / 1000 };
}

function numericVelocity(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function mapSpring(from: MotionValueShape, to: MotionValueShape, velocity: unknown, time: number, options: PhysicsSpringOptions<unknown>): { value: MotionValueShape; velocity: MotionValueShape | number } {
  if (typeof from === 'number' && typeof to === 'number') return scalarSpring(from, to, numericVelocity(velocity), time, options);
  if (Array.isArray(from) && Array.isArray(to)) {
    const states = from.map((item, index) => mapSpring(item, to[index] ?? item, Array.isArray(velocity) ? velocity[index] : 0, time, options));
    return { value: states.map((state) => state.value) as any, velocity: states.map((state) => state.velocity) as any };
  }
  if (from && to && typeof from === 'object' && typeof to === 'object') {
    const values: Record<string, MotionValueShape> = {}; const velocities: Record<string, MotionValueShape> = {};
    const v = velocity && typeof velocity === 'object' ? velocity as Record<string, unknown> : {};
    for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
      const a = (from as Record<string, MotionValueShape | undefined>)[key]; const b = (to as Record<string, MotionValueShape | undefined>)[key];
      if (a == null || b == null) { values[key] = (b ?? a)!; velocities[key] = 0; continue; }
      const state = mapSpring(a, b, v[key], time, options); values[key] = state.value; velocities[key] = state.velocity as MotionValueShape;
    }
    return { value: values, velocity: velocities };
  }
  return { value: time <= 0 ? from : to, velocity: 0 };
}

function maxMagnitude(value: unknown): number {
  if (typeof value === 'number') return Math.abs(value);
  if (Array.isArray(value)) return Math.max(0, ...value.map(maxMagnitude));
  if (value && typeof value === 'object') return Math.max(0, ...Object.values(value).map(maxMagnitude));
  return 0;
}

function difference(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b);
  if (Array.isArray(a) && Array.isArray(b)) return Math.max(0, ...a.map((v, i) => difference(v, b[i])));
  if (a && b && typeof a === 'object' && typeof b === 'object') return Math.max(0, ...Object.keys(a).map((key) => difference((a as any)[key], (b as any)[key])));
  return Object.is(a, b) ? 0 : Infinity;
}

abstract class PhysicsItem<T extends MotionValueShape> implements TimelineItem {
  abstract readonly kind: string;
  name?: string;
  abstract readonly totalDuration: number;
  protected frameLoop: FrameScheduler;
  protected startedAt = 0;
  protected removeFrame?: () => void;
  protected resolveFinished!: (item: this) => void;
  finished: Promise<this>;
  elapsed = 0;
  isAnimating = false;
  protected constructor(protected apply?: (value: T, velocity: T | number, time: number) => void, scheduler_?: FrameScheduler) {
    this.frameLoop = scheduler_ ?? scheduler;
    this.finished = new Promise<this>((resolve) => { this.resolveFinished = resolve; });
  }
  abstract sampleAt(milliseconds: number): T;
  play() { if (this.isAnimating) return this; this.isAnimating = true; this.startedAt = this.frameLoop.now() - this.elapsed; this.removeFrame = this.frameLoop.add(this.advance); return this; }
  pause() { this.removeFrame?.(); this.isAnimating = false; return this; }
  cancel() { this.removeFrame?.(); this.isAnimating = false; this.resolveFinished(this); return this; }
  seekTime(milliseconds: number) { this.elapsed = Math.max(0, Math.min(this.totalDuration, milliseconds)); this.sampleAt(this.elapsed); if (this.isAnimating) this.startedAt = this.frameLoop.now() - this.elapsed; return this; }
  private advance: FrameTask = (time) => { this.elapsed = Math.min(this.totalDuration, Math.max(0, time - this.startedAt)); this.sampleAt(this.elapsed); if (this.elapsed < this.totalDuration) return true; this.isAnimating = false; this.resolveFinished(this); return false; };
}

export interface SpringItemOptions<T extends MotionValueShape> extends PhysicsSpringOptions<T> { from: T; to: T; onUpdate?: (value: T, velocity: T | number, time: number) => void; name?: string; autoplay?: boolean }

export class SpringItem<T extends MotionValueShape = number> extends PhysicsItem<T> {
  readonly kind = 'spring' as const;
  readonly from: T; readonly to: T; readonly initialVelocity: T | number;
  readonly options: PhysicsSpringOptions<T>;
  readonly totalDuration: number;
  value: T; velocity: T | number;
  constructor(options: SpringItemOptions<T>) {
    super(options.onUpdate, options.scheduler);
    this.name = options.name; this.from = options.from; this.to = options.to; this.initialVelocity = options.velocity ?? 0;
    this.options = options; this.value = this.from; this.velocity = this.initialVelocity;
    this.totalDuration = springDuration({ ...options, from: this.from, to: this.to, velocity: this.initialVelocity });
    if (options.autoplay) queueMicrotask(() => this.play());
  }
  sampleAt(milliseconds: number) {
    const time = Math.max(0, Math.min(this.totalDuration, milliseconds));
    const state = mapSpring(this.from, this.to, this.initialVelocity, time, this.options as PhysicsSpringOptions<unknown>);
    if (time >= this.totalDuration) { this.value = this.to; this.velocity = 0; } else { this.value = state.value as T; this.velocity = state.velocity as T | number; }
    this.apply?.(this.value, this.velocity, time); return this.value;
  }
}

export interface InertiaItemOptions<T extends MotionValueShape = number> extends InertiaOptions<T> { from: T; onUpdate?: (value: T, velocity: T | number, time: number) => void; name?: string; autoplay?: boolean }

export class InertiaItem<T extends MotionValueShape = number> extends PhysicsItem<T> {
  readonly kind = 'inertia' as const;
  readonly from: T; readonly initialVelocity: T | number; readonly options: InertiaOptions<T>;
  readonly totalDuration: number; readonly target: T;
  value: T; velocity: T | number;
  private boundary?: number; private crossingTime = 0; private settle?: SpringItem<number>;
  private retargetedVelocity?: number;
  private decayTime = 0;
  private hasRetargetedTail = false;
  constructor(options: InertiaItemOptions<T>) {
    super(options.onUpdate, options.scheduler);
    this.name = options.name; this.from = options.from; this.initialVelocity = options.velocity ?? 0; this.options = options;
    this.value = this.from; this.velocity = this.initialVelocity;
    const tau = Math.max(1, options.timeConstant ?? 325); const power = options.power ?? .8;
    if (typeof this.from === 'number') {
      const projected = projectFling(this.from, numericVelocity(this.initialVelocity) * power, tau);
      const modified = options.modifyTarget?.(projected) ?? projected;
      if (!Number.isFinite(modified)) throw new Error('Inertia target must be a finite number');
      if (modified !== projected) this.retargetedVelocity = (modified - this.from) / tau;
      this.target = modified as T;
      const bound = modified < (options.min ?? -Infinity) ? options.min : modified > (options.max ?? Infinity) ? options.max : undefined;
      if (bound != null) {
        this.boundary = bound;
        this.target = bound as T;
        const effectiveVelocity = this.retargetedVelocity ?? numericVelocity(this.initialVelocity) * power;
        const distance = bound - this.from; const full = effectiveVelocity * tau;
        const ratio = full === 0 ? 1 : Math.max(0, Math.min(.999999, distance / full));
        this.crossingTime = Math.max(0, -tau * Math.log(1 - ratio));
        const crossingVelocity = effectiveVelocity * Math.exp(-this.crossingTime / tau);
        if (options.bounce !== false) this.settle = new SpringItem<number>({ from: bound, to: bound, velocity: crossingVelocity, ...(typeof options.bounce === 'object' ? options.bounce as PhysicsSpringOptions<number> : {}), scheduler: options.scheduler });
      }
    } else this.target = this.from;
    const rest = Math.max(.00001, options.restDelta ?? .01);
    const v = Math.abs(this.retargetedVelocity ?? numericVelocity(this.initialVelocity) * power);
    this.decayTime = v <= rest ? 0 : Math.max(0, tau * Math.log(v / rest));
    this.hasRetargetedTail = this.retargetedVelocity !== undefined && this.boundary === undefined && v > 0;
    this.totalDuration = this.settle ? this.crossingTime + this.settle.totalDuration
      : this.boundary !== undefined ? this.crossingTime
      : this.decayTime + (this.hasRetargetedTail ? 2 * tau : 0);
    if (options.autoplay) queueMicrotask(() => this.play());
  }
  sampleAt(milliseconds: number) {
    const time = Math.max(0, Math.min(this.totalDuration, milliseconds));
    if (typeof this.from !== 'number') { this.apply?.(this.value, this.velocity, time); return this.value; }
    if (time >= this.totalDuration) {
      this.value = this.target; this.velocity = 0;
    } else if (this.settle && this.boundary != null && time >= this.crossingTime) {
      this.value = this.settle.sampleAt(time - this.crossingTime) as T; this.velocity = this.settle.velocity as T | number;
    } else {
      const tau = Math.max(1, this.options.timeConstant ?? 325);
      const v0 = this.retargetedVelocity ?? numericVelocity(this.initialVelocity) * (this.options.power ?? .8);
      if (this.hasRetargetedTail && time >= this.decayTime) {
        // The quadratic tail matches exponential position/velocity at its start
        // and reaches the target with zero velocity, without overshoot or a jump.
        const remaining = 1 - (time - this.decayTime) / (2 * tau);
        const tailVelocity = v0 * Math.exp(-this.decayTime / tau);
        this.value = ((this.target as number) - tailVelocity * tau * remaining * remaining) as T;
        this.velocity = (tailVelocity * remaining) as T | number;
      } else {
        this.value = (this.from + v0 * tau * (1 - Math.exp(-time / tau))) as T;
        this.velocity = (v0 * Math.exp(-time / tau)) as T | number;
      }
    }
    this.apply?.(this.value, this.velocity, time); return this.value;
  }
}

export function springDuration<T extends MotionValueShape>(options: PhysicsSpringOptions<T> & { from?: T; to?: T; velocity?: T | number } = {}): number {
  const from = (options.from ?? 0) as MotionValueShape; const to = (options.to ?? 1) as MotionValueShape;
  const restDelta = options.restDelta ?? .01; const restSpeed = options.restSpeed ?? .01;
  let previous = 0;
  for (let time = 0; time <= 20000; time += 4) {
    const state = mapSpring(from, to, options.velocity ?? 0, time, options as PhysicsSpringOptions<unknown>);
    if (difference(state.value, to) <= restDelta && maxMagnitude(state.velocity) <= restSpeed) {
      let low = previous; let high = time;
      for (let i = 0; i < 12; i += 1) { const mid = (low + high) / 2; const sample = mapSpring(from, to, options.velocity ?? 0, mid, options as PhysicsSpringOptions<unknown>); if (difference(sample.value, to) <= restDelta && maxMagnitude(sample.velocity) <= restSpeed) high = mid; else low = mid; }
      return high;
    }
    previous = time;
  }
  return 20000;
}

export function stiffnessFor(duration: number, bounce = 0, mass = 1): number {
  const seconds = Math.max(.001, duration / 1000); const dampingRatio = Math.max(.08, 1 - Math.max(0, Math.min(1, bounce)) * .82);
  return mass * (Math.log(100) / (dampingRatio * seconds)) ** 2;
}

export function rubberband(value: number, min: number, max: number, coefficient = .55, dimension = 300): number {
  if (value >= min && value <= max) return value;
  const boundary = value < min ? min : max; const distance = Math.abs(value - boundary); const resisted = (1 - 1 / (distance * coefficient / Math.max(1, dimension) + 1)) * Math.max(1, dimension);
  return boundary + Math.sign(value - boundary) * resisted;
}

export function clampWithRubberband(value: number, min: number, max: number, coefficient: number | false = .55, dimension = 300): number {
  return coefficient === false ? Math.max(min, Math.min(max, value)) : rubberband(value, min, max, coefficient, dimension);
}

export function projectFling(value: number, velocity: number, timeConstant = 325): number { return value + velocity * timeConstant; }

export function snapTo(points: number[] | { step: number; offset?: number } | ((projected: number) => number), value: number, velocity: number, timeConstant = 325): number {
  const projected = projectFling(value, velocity, timeConstant);
  if (typeof points === 'function') return points(projected);
  if (!Array.isArray(points)) { const offset = points.offset ?? 0; return Math.round((projected - offset) / points.step) * points.step + offset; }
  return points.reduce((nearest, point) => Math.abs(point - projected) < Math.abs(nearest - projected) ? point : nearest, points[0] ?? value);
}
