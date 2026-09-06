import { describe, expect, test } from 'vitest';
import { compileTracks, createCompiledPlayer } from '@dhaakon/motion/compiled';
import {
  BATCH_CHANNELS,
  BATCH_DURATION_MS,
  batchFrameCount,
  batchFrameTime,
  batchMaxDelta,
  createBatchTracks,
  type BatchPoint,
} from '../../docs/src/labs/rust/batch';

describe('Rust docs deterministic field', () => {
  test('authors bounded stable geometry with portable curves and seven fixed channels', () => {
    const tracks = createBatchTracks(256);
    expect(tracks).toEqual(createBatchTracks(256));
    expect(new Set(tracks.map((track) => track.id)).size).toBe(256);
    const plan = compileTracks(tracks, { requirePortable: true });
    expect(plan.portable).toBe(true);
    expect(plan.totalDuration).toBe(BATCH_DURATION_MS);
    expect(plan.ir.tracks).toHaveLength(256);
    for (const track of plan.ir.tracks) {
      expect(
        track.values.every((value) => value.length === 7 && value.every(Number.isFinite)),
      ).toBe(true);
      expect(track.values.at(-1)).toEqual(track.values[0]);
    }
  });

  test.each([256, 1024, 2048])('supports the advertised %i-point resource tier', (count) => {
    const plan = compileTracks(createBatchTracks(count), { requirePortable: true });
    expect(plan.ir.tracks).toHaveLength(count);
    expect(plan.diagnostics).toEqual([]);
  });

  test('frame timestamps derive from integer frames and exclude the looping endpoint', () => {
    expect(batchFrameCount(24)).toBe(192);
    expect(batchFrameCount(60)).toBe(480);
    expect(batchFrameTime(84, 24)).toBe(3500);
    expect(batchFrameTime(210, 60)).toBe(3500);
    expect(batchFrameTime(191, 24)).toBeLessThan(BATCH_DURATION_MS);
    expect(batchFrameTime(479, 60)).toBeLessThan(BATCH_DURATION_MS);
    expect(() => batchFrameTime(192, 24)).toThrow('half-open');
    expect(() => batchFrameTime(-1, 24)).toThrow('half-open');
    expect(() => batchFrameTime(0.5, 24)).toThrow('half-open');
    expect(() => createBatchTracks(100_000)).toThrow('bounded');
  });

  test('random-access evaluation is history-independent across formations and frame rates', () => {
    const plan = compileTracks(createBatchTracks(256), { requirePortable: true });
    const first = createCompiledPlayer(plan, { backend: 'js' });
    const second = createCompiledPlayer(plan, { backend: 'js' });
    const values = (player: typeof first) =>
      plan.authored.map((track) => player.get(track.id) as BatchPoint);
    try {
      for (const frame of [0, 83, 132, 163, 24, 191, 84]) {
        first.sampleAt(batchFrameTime(frame, 24));
        second.sampleAt(7900);
        second.sampleAt(batchFrameTime(frame, 24));
        expect(batchMaxDelta(values(first), values(second))).toBe(0);
        for (const point of values(first))
          expect(BATCH_CHANNELS.every((key) => Number.isFinite(point[key]))).toBe(true);
      }
      first.sampleAt(batchFrameTime(84, 24));
      second.sampleAt(batchFrameTime(210, 60));
      expect(batchMaxDelta(values(first), values(second))).toBe(0);
    } finally {
      first.dispose();
      second.dispose();
    }
  });

  test('numeric comparison never reports malformed or missing state as agreement', () => {
    const [track] = createBatchTracks(256);
    const point = track.keyframes[0].value;
    expect(batchMaxDelta([point], [{ ...point }])).toBe(0);
    expect(batchMaxDelta([point], [{ ...point, x: point.x + 0.5 }])).toBeCloseTo(0.5);
    expect(batchMaxDelta([point], [])).toBe(Infinity);
    expect(batchMaxDelta([point], [{ ...point, x: NaN }])).toBe(Infinity);
    expect(batchMaxDelta([point], new Array(1))).toBe(Infinity);
  });
});
