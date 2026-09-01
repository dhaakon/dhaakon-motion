import { T as Tween, a as Timeline, L as Line, M as MotionValue, b as animate, s as stagger, E as EasingFunction, c as cubicBezier, d as spring } from './core-Cr8UG3gM.js';
export { C as CycleSample, e as CycleSpec, D as Direction, f as Easing, g as EasingName, F as FrameDriver, h as FrameRate, i as FrameRateInput, j as FrameRates, k as FrameScheduler, l as FrameTask, m as MotionPrimitive, n as MotionValueShape, P as PropertyRange, R as RenderContext, o as TimeInput, p as Timecode, q as TimelineItem, r as TimelineOptions, t as TimelinePosition, u as TweenOptions, v as TweenState, w as activeDuration, x as addFrames, y as defaultRenderContext, z as formatTime, A as formatTimecode, B as frameRate, G as frameToMs, H as framesToTimecode, I as interpolate, J as mix, K as msToFrame, N as msToTimecode, O as parseTime, Q as parseTimecode, S as resolveEasing, U as sampleCycle, V as scheduler, W as snapToFrame, X as timecodeToFrames, Y as timecodeToMs, Z as totalDuration } from './core-Cr8UG3gM.js';

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
