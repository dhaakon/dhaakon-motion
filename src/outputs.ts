import type { CueEvent } from './items';
import type { FrameInfo, TransportOutput } from './transport';

/** Wrap a plain "draw once after every value has been written" function as a `TransportOutput` — for Canvas, a custom renderer, or anything else that just needs one call per tick. */
export function drawOutput(draw: (info: FrameInfo) => void, options: { name?: string } = {}): TransportOutput {
  return { name: options.name ?? 'draw', onTick: draw };
}

/**
 * Route every cue fired anywhere in the tree to `send`. The routing key is
 * the cue's own payload — conventionally `{ signal: <whatever the receiving
 * system understands> }`, in which case `send` receives just that inner
 * value; a payload without a `signal` property is forwarded as-is.
 */
export function signalOutput(
  send: (signal: unknown, cue: CueEvent, info: FrameInfo) => void,
  options: { filter?: (cue: CueEvent) => boolean; name?: string } = {},
): TransportOutput {
  return {
    name: options.name ?? 'signal',
    onTick(info) {
      for (const cue of info.cues ?? []) {
        if (options.filter && !options.filter(cue)) continue;
        const signal = cue.payload && typeof cue.payload === 'object' && 'signal' in (cue.payload as Record<string, unknown>)
          ? (cue.payload as Record<string, unknown>).signal
          : cue.payload;
        send(signal, cue, info);
      }
    },
  };
}
