import React from 'react';
import { MotionValueShape, TweenOptions, Tween, EasingFunction, EasingName, MotionValue, Timeline } from '@dhaakon/motion';

interface MotionTransition {
    duration?: number;
    delay?: number;
    repeat?: number;
    repeatDelay?: number;
    yoyo?: boolean;
    easing?: EasingFunction | EasingName;
}
interface MotionConfigValue {
    transition?: MotionTransition;
    reducedMotion?: 'user' | 'always' | 'never';
}
declare function MotionConfig({ children, ...value }: MotionConfigValue & {
    children: React.ReactNode;
}): React.JSX.Element;
declare function useReducedMotion(): boolean;
declare function useMotionValue<T extends MotionValueShape>(initial: T): MotionValue<T>;
declare function useMotionValueState<T extends MotionValueShape>(value: MotionValue<T>): T;
declare function useTween<T extends MotionValueShape>(from: T, to: T, options?: Omit<TweenOptions<T>, 'from' | 'to'>): {
    value: T;
    motionValue: MotionValue<T>;
    controls: React.RefObject<Tween<T> | null>;
};
declare function useTimeline(factory: () => Timeline, dependencies?: React.DependencyList): React.RefObject<Timeline | null>;
interface MotionRenderProps<T extends MotionValueShape> extends Omit<TweenOptions<T>, 'from' | 'to'> {
    from: T;
    to: T;
    children: (value: T, controls: React.RefObject<Tween<T> | null>) => React.ReactNode;
}
declare function Motion<T extends MotionValueShape>({ from, to, children, ...options }: MotionRenderProps<T>): React.JSX.Element;
type MotionStyle = Record<string, number | string>;
type NativeProps<T extends React.ElementType> = Omit<React.ComponentPropsWithoutRef<T>, 'style'>;
type MotionElementProps<T extends React.ElementType> = NativeProps<T> & {
    initial?: MotionStyle | false;
    animate?: MotionStyle;
    transition?: MotionTransition;
    style?: React.CSSProperties;
    onMotionStart?: () => void;
    onMotionComplete?: () => void;
    as?: React.ElementType;
};
declare function createMotionComponent<T extends React.ElementType>(tag: T): React.ForwardRefExoticComponent<MotionElementProps<T> & React.RefAttributes<HTMLElement>>;
type MotionFactory = {
    div: React.ForwardRefExoticComponent<MotionElementProps<'div'> & React.RefAttributes<HTMLElement>>;
    span: React.ForwardRefExoticComponent<MotionElementProps<'span'> & React.RefAttributes<HTMLElement>>;
    button: React.ForwardRefExoticComponent<MotionElementProps<'button'> & React.RefAttributes<HTMLElement>>;
    section: React.ForwardRefExoticComponent<MotionElementProps<'section'> & React.RefAttributes<HTMLElement>>;
    article: React.ForwardRefExoticComponent<MotionElementProps<'article'> & React.RefAttributes<HTMLElement>>;
    [key: string]: React.ComponentType<any>;
};
declare const motion: MotionFactory;

export { Motion, MotionConfig, type MotionConfigValue, type MotionElementProps, type MotionRenderProps, type MotionStyle, type MotionTransition, createMotionComponent, motion, useMotionValue, useMotionValueState, useReducedMotion, useTimeline, useTween };
