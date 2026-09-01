import { test, expect } from 'vitest';
import { Track, track, MotionValue, Tween, Timeline, Easing, registerEasing, resolveEasing, serializeEasing } from '@dhaakon/motion';

test('valueAt interpolates between the surrounding keyframes and clamps at the ends', () => {
  const t = new Track<number>({
    keyframes: [{ at: 0, value: 0 }, { at: 100, value: 10, easing: 'linear' }, { at: 200, value: 0, easing: 'linear' }],
    apply: () => {},
  });
  expect(t.valueAt(-50)).toBe(0);
  expect(t.valueAt(0)).toBe(0);
  expect(t.valueAt(50)).toBe(5);
  expect(t.valueAt(100)).toBe(10);
  expect(t.valueAt(150)).toBe(5);
  expect(t.valueAt(300)).toBe(0);
});

test('each segment can use its own easing', () => {
  const t = new Track<number>({
    keyframes: [
      { at: 0, value: 0 },
      { at: 100, value: 100, easing: 'linear' },
      { at: 200, value: 200, easing: ['steps', 4] },
    ],
    apply: () => {},
  });
  expect(t.valueAt(50)).toBe(50); // linear segment
  expect(t.valueAt(125)).toBe(125); // steps(4) segment: local t=0.25 quantizes to 0.25 exactly, so this one lands on a step boundary
  expect(t.valueAt(140)).toBe(125); // local t=0.4 quantizes down to the same 0.25 step
});

test('track() with a MotionValue target writes through .set()', () => {
  const value = new MotionValue<number>(0);
  const t = track(value, [{ at: 0, value: 0 }, { at: 100, value: 10, easing: 'linear' }]);
  t.sampleAt(50);
  expect(value.get()).toBe(5);
});

test('track() with a plain function target calls it directly', () => {
  const seen: number[] = [];
  const t = track((v: number) => seen.push(v), [{ at: 0, value: 0 }, { at: 100, value: 10, easing: 'linear' }]);
  t.sampleAt(0);
  t.sampleAt(100);
  expect(seen).toEqual([0, 10]);
});

test('a Track embeds in a Timeline like any other TimelineItem', () => {
  const values: number[] = [];
  const t = track((v: number) => values.push(v), [{ at: 0, value: 0 }, { at: 100, value: 100, easing: 'linear' }]);
  const timeline = new Timeline().add(t, 0);
  timeline.sampleAt(50);
  expect(values.at(-1)).toBe(50);
});

test('frame/timecode keyframe positions resolve through the track\'s own frameRate', () => {
  const t = new Track<number>({ frameRate: 24, keyframes: [{ at: 0, value: 0 }, { at: '12f', value: 12, easing: 'linear' }], apply: () => {} });
  expect(t.duration).toBeCloseTo(500, 6); // 12f @ 24fps
});

test('Tween.toTrack() produces an equivalent two-keyframe Track', () => {
  const seen: number[] = [];
  const tween = new Tween({ from: 0, to: 10, duration: 100, delay: 20, easing: 'linear', onUpdate: (v) => seen.push(v as number) });
  const t = tween.toTrack();
  expect(t.duration).toBe(120);
  t.sampleAt(70); // 50ms into the 100ms span after the 20ms delay
  expect(seen.at(-1)).toBe(5);
});

test('registered and built-in easings serialize back to their name; anonymous functions do not', () => {
  const custom = registerEasing('bounceTest', (t: number) => t);
  expect(serializeEasing(Easing.linear)).toBe('linear');
  expect(serializeEasing(custom)).toBe('bounceTest');
  expect(serializeEasing((t: number) => t)).toBeUndefined();
  expect(resolveEasing('bounceTest')).toBe(custom);
  expect(() => resolveEasing('doesNotExist')).toThrow(/Unknown easing/);
});
