import { Timeline, type TimelinePosition } from './timeline';
import { parseTime, type TimeInput } from './time';
import type { TransportOutput } from './transport';

/** Byte-array builders for the common Channel Voice messages. */
export const midi = {
  noteOn(note: number, velocity = 100, channel = 0): number[] { return [0x90 | (channel & 0x0f), note & 0x7f, velocity & 0x7f]; },
  noteOff(note: number, channel = 0): number[] { return [0x80 | (channel & 0x0f), note & 0x7f, 0]; },
  cc(controller: number, value: number, channel = 0): number[] { return [0xb0 | (channel & 0x0f), controller & 0x7f, value & 0x7f]; },
  programChange(program: number, channel = 0): number[] { return [0xc0 | (channel & 0x0f), program & 0x7f]; },
};

/**
 * Routes cue payloads shaped `{ midi: number[] }` to a Web MIDI output port,
 * timestamped with the tick's own clock so messages stay in order even when
 * several fire in one tick.
 */
export function midiOutput(port: Pick<MIDIOutput, 'send'>, options: { name?: string } = {}): TransportOutput {
  return {
    name: options.name ?? 'midi',
    onTick(info) {
      for (const cue of info.cues ?? []) {
        const bytes = (cue.payload as { midi?: number[] } | undefined)?.midi;
        if (bytes) port.send(bytes, globalThis.performance?.now?.());
      }
    },
  };
}

/** Adds a pair of cues to `timeline`: a note-on at `at`, and a note-off `duration` later (default: immediately). */
export function noteCue(
  timeline: Timeline,
  at: TimelinePosition,
  note: number,
  options: { velocity?: number; duration?: TimeInput; channel?: number } = {},
): Timeline {
  const velocity = options.velocity ?? 100;
  const channel = options.channel ?? 0;
  const onMs = timeline.explain(at).ms;
  const durationMs = options.duration != null ? parseTime(options.duration, timeline.frameRate) : 0;
  timeline.cue(`note${note}-on`, onMs, () => {}, { payload: { midi: midi.noteOn(note, velocity, channel) } });
  timeline.cue(`note${note}-off`, onMs + durationMs, () => {}, { payload: { midi: midi.noteOff(note, channel) } });
  return timeline;
}
