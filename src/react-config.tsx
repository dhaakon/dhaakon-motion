import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { TimeInput, EasingFunction, EasingName, FrameRateInput } from '@dhaakon/motion';

export interface MotionTransition {
  duration?: TimeInput;
  delay?: TimeInput;
  repeat?: number;
  repeatDelay?: TimeInput;
  yoyo?: boolean;
  easing?: EasingFunction | EasingName;
  frameRate?: FrameRateInput;
}
export interface MotionConfigValue {
  transition?: MotionTransition;
  reducedMotion?: 'user' | 'always' | 'never';
  frameRate?: FrameRateInput;
}
export const MotionContext = createContext<MotionConfigValue>({ reducedMotion: 'user' });
export function MotionConfig({ children, ...value }: MotionConfigValue & { children: ReactNode }) {
  const parent = useContext(MotionContext);
  return (
    <MotionContext.Provider
      value={useMemo(
        () => ({ ...parent, ...value, transition: { ...parent.transition, ...value.transition } }),
        [parent, value.transition, value.reducedMotion, value.frameRate],
      )}
    >
      {children}
    </MotionContext.Provider>
  );
}
export function useReducedMotion() {
  const setting = useContext(MotionContext).reducedMotion;
  const query = useMemo(
    () =>
      typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null,
    [],
  );
  const system = useSyncExternalStore(
    (listener) => {
      query?.addEventListener('change', listener);
      return () => query?.removeEventListener('change', listener);
    },
    () => query?.matches ?? false,
    () => false,
  );
  return setting === 'always' || (setting !== 'never' && system);
}
