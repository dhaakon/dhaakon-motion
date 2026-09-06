import { resolveEasing, type EasingFunction, type Direction } from '@dhaakon/motion';

/** Private interchange contract. Creation/editing only; never serialized per frame. */
export interface NumericCurve {
  kind: string;
  args: readonly number[];
}
export interface NumericTrack {
  id: string;
  times: readonly number[];
  values: readonly (readonly number[])[];
  easings: readonly NumericCurve[];
  /** -1 represents infinite repeat without nonfinite JSON. */
  repeat: number;
  repeatDelay: number;
  direction: Direction;
}
export interface NumericPlan {
  version: 1;
  tracks: readonly NumericTrack[];
}
export const NUMERIC_IR_VERSION = 1;
export const numericLimits = Object.freeze({
  tracks: 100_000,
  keys: 4096,
  width: 64,
  scalars: 4_000_000,
  output: 1_000_000,
});
const builtins = new Set([
  'linear',
  'easeInQuad',
  'easeOutQuad',
  'easeInOutQuad',
  'easeInCubic',
  'easeOutCubic',
  'easeInOutCubic',
  'easeInQuart',
  'easeOutQuart',
  'easeInOutQuart',
  'easeOutBack',
  'dhaakon',
]);
// IR builtins are fixed mathematical operations, not the mutable host easing registry.
const functions: Record<string, EasingFunction> = {
  linear: (t) => t,
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  easeInCubic: (t) => t ** 3,
  easeOutCubic: (t) => 1 - (1 - t) ** 3,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  easeInQuart: (t) => t ** 4,
  easeOutQuart: (t) => 1 - (1 - t) ** 4,
  easeInOutQuart: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2),
  easeOutBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
};
const finite = (n: unknown, min: number, max: number): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
const fail = (path: string, message: string): never => {
  throw new Error(`Numeric IR ${path}: ${message}`);
};
function fields(value: object, names: string[], path: string) {
  if (
    !value ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  )
    fail(path, 'expected plain descriptor');
  if (Object.getOwnPropertySymbols(value).length) fail(path, 'symbol properties are not supported');
  for (const key of Object.getOwnPropertyNames(value)) {
    if (!names.includes(key) || !('value' in Object.getOwnPropertyDescriptor(value, key)!))
      fail(path, `unknown/accessor field ${key}`);
  }
}
function dense(value: readonly unknown[], path: string) {
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    Object.getOwnPropertySymbols(value).length
  )
    fail(path, 'expected dense plain array');
  const keys = Object.getOwnPropertyNames(value);
  if (keys.length !== value.length + 1) fail(path, 'sparse/custom-property array');
  for (let i = 0; i < value.length; i++)
    if (!Object.hasOwn(value, i) || !('value' in Object.getOwnPropertyDescriptor(value, i)!))
      fail(path, 'sparse/accessor array');
}

export function validateCurve(curve: NumericCurve, path = 'easing'): void {
  if (!curve || typeof curve.kind !== 'string' || !Array.isArray(curve.args))
    fail(path, 'invalid descriptor');
  fields(curve, ['kind', 'args'], path);
  dense(curve.args, path + '.args');
  const a = curve.args;
  if (builtins.has(curve.kind) && a.length === 0) return;
  if (
    curve.kind === 'cubicBezier' &&
    a.length === 4 &&
    finite(a[0], 0, 1) &&
    finite(a[2], 0, 1) &&
    finite(a[1], -100, 100) &&
    finite(a[3], -100, 100)
  )
    return;
  if (
    curve.kind === 'spring' &&
    a.length === 3 &&
    finite(a[0], 1e-6, 1e6) &&
    finite(a[1], 0, 1e6) &&
    finite(a[2], 1e-6, 1e6)
  )
    return;
  if (
    curve.kind === 'steps' &&
    a.length === 2 &&
    finite(a[0], 1, 1e6) &&
    Number.isInteger(a[0]) &&
    (a[1] === 0 || a[1] === 1)
  )
    return;
  fail(path, 'unsupported curve or invalid parameters');
}

export function curveFunction(curve: NumericCurve): EasingFunction {
  if (curve.kind === 'dhaakon') return resolveEasing(['cubicBezier', 0.16, 1, 0.3, 1]);
  if (curve.kind === 'cubicBezier')
    return resolveEasing(['cubicBezier', ...curve.args] as [
      'cubicBezier',
      number,
      number,
      number,
      number,
    ]);
  if (curve.kind === 'spring')
    return resolveEasing([
      'spring',
      { stiffness: curve.args[0], damping: curve.args[1], mass: curve.args[2] },
    ]);
  if (curve.kind === 'steps') {
    const [count, start] = curve.args;
    return (t) =>
      Math.min(1, Math.max(0, (start ? Math.ceil(t * count) : Math.floor(t * count)) / count));
  }
  return functions[curve.kind];
}

