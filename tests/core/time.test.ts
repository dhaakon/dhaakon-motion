import { test, expect } from 'vitest';
import { frameRate, FrameRates, frameToMs, msToFrame, snapToFrame, parseTime, formatTime } from '@dhaakon/motion';

test('frameRate resolves NTSC decimals to their rational form', () => {
  expect(frameRate(29.97)).toMatchObject({ num: 30000, den: 1001, dropFrame: false });
  expect(frameRate('29.97df')).toMatchObject({ num: 30000, den: 1001, dropFrame: true });
  expect(frameRate(24)).toMatchObject({ num: 24, den: 1, dropFrame: false });
  expect(frameRate({ num: 60000, den: 1001 })).toMatchObject({ num: 60000, den: 1001 });
});

test('drop-frame is only legal at 29.97 or 59.94', () => {
  expect(() => frameRate('24df')).toThrow(/drop-frame/i);
  expect(() => frameRate({ num: 25, den: 1, dropFrame: true })).toThrow(/drop-frame/i);
});

test('FrameRates presets match frameRate()', () => {
  expect(FrameRates['29.97df']).toEqual(frameRate('29.97df'));
  expect(FrameRates['23.976']).toEqual(frameRate(23.976));
});

test('frameToMs and msToFrame round-trip at an integer rate', () => {
  const rate = frameRate(24);
  for (let frame = 0; frame < 240; frame += 7) {
    expect(msToFrame(frameToMs(frame, rate), rate)).toBe(frame);
  }
});

test('msToFrame floors, matching what frame is actually on screen', () => {
  const rate = frameRate(24); // ~41.667ms per frame
  expect(msToFrame(0, rate)).toBe(0);
  expect(msToFrame(41, rate)).toBe(0);
  expect(msToFrame(42, rate)).toBe(1);
  expect(msToFrame(83.33, rate)).toBe(1);
});

test('snapToFrame quantizes down to the frame boundary', () => {
  const rate = frameRate(24);
  expect(snapToFrame(50, rate)).toBeCloseTo(frameToMs(1, rate), 6);
});

test('parseTime resolves every TimeInput form', () => {
  expect(parseTime(500)).toBe(500);
  expect(parseTime('500ms')).toBe(500);
  expect(parseTime('1.5s')).toBe(1500);
  expect(parseTime('12f', 24)).toBeCloseTo(500, 6);
  expect(parseTime('00:00:01:00', 24)).toBe(1000);
});

test('parseTime throws a clear error when a frame or timecode value has no rate', () => {
  expect(() => parseTime('12f')).toThrow(/frameRate/);
  expect(() => parseTime('00:00:01:00')).toThrow(/frameRate/);
});

test('formatTime renders every style', () => {
  expect(formatTime(1500)).toBe('1500ms');
  expect(formatTime(1500, undefined, 'seconds')).toBe('1.500s');
  expect(formatTime(500, 24, 'frames')).toBe('12f');
  expect(formatTime(1000, 24, 'timecode')).toBe('00:00:01:00');
  expect(formatTime(2000, '29.97df', 'timecode')).toBe('00:00:01;29');
});
