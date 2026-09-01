import type { FrameInfo, TransportOutput, TransportState } from './transport';

export interface TraceEntry {
  tick: number;
  time: number;
  frame: number;
  rate: number;
  state: TransportState;
  cues: string[];
  /** Wall-clock milliseconds since the previous tick's `onTick` (a cheap proxy for actual frame cadence). */
  durationMs: number;
}

export interface Trace extends TransportOutput {
  entries: TraceEntry[];
  clear(): void;
  toText(): string;
}

const wallNow = () => globalThis.performance?.now?.() ?? Date.now();

/** A ring-buffer `TransportOutput` that records every tick for inspection. Attach via `transport.trace()`. */
export function createTrace(options: { capacity?: number } = {}): Trace {
  const capacity = Math.max(1, options.capacity ?? 200);
  let tickCount = 0;
  let state: TransportState = 'idle';
  let lastTickAt: number | null = null;

  const trace: Trace = {
    name: 'trace',
    entries: [],
    onStateChange(next) { state = next; },
    onTick(info: FrameInfo) {
      const now = wallNow();
      const durationMs = lastTickAt == null ? 0 : now - lastTickAt;
      lastTickAt = now;
      trace.entries.push({ tick: tickCount, time: info.time, frame: info.frame, rate: info.rate, state, cues: info.cues ?? [], durationMs });
      if (trace.entries.length > capacity) trace.entries.splice(0, trace.entries.length - capacity);
      tickCount += 1;
    },
    clear() { trace.entries.length = 0; tickCount = 0; lastTickAt = null; },
    toText() {
      return trace.entries.map((entry) => {
        const cues = entry.cues.length ? ` cues=[${entry.cues.join(', ')}]` : '';
        return `#${entry.tick} t=${entry.time.toFixed(1)}ms f=${entry.frame} rate=${entry.rate} state=${entry.state}${cues}`;
      }).join('\n');
    },
  };
  return trace;
}
