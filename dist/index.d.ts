export type EasingFunction = (t: number) => number;
export declare const Easing: Record<string, EasingFunction>;
export declare class Line { constructor(start: number[], end: number[]); value(t: number): number[]; }
export interface TweenOptions { duration?: number; delay?: number; easing?: EasingFunction; curve?: [number, number] | Line; properties?: Record<string, {start: number; end: number}>; node?: unknown; onBegin?: () => void; onUpdate?: (value: number | number[] | Record<string, number>) => void; onEnd?: () => void; }
export declare class Tween { constructor(options?: TweenOptions); to(options: TweenOptions): this; play(options?: TweenOptions): this; pause(): this; stop(): this; reverse(): this; }
export declare class Timeline extends Tween { addTween(tween: Tween): this; addTweens(tweens: Tween[]): this; loop(value?: boolean): this; }
declare const _default: {Tween: typeof Tween; Timeline: typeof Timeline; Line: typeof Line; Easing: typeof Easing};
export default _default;
