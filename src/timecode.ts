import { frameToMs, msToFrame, type FrameRate } from './time';

export interface Timecode {
  hours: number;
  minutes: number;
  seconds: number;
  frames: number;
  dropFrame: boolean;
}

/** SMPTE drop-frame count per minute for a rounded frame rate (2 at 29.97, 4 at 59.94). */
function dropCount(fpsRounded: number): number {
  return fpsRounded / 15;
}

const TC_RE = /^(\d{1,2}):(\d{2}):(\d{2})([:;])(\d{1,2})$/;

/** Parse `'HH:MM:SS:FF'` (`;` before FF marks drop-frame) and validate it against `rate`. */
export function parseTimecode(text: string, rate: FrameRate): Timecode {
  const match = text.trim().match(TC_RE);
  if (!match) throw new Error(`Invalid timecode: "${text}"`);
  const [, h, m, s, sep, f] = match;
  const dropFrame = sep === ';';
  if (dropFrame && !rate.dropFrame) {
    throw new Error(`Timecode "${text}" uses ';' (drop-frame) but the frame rate ${rate.label} is not drop-frame`);
  }
  const hours = Number(h);
  const minutes = Number(m);
  const seconds = Number(s);
  const frames = Number(f);
  const fpsRounded = Math.round(rate.fps);
  if (minutes > 59 || seconds > 59) throw new Error(`Invalid timecode "${text}": minutes and seconds must be 0-59`);
  if (frames >= fpsRounded) throw new Error(`Invalid timecode "${text}": frames must be 0-${fpsRounded - 1} at ${rate.label}`);
  if (rate.dropFrame) {
    const df = dropCount(fpsRounded);
    const isDroppedInstant = minutes % 10 !== 0 && seconds === 0 && frames < df;
    if (isDroppedInstant) {
      throw new Error(`Invalid drop-frame timecode "${text}": frame ${frames} is dropped at the start of minute ${minutes}`);
    }
  }
  return { hours, minutes, seconds, frames, dropFrame };
}

/** Convert a timecode into an absolute frame index, applying the SMPTE drop-frame correction when `rate.dropFrame` is set. */
export function timecodeToFrames(tc: Timecode, rate: FrameRate): number {
  const fpsRounded = Math.round(rate.fps);
  const totalMinutes = 60 * tc.hours + tc.minutes;
  let frame = fpsRounded * 3600 * tc.hours + fpsRounded * 60 * tc.minutes + fpsRounded * tc.seconds + tc.frames;
  if (rate.dropFrame) {
    frame -= dropCount(fpsRounded) * (totalMinutes - Math.floor(totalMinutes / 10));
  }
  return frame;
}

/** Convert an absolute frame index into a timecode, applying the SMPTE drop-frame correction when `rate.dropFrame` is set. */
export function framesToTimecode(frame: number, rate: FrameRate): Timecode {
  const fpsRounded = Math.round(rate.fps);

  if (!rate.dropFrame) {
    const framesPart = ((frame % fpsRounded) + fpsRounded) % fpsRounded;
    const totalSeconds = Math.floor(frame / fpsRounded);
    const secondsPart = ((totalSeconds % 60) + 60) % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutesPart = ((totalMinutes % 60) + 60) % 60;
    const hoursPart = Math.floor(totalMinutes / 60);
    return { hours: hoursPart, minutes: minutesPart, seconds: secondsPart, frames: framesPart, dropFrame: false };
  }

  const df = dropCount(fpsRounded);
  const framesPer24Hours = fpsRounded * 3600 * 24;
  const framesPer10Minutes = Math.round(rate.fps * 60 * 10);
  const framesPerMinute = fpsRounded * 60 - df;
  let f = ((frame % framesPer24Hours) + framesPer24Hours) % framesPer24Hours;
  const tenMinuteBlocks = Math.floor(f / framesPer10Minutes);
  const remainder = f % framesPer10Minutes;
  f += remainder > df
    ? df * 9 * tenMinuteBlocks + df * Math.floor((remainder - df) / framesPerMinute)
    : df * 9 * tenMinuteBlocks;

  const framesPart = f % fpsRounded;
  const totalSeconds = Math.floor(f / fpsRounded);
  const secondsPart = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutesPart = totalMinutes % 60;
  const hoursPart = Math.floor(totalMinutes / 60);
  return { hours: hoursPart, minutes: minutesPart, seconds: secondsPart, frames: framesPart, dropFrame: true };
}

function pad(n: number, width = 2): string {
  return String(Math.trunc(n)).padStart(width, '0');
}

/** Format a `Timecode` as `'HH:MM:SS:FF'`, or `'HH:MM:SS;FF'` when it is drop-frame. */
export function formatTimecode(tc: Timecode): string {
  return `${pad(tc.hours)}:${pad(tc.minutes)}:${pad(tc.seconds)}${tc.dropFrame ? ';' : ':'}${pad(tc.frames)}`;
}

/** Convert milliseconds into a `Timecode` at `rate`. */
export function msToTimecode(ms: number, rate: FrameRate): Timecode {
  return framesToTimecode(msToFrame(ms, rate), rate);
}

/** Convert a timecode (string or parsed `Timecode`) into milliseconds at `rate`. */
export function timecodeToMs(input: string | Timecode, rate: FrameRate): number {
  const tc = typeof input === 'string' ? parseTimecode(input, rate) : input;
  return frameToMs(timecodeToFrames(tc, rate), rate);
}

/** Add (or subtract, with a negative count) a number of frames to a timecode. */
export function addFrames(tc: Timecode, frames: number, rate: FrameRate): Timecode {
  return framesToTimecode(timecodeToFrames(tc, rate) + frames, rate);
}
