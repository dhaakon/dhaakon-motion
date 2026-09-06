import React, {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import {
  createCssAnimator,
  defaultCssMotionTokens,
  type CssAnimator,
  type CssMotionTokens,
  type CssPlayback,
  type CssPlaybackResult,
  type CssTarget,
  type CssTransition,
} from '@dhaakon/motion/css';
import { useReducedMotion } from './react-config';

export type CssVariants = Readonly<Record<string, CssTarget>>;
export interface CssMotionProps {
  initial?: CssTarget | string | false;
  animate: CssTarget | string;
  variants?: CssVariants;
  transition?: CssTransition | string;
  onMotionStart?: (playback: CssPlayback) => void;
  onMotionComplete?: (result: CssPlaybackResult) => void;
}
const CssContext = createContext<CssMotionTokens>(defaultCssMotionTokens);
export function CssMotionConfig({
  tokens,
  children,
}: {
  tokens: CssMotionTokens;
  children: React.ReactNode;
}) {
  const parent = useContext(CssContext);
  const value = useMemo(() => ({ ...parent, ...tokens }), [parent, tokens]);
  return <CssContext.Provider value={value}>{children}</CssContext.Provider>;
}
const useOwnedLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
function resolveVariant(value: CssTarget | string, variants?: CssVariants): CssTarget {
  if (typeof value !== 'string') return value;
  if (!variants || !Object.hasOwn(variants, value))
    throw new Error(`Unknown CSS variant: ${value}`);
  return variants[value];
}

/** Additive CSS-native API. Existing numeric motion/gesture semantics remain unchanged. */
export function createCssMotionComponent<T extends React.ElementType>(tag: T) {
  type Props = Omit<React.ComponentPropsWithoutRef<T>, keyof CssMotionProps> & CssMotionProps;
  const Component = forwardRef<HTMLElement, Props>(
    function CssMotionElement(rawProps, forwardedRef) {
      const {
        initial,
        animate,
        variants,
        transition,
        onMotionStart,
        onMotionComplete,
        style,
        ...props
      } = rawProps as CssMotionProps & { style?: React.CSSProperties; [key: string]: unknown };
      const tokens = useContext(CssContext);
      const reduced = useReducedMotion();
      const target = resolveVariant(animate, variants);
      const timing =
        typeof transition === 'string'
          ? Object.hasOwn(tokens, transition)
            ? tokens[transition]
            : (() => {
                throw new Error(`Unknown CSS motion token: ${transition}`);
              })()
          : (transition ?? tokens.feedback);
      // Stable authoring snapshot prevents React from overwriting imperative frame values.
      const first = useRef({
        value: !reduced && initial ? { ...resolveVariant(initial, variants) } : { ...target },
        shouldAnimate: initial !== undefined && initial !== false,
      });
      const node = useRef<HTMLElement | null>(null);
      const owner = useRef<CssAnimator | null>(null);
      const fresh = useRef(true);
      const callbacks = useRef({ onMotionStart, onMotionComplete });
      callbacks.current = { onMotionStart, onMotionComplete };
      const targetKey = JSON.stringify(target);
      useOwnedLayoutEffect(() => {
        if (!node.current) return;
        const animator = createCssAnimator(node.current);
        owner.current = animator;
        fresh.current = true;
        try {
          animator.set(first.current.value);
        } catch (error) {
          owner.current = null;
          animator.dispose();
          throw error;
        }
        return () => {
          owner.current = null;
          animator.dispose();
        };
      }, []);
      useOwnedLayoutEffect(() => {
        const animator = owner.current;
        if (!animator) return;
        let valid = true;
        const skipEntry = fresh.current && !first.current.shouldAnimate;
        fresh.current = false;
        const playback = animator.animate(target, {
          ...timing,
          duration: skipEntry ? 0 : timing.duration,
          reducedMotion: reduced,
        });
        callbacks.current.onMotionStart?.(playback);
        void playback.finished.then((result) => {
          if (valid && result.status === 'finished') callbacks.current.onMotionComplete?.(result);
        });
        // Retargeting is owned by animator.animate, which samples the current computed style
        // before cancelling. Only invalidate callbacks here; teardown owns cancellation.
        return () => {
          valid = false;
        };
      }, [targetKey, timing.duration, timing.delay, timing.easing, reduced]);
      const ref = useMemo(
        () => (element: HTMLElement | null) => {
          node.current = element;
          if (typeof forwardedRef === 'function') forwardedRef(element);
          else if (forwardedRef) forwardedRef.current = element;
        },
        [forwardedRef],
      );
      return React.createElement(tag, {
        ...props,
        ref,
        style: { ...style, ...first.current.value },
      });
    },
  );
  Component.displayName = `CssMotion(${typeof tag === 'string' ? tag : 'Component'})`;
  return Component;
}

export const cssMotion = {
  div: createCssMotionComponent('div'),
  section: createCssMotionComponent('section'),
  article: createCssMotionComponent('article'),
  span: createCssMotionComponent('span'),
  button: createCssMotionComponent('button'),
};
