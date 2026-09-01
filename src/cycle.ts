export type Direction = 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';

export interface CycleSpec {
  duration: number;
  delay: number;
  repeat: number;
  repeatDelay: number;
  direction: Direction;
  reversed: boolean;
}

export interface CycleSample {
  iteration: number;
  cycleTime: number;
  progress: number;
  active: number;
}

/** Total time a cycle spends actively running, excluding its leading delay. `Infinity` when `repeat` is `Infinity`. */
export function activeDuration(spec: Pick<CycleSpec, 'duration' | 'repeat' | 'repeatDelay'>): number {
  if (spec.repeat === Infinity) return Infinity;
  return spec.duration * (spec.repeat + 1) + spec.repeatDelay * spec.repeat;
}

/** Total time a cycle occupies, including its leading delay. */
export function totalDuration(spec: Pick<CycleSpec, 'duration' | 'delay' | 'repeat' | 'repeatDelay'>): number {
  return spec.delay + activeDuration(spec);
}

/**
 * Pure repeat/yoyo/direction sampler shared by `Tween` and offline rendering.
 * Extracted from the original `Tween.sampleAt` math; must stay bit-for-bit identical.
 */
export function sampleCycle(spec: CycleSpec, milliseconds: number): CycleSample {
  const active = Math.max(0, milliseconds - spec.delay);
  const cycleDuration = spec.duration + spec.repeatDelay;
  const iteration = spec.duration === 0
    ? spec.repeat
    : Math.min(spec.repeat, Math.floor(active / Math.max(1, cycleDuration)));
  const cycleTime = Math.min(spec.duration, Math.max(0, active - iteration * cycleDuration));
  let raw = spec.duration === 0 ? 1 : cycleTime / spec.duration;
  const alternating = spec.direction === 'alternate' || spec.direction === 'alternate-reverse';
  const startsReverse = spec.direction === 'reverse' || spec.direction === 'alternate-reverse';
  if (startsReverse !== (alternating && iteration % 2 === 1) !== spec.reversed) raw = 1 - raw;
  const progress = Math.max(0, Math.min(1, raw));
  return { iteration, cycleTime, progress, active };
}
