import { validateNumericPlan, type NumericPlan } from './numeric';

const kinds = [
  'linear',
  'easeInQuad',
  'easeOutQuad',
  'easeInOutQuad',
  'easeInCubic',
  'easeOutCubic',
  'easeInOutCubic',
  'easeInQuart',
  'easeOutQuart',
  'easeInOutQuart',
  'easeOutBack',
  'dhaakon',
  'cubicBezier',
  'spring',
  'steps',
];
const directions = ['normal', 'reverse', 'alternate', 'alternate-reverse'];
export const NUMERIC_BINARY_VERSION = 1;

/** Creation-time DHM1 little-endian wire data. No JSON/string conversion in Wasm sampling. */
export function encodeNumericPlan(plan: NumericPlan): Uint8Array {
  validateNumericPlan(plan);
  const encoder = new TextEncoder();
  const ids = plan.tracks.map((track) => encoder.encode(track.id));
  let size = 12;
  for (let i = 0; i < plan.tracks.length; i++) {
    const track = plan.tracks[i];
    size += 4 + ids[i].length + 4 + 4 + 4 + 8 + 1;
    size += track.times.length * 8 + track.times.length * track.values[0].length * 8;
    for (const curve of track.easings) size += 2 + curve.args.length * 8;
    if (size > 64 * 1024 * 1024) throw new Error('RESOURCE_LIMIT: binary plan exceeds 64 MiB');
  }
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  const u8 = (value: number) => {
    view.setUint8(offset, value);
    offset++;
  };
  const u32 = (value: number) => {
    view.setUint32(offset, value, true);
    offset += 4;
  };
  const i32 = (value: number) => {
    view.setInt32(offset, value, true);
    offset += 4;
  };
  const f64 = (value: number) => {
    view.setFloat64(offset, value, true);
    offset += 8;
  };
  bytes.set([68, 72, 77, 49]);
  offset = 4;
  u32(NUMERIC_BINARY_VERSION);
  u32(plan.tracks.length);
  for (let i = 0; i < plan.tracks.length; i++) {
    const track = plan.tracks[i];
    u32(ids[i].length);
    bytes.set(ids[i], offset);
    offset += ids[i].length;
    u32(track.values[0].length);
    u32(track.times.length);
    i32(track.repeat);
    f64(track.repeatDelay);
    u8(directions.indexOf(track.direction));
    for (const time of track.times) f64(time);
    for (const value of track.values) for (const channel of value) f64(channel);
    for (const curve of track.easings) {
      u8(kinds.indexOf(curve.kind));
      u8(curve.args.length);
      for (const arg of curve.args) f64(arg);
    }
  }
  return bytes;
}
