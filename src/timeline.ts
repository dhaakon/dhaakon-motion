import { Tween } from './core';
import type { MotionValueShape } from './interpolate';
import { sampleCycle, totalDuration as cycleTotalDuration, type Direction } from './cycle';
import { defaultRenderContext, type CueEvent, type CueOptions, type Marker, type RenderContext, type TimelineItem } from './items';
import { frameRate, msToFrame, parseTime, type FrameRateInput } from './time';
import { formatTimecode, msToTimecode } from './timecode';
import type { FrameScheduler } from './scheduler';
import { Transport } from './transport';

export interface InspectNode {
  kind: string;
  name?: string;
  start: number;
  end: number;
  duration: number;
  totalDuration: number;
  repeat: number;
  direction: string;
  startTimecode?: string;
  children: InspectNode[];
  markers: readonly Marker[];
  cues: readonly { name: string; time: number }[];
}

export interface TimelineOptions {
  name?: string;
  repeat?: number;
  repeatDelay?: number;
  yoyo?: boolean;
  autoplay?: boolean;
  onUpdate?: (time: number, progress: number) => void;
  onComplete?: () => void;
  scheduler?: FrameScheduler;
  /** Frame rate used to resolve frame ('12f') and timecode positions, and by `.frames`/`.timecode()`. Defaults to 60 fps. */
  frameRate?: FrameRateInput;
  /** Quantize every rendered time to a frame boundary before sampling children. */
  snap?: boolean;
}

export type TimelinePosition = number | '<' | '>' | string;
interface TimelineEntry { item: TimelineItem; start: number; end: number; }

interface CrossingPoint {
  name: string;
  time: number;
  payload: unknown;
  once: boolean;
  fired: boolean;
  onForward?: (e: CueEvent) => void;
  onBackward?: (e: CueEvent) => void;
}

const TIME_LITERAL_RE = /^-?\d+(?:\.\d+)?(?:f|s|ms)$|^\d{1,2}:\d{2}:\d{2}[:;]\d{1,2}$/i;
const ANCHOR_RE = /^([<>])(?:([+-]=)(.+))?$/;
const LABEL_OFFSET_RE = /^(.+?)([+-]=)(.+)$/;

/**
 * A local clock that samples a flat list of children (tweens, tracks, nested
 * timelines, audio clips) from one position, plus named markers and cues.
 * A root timeline (one with no parent) lazily owns a private `Transport`
 * that its `play`/`pause`/`seek`/... methods forward to.
 */
export class Timeline implements TimelineItem {
  readonly kind = 'timeline' as const;
  name?: string;
  readonly options: TimelineOptions;

  private entries: TimelineEntry[] = [];
  private labels = new Map<string, number>();
  private cursor = 0;
  /** The furthest a marker/cue/region reaches; a cue-only timeline (no content) still has a real, sampleable duration. */
  private markerCursor = 0;
  private rateInput?: FrameRateInput;
  private points: CrossingPoint[] = [];
  private markerMeta = new Map<string, { color?: string; payload?: unknown }>();
  private lastCycleTime: number | null = null;
  private lastIteration = 0;

  private parentTimeline?: Timeline;
  private ownTransport?: Transport;

  constructor(options: TimelineOptions = {}) {
    this.options = options;
    this.name = options.name;
    this.rateInput = options.frameRate;
    if (options.autoplay) queueMicrotask(() => this.play());
  }

  // ---- content length vs. playback length -------------------------------
  /** Content length: the furthest a child, marker, cue, or region reaches, before this timeline's own repeat/yoyo is applied. */
  get duration() { return Math.max(this.cursor, this.markerCursor); }
  /** Content length including this timeline's own repeat/repeatDelay. `Infinity` when `repeat` is `Infinity`. */
  get totalDuration() {
    return cycleTotalDuration({ duration: this.duration, delay: 0, repeat: this.options.repeat ?? 0, repeatDelay: this.options.repeatDelay ?? 0 });
  }
  get frameRate() { return frameRate(this.rateInput ?? 60); }
  get frames() { return msToFrame(this.duration, this.frameRate); }
  timecode(ms = this.duration) { return msToTimecode(ms, this.frameRate); }

