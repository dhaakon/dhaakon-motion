import { test, expect } from 'vitest';
import { frameRate } from '@dhaakon/motion';
import {
  parseTimecode, formatTimecode, timecodeToFrames, framesToTimecode, timecodeToMs, addFrames,
} from '@dhaakon/motion';

const df2997 = frameRate('29.97df');
const df5994 = frameRate('59.94df');
const nd30 = frameRate(30);
const nd24 = frameRate(24);

const vectors: Array<[string, ReturnType<typeof frameRate>, number]> = [
  ['00:01:00;02', df2997, 1800],
  ['00:10:00;00', df2997, 17982],
  ['01:00:00;00', df2997, 107892],
  ['00:01:00:00', nd30, 1800],
  ['00:00:01:00', nd24, 24],
  ['00:00:01:23', nd24, 47],
  ['01:00:00;00', df5994, 215784],
];

test.each(vectors)('%s at %s is frame %i', (text, rate, expected) => {
  expect(timecodeToFrames(parseTimecode(text, rate), rate)).toBe(expected);
  expect(formatTimecode(framesToTimecode(expected, rate))).toBe(text);
});

test('round-trips every frame across the first 20 minutes at 29.97df', () => {
  const framesPerMinute = Math.round(29.97 * 60); // nominal count before drop correction, generous upper bound
  const total = framesPerMinute * 20;
  for (let frame = 0; frame < total; frame += 1) {
    const tc = framesToTimecode(frame, df2997);
    expect(timecodeToFrames(tc, df2997)).toBe(frame);
  }
});

test('round-trips a strided sample across 3 hours at 29.97df', () => {
  const threeHours = timecodeToFrames(parseTimecode('03:00:00;00', df2997), df2997);
  for (let frame = 0; frame < threeHours; frame += 97) {
    const tc = framesToTimecode(frame, df2997);
    expect(timecodeToFrames(tc, df2997)).toBe(frame);
  }
});

test('drop-frame timecode never lands on a dropped frame instant', () => {
  // Frames 0 and 1 at the start of any non-tenth minute are dropped, so no
  // frame index should ever format back to one of those instants.
  for (let minute = 1; minute < 20; minute += 1) {
    if (minute % 10 === 0) continue;
    const boundaryFrame = timecodeToFrames({ hours: 0, minutes: minute, seconds: 0, frames: 2, dropFrame: true }, df2997);
    const tc = framesToTimecode(boundaryFrame, df2997);
    expect(tc.frames).not.toBe(0);
    expect(tc.frames).not.toBe(1);
  }
});

test('parseTimecode rejects a drop-frame separator at a non-drop-frame rate', () => {
  expect(() => parseTimecode('00:01:00;02', nd30)).toThrow(/drop-frame/i);
});

test('parseTimecode rejects an out-of-range frame number', () => {
  expect(() => parseTimecode('00:00:00:30', nd30)).toThrow(/frames must be/i);
});

test('parseTimecode rejects a dropped-frame instant', () => {
  expect(() => parseTimecode('00:01:00;00', df2997)).toThrow(/dropped/i);
  expect(() => parseTimecode('00:01:00;01', df2997)).toThrow(/dropped/i);
  expect(() => parseTimecode('00:10:00;00', df2997)).not.toThrow();
});

test('timecodeToMs and addFrames', () => {
  expect(timecodeToMs('00:00:01:00', nd24)).toBe(1000);
  const tc = parseTimecode('00:00:59:00', nd24);
  expect(addFrames(tc, 24, nd24)).toEqual({ hours: 0, minutes: 1, seconds: 0, frames: 0, dropFrame: false });
});
