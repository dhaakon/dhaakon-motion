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
  if (source instanceof Transport) return source;
  return new OfflineTransport({ root: source, frameRate: options.frameRate ?? source.frameRate });
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
  return { from, to };
}

/**
 * Render every frame in `[from, to]` (default the whole duration) at an exact,
 * accumulation-free frame clock, calling `onFrame` once per frame after every
 * value has been written and every attached output has drawn. Deterministic:
 * running it twice, or resuming it on the same transport from where a prior
 * call left off, produces identical output. Resuming is detected by `from > 0`,
 * which skips the reset-and-clear-cue-state a fresh run performs at `from <= 0`.
 */
export async function renderFrames(
  source: Transport | Timeline,
  onFrame: (info: FrameInfo) => void | Promise<void>,
  options: RenderFramesOptions = {},
): Promise<{ frames: number; from: number; to: number }> {
  const transport = resolveOfflineTransport(source, options);
  const rate = options.frameRate ? frameRate(options.frameRate) : transport.frameRate;
  const { from, to } = resolveRange(transport, rate, options);

  const detachers = (options.outputs ?? []).map((output) => attachForOffline(transport, output));
  let latest: FrameInfo | undefined;
  const unsubscribe = transport.subscribe((info) => { latest = info; });

  try {
    if (from <= 0) transport.root.reset?.();
    transport.seek(from, { cues: 'skip' });

    const startFrame = msToFrame(from, rate);
    const endFrame = msToFrame(to, rate);
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
    for (const detach of detachers) detach();
  }
}

/** A synchronous, pull-based equivalent of `renderFrames`: each `next()` renders and returns the next frame. */
export function* frames(source: Transport | Timeline, options: { frameRate?: FrameRateInput; from?: TimeInput; to?: TimeInput } = {}): Generator<FrameInfo, void, unknown> {
  const transport = resolveOfflineTransport(source, options);
  const rate = options.frameRate ? frameRate(options.frameRate) : transport.frameRate;
  const { from, to } = resolveRange(transport, rate, options);

  let latest: FrameInfo | undefined;
  const unsubscribe = transport.subscribe((info) => { latest = info; });
  try {
    if (from <= 0) transport.root.reset?.();
    transport.seek(from, { cues: 'skip' });
    const startFrame = msToFrame(from, rate);
    const endFrame = msToFrame(to, rate);
    for (let frame = startFrame; frame <= endFrame; frame += 1) {
      transport.seek(frameToMs(frame, rate), { cues: 'fire' });
      yield latest as FrameInfo;
    }
  } finally {
    unsubscribe();
  }
}
