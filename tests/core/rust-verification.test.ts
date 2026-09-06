import { expect, test, vi } from 'vitest';
import { createJsEvaluator, type NumericPlan, type WasmRuntime } from '@dhaakon/motion/compiled';
import { verifyScore } from '../../docs/src/labs/rust/verification';

const plan: NumericPlan = {
  version: 1,
  tracks: [
    {
      id: 'value',
      times: [0, 1000],
      values: [[0], [100]],
      easings: [{ kind: 'linear', args: [] }],
      repeat: 0,
      repeatDelay: 0,
      direction: 'normal',
    },
  ],
};

// Instrumentation for verification control flow only, not Wasm conformance evidence.
function instrumentedRuntime(change = (values: Float64Array) => values) {
  const times: number[] = [];
  const dispose = vi.fn();
  const runtime: WasmRuntime = {
    backend: 'wasm',
    abiVersion: 1,
    dispose: vi.fn(),
    createEvaluator(input) {
      const reference = createJsEvaluator(input);
      return {
        backend: 'wasm',
        length: reference.length,
        sample(ms) {
          times.push(ms);
          return change(reference.sample(ms));
        },
        dispose() {
          reference.dispose();
          dispose();
        },
      };
    },
  };
  return { runtime, times, dispose };
}

test('verification traverses every frame three ways and reports exact channel count', async () => {
  const { runtime, times, dispose } = instrumentedRuntime();
  const progress = vi.fn();
  const result = await verifyScore(plan, runtime, 5, 60, new AbortController().signal, progress);
  expect(result).toEqual({
    comparisons: 15,
    samples: 15,
    maxError: 0,
    maxScaledError: 0,
    passed: true,
  });
  expect(times.slice(0, 5)).toEqual([0, 1, 2, 3, 4].map((frame) => (frame * 1000) / 60));
  expect(times.slice(5, 10)).toEqual([...times.slice(0, 5)].reverse());
  expect([...times.slice(10)].sort((a, b) => a - b)).toEqual(times.slice(0, 5));
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(runtime.dispose).not.toHaveBeenCalled();
  expect(progress).toHaveBeenLastCalledWith(1);
});

test('verification reports numeric mismatches instead of labeling the run a match', async () => {
  const { runtime, dispose } = instrumentedRuntime((values) => new Float64Array([values[0] + 0.1]));
  const result = await verifyScore(plan, runtime, 5, 60, new AbortController().signal, () => {});
  expect(result.passed).toBe(false);
  expect(result.maxError).toBeCloseTo(0.1);
  expect(dispose).toHaveBeenCalledTimes(1);
});

test.each([
  ['nonfinite', () => new Float64Array([NaN]), /nonfinite/],
  ['wrong length', () => new Float64Array([]), /count differs/],
] as const)(
  'verification rejects %s output and frees its evaluator',
  async (_label, change, error) => {
    const { runtime, dispose } = instrumentedRuntime(change);
    await expect(
      verifyScore(plan, runtime, 5, 60, new AbortController().signal, () => {}),
    ).rejects.toThrow(error);
    expect(dispose).toHaveBeenCalledTimes(1);
  },
);

test('aborting before acquisition does not create a runtime evaluator', async () => {
  const { runtime } = instrumentedRuntime();
  const create = vi.spyOn(runtime, 'createEvaluator');
  const controller = new AbortController();
  controller.abort();
  await expect(verifyScore(plan, runtime, 5, 60, controller.signal, () => {})).rejects.toThrow();
  expect(create).not.toHaveBeenCalled();
});

test('aborting in a yielded traversal stops publication and releases owned evaluator', async () => {
  const { runtime, times, dispose } = instrumentedRuntime();
  const controller = new AbortController();
  await expect(
    verifyScore(plan, runtime, 60, 60, controller.signal, () => controller.abort()),
  ).rejects.toThrow();
  expect(times).toHaveLength(48);
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(runtime.dispose).not.toHaveBeenCalled();
});
