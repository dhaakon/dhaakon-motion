import React, { createContext, forwardRef, useContext, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { MotionValue, Timeline, Tween, type TweenOptions, type EasingFunction, type EasingName, type MotionValueShape } from '@dhaakon/motion';

export interface MotionTransition { duration?: number; delay?: number; repeat?: number; repeatDelay?: number; yoyo?: boolean; easing?: EasingFunction | EasingName; }
export interface MotionConfigValue { transition?: MotionTransition; reducedMotion?: 'user' | 'always' | 'never'; }
const MotionContext = createContext<MotionConfigValue>({ reducedMotion: 'user' });

export function MotionConfig({ children, ...value }: MotionConfigValue & { children: React.ReactNode }) {
  const parent = useContext(MotionContext);
  return <MotionContext.Provider value={useMemo(() => ({ ...parent, ...value, transition: { ...parent.transition, ...value.transition } }), [parent, value.transition, value.reducedMotion])}>{children}</MotionContext.Provider>;
}

export function useReducedMotion() {
  const setting = useContext(MotionContext).reducedMotion;
  const query = useMemo(() => typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null, []);
  const system = useSyncExternalStore(
    (listener) => { query?.addEventListener('change', listener); return () => query?.removeEventListener('change', listener); },
    () => query?.matches ?? false, () => false,
  );
  return setting === 'always' || (setting !== 'never' && system);
}

export function useMotionValue<T extends MotionValueShape>(initial: T) {
  const ref = useRef<MotionValue<T> | null>(null);
  if (!ref.current) ref.current = new MotionValue(initial);
  useEffect(() => () => ref.current?.stop(), []);
  return ref.current;
}

export function useMotionValueState<T extends MotionValueShape>(value: MotionValue<T>) {
  return useSyncExternalStore(value.subscribe, () => value.get(), () => value.get());
}

export function useTween<T extends MotionValueShape>(from: T, to: T, options: Omit<TweenOptions<T>, 'from' | 'to'> = {}) {
  const motionValue = useMotionValue(from); const tween = useRef<Tween<T> | null>(null); const reduced = useReducedMotion();
  const transition = useContext(MotionContext).transition;
  const fromKey = stableKey(from); const toKey = stableKey(to);
  useEffect(() => {
    motionValue.set(from);
    tween.current = motionValue.animate(to, { ...transition, ...options, duration: reduced ? 0 : options.duration ?? transition?.duration });
    return () => { tween.current?.cancel(); };
  }, [motionValue, fromKey, toKey, reduced, options.duration, options.delay, options.repeat, options.repeatDelay, options.yoyo, options.easing, options.ease]);
  return { value: useMotionValueState(motionValue), motionValue, controls: tween };
}

export function useTimeline(factory: () => Timeline, dependencies: React.DependencyList = []) {
  const timeline = useRef<Timeline | null>(null);
  useEffect(() => { timeline.current = factory(); return () => { timeline.current?.stop(); timeline.current = null; }; }, dependencies);
  return timeline;
}

export interface MotionRenderProps<T extends MotionValueShape> extends Omit<TweenOptions<T>, 'from' | 'to'> {
  from: T; to: T; children: (value: T, controls: React.RefObject<Tween<T> | null>) => React.ReactNode;
}
export function Motion<T extends MotionValueShape>({ from, to, children, ...options }: MotionRenderProps<T>) {
  const result = useTween(from, to, options); return <>{children(result.value, result.controls)}</>;
}

export type MotionStyle = Record<string, number | string>;
type NativeProps<T extends React.ElementType> = Omit<React.ComponentPropsWithoutRef<T>, 'style'>;
export type MotionElementProps<T extends React.ElementType> = NativeProps<T> & {
  initial?: MotionStyle | false; animate?: MotionStyle; transition?: MotionTransition; style?: React.CSSProperties;
  onMotionStart?: () => void; onMotionComplete?: () => void; as?: React.ElementType;
};

const transformKeys = new Set(['x', 'y', 'z', 'scale', 'scaleX', 'scaleY', 'rotate', 'rotateX', 'rotateY', 'skewX', 'skewY']);
const unitless = new Set(['opacity', 'zIndex', 'fontWeight', 'lineHeight', 'scale', 'scaleX', 'scaleY', 'flexGrow', 'flexShrink']);
function writeStyle(node: HTMLElement, values: MotionStyle) {
  const transforms: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (transformKeys.has(key)) {
      const unit = key.startsWith('rotate') || key.startsWith('skew') ? 'deg' : key.startsWith('scale') ? '' : 'px';
      const name = key === 'x' ? 'translateX' : key === 'y' ? 'translateY' : key === 'z' ? 'translateZ' : key;
      transforms.push(`${name}(${typeof value === 'number' ? `${value}${unit}` : value})`);
    } else {
      const cssKey = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      node.style.setProperty(cssKey, typeof value === 'number' && !unitless.has(key) ? `${value}px` : String(value));
    }
  }
  if (transforms.length) node.style.transform = transforms.join(' ');
}

