import { Track, Timeline, Transport, type Keyframe, type TrackOptions, type Clock, type TransportOutput, type TimelineItem } from '@dhaakon/motion';

/** `now()` reads an `AudioContext`'s own clock, in milliseconds — pass as a `Transport`'s `clock` to make audio the master. */
export function audioClock(context: Pick<AudioContext, 'currentTime'>): Clock {
  return { now: () => context.currentTime * 1000 };
}

export interface AudioClipOptions {
  context: AudioContext;
  buffer: AudioBuffer;
  destination?: AudioNode;
  /** Milliseconds into `buffer` to start reading from. Default 0. */
  offset?: number;
  /** Playback length in milliseconds. Default: the rest of the buffer after `offset`. */
  duration?: number;
  gain?: number;
  loop?: boolean;
  name?: string;
}

/** A scheduled audio clip. It has no values of its own to sample — `audioOutput` (or `renderAudio`) owns starting and stopping its source node. */
export class AudioClip implements TimelineItem {
  readonly kind = 'audio' as const;
  name?: string;
  readonly context: AudioContext;
  readonly buffer: AudioBuffer;
  readonly destination?: AudioNode;
  readonly offset: number;
  readonly gain: number;
  readonly loop: boolean;
  private explicitDuration?: number;

  constructor(options: AudioClipOptions) {
    this.context = options.context;
    this.buffer = options.buffer;
    this.destination = options.destination;
    this.offset = options.offset ?? 0;
    this.gain = options.gain ?? 1;
    this.loop = options.loop ?? false;
    this.explicitDuration = options.duration;
    this.name = options.name;
  }

  get totalDuration(): number {
    return this.explicitDuration ?? Math.max(0, this.buffer.duration * 1000 - this.offset);
  }

  /** No-op: `AudioClip` has no per-frame value. Scheduling is owned by `audioOutput`/`renderAudio`, which read absolute clip positions directly. */
  sampleAt() {}
}

interface PlacedClip { clip: AudioClip; start: number; end: number; }

/**
 * Walk a timeline's tree for `AudioClip`s and their absolute (transport-local)
 * start/end. Nested-timeline repeat/yoyo folding is not accounted for: a clip
 * inside a repeating nested timeline is treated as if that timeline never
 * repeats, so it plays once at its first-lap position. Put clips on the root
 * (or a non-repeating container) for correct behavior.
 */
function collectAudioClips(timeline: Timeline, offset: number, out: PlacedClip[]): PlacedClip[] {
  for (const entry of timeline.items) {
    const start = offset + entry.start;
    const end = offset + entry.end;
    if (entry.item instanceof AudioClip) out.push({ clip: entry.item, start, end });
    else if (entry.item instanceof Timeline) collectAudioClips(entry.item, start, out);
  }
  return out;
}

interface ActiveVoice { source: AudioBufferSourceNode; gain: GainNode; startedAtContextTime: number; startedAtTransportTime: number; }

export interface AudioOutputOptions {
  /** How far (ms) a playing source may drift from where it should be before it is stopped and restarted. Default 25. */
  driftThreshold?: number;
  /** How far ahead (ms) of a clip's start a source may be scheduled. Default 100. */
  lookahead?: number;
  name?: string;
}

/**
 * Schedules every `AudioClip` in the tree against the `AudioContext`'s own
 * clock. Never plays in reverse (a negative or zero rate stops every voice);
 * a pause, seek, or rate change restarts sources at the new offset. Not
 * usable offline — pair `AudioClip`/`renderAudio` with an `OfflineAudioContext`
 * for export instead.
 */
