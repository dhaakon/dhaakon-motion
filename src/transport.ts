import { scheduler, type FrameScheduler, type FrameTask } from './scheduler';
import { frameRate, frameToMs, msToFrame, parseTime, type FrameRate, type FrameRateInput, type TimeInput } from './time';
import { formatTimecode, msToTimecode } from './timecode';
import { Timeline, type TimelinePosition } from './timeline';
import type { TimelineItem } from './items';

/** A source of "now", in milliseconds. Swap it to make something other than the scheduler's driver the master clock (e.g. an `AudioContext`). */
export interface Clock { now(): number; }

export type TransportState = 'idle' | 'playing' | 'paused' | 'finished';

export interface TransportOptions {
  /** Tick source. Defaults to the shared global scheduler. */
  scheduler?: FrameScheduler;
  /** Time source. Defaults to the scheduler's own clock. */
  clock?: Clock;
  /** Used for `.frame`, `.timecode`, `snap`, and to resolve frame/timecode inputs. Default 60 fps. */
  frameRate?: FrameRateInput;
  /** Quantize every rendered time to a frame boundary. */
  snap?: boolean;
  /** Playback rate. Negative plays backwards. Default 1. */
  rate?: number;
  /** `true` loops the whole duration; `[from, to]` loops just that region. */
  loop?: boolean | [TimeInput, TimeInput];
  /** Overrides `root.totalDuration` (needed when the root repeats infinitely on its own but the transport should still have a bound). */
  duration?: TimeInput;
  /** Use this timeline as the root instead of creating an empty one. */
  root?: Timeline;
}

export interface FrameInfo {
  time: number;
  frame: number;
  timecode: string;
  delta: number;
  rate: number;
  direction: 1 | -1;
  frameRate: FrameRate;
}

export interface TransportOutput {
  name?: string;
  onAttach?(transport: Transport): void;
  onTick?(info: FrameInfo): void;
  onStateChange?(state: TransportState, transport: Transport): void;
  onSeek?(info: FrameInfo): void;
  onRateChange?(rate: number): void;
  onDetach?(): void;
  /** `false` means this output cannot be driven by `renderFrames`/offline rendering (e.g. live audio). Default `true`. */
  supportsOffline?: boolean;
}

/**
 * One clock authority for a composition. Timelines render into it; outputs
 * (DOM, Three.js, Canvas, audio, hardware) draw or send once per tick, after
 * every value has been written for that instant.
 */
export class Transport {
  readonly frameRate: FrameRate;
  root: Timeline;
  onError: (err: unknown) => void = (err) => { console.error(err); };

  private schedulerRef: FrameScheduler;
  private clock: Clock;
  private _time = 0;
  private lastRenderedTime = 0;
  private _rate: number;
  private _state: TransportState = 'idle';
  private snap: boolean;
  private anchorClock = 0;
  private anchorTime = 0;
  private loopRegion: [number, number] | null = null;
  private explicitDuration?: number;
  private removeFrame?: () => void;
  private outputs = new Set<TransportOutput>();
  private listeners = new Set<(info: FrameInfo, transport: Transport) => void>();
  private loopListeners = new Set<() => void>();
  private resolveFinished!: (transport: this) => void;
  finished: Promise<this>;

  constructor(options: TransportOptions = {}) {
    this.schedulerRef = options.scheduler ?? scheduler;
    this.clock = options.clock ?? { now: () => this.schedulerRef.now() };
    this.frameRate = frameRate(options.frameRate ?? 60);
    this._rate = options.rate ?? 1;
    this.snap = options.snap ?? false;
    this.root = options.root ?? new Timeline({ scheduler: options.scheduler });
    if (options.duration != null) this.explicitDuration = parseTime(options.duration, this.frameRate);
    this.finished = this.newFinished();
    if (options.loop) this.setLoop(options.loop);
  }