export function createMotionComponent<T extends React.ElementType>(tag: T) {
  const Component = forwardRef<HTMLElement, MotionElementProps<any>>(function DhaakonMotionElement(rawProps, forwardedRef) {
    const { as, initial, animate: target, transition, style, onMotionStart, onMotionComplete, ...props } = rawProps as MotionElementProps<T>;
    const localRef = useRef<HTMLElement | null>(null); const config = useContext(MotionContext); const reduced = useReducedMotion();
    useImperativeHandle(forwardedRef, () => localRef.current as HTMLElement);
    const initialKey = stableKey(initial); const targetKey = stableKey(target);
    useLayoutEffect(() => { if (localRef.current && initial) writeStyle(localRef.current, initial); }, [initialKey]);
    useEffect(() => {
      const node = localRef.current; if (!node || !target) return;
      const from = initial === false ? readStyle(node, target) : { ...(initial || readStyle(node, target)) };
      if (reduced) { writeStyle(node, target); onMotionComplete?.(); return; }
      const tween = new Tween<MotionStyle>({ ...config.transition, ...transition, from, to: target,
        onStart: () => onMotionStart?.(), onUpdate: (value) => writeStyle(node, value), onComplete: () => onMotionComplete?.() }).play();
      return () => { tween.cancel(); };
    }, [initialKey, targetKey, reduced, transition?.duration, transition?.delay, transition?.repeat, transition?.repeatDelay, transition?.yoyo, transition?.easing]);
    return React.createElement(as || tag, { ...props, style, ref: localRef });
  });
  return Component as React.ForwardRefExoticComponent<MotionElementProps<T> & React.RefAttributes<HTMLElement>>;
}

function readStyle(node: HTMLElement, target: MotionStyle) {
  const computed = getComputedStyle(node); const values: MotionStyle = {};
  for (const key of Object.keys(target)) {
    if (transformKeys.has(key)) values[key] = key.startsWith('scale') ? 1 : 0;
    else { const css = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`); const value = computed.getPropertyValue(css); values[key] = Number.isNaN(Number(value)) || value.trim() === '' ? value : Number(value); }
  }
  return values;
}
function stableKey(value: unknown) { try { return JSON.stringify(value); } catch { return String(value); } }

type MotionFactory = {
  div: React.ForwardRefExoticComponent<MotionElementProps<'div'> & React.RefAttributes<HTMLElement>>;
  span: React.ForwardRefExoticComponent<MotionElementProps<'span'> & React.RefAttributes<HTMLElement>>;
  button: React.ForwardRefExoticComponent<MotionElementProps<'button'> & React.RefAttributes<HTMLElement>>;
  section: React.ForwardRefExoticComponent<MotionElementProps<'section'> & React.RefAttributes<HTMLElement>>;
  article: React.ForwardRefExoticComponent<MotionElementProps<'article'> & React.RefAttributes<HTMLElement>>;
  [key: string]: React.ComponentType<any>;
};
const cache = new Map<string, React.ComponentType<any>>();
export const motion = new Proxy({} as MotionFactory, { get: (_, tag: string) => { if (!cache.has(tag)) cache.set(tag, createMotionComponent(tag as React.ElementType)); return cache.get(tag); } });