  // ---- tree ---------------------------------------------------------------
  get parent(): Timeline | undefined { return this.parentTimeline; }
  get items(): ReadonlyArray<{ item: TimelineItem; start: number; end: number }> { return this.entries; }
  /** Walks up to the outermost timeline and returns its private transport, if it has been played. */
  get rootTransport(): Transport | undefined {
    let node: Timeline = this;
    while (node.parentTimeline) node = node.parentTimeline;
    return node.ownTransport;
  }
  /** Called by a `Transport`'s constructor when it adopts this timeline as its `root` (including its own default root). Not usually called directly. */
  bindTransport(transport: Transport) {
    if (this.parentTimeline) throw new Error(this.nestedError());
    if (this.ownTransport && this.ownTransport !== transport) {
      throw new Error(`Timeline${this.name ? ` "${this.name}"` : ''} already has its own transport (it was played directly, or is already another transport's root).`);
    }
    this.ownTransport = transport;
  }

  label(name: string, at: TimelinePosition = this.cursor) {
    const time = this.resolvePosition(at, this.entries.at(-1));
    this.labels.set(name, time);
    this.markerCursor = Math.max(this.markerCursor, time);
    return this;
  }

  add(item: TimelineItem, at?: TimelinePosition): this {
    if (item instanceof Timeline) {
      if (item.parentTimeline) throw new Error(`Timeline${item.name ? ` "${item.name}"` : ''} is already attached to another timeline.`);
      if (item.ownTransport) throw new Error(`Timeline${item.name ? ` "${item.name}"` : ''} already has its own transport (it was played directly); nest it before playing it.`);
      item.parentTimeline = this;
      if (item.rateInput == null && this.rateInput != null) item.rateInput = this.rateInput;
    }
    const previous = this.entries.at(-1);
    const start = this.resolvePosition(at, previous);
    const end = start + item.totalDuration;
    this.entries.push({ item, start, end });
    this.cursor = Math.max(this.cursor, end);
    return this;
  }
  /** @deprecated kept for the pre-0.4 API; identical to `add`. */
  addTween<T extends MotionValueShape>(tween: Tween<T>, at?: TimelinePosition) { return this.add(tween, at); }
  addTweens(tweens: Tween<MotionValueShape>[]) { tweens.forEach((tween) => this.add(tween)); return this; }

  remove(item: TimelineItem): this {
    const index = this.entries.findIndex((entry) => entry.item === item);
    if (index === -1) return this;
    this.entries.splice(index, 1);
    if (item instanceof Timeline && item.parentTimeline === this) item.parentTimeline = undefined;
    this.cursor = this.entries.reduce((max, entry) => Math.max(max, entry.end), 0);
    return this;
  }
  clear(): this {
    for (const entry of this.entries) if (entry.item instanceof Timeline && entry.item.parentTimeline === this) entry.item.parentTimeline = undefined;
    this.entries = [];
    this.labels.clear();
    this.markerMeta.clear();
    this.points = [];
    this.cursor = 0;
    this.markerCursor = 0;
    this.lastCycleTime = null;
    this.lastIteration = 0;
    return this;
  }

  // ---- markers, cues, regions ---------------------------------------------
  get markers(): readonly Marker[] {
    return [...this.labels.entries()]
      .map(([name, time]) => ({ kind: 'marker' as const, name, time, ...this.markerMeta.get(name) }))
      .sort((a, b) => a.time - b.time);
  }
  get cues(): readonly { name: string; time: number }[] {
    return this.points.map((p) => ({ name: p.name, time: p.time })).sort((a, b) => a.time - b.time);
  }
  marker(name: string, at: TimelinePosition = this.cursor, options: { color?: string; payload?: unknown } = {}): this {
    const time = this.resolvePosition(at, this.entries.at(-1));
    this.labels.set(name, time);
    this.markerCursor = Math.max(this.markerCursor, time);
    if (options.color != null || options.payload !== undefined) this.markerMeta.set(name, options);
    return this;
  }

