import { formatTimecode, msToTimecode, timecodeToMs } from './timecode';

/** A rational frame rate: `num / den` frames per second, with an optional SMPTE drop-frame flag. */
export interface FrameRate {
  readonly num: number;
  readonly den: number;
  readonly dropFrame: boolean;
  readonly fps: number;
  readonly label: string;
}

export type FrameRateInput = number | string | FrameRate | { num: number; den?: number; dropFrame?: boolean };

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

function trimFps(fps: number): string {
  return String(Math.round(fps * 1000) / 1000);
}

function buildFrameRate(num: number, den: number, dropFrame: boolean): FrameRate {
  if (!Number.isFinite(num) || !Number.isFinite(den) || num <= 0 || den <= 0) {
    throw new Error(`Invalid frame rate: ${num}/${den}`);
  }
  const divisor = gcd(Math.round(num), Math.round(den)) || 1;
  const n = Math.round(num) / divisor;
  const d = Math.round(den) / divisor;
  if (dropFrame && !((n === 30000 && d === 1001) || (n === 60000 && d === 1001))) {
    throw new Error(`Drop-frame timecode is only valid at 29.97 or 59.94 fps, got ${n}/${d} (${trimFps(n / d)} fps)`);
  }
  const fps = n / d;
  return { num: n, den: d, dropFrame, fps, label: dropFrame ? `${trimFps(fps)}df` : trimFps(fps) };
}

const NTSC_TABLE = [
  { fps: 24000 / 1001, num: 24000, den: 1001 },
  { fps: 30000 / 1001, num: 30000, den: 1001 },
  { fps: 60000 / 1001, num: 60000, den: 1001 },
];

function frameRateFromNumber(numeric: number, dropFrame: boolean): FrameRate {
  if (!Number.isFinite(numeric) || numeric <= 0) throw new Error(`Invalid frame rate: ${numeric}`);
  const ntsc = NTSC_TABLE.find((entry) => Math.abs(entry.fps - numeric) < 0.001);
  if (ntsc) return buildFrameRate(ntsc.num, ntsc.den, dropFrame);
  if (Number.isInteger(numeric)) return buildFrameRate(numeric, 1, dropFrame);
  return buildFrameRate(Math.round(numeric * 1000), 1000, dropFrame);
}

function frameRateFromString(text: string): FrameRate {
  const trimmed = text.trim();
  const dropFrame = /df$/i.test(trimmed);
  const numeric = Number(trimmed.replace(/df$/i, ''));
  return frameRateFromNumber(numeric, dropFrame);
}

/** Named presets for the common broadcast and film frame rates. */
export const FrameRates = {
  '23.976': buildFrameRate(24000, 1001, false),
  '24': buildFrameRate(24, 1, false),
  '25': buildFrameRate(25, 1, false),
  '29.97': buildFrameRate(30000, 1001, false),
  '29.97df': buildFrameRate(30000, 1001, true),
  '30': buildFrameRate(30, 1, false),
  '50': buildFrameRate(50, 1, false),
  '59.94': buildFrameRate(60000, 1001, false),
  '59.94df': buildFrameRate(60000, 1001, true),
  '60': buildFrameRate(60, 1, false),
} as const satisfies Record<string, FrameRate>;

/** Normalize a frame rate input (a plain number, a preset string like `'29.97df'`, or an explicit `{num, den}`) into a `FrameRate`. */
export function frameRate(input: FrameRateInput): FrameRate {
  if (typeof input === 'number') return frameRateFromNumber(input, false);
  if (typeof input === 'string') return frameRateFromString(input);
  if (input && typeof input === 'object' && 'num' in input) {
    return buildFrameRate(input.num, input.den ?? 1, Boolean(input.dropFrame));
  }
  throw new Error(`Invalid frame rate: ${JSON.stringify(input)}`);
}

const FRAME_EPSILON = 1e-6;

/** Convert a frame index into milliseconds at a given rate. */
export function frameToMs(frame: number, rate: FrameRate): number {
  return (frame * 1000 * rate.den) / rate.num;
}

/** Convert milliseconds into the frame index that contains that instant (floor, with a small epsilon to absorb float error). */
export function msToFrame(ms: number, rate: FrameRate): number {
  return Math.floor((ms * rate.num) / (1000 * rate.den) + FRAME_EPSILON);
}

/** Quantize milliseconds down to the start of its containing frame. */
export function snapToFrame(ms: number, rate: FrameRate): number {
  return frameToMs(msToFrame(ms, rate), rate);
}

/**
 * A time value as authored: plain milliseconds, or a string with a unit —
 * `'12f'` (frames, needs a rate), `'1.5s'` (seconds), `'500ms'`, or a SMPTE
 * timecode (`'HH:MM:SS:FF'` / `'HH:MM:SS;FF'`, needs a rate).
 */
export type TimeInput = number | string;

const FRAMES_RE = /^(-?\d+(?:\.\d+)?)f$/i;
const SECONDS_RE = /^(-?\d+(?:\.\d+)?)s$/i;
const MS_RE = /^(-?\d+(?:\.\d+)?)ms$/i;
const TIMECODE_RE = /^\d{1,2}:\d{2}:\d{2}[:;]\d{1,2}$/;

/** Resolve any `TimeInput` form into milliseconds. Frame and timecode forms require `rate`. */
export function parseTime(input: TimeInput, rate?: FrameRateInput): number {
  if (typeof input === 'number') return input;
  const text = input.trim();

  const framesMatch = text.match(FRAMES_RE);
  if (framesMatch) {
    if (rate == null) throw new Error(`parseTime: "${input}" is a frame value and needs a frameRate`);
    return frameToMs(Number(framesMatch[1]), frameRate(rate));
  }

  const secondsMatch = text.match(SECONDS_RE);
  if (secondsMatch) return Number(secondsMatch[1]) * 1000;

  const msMatch = text.match(MS_RE);
  if (msMatch) return Number(msMatch[1]);

  if (TIMECODE_RE.test(text)) {
    if (rate == null) throw new Error(`parseTime: "${input}" is a timecode and needs a frameRate`);
    return timecodeToMs(text, frameRate(rate));
  }

  const plain = Number(text);
  if (text !== '' && Number.isFinite(plain)) return plain;
  throw new Error(`parseTime: unrecognized time value "${input}"`);
}

/** Format milliseconds for display. `'frames'` and `'timecode'` styles require `rate`. */
export function formatTime(ms: number, rate?: FrameRateInput, style: 'ms' | 'seconds' | 'frames' | 'timecode' = 'ms'): string {
  if (style === 'ms') return `${Math.round(ms)}ms`;
  if (style === 'seconds') return `${(ms / 1000).toFixed(3)}s`;
  if (rate == null) throw new Error(`formatTime: style "${style}" needs a frameRate`);
  const resolved = frameRate(rate);
  if (style === 'frames') return `${msToFrame(ms, resolved)}f`;
  return formatTimecode(msToTimecode(ms, resolved));
}
