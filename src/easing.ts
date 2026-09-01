export type EasingFunction = (progress: number) => number;

const clamp = (n: number) => Math.min(1, Math.max(0, n));

/** How an easing function was built, so `serializeEasing` can recover a JSON-safe description of it. */
export type EasingTuple =
  | ['cubicBezier', number, number, number, number]
  | ['spring', { stiffness?: number; damping?: number; mass?: number }]
  | ['steps', number];
/** Anything that can describe an easing curve: a built-in or registered name, a tuple that builds one, or a function directly. */
export type EasingInput = EasingFunction | EasingTuple | string;

const easingSource = new WeakMap<EasingFunction, EasingTuple>();

export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFunction {
  const sample = (a: number, b: number, t: number) => 3 * a * (1 - t) ** 2 * t + 3 * b * (1 - t) * t ** 2 + t ** 3;
  const fn: EasingFunction = (progress) => {
    const x = clamp(progress);
    let low = 0; let high = 1; let t = x;
    for (let i = 0; i < 12; i += 1) {
      const estimate = sample(x1, x2, t);
      if (Math.abs(estimate - x) < 0.0001) break;
      if (estimate < x) low = t; else high = t;
      t = (low + high) / 2;
    }
    return sample(y1, y2, t);
  };
  easingSource.set(fn, ['cubicBezier', x1, y1, x2, y2]);
  return fn;
}

export interface SpringOptions { stiffness?: number; damping?: number; mass?: number; }
export function spring(options: SpringOptions = {}): EasingFunction {
  const { stiffness = 170, damping = 26, mass = 1 } = options;
  const omega = Math.sqrt(stiffness / mass);
  const ratio = damping / (2 * Math.sqrt(stiffness * mass));
  const duration = 1;
  const response = (t: number) => {
    if (ratio < 1) {
      const damped = omega * Math.sqrt(1 - ratio * ratio);
      return 1 - Math.exp(-ratio * omega * t) * (Math.cos(damped * t) + (ratio * omega / damped) * Math.sin(damped * t));
    }
    return 1 - Math.exp(-omega * t) * (1 + omega * t);
  };
  const end = response(duration) || 1;
  const fn: EasingFunction = (t) => response(clamp(t) * duration) / end;
  easingSource.set(fn, ['spring', options]);
  return fn;
}

/** A stepped ("hold") easing: `count` discrete plateaus across the curve. */
export function steps(count: number, position: 'start' | 'end' = 'end'): EasingFunction {
  const n = Math.max(1, Math.round(count));
  const fn: EasingFunction = (t) => {
    const x = clamp(t);
    const step = position === 'start' ? Math.ceil(x * n) : Math.floor(x * n);
    return Math.min(1, Math.max(0, step / n));
  };
  easingSource.set(fn, ['steps', n]);
  return fn;
}

export const Easing = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2,
  easeInCubic: (t: number) => t ** 3,
  easeOutCubic: (t: number) => 1 - (1 - t) ** 3,
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2,
  easeInQuart: (t: number) => t ** 4,
  easeOutQuart: (t: number) => 1 - (1 - t) ** 4,
  easeInOutQuart: (t: number) => t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2,
  easeOutBack: (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  dhaakon: cubicBezier(0.16, 1, 0.3, 1),
} satisfies Record<string, EasingFunction>;

export type EasingName = keyof typeof Easing;

const builtinNames = new Map<EasingFunction, EasingName>(
  (Object.entries(Easing) as [EasingName, EasingFunction][]).map(([name, fn]) => [fn, name]),
);
const registry = new Map<string, EasingFunction>();

/** Register a custom easing under a name, so it can be used as a string (e.g. in a cue sheet) and round-trip through `serializeEasing`. */
export function registerEasing(name: string, fn: EasingFunction): EasingFunction {
  registry.set(name, fn);
  return fn;
}

/** Resolve any `EasingInput` — a built-in or registered name, a `['cubicBezier', ...]`/`['spring', ...]`/`['steps', n]` tuple, or a function — into a function. */
export function resolveEasing(easing?: EasingFunction | EasingName | EasingInput): EasingFunction {
  if (!easing) return Easing.dhaakon;
  if (typeof easing === 'function') return easing;
  if (typeof easing === 'string') {
    if (easing in Easing) return Easing[easing as EasingName];
    const registered = registry.get(easing);
    if (registered) return registered;
    throw new Error(`Unknown easing: "${easing}"`);
  }
  const [kind, ...args] = easing;
  if (kind === 'cubicBezier') return cubicBezier(...(args as [number, number, number, number]));
  if (kind === 'spring') return spring(args[0] as SpringOptions | undefined);
  if (kind === 'steps') return steps(args[0] as number);
  throw new Error(`Unknown easing tuple: ${JSON.stringify(easing)}`);
}

/**
 * The inverse of `resolveEasing`: recover a JSON-safe description of an
 * easing function — its registered/built-in name if it has one, else the
 * tuple it was built from (`cubicBezier`/`spring`/`steps` all tag their
 * result), else `undefined` for an anonymous function.
 */
export function serializeEasing(input: EasingInput | undefined): EasingInput | undefined {
  if (input == null) return undefined;
  if (typeof input !== 'function') return input;
  const builtin = builtinNames.get(input);
  if (builtin) return builtin;
  for (const [name, fn] of registry) if (fn === input) return name;
  return easingSource.get(input);
}