/** Validate at the trust boundary, including budgets before allocating output storage. */
export function validateNumericPlan(plan: NumericPlan): number {
  if (!plan || plan.version !== 1 || !Array.isArray(plan.tracks))
    fail('version', 'expected version 1 tracks');
  fields(plan, ['version', 'tracks'], 'plan');
  dense(plan.tracks, 'tracks');
  if (plan.tracks.length > numericLimits.tracks) fail('tracks', 'resource limit exceeded');
  const ids = new Set<string>();
  let scalars = 0;
  let output = 0;
  for (const [i, track] of plan.tracks.entries()) {
    const path = `tracks[${i}]`;
    fields(track, ['id', 'times', 'values', 'easings', 'repeat', 'repeatDelay', 'direction'], path);
    if (
      !track ||
      typeof track.id !== 'string' ||
      !track.id.length ||
      new TextEncoder().encode(track.id).length > 256 ||
      ids.has(track.id)
    )
      fail(path, 'invalid or duplicate id');
    ids.add(track.id);
    if (
      !Array.isArray(track.times) ||
      !track.times.length ||
      track.times.length > numericLimits.keys ||
      !Array.isArray(track.values) ||
      track.values.length !== track.times.length
    )
      fail(path, 'invalid key arrays');
    dense(track.times, path + '.times');
    dense(track.values, path + '.values');
    const width = track.values[0]?.length;
    if (!width || width > numericLimits.width) fail(path, 'invalid vector width');
    output += width;
    scalars += width * track.times.length;
    if (output > numericLimits.output || scalars > numericLimits.scalars)
      fail(path, 'resource limit exceeded');
    for (let k = 0; k < track.times.length; k++) {
      if (!finite(track.times[k], 0, 1e12) || (k && track.times[k] < track.times[k - 1]))
        fail(`${path}.times[${k}]`, 'expected finite nondecreasing times');
      if (
        !Array.isArray(track.values[k]) ||
        track.values[k].length !== width ||
        Array.from(track.values[k]).some((n) => !finite(n, -1e100, 1e100))
      )
        fail(`${path}.values[${k}]`, 'invalid numeric vector');
      dense(track.values[k], `${path}.values[${k}]`);
    }
    if (!Array.isArray(track.easings) || track.easings.length !== track.times.length - 1)
      fail(path, 'one easing per segment required');
    dense(track.easings, path + '.easings');
    for (let k = 0; k < track.easings.length; k++)
      validateCurve(track.easings[k], `${path}.easings[${k}]`);
    if (
      !(track.repeat === -1 || (finite(track.repeat, 0, 1e6) && Number.isInteger(track.repeat))) ||
      !finite(track.repeatDelay, 0, 1e12)
    )
      fail(path, 'invalid repeat');
    if (!['normal', 'reverse', 'alternate', 'alternate-reverse'].includes(track.direction))
      fail(path, 'invalid direction');
  }
  return output;
}

/** Exact positive cycle duration: sub-millisecond timelines are not rounded to 1ms. */
export function contentTime(track: NumericTrack, ms: number): number {
  const duration = track.times[track.times.length - 1];
  if (duration === 0) return 0;
  const active = Math.max(0, ms);
  const cycle = duration + track.repeatDelay;
  const iteration =
    track.repeat === -1
      ? Math.floor((active % (2 * cycle)) / cycle)
      : Math.min(track.repeat, Math.floor(active / cycle));
  const local = Math.min(
    duration,
    Math.max(0, track.repeat === -1 ? active % cycle : active - iteration * cycle),
  );
  const alternating = track.direction === 'alternate' || track.direction === 'alternate-reverse';
  const reverse =
    (track.direction === 'reverse' || track.direction === 'alternate-reverse') !==
    (alternating && iteration % 2 === 1);
  const progress = local / duration;
  return Math.min(1, Math.max(0, reverse ? 1 - progress : progress)) * duration;
}

export interface NumericEvaluator {
  readonly backend: 'js' | 'wasm';
  readonly length: number;
  /** Borrowed internal view, valid until next sample/create/free. Hosts must copy before callbacks. */
  sample(ms: number): Float64Array;
  dispose(): void;
}

export function createJsEvaluator(plan: NumericPlan): NumericEvaluator {
  const length = validateNumericPlan(plan);
  // Own the numeric plan; later mutation of a caller's IR cannot invalidate validation.
  const tracks = plan.tracks.map((track) => ({
    ...track,
    times: [...track.times],
    values: track.values.map((value) => Float64Array.from(value)),
    curves: track.easings.map(curveFunction),
  }));
  const output = new Float64Array(length);
  let disposed = false;
  return {
    backend: 'js',
    length,
    sample(ms) {
      if (disposed) throw new Error('Compiled evaluator is disposed');
      if (!Number.isFinite(ms) || Math.abs(ms) > 1e15)
        throw new Error('Compiled sample time must be finite and within ±1e15ms');
      let offset = 0;
      for (const track of tracks) {
        const time = contentTime(track as unknown as NumericTrack, ms);
        const last = track.times.length - 1;
        if (last === 0 || time <= track.times[0]) output.set(track.values[0], offset);
        else if (time >= track.times[last]) output.set(track.values[last], offset);
        else {
          // Lower-bound search retains the original first-ending-segment duplicate-key rule.
          let low = 1,
            high = last;
          while (low < high) {
            const middle = (low + high) >>> 1;
            if (track.times[middle] < time) low = middle + 1;
            else high = middle;
          }
          const span = track.times[low] - track.times[low - 1];
          const p = track.curves[low - 1](
            span <= 0 ? 1 : Math.min(1, Math.max(0, (time - track.times[low - 1]) / span)),
          );
          const from = track.values[low - 1],
            to = track.values[low];
          for (let channel = 0; channel < from.length; channel++)
            output[offset + channel] = from[channel] + (to[channel] - from[channel]) * p;
        }
        offset += track.values[0].length;
      }
      return output;
    },
    dispose() {
      disposed = true;
    },
  };
}