export function audioOutput(context: AudioContext, options: AudioOutputOptions = {}): TransportOutput & { unlock(): Promise<void> } {
  const driftThreshold = options.driftThreshold ?? 25;
  const active = new Map<AudioClip, ActiveVoice>();
  let clips: PlacedClip[] = [];
  let owner: Transport | undefined;

  const stopVoice = (clip: AudioClip) => {
    const voice = active.get(clip);
    if (!voice) return;
    try { voice.source.stop(); } catch { /* already stopped */ }
    voice.source.disconnect();
    voice.gain.disconnect();
    active.delete(clip);
  };
  const stopAll = () => { for (const clip of [...active.keys()]) stopVoice(clip); };

  const startVoice = (placed: PlacedClip, info: { time: number; rate: number }) => {
    const source = context.createBufferSource();
    source.buffer = placed.clip.buffer;
    source.loop = placed.clip.loop;
    source.playbackRate.value = Math.max(0, Math.abs(info.rate));
    const gainNode = context.createGain();
    gainNode.gain.value = placed.clip.gain;
    source.connect(gainNode);
    gainNode.connect(placed.clip.destination ?? context.destination);
    const offsetIntoClip = Math.max(0, (info.time - placed.start) / 1000 + placed.clip.offset / 1000);
    source.start(context.currentTime, offsetIntoClip);
    active.set(placed.clip, { source, gain: gainNode, startedAtContextTime: context.currentTime, startedAtTransportTime: info.time });
  };

  return {
    name: options.name ?? 'audio',
    supportsOffline: false,
    onAttach(transport) { owner = transport; clips = collectAudioClips(transport.root, 0, []); },
    onStateChange(state) { if (state !== 'playing') stopAll(); },
    // No onSeek handler: Transport fires onTick (with the new time) before onSeek, so
    // stopping here would undo whatever the tick's drift check just correctly started.
    // A seek already reads as a large drift on the next tick and restarts naturally.
    onRateChange() { stopAll(); },
    onTick(info) {
      if (owner?.state !== 'playing' || info.rate <= 0) { stopAll(); return; }
      for (const placed of clips) {
        const shouldPlay = info.time >= placed.start && info.time < placed.end;
        if (!shouldPlay) { stopVoice(placed.clip); continue; }
        const voice = active.get(placed.clip);
        if (!voice) { startVoice(placed, info); continue; }
        const expectedContextTime = voice.startedAtContextTime + ((info.time - voice.startedAtTransportTime) / 1000) / info.rate;
        const driftMs = Math.abs(context.currentTime - expectedContextTime) * 1000;
        if (driftMs > driftThreshold) { stopVoice(placed.clip); startVoice(placed, info); }
      }
    },
    onDetach() { stopAll(); owner = undefined; },
    async unlock() { if (context.state === 'suspended') await context.resume(); },
  };
}

/** A `Track` for an `AudioParam`, ramping to each keyframe's value one tick ahead of the context clock so envelopes are sample-accurate rather than tick-quantized. */
export function paramTrack(
  param: AudioParam,
  keyframes: Keyframe<number>[],
  options: Omit<TrackOptions<number>, 'keyframes' | 'apply' | 'target'> & { context: Pick<AudioContext, 'currentTime'> },
): Track<number> {
  const { context, ...rest } = options;
  return new Track<number>({ ...rest, keyframes, apply: (value) => { param.linearRampToValueAtTime(value, context.currentTime + 1 / 60); } });
}

/** Render every `AudioClip` under `source` into `context` (typically an `OfflineAudioContext`), scheduling each at its absolute start time. */
export async function renderAudio(
  source: Transport | Timeline,
  context: OfflineAudioContext,
  options: { from?: number; to?: number } = {},
): Promise<AudioBuffer> {
  const root = source instanceof Transport ? source.root : source;
  const clips = collectAudioClips(root, 0, []);
  const from = options.from ?? 0;
  const to = options.to ?? Infinity;
  for (const placed of clips) {
    if (placed.end <= from || placed.start >= to) continue;
    const bufferSource = context.createBufferSource();
    bufferSource.buffer = placed.clip.buffer;
    bufferSource.loop = placed.clip.loop;
    const gainNode = context.createGain();
    gainNode.gain.value = placed.clip.gain;
    bufferSource.connect(gainNode);
    gainNode.connect(placed.clip.destination ?? context.destination);
    const startAt = Math.max(0, (placed.start - from) / 1000);
    bufferSource.start(startAt, placed.clip.offset / 1000);
  }
  return context.startRendering();
}
