export type EasingFunction = (progress: number) => number;

const clamp = (n: number) => Math.min(1, Math.max(0, n));

export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFunction {
  const sample = (a: number, b: number, t: number) => 3 * a * (1 - t) ** 2 * t + 3 * b * (1 - t) * t ** 2 + t ** 3;
  return (progress) => {
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
}

export function spring({ stiffness = 170, damping = 26, mass = 1 } = {}): EasingFunction {
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
  return (t) => response(clamp(t) * duration) / end;
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

export function resolveEasing(easing?: EasingFunction | EasingName): EasingFunction {
  if (!easing) return Easing.dhaakon;
  return typeof easing === 'string' ? Easing[easing] : easing;
}
