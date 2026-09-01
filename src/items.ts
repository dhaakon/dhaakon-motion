import type { FrameInfo, Transport } from './transport';
import type { Timeline } from './timeline';

/**
 * The shared contract every timeline participant implements: tweens, tracks,
 * nested timelines, and audio clips. A `Timeline` holds a flat list of these
 * and drives them from one local clock.
 */
export interface TimelineItem {
  readonly kind: string;
  name?: string;
  /** Total occupied time in milliseconds, including delay and repeats. `Infinity` is allowed. */
  readonly totalDuration: number;
  /** Write values (and, for timelines, fire cues) for a local time. `ctx` carries direction and, when driven by a transport, frame/transport info. */
  sampleAt(localMs: number, ctx?: RenderContext): void;
  /** Clear any "already fired" state (cue `once`, crossing history) so the next sample starts fresh. */
  reset?(): void;
}

export interface RenderContext {
  direction: 1 | -1;
  fireCues: boolean;
  frame?: FrameInfo;
  transport?: Transport;
}

export const defaultRenderContext: RenderContext = { direction: 1, fireCues: true };

/** A named, zero-duration position on a timeline. Labels created with `.label()` are markers too. */
export interface Marker {
  kind: 'marker';
  name: string;
  time: number;
  color?: string;
  payload?: unknown;
}

/** What a cue or region handler receives when it fires. */
export interface CueEvent {
  name: string;
  time: number;
  direction: 1 | -1;
  payload: unknown;
  timeline: Timeline;
  frame: FrameInfo | undefined;
}

export interface CueOptions {
  payload?: unknown;
  /** Fire at most once; call `timeline.reset()` (or replay from the start) to re-arm it. */
  once?: boolean;
  onEnter?(e: CueEvent): void;
  onExit?(e: CueEvent): void;
}
