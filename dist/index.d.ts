import { T as Tween, a as Timeline, L as Line, M as MotionValue, b as animate, s as stagger, E as EasingFunction, c as cubicBezier, d as spring } from './core-LekNLCui.js';
export { C as CycleSample, e as CycleSpec, D as Direction, f as Easing, g as EasingName, F as FrameDriver, h as FrameScheduler, i as FrameTask, j as MotionPrimitive, k as MotionValueShape, P as PropertyRange, R as RenderContext, l as TimelineItem, m as TimelineOptions, n as TweenOptions, o as TweenState, p as activeDuration, q as defaultRenderContext, r as interpolate, t as mix, u as resolveEasing, v as sampleCycle, w as scheduler, x as totalDuration } from './core-LekNLCui.js';

declare const _default: {
    Tween: typeof Tween;
    Timeline: typeof Timeline;
    Line: typeof Line;
    MotionValue: typeof MotionValue;
    animate: typeof animate;
    stagger: typeof stagger;
    Easing: {
        linear: (t: number) => number;
        easeInQuad: (t: number) => number;
        easeOutQuad: (t: number) => number;
        easeInOutQuad: (t: number) => number;
        easeInCubic: (t: number) => number;
        easeOutCubic: (t: number) => number;
        easeInOutCubic: (t: number) => number;
        easeInQuart: (t: number) => number;
        easeOutQuart: (t: number) => number;
        easeInOutQuart: (t: number) => number;
        easeOutBack: (t: number) => number;
        dhaakon: EasingFunction;
    };
    cubicBezier: typeof cubicBezier;
    spring: typeof spring;
};

export { EasingFunction, Line, MotionValue, Timeline, Tween, animate, cubicBezier, _default as default, spring, stagger };