  cue(name: string, at: TimelinePosition, handler: (e: CueEvent) => void, options: CueOptions = {}): this {
    const time = this.resolvePosition(at, this.entries.at(-1));
    this.insertPoint({ name, time, payload: options.payload, once: options.once ?? false, fired: false, onForward: handler, onBackward: handler });
    return this;
  }

  region(name: string, from: TimelinePosition, to: TimelinePosition, options: CueOptions = {}): this {
    const previous = this.entries.at(-1);
    const fromTime = this.resolvePosition(from, previous);
    const toTime = this.resolvePosition(to, previous);
    const payload = options.payload;
    const once = options.once ?? false;
    this.insertPoint({ name, time: fromTime, payload, once, fired: false, onForward: options.onEnter, onBackward: options.onExit });
    this.insertPoint({ name, time: toTime, payload, once, fired: false, onForward: options.onExit, onBackward: options.onEnter });
    return this;
  }

  private insertPoint(point: CrossingPoint) {
    const index = this.points.findIndex((existing) => existing.time > point.time);
    if (index === -1) this.points.push(point); else this.points.splice(index, 0, point);
    this.markerCursor = Math.max(this.markerCursor, point.time);
  }

  seekToMarker(name: string): this {
    const time = this.labels.get(name);
    if (time == null) throw new Error(`Unknown timeline label: ${name}`);
    this.seek(this.totalDuration ? time / this.totalDuration : 0);
    return this;
  }
  nextMarker(fromMs = this.lastCycleTime ?? 0): Marker | undefined {
    return this.markers.find((marker) => marker.time > fromMs);
  }
  previousMarker(fromMs = this.lastCycleTime ?? 0): Marker | undefined {
    return [...this.markers].reverse().find((marker) => marker.time < fromMs);
  }

  // ---- inspection -----------------------------------------------------------
  inspect(): InspectNode { return this.inspectAsChild(0, this.totalDuration); }
  private inspectAsChild(start: number, end: number): InspectNode {
    return {
      kind: this.kind, name: this.name, start, end,
      duration: this.duration, totalDuration: this.totalDuration,
      repeat: this.options.repeat ?? 0, direction: this.options.yoyo ? 'alternate' : 'normal',
      startTimecode: formatTimecode(msToTimecode(start, this.frameRate)),
      children: this.entries.map((entry) => entry.item instanceof Timeline
        ? entry.item.inspectAsChild(entry.start, entry.end)
        : {
          kind: entry.item.kind, name: entry.item.name, start: entry.start, end: entry.end,
          duration: entry.item.totalDuration, totalDuration: entry.item.totalDuration,
          repeat: 0, direction: 'normal', children: [], markers: [], cues: [],
        }),
      markers: this.markers,
      cues: this.cues,
    };
  }

