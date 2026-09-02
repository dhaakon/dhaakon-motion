import { afterEach, beforeEach, expect, test } from 'vitest';
import { MotionValue } from '@dhaakon/motion';
import { drag, gestureToTrack, record, replay, type GestureRecording } from '@dhaakon/motion/gesture';
import { installPointerEvents, ManualDriver, pointer } from '@dhaakon/motion/testing';

let restore = () => {};
beforeEach(() => { restore = installPointerEvents(); });
afterEach(() => { restore(); document.body.innerHTML = ''; });

test('record captures a portable pointer data trail and replay reproduces the drag', async () => {
  const source = document.createElement('div'); const target = document.createElement('div'); document.body.append(source, target);
  Object.defineProperty(source, 'getBoundingClientRect', { value: () => ({ left: 0, top: 0, width: 100, height: 100 }) });
  Object.defineProperty(target, 'getBoundingClientRect', { value: () => ({ left: 0, top: 0, width: 100, height: 100 }) });
  const recorder = record(source, { normalize: true, frameRate: 24 }); const stream = pointer(source);
  stream.down(0, 0, 0); stream.move(25, 10, 20); stream.move(75, 20, 40); stream.up(100, 30, 60); const recording = recorder.stop();
  expect(recording.$schema).toBe('dhaakon-motion/gesture/1'); expect(recording.samples).toHaveLength(4); expect(recording.samples[2].x).toBe(.75);
  const x = new MotionValue<number>(0); const binding = drag(x, target, { axis: 'x', immediate: true, momentum: false });
  await replay(recording, target, { driver: new ManualDriver() }); expect(x.get()).toBe(100); binding.dispose();
});

test('gestureToTrack quantizes to frames and simplifies a dense stroke', () => {
  const recording: GestureRecording = { $schema: 'dhaakon-motion/gesture/1', samples: Array.from({ length: 200 }, (_, index) => ({ id: 1, type: 'pen', kind: index === 0 ? 'down' as const : index === 199 ? 'up' as const : 'move' as const, x: index, y: index * .5 + Math.sin(index / 20), t: index * 4 })) };
  const track = gestureToTrack(recording, { frameRate: 24, axis: 'both', simplify: 2 });
  expect(track.keyframes.length).toBeLessThanOrEqual(12);
  expect(track.keyframes.every((keyframe) => Math.abs(keyframe.at / (1000 / 24) - Math.round(keyframe.at / (1000 / 24))) < 1e-8)).toBe(true);
  expect(track.valueAt(track.duration)).toEqual({ x: 199, y: recording.samples[199].y });
});