  get time() { return this._time; }
  get rate() { return this._rate; }
  get state() { return this._state; }
  get duration() { return this.explicitDuration ?? this.root.totalDuration; }
  get frame() { return msToFrame(this._time, this.frameRate); }
  get timecode() { return formatTimecode(msToTimecode(this._time, this.frameRate)); }
  get progress() { const d = this.duration; return d && Number.isFinite(d) ? this._time / d : 0; }

  add(item: TimelineItem, at?: TimelinePosition): this { this.root.add(item, at); return this; }

  attach(output: TransportOutput): () => void {
    this.outputs.add(output);
    output.onAttach?.(this);
    return () => { if (this.outputs.delete(output)) output.onDetach?.(); };
  }

  subscribe(listener: (info: FrameInfo, transport: Transport) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** Notified once per lap when a loop region wraps. */
  onLoop(listener: () => void): () => void {
    this.loopListeners.add(listener);
    return () => { this.loopListeners.delete(listener); };
  }

  play(): this {
    if (this._state === 'playing') return this;
    if (this._state === 'finished') {
      this._time = this._rate >= 0 ? 0 : this.boundedDuration();
      this.lastRenderedTime = this._time;
      this.root.reset?.();
      this.finished = this.newFinished();
    }
    this._state = 'playing';
    this.anchorClock = this.clock.now();
    this.anchorTime = this._time;
    this.removeFrame = this.schedulerRef.add(this.onFrame);
    this.emitStateChange();
    return this;
  }

  pause(): this {
    if (this._state !== 'playing') return this;
    this.removeFrame?.();
    this._state = 'paused';
    this.emitStateChange();
    return this;
  }

  stop(): this {
    this.removeFrame?.();
    this._state = 'idle';
    this._time = 0;
    this.root.reset?.();
    this.renderAt(0, false);
    this.emitStateChange();
    return this;
  }

  toggle(): this { return this._state === 'playing' ? this.pause() : this.play(); }

  seek(to: TimeInput, options: { cues?: 'fire' | 'skip' } = {}): this {
    const target = Math.max(0, Math.min(this.boundedDuration(), parseTime(to, this.frameRate)));
    this._time = target;
    if (this._state === 'playing') { this.anchorClock = this.clock.now(); this.anchorTime = target; }
    this.renderAt(target, options.cues !== 'skip');
    this.emitSeek();
    return this;
  }
  seekFrame(frame: number): this { return this.seek(frameToMs(frame, this.frameRate)); }
  seekTimecode(tc: string): this { return this.seek(tc); }
  step(frames = 1): this { this.pause(); return this.seekFrame(this.frame + frames); }

  setRate(rate: number): this {
    if (this._state === 'playing') { this.anchorClock = this.clock.now(); this.anchorTime = this._time; }
    this._rate = rate;
    for (const output of this.outputs) output.onRateChange?.(rate);
    return this;
  }
  reverse(): this { return this.setRate(-this._rate); }

  setLoop(loop: TransportOptions['loop']): this {
    if (!loop) { this.loopRegion = null; return this; }
    if (loop === true) {
      const duration = this.duration;
      if (!Number.isFinite(duration)) throw new Error('Transport.setLoop(true) needs a finite duration; pass an explicit duration or a [from, to] region.');
      this.loopRegion = [0, duration];
      return this;
    }
    const [a, b] = loop;
    this.loopRegion = [parseTime(a, this.frameRate), parseTime(b, this.frameRate)];
    return this;
  }

  /** Follow an external clock (an LTC/MTC decoder, an OSC message, another transport). Hard-seeks past `threshold`; otherwise nudges rate to converge. */
  chase(externalMs: number, options: { smoothing?: number; threshold?: number } = {}): this {
    const smoothingWindow = (options.smoothing ?? 0.1) * 1000;
    const threshold = options.threshold ?? 40;
    if (this._state !== 'playing') this.play();
    const diff = externalMs - this._time;
    if (Math.abs(diff) > threshold) {
      const direction = this._rate >= 0 ? 1 : -1;
      this.seek(externalMs);
      this.setRate(direction);
      return this;
    }
    this.setRate(1 + diff / smoothingWindow);
    return this;
  }

  /** Manually drive the transport from an absolute clock value. Used by offline rendering and tests. */
  tick(now: number): void { this.advance(now); }

  dispose(): void {
    this.removeFrame?.();
    for (const output of this.outputs) output.onDetach?.();
    this.outputs.clear();
    this.listeners.clear();
    this.loopListeners.clear();
  }

  // The scheduler is only a tick source; the time source is `this.clock` (which may
  // differ, e.g. an AudioContext clock), so the scheduler's own `now` is ignored here.
  private onFrame: FrameTask = () => {
    this.advance(this.clock.now());
    return this._state === 'playing';
  };

  private advance(now: number) {
    const elapsed = now - this.anchorClock;
    this.advanceTo(this.anchorTime + elapsed * this._rate);
  }

  private advanceTo(rawTime: number) {
    if (this.loopRegion) {
      const [a, b] = this.loopRegion;
      const len = b - a;
      let remaining = rawTime;
      let guard = 0;
      while (len > 0 && guard++ < 10000) {
        if (this._rate >= 0) {
          if (remaining <= b) break;
          this.renderAt(b, true);
          this.fireLoop();
          remaining = a + (remaining - b);
        } else {
          if (remaining >= a) break;
          this.renderAt(a, true);
          this.fireLoop();
          remaining = b + (remaining - a);
        }
      }
      this._time = Math.max(a, Math.min(b, remaining));
      this.renderAt(this._time, true);
      return;
    }
    const duration = this.duration;
    const clamped = Math.max(0, Math.min(duration, rawTime));
    this._time = clamped;
    this.renderAt(clamped, true);
    const reachedEnd = Number.isFinite(duration) && duration > 0
      && ((this._rate >= 0 && clamped >= duration) || (this._rate < 0 && clamped <= 0));
    if (reachedEnd && this._state === 'playing') this.finish();
  }

  private renderAt(time: number, fireCues: boolean) {
    const quantized = this.snap ? this.frameSnap(time) : time;
    const direction: 1 | -1 = quantized >= this.lastRenderedTime ? 1 : -1;
    const delta = quantized - this.lastRenderedTime;
    this._time = quantized;
    const info: FrameInfo = {
      time: quantized,
      frame: msToFrame(quantized, this.frameRate),
      timecode: formatTimecode(msToTimecode(quantized, this.frameRate)),
      delta, rate: this._rate, direction, frameRate: this.frameRate,
    };
    this.root.sampleAt(quantized, { direction, fireCues, frame: info, transport: this });
    for (const output of this.outputs) {
      try { output.onTick?.(info); } catch (err) { this.onError(err); }
    }
    for (const listener of this.listeners) listener(info, this);
    this.lastRenderedTime = quantized;
  }

  private frameSnap(ms: number): number {
    return frameToMs(msToFrame(ms, this.frameRate), this.frameRate);
  }

  private emitSeek() {
    const info: FrameInfo = {
      time: this._time, frame: this.frame, timecode: this.timecode,
      delta: 0, rate: this._rate, direction: 1, frameRate: this.frameRate,
    };
    for (const output of this.outputs) output.onSeek?.(info);
  }

  private emitStateChange() {
    for (const output of this.outputs) output.onStateChange?.(this._state, this);
  }

  private fireLoop() {
    for (const listener of this.loopListeners) listener();
  }

  private boundedDuration(): number {
    const duration = this.duration;
    return Number.isFinite(duration) ? duration : 0;
  }

  private finish() {
    this._state = 'finished';
    this.emitStateChange();
    this.resolveFinished(this);
  }

  private newFinished(): Promise<this> {
    return new Promise((resolve) => { this.resolveFinished = resolve; });
  }
}
