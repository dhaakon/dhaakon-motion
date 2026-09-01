import { a as TransportOutput, e as Timeline, J as TimelinePosition, f as TimeInput } from './track-cepHoOcR.cjs';

/** Byte-array builders for the common Channel Voice messages. */
declare const midi: {
    noteOn(note: number, velocity?: number, channel?: number): number[];
    noteOff(note: number, channel?: number): number[];
    cc(controller: number, value: number, channel?: number): number[];
    programChange(program: number, channel?: number): number[];
};
/**
 * Routes cue payloads shaped `{ midi: number[] }` to a Web MIDI output port,
 * timestamped with the tick's own clock so messages stay in order even when
 * several fire in one tick.
 */
declare function midiOutput(port: Pick<MIDIOutput, 'send'>, options?: {
    name?: string;
}): TransportOutput;
/** Adds a pair of cues to `timeline`: a note-on at `at`, and a note-off `duration` later (default: immediately). */
declare function noteCue(timeline: Timeline, at: TimelinePosition, note: number, options?: {
    velocity?: number;
    duration?: TimeInput;
    channel?: number;
}): Timeline;

export { midi, midiOutput, noteCue };
