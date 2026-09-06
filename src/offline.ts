import { Transport, type FrameInfo, type TransportOutput } from './transport';
import { Timeline } from './timeline';
import { frameRate, frameToMs, msToFrame, parseTime, type FrameRateInput, type TimeInput } from './time';

/**
 * A `Transport` meant for offline export rather than real-time playback: it
 * is never `play()`ed, never touches the scheduler or `performance.now`, and
 * `attach()` skips (with one warning) any output whose `supportsOffline` is
 * `false` — e.g. live audio, which has nothing meaningful to do offline.
 */
export class OfflineTransport extends Transport {
  attach(output: TransportOutput): () => void {
    return attachForOffline(this, output, (o) => super.attach(o));
  }
}

export interface RenderFramesOptions {
  frameRate?: FrameRateInput;
  from?: TimeInput;
  to?: TimeInput;
  outputs?: TransportOutput[];
  signal?: AbortSignal;
  /** Frames between forced `await` yields to the event loop (default 0 = never yield beyond what `onFrame` itself awaits). */
  yieldEvery?: number;
}

function resolveOfflineTransport(source: Transport | Timeline, options: { frameRate?: FrameRateInput }): Transport {
  if (source instanceof Timeline && source.parent) throw new Error('Offline rendering requires a root timeline, not a nested child.');
  const transport = source instanceof Transport ? source : source.rootTransport ?? new OfflineTransport({ root: source, frameRate: options.frameRate ?? source.frameRate });
  if (options.frameRate !== undefined) {
    const rate = frameRate(options.frameRate);
    if (rate.num !== transport.frameRate.num || rate.den !== transport.frameRate.den || rate.dropFrame !== transport.frameRate.dropFrame)
      throw new Error('Offline frame rate must match the owning transport frame rate. Create a fresh source to export at another rate.');
  }
  return transport;
}

const warnedOffline = new WeakSet<TransportOutput>();
/** Attach `output` for an offline render, skipping (with one warning) an output that declares `supportsOffline: false`. */
function attachForOffline(transport: Transport, output: TransportOutput, doAttach: (o: TransportOutput) => (() => void) = (o) => transport.attach(o)): () => void {
  if (output.supportsOffline === false) {
    if (!warnedOffline.has(output)) {
      warnedOffline.add(output);
      console.warn(`renderFrames/frames: output${output.name ? ` "${output.name}"` : ''} does not support offline rendering and was skipped.`);
    }
    return () => {};
  }
  return doAttach(output);
}

function resolveRange(transport: Transport, rate: ReturnType<typeof frameRate>, options: { from?: TimeInput; to?: TimeInput }) {
  const from = options.from != null ? parseTime(options.from, rate) : 0;
  const to = options.to != null ? parseTime(options.to, rate) : transport.duration;
  if (!Number.isFinite(to)) throw new Error('renderFrames/frames: the transport has an infinite duration; pass an explicit `to`.');
  if (!Number.isFinite(from) || from < 0 || to < from || to > transport.duration) throw new Error('renderFrames/frames: range must be finite, non-negative, ordered, and within the transport duration.');
  if (!Number.isSafeInteger(msToFrame(from, rate)) || !Number.isSafeInteger(msToFrame(to, rate))) throw new Error('renderFrames/frames: range exceeds safe integer frame indices.');
  return { from, to };
}

const sampledOffline = new WeakSet<Transport>();
function prepareRange(transport: Transport, from: number, startTime: number) {
  if (from <= 0 || !sampledOffline.has(transport)) {
    transport.root.resetBefore(startTime);
  }
  sampledOffline.add(transport);
}

/**
 * Render every frame in `[from, to]` (default the whole duration) at an exact,
 * accumulation-free frame clock, calling `onFrame` once per frame after every
 * value has been written and every attached output has drawn. Deterministic:
 * running it twice, or resuming it on the same transport from where a prior
 * call left off, produces identical sampled values. First use (including a partial
 * range), or `from <= 0`, resets cue history and includes the first boundary.
 * Subsequent `from > 0` calls resume existing crossing/once state. The owning
 * transport is reused, remains at the final sampled time, and must not be playing.
 * Playback loop wrapping is suspended during capture (the loop setting survives).
 * Explicit seeks/graph edits by the caller during capture remain unsupported.
 */
export async function renderFrames(
  source: Transport | Timeline,
  onFrame: (info: FrameInfo) => void | Promise<void>,
  options: RenderFramesOptions = {},
): Promise<{ frames: number; from: number; to: number }> {
  const transport = resolveOfflineTransport(source, options);
  const rate = options.frameRate ? frameRate(options.frameRate) : transport.frameRate;
  const { from, to } = resolveRange(transport, rate, options);
  const release = transport.beginOffline();
  const detachers: Array<() => void> = [];
  let latest: FrameInfo | undefined;
  const unsubscribe = transport.subscribe((info) => { latest = info; });

  try {
    for (const output of options.outputs ?? []) detachers.push(attachForOffline(transport, output));
    const startFrame = msToFrame(from, rate);
    const endFrame = msToFrame(to, rate);
    prepareRange(transport, from, frameToMs(startFrame, rate));
    let count = 0;
    for (let frame = startFrame; frame <= endFrame; frame += 1) {
      if (options.signal?.aborted) break;
      transport.seek(frameToMs(frame, rate), { cues: 'fire' });
      const result = onFrame(latest as FrameInfo);
      if (result) await result;
      count += 1;
      if (options.yieldEvery && count % options.yieldEvery === 0) await new Promise((resolve) => { setTimeout(resolve, 0); });
    }
    return { frames: count, from, to };
  } finally {
    unsubscribe();
    const errors: unknown[] = [];
    try {
      for (const detach of detachers) {
        try { detach(); } catch (error) { errors.push(error); }
      }
    } finally { release(); }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'Offline output cleanup failed.');
  }
}

/** A synchronous, pull-based equivalent of `renderFrames`: each `next()` renders and returns the next frame. */
export function* frames(source: Transport | Timeline, options: { frameRate?: FrameRateInput; from?: TimeInput; to?: TimeInput } = {}): Generator<FrameInfo, void, unknown> {
  const transport = resolveOfflineTransport(source, options);
  const rate = options.frameRate ? frameRate(options.frameRate) : transport.frameRate;
  const { from, to } = resolveRange(transport, rate, options);
  const release = transport.beginOffline();
  let latest: FrameInfo | undefined;
  const unsubscribe = transport.subscribe((info) => { latest = info; });
  try {
    const startFrame = msToFrame(from, rate);
    const endFrame = msToFrame(to, rate);
    prepareRange(transport, from, frameToMs(startFrame, rate));
    for (let frame = startFrame; frame <= endFrame; frame += 1) {
      transport.seek(frameToMs(frame, rate), { cues: 'fire' });
      yield latest as FrameInfo;
    }
  } finally {
    unsubscribe();
    release();
  }
}
