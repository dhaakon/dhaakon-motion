/**
 * The shared contract every timeline participant implements: tweens, tracks,
 * nested timelines, cues, markers, and audio clips. A `Timeline` holds a flat
 * list of these and drives them from one local clock.
 */
export interface TimelineItem {
  readonly kind: string;
  name?: string;
  /** Total occupied time in milliseconds, including delay and repeats. `Infinity` is allowed. */
  readonly totalDuration: number;
  /** Write values (and fire cues) for a local time. `ctx` carries direction and, when driven by a transport, frame/transport info. */
  sampleAt(localMs: number, ctx?: RenderContext): void;
  /** Clear any "already fired" state (cue `once`, crossing history) so the next sample starts fresh. */
  reset?(): void;
}

export interface RenderContext {
  direction: 1 | -1;
  fireCues: boolean;
  frame?: unknown;
  transport?: unknown;
}

export const defaultRenderContext: RenderContext = { direction: 1, fireCues: true };
