import { interpolate, type MotionValueShape } from './interpolate';
import { resolveEasing, type EasingFunction, type EasingInput } from './easing';
import { frameRate as resolveFrameRate, parseTime, type FrameRateInput, type TimeInput } from './time';
import { sampleCycle, totalDuration as cycleTotalDuration, type Direction } from './cycle';
import type { RenderContext, TimelineItem } from './items';
import { MotionValue } from './core';

/** One value at a point in time. `easing` describes the segment *ending* at this key (ignored on the first key). */
export interface Keyframe<T> { at: TimeInput; value: T; easing?: EasingInput; }

export interface TrackOptions<T extends MotionValueShape> {
  keyframes: Keyframe<T>[];
  /** How a sampled value is written. Required unless `target` is given. */
  apply?: (value: T, ctx?: RenderContext) => void;
  /** Convenience for `apply: (v) => target.set(v)`. */
  target?: MotionValue<T>;
  name?: string;
  /** Resolves frame/timecode `at` values. */
  frameRate?: FrameRateInput;
  repeat?: number;
  repeatDelay?: number;
  direction?: Direction;
  /** Default easing for every segment that doesn't specify its own. */
  easing?: EasingInput;
}

/** A multi-keyframe animation track — the N-keyframe generalization of a two-key `Tween`. */
export class Track<T extends MotionValueShape> implements TimelineItem {
  readonly kind = 'track' as const;
  name?: string;
  readonly keyframes: ReadonlyArray<{ at: number; value: T }>;

  private segments: Array<{ from: number; to: number; ease: EasingFunction }> = [];
  private apply: (value: T, ctx?: RenderContext) => void;
  private repeat: number;
  private repeatDelay: number;
  private direction: Direction;

  constructor(options: TrackOptions<T>) {
    if (!options.apply && !options.target) throw new Error('Track needs either `apply` or `target`.');
    this.name = options.name;
    this.apply = options.apply ?? ((value) => options.target!.set(value));
    this.repeat = options.repeat ?? 0;
    this.repeatDelay = options.repeatDelay ?? 0;
    this.direction = options.direction ?? 'normal';

    if (!options.keyframes.length) throw new Error('Track needs at least one keyframe.');
    const rate = options.frameRate ? resolveFrameRate(options.frameRate) : undefined;
    const resolved = options.keyframes
      .map((key) => ({ at: typeof key.at === 'number' ? key.at : parseTime(key.at, rate), value: key.value, easing: key.easing }))
      .sort((a, b) => a.at - b.at);
    this.keyframes = resolved.map(({ at, value }) => ({ at, value }));
    for (let i = 1; i < resolved.length; i += 1) {
      this.segments.push({ from: resolved[i - 1].at, to: resolved[i].at, ease: resolveEasing(resolved[i].easing ?? options.easing) });
    }
  }

  /** Content length: the last keyframe's time. */
  get duration() { return this.keyframes.at(-1)?.at ?? 0; }
  get totalDuration() {
    return cycleTotalDuration({ duration: this.duration, delay: 0, repeat: this.repeat, repeatDelay: this.repeatDelay });
  }

  /** Pure: the interpolated value at a content-local time, without writing it anywhere. */
  valueAt(ms: number): T {
    const first = this.keyframes[0];
    const last = this.keyframes.at(-1)!;
    if (this.keyframes.length === 1 || ms <= first.at) return first.value;
    if (ms >= last.at) return last.value;
    const index = this.segments.findIndex((segment) => ms <= segment.to);
    const segment = this.segments[index === -1 ? this.segments.length - 1 : index];
    const from = this.keyframes[index];
    const to = this.keyframes[index + 1];
    const span = segment.to - segment.from;
    const t = span <= 0 ? 1 : (ms - segment.from) / span;
    return interpolate(from.value, to.value, segment.ease(Math.max(0, Math.min(1, t))));
  }

  sampleAt(localMs: number, ctx?: RenderContext) {
    const spec = { duration: this.duration, delay: 0, repeat: this.repeat, repeatDelay: this.repeatDelay, direction: this.direction, reversed: false };
    const { cycleTime } = sampleCycle(spec, localMs);
    this.apply(this.valueAt(cycleTime), ctx);
  }
}

/** `new Track({ target, keyframes, ...options })`, accepting either a `MotionValue` or a plain setter as the first argument. */
export function track<T extends MotionValueShape>(
  target: MotionValue<T> | ((value: T) => void),
  keyframes: Keyframe<T>[],
  options: Omit<TrackOptions<T>, 'keyframes' | 'apply' | 'target'> = {},
): Track<T> {
  return target instanceof MotionValue
    ? new Track<T>({ ...options, keyframes, target })
    : new Track<T>({ ...options, keyframes, apply: target });
}