  /** A stable, human-readable rendering of the tree, its markers, and its cues. */
  toAscii(options: { width?: number; frameRate?: FrameRateInput; labels?: boolean } = {}): string {
    const width = Math.max(10, options.width ?? 60);
    const root = this.inspect();
    const total = Math.max(1, Number.isFinite(root.totalDuration) ? root.totalDuration : root.duration);
    const scale = (t: number) => Math.max(0, Math.min(width, Math.round((Math.min(t, total) / total) * width)));
    const lines: string[] = [`${this.name ?? 'timeline'}  0 .. ${Math.round(total)}ms`];
    const renderNode = (node: InspectNode, depth: number, isLast: boolean, prefix: string) => {
      const connector = depth === 0 ? '' : (isLast ? '└ ' : '├ ');
      const barStart = scale(node.start);
      const barEnd = Math.max(barStart + 1, scale(node.end));
      const bar = `${' '.repeat(barStart)}${'█'.repeat(Math.min(width, barEnd) - barStart)}`;
      const label = (node.name ?? node.kind).padEnd(10);
      lines.push(`${prefix}${connector}${label} ${node.kind.padEnd(8)} ${bar}`);
      const childPrefix = depth === 0 ? '' : `${prefix}${isLast ? '  ' : '│ '}`;
      node.children.forEach((child, index) => renderNode(child, depth + 1, index === node.children.length - 1, childPrefix));
    };
    root.children.forEach((child, index) => renderNode(child, 1, index === root.children.length - 1, ''));
    if (options.labels !== false) {
      const markerText = this.markers.map((marker) => `◆ ${marker.name} @ ${Math.round(marker.time)}`).join('   ');
      const cueText = this.cues.map((cue) => `● ${cue.name} @ ${Math.round(cue.time)}`).join('   ');
      if (markerText) lines.push(markerText);
      if (cueText) lines.push(cueText);
    }
    return lines.join('\n');
  }

  /** How a position string resolved: its absolute time, and (for a label/anchor form) the base it was measured from. */
  explain(position: TimelinePosition): { ms: number; frame: number; timecode: string; base?: string; offset?: number } {
    const previous = this.entries.at(-1);
    const ms = this.resolvePosition(position, previous);
    const result: { ms: number; frame: number; timecode: string; base?: string; offset?: number } = {
      ms, frame: msToFrame(ms, this.frameRate), timecode: formatTimecode(msToTimecode(ms, this.frameRate)),
    };
    if (typeof position === 'string') {
      const text = position.trim();
      const anchorMatch = text.match(ANCHOR_RE);
      if (anchorMatch) {
        result.base = anchorMatch[1];
        if (anchorMatch[3]) result.offset = parseTime(anchorMatch[3], this.frameRate) * (anchorMatch[2] === '+=' ? 1 : -1);
      } else {
        const labelMatch = text.match(LABEL_OFFSET_RE);
        if (labelMatch) { result.base = labelMatch[1]; result.offset = parseTime(labelMatch[3], this.frameRate) * (labelMatch[2] === '+=' ? 1 : -1); }
      }
    }
    return result;
  }

  // ---- playback (root timelines only) --------------------------------------
  private nestedError(): string {
    return `Timeline${this.name ? ` "${this.name}"` : ''} is nested; control its root transport instead.`;
  }
  private get transport(): Transport {
    if (this.parentTimeline) throw new Error(this.nestedError());
    if (!this.ownTransport) {
      this.ownTransport = new Transport({ root: this, scheduler: this.options.scheduler, frameRate: this.rateInput, snap: this.options.snap });
    }
    return this.ownTransport;
  }
  get state() { return this.transport.state; }
  get finished() { return this.transport.finished; }

  play(): this { this.transport.play(); return this; }
  start(): this { return this.play(); }
  pause(): this { this.transport.pause(); return this; }
  stop(): this { this.transport.stop(); return this; }
  reverse(): this { this.transport.reverse(); return this; }
  /** `progress` is a 0..1 fraction of `totalDuration`, matching the pre-0.4 API. */
  seek(progress: number): this {
    const duration = this.totalDuration;
    this.transport.seek(Number.isFinite(duration) ? Math.max(0, Math.min(1, progress)) * duration : 0);
    return this;
  }
  loop(value = true): this { this.options.repeat = value ? Infinity : 0; return this; }

  // ---- sampling -------------------------------------------------------------
  sampleAt(localMs: number, ctx: RenderContext = defaultRenderContext) {
    const spec = {
      duration: this.duration, delay: 0,
      repeat: this.options.repeat ?? 0, repeatDelay: this.options.repeatDelay ?? 0,
      direction: (this.options.yoyo ? 'alternate' : 'normal') as Direction, reversed: false,
    };
    const { cycleTime, iteration, progress } = sampleCycle(spec, localMs);

    if (ctx.fireCues && this.points.length) this.fireCrossings(cycleTime, iteration, ctx);
    this.lastCycleTime = cycleTime;
    this.lastIteration = iteration;

    for (const entry of this.entries) entry.item.sampleAt(cycleTime - entry.start, ctx);
    this.options.onUpdate?.(cycleTime, progress);
    if (progress >= 1 && iteration >= (this.options.repeat ?? 0)) this.options.onComplete?.();
    return cycleTime;
  }
  /** Alias of `sampleAt` for absolute (not delay-relative) callers, matching the pre-0.4 API. */
  render(time: number) { this.sampleAt(time); }

