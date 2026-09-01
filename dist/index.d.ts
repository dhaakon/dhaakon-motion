import { T as Tween, a as Timeline, b as Transport, L as Line, M as MotionValue, c as animate, s as stagger, E as EasingFunction, d as cubicBezier, e as spring } from './core-D60sAinY.js';
export { C as Clock, f as CueEvent, g as CueOptions, h as CycleSample, i as CycleSpec, D as Direction, j as Easing, k as EasingName, F as FrameDriver, l as FrameInfo, m as FrameRate, n as FrameRateInput, o as FrameRates, p as FrameScheduler, q as FrameTask, r as Marker, t as MotionPrimitive, u as MotionValueShape, P as PropertyRange, R as RenderContext, v as TimeInput, w as Timecode, x as TimelineItem, y as TimelineOptions, z as TimelinePosition, A as TransportOptions, B as TransportOutput, G as TransportState, H as TweenOptions, I as TweenState, J as activeDuration, K as addFrames, N as defaultRenderContext, O as formatTime, Q as formatTimecode, S as frameRate, U as frameToMs, V as framesToTimecode, W as interpolate, X as mix, Y as msToFrame, Z as msToTimecode, _ as parseTime, $ as parseTimecode, a0 as resolveEasing, a1 as sampleCycle, a2 as scheduler, a3 as snapToFrame, a4 as timecodeToFrames, a5 as timecodeToMs, a6 as totalDuration } from './core-D60sAinY.js';

declare const _default: {
    Tween: typeof Tween;
    Timeline: typeof Timeline;
    Transport: typeof Transport;
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

export { EasingFunction, Line, MotionValue, Timeline, Transport, Tween, animate, cubicBezier, _default as default, spring, stagger };
