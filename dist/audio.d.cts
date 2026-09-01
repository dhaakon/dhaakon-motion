import { T as TimelineItem, C as Clock, a as TransportOutput, K as Keyframe, b as TrackOptions, c as Track, d as Transport, e as Timeline } from './track-EtJQft_W.cjs';

/** `now()` reads an `AudioContext`'s own clock, in milliseconds — pass as a `Transport`'s `clock` to make audio the master. */
declare function audioClock(context: Pick<AudioContext, 'currentTime'>): Clock;
interface AudioClipOptions {
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
declare class AudioClip implements TimelineItem {
    readonly kind: "audio";
    name?: string;
    readonly context: AudioContext;
    readonly buffer: AudioBuffer;
    readonly destination?: AudioNode;
    readonly offset: number;
    readonly gain: number;
    readonly loop: boolean;
    private explicitDuration?;
    constructor(options: AudioClipOptions);
    get totalDuration(): number;
    /** No-op: `AudioClip` has no per-frame value. Scheduling is owned by `audioOutput`/`renderAudio`, which read absolute clip positions directly. */
    sampleAt(): void;
}
interface AudioOutputOptions {
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
declare function audioOutput(context: AudioContext, options?: AudioOutputOptions): TransportOutput & {
    unlock(): Promise<void>;
};
/** A `Track` for an `AudioParam`, ramping to each keyframe's value one tick ahead of the context clock so envelopes are sample-accurate rather than tick-quantized. */
declare function paramTrack(param: AudioParam, keyframes: Keyframe<number>[], options: Omit<TrackOptions<number>, 'keyframes' | 'apply' | 'target'> & {
    context: Pick<AudioContext, 'currentTime'>;
}): Track<number>;
/** Render every `AudioClip` under `source` into `context` (typically an `OfflineAudioContext`), scheduling each at its absolute start time. */
declare function renderAudio(source: Transport | Timeline, context: OfflineAudioContext, options?: {
    from?: number;
    to?: number;
}): Promise<AudioBuffer>;

export { AudioClip, type AudioClipOptions, type AudioOutputOptions, audioClock, audioOutput, paramTrack, renderAudio };