  reset() {
    this.lastCycleTime = null;
    this.lastIteration = 0;
    for (const point of this.points) point.fired = false;
    for (const entry of this.entries) entry.item.reset?.();
  }

  private iterationReversed(iteration: number): boolean {
    return this.options.yoyo === true && iteration % 2 === 1;
  }

  private fireCrossings(cycleTime: number, iteration: number, ctx: RenderContext) {
    if (this.lastCycleTime == null) {
      this.fireSegment(ctx.direction >= 0 ? -Infinity : Infinity, cycleTime, ctx);
      return;
    }
    if (iteration === this.lastIteration) {
      this.fireSegment(this.lastCycleTime, cycleTime, ctx);
      return;
    }
    const stepDir = iteration > this.lastIteration ? 1 : -1;
    let iter = this.lastIteration;
    let from = this.lastCycleTime;
    let guard = 0;
    while (iter !== iteration && guard++ < 2000) {
      const tail = this.iterationReversed(iter) ? 0 : this.duration;
      this.fireSegment(from, tail, ctx);
      iter += stepDir;
      from = this.iterationReversed(iter) ? this.duration : 0;
    }
    this.fireSegment(from, cycleTime, ctx);
  }

  private fireSegment(fromT: number, toT: number, ctx: RenderContext) {
    if (toT === fromT || !this.points.length) return;
    const forward = toT > fromT;
    const ordered = forward ? this.points : [...this.points].reverse();
    for (const point of ordered) {
      const crossed = forward ? (point.time > fromT && point.time <= toT) : (point.time <= fromT && point.time > toT);
      if (!crossed) continue;
      if (point.once && point.fired) continue;
      const handler = forward ? point.onForward : point.onBackward;
      if (!handler) continue;
      point.fired = true;
      const event: CueEvent = { name: point.name, time: point.time, direction: forward ? 1 : -1, payload: point.payload, timeline: this, frame: ctx.frame };
      try { handler(event); this.rootTransport?.noteCue(point.name); } catch (err) { (this.rootTransport?.onError ?? defaultOnError)(err); }
    }
  }

  // ---- positions --------------------------------------------------------
  private resolvePosition(at: TimelinePosition | undefined, previous?: TimelineEntry): number {
    if (at == null) return previous?.end ?? 0;
    if (typeof at === 'number') return Math.max(0, at);
    const text = at.trim();

    const anchorMatch = text.match(ANCHOR_RE);
    if (anchorMatch) {
      const [, anchor, op, offsetText] = anchorMatch;
      const base = anchor === '<' ? (previous?.start ?? 0) : (previous?.end ?? 0);
      if (!op) return Math.max(0, base);
      return Math.max(0, base + parseTime(offsetText, this.frameRate) * (op === '+=' ? 1 : -1));
    }

    if (TIME_LITERAL_RE.test(text)) return Math.max(0, parseTime(text, this.frameRate));

    const labelMatch = text.match(LABEL_OFFSET_RE);
    const labelName = labelMatch ? labelMatch[1] : text;
    const base = this.labels.get(labelName);
    if (base == null) throw new Error(`Unknown timeline label: ${at}`);
    if (!labelMatch) return Math.max(0, base);
    return Math.max(0, base + parseTime(labelMatch[3], this.frameRate) * (labelMatch[2] === '+=' ? 1 : -1));
  }
}

function defaultOnError(err: unknown) { console.error(err); }
