/** Browser-owned CSS transitions. No browser access, clock or Wasm at import time. */
type CssTarget = Readonly<Record<string, string | number>>;
interface CssTransition {
    duration?: number;
    delay?: number;
    easing?: string;
}
type CssMotionTokens = Readonly<Record<string, Readonly<CssTransition>>>;
interface CssPlaybackResult {
    status: 'finished' | 'cancelled';
    backend: 'waapi' | 'instant';
    reason?: string;
}
interface CssPlayback {
    readonly backend: 'waapi' | 'instant';
    readonly finished: Promise<CssPlaybackResult>;
    cancel(): void;
}
interface CssAnimator {
    animate(target: CssTarget, options?: CssTransition & {
        reducedMotion?: boolean;
    }): CssPlayback;
    set(target: CssTarget): void;
    /** Cancels native effects and restores the inline declarations this owner acquired. */
    dispose(): void;
}
declare const defaultCssMotionTokens: CssMotionTokens;
/** Pass @dhaakon/ui's tokens.motion. This adapter does not import or require the UI package. */
declare function createCssMotionTokens(source: {
    duration: string;
    durationFast: string;
    durationSlow: string;
    ease: string;
}): CssMotionTokens;
/** One exclusive CSS animator per element; do not independently animate its owned properties. */
declare function createCssAnimator(element: HTMLElement): CssAnimator;

export { type CssAnimator, type CssMotionTokens, type CssPlayback, type CssPlaybackResult, type CssTarget, type CssTransition, createCssAnimator, createCssMotionTokens, defaultCssMotionTokens };
