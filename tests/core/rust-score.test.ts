import { describe, expect, test } from 'vitest';
import { compileTracks, createCompiledPlayer } from '@dhaakon/motion/compiled';
import {
  createScoreInputs,
  SCORE_ACTS,
  SCORE_FPS,
  SCORE_FRAMES,
  SCORE_INITIAL_VALUES,
  scoreSnapshot,
} from '../../docs/src/labs/rust/score';

describe('Rust experimental authored SVG score', () => {
  test('all 20 groups compile portably with numeric, color, unit and steps channels', () => {
    const inputs = createScoreInputs();
    const plan = compileTracks(inputs, { requirePortable: true });
    expect(plan.portable).toBe(true);
    expect(plan.diagnostics).toEqual([]);
    expect(plan.ir.tracks).toHaveLength(20);
    expect(plan.totalDuration).toBe(12_000);
    expect(
      plan.ir.tracks.flatMap((track) => track.easings).some((easing) => easing.kind === 'steps'),
    ).toBe(true);
    expect(inputs.find(({ id }) => id === 'logoStroke')?.keyframes[0].value).toHaveProperty(
      'width',
      '0.6px',
    );
    expect(Object.keys(SCORE_INITIAL_VALUES)).toHaveLength(20);
    const independent = createScoreInputs();
    inputs[0].keyframes[0].value = 999;
    expect(independent[0].keyframes[0].value).not.toBe(999);
  });

  test('five contiguous half-open acts cover exactly 720 frames at 60fps', () => {
    expect(SCORE_FPS).toBe(60);
    expect(SCORE_FRAMES).toBe(720);
    expect(SCORE_ACTS).toHaveLength(5);
    expect(SCORE_ACTS[0].startFrame).toBe(0);
    expect(SCORE_ACTS.at(-1)?.endFrame).toBe(SCORE_FRAMES);
    SCORE_ACTS.forEach((act, index) => {
      expect(act.endFrame - act.startFrame).toBe(144);
      if (index > 0) expect(act.startFrame).toBe(SCORE_ACTS[index - 1].endFrame);
    });
  });

  test('sequential, reversed and shuffled exact-frame JS samples are state-identical', () => {
    const player = createCompiledPlayer(
      compileTracks(createScoreInputs(), { requirePortable: true }),
    );
    const capture = (frame: number) => {
      player.sampleAt((frame * 1000) / SCORE_FPS);
      return scoreSnapshot((id) => player.get(id));
    };
    try {
      const frames = Array.from({ length: SCORE_FRAMES }, (_, frame) => frame);
      const expected = frames.map(capture);
      for (const frame of frames.slice().reverse()) expect(capture(frame)).toEqual(expected[frame]);
      // 137 and 720 are coprime: a repeatable full permutation, without Math.random.
      for (const index of frames) {
        const frame = (index * 137) % SCORE_FRAMES;
        expect(capture(frame)).toEqual(expected[frame]);
      }
      expect(player.diagnostics.engine).toBe('js');
    } finally {
      player.dispose();
    }
  });

  test('acts change actual layer states, and arbitrary later seeks settle finitely', () => {
    const player = createCompiledPlayer(compileTracks(createScoreInputs()));
    const sample = (frame: number) => {
      player.sampleAt((frame * 1000) / SCORE_FPS);
      return scoreSnapshot((id) => player.get(id));
    };
    try {
      const states = SCORE_ACTS.map(({ startFrame }) => sample(startFrame + 72));
      expect(new Set(states.map((state) => JSON.stringify(state))).size).toBe(5);
      expect((states[1].aperture as { radius: number }).radius).toBeGreaterThan(
        (states[0].aperture as { radius: number }).radius,
      );
      expect((states[2].exploded as { spread: number }).spread).toBeGreaterThan(0.7);
      expect((states[3].ribbons as { opacity: number }).opacity).toBeGreaterThan(0.5);
      expect((states[4].logoSlices as { amount: number }).amount).toBe(0);
      const final = sample(720);
      expect(sample(100_000)).toEqual(final);
      for (const group of Object.values(final)) {
        for (const value of Object.values(group as Record<string, unknown>)) {
          if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
        }
      }
    } finally {
      player.dispose();
    }
  });
});
