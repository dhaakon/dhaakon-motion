import { createJsEvaluator, type NumericPlan, type WasmRuntime } from '@dhaakon/motion/compiled';

export interface VerificationResult {
  comparisons: number;
  samples: number;
  maxError: number;
  maxScaledError: number;
  passed: boolean;
}

function yieldTask(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, 0);
    signal.addEventListener('abort', abort, { once: true });
  });
}

/** Real evaluator comparison, independent of SVG pixels and wall-clock scheduling. */
export async function verifyScore(
  plan: NumericPlan,
  runtime: WasmRuntime,
  frames: number,
  fps: number,
  signal: AbortSignal,
  onProgress: (progress: number) => void,
): Promise<VerificationResult> {
  const js = createJsEvaluator(plan);
  let wasm: ReturnType<WasmRuntime['createEvaluator']> | undefined;
  const result: VerificationResult = {
    comparisons: 0,
    samples: 0,
    maxError: 0,
    maxScaledError: 0,
    passed: true,
  };
  // Even/odd permutation visits every frame exactly once, including non-720 test corpora.
  const shuffled = Array.from({ length: frames }, (_, index) => index).sort(
    (a, b) => (a % 2) - (b % 2) || b - a,
  );
  try {
    signal.throwIfAborted();
    wasm = runtime.createEvaluator(plan);
    for (let order = 0; order < 3; order++) {
      for (let index = 0; index < frames; index++) {
        signal.throwIfAborted();
        const frame = order === 0 ? index : order === 1 ? frames - 1 - index : shuffled[index];
        const ms = (frame * 1000) / fps;
        const expected = js.sample(ms);
        const actual = wasm.sample(ms);
        if (actual.length !== expected.length) throw new Error('Evaluator channel count differs');
        for (let channel = 0; channel < expected.length; channel++) {
          const error = Math.abs(actual[channel] - expected[channel]);
          const scaled = error / Math.max(1, Math.abs(expected[channel]));
          if (!Number.isFinite(error)) throw new Error('Evaluator returned a nonfinite value');
          result.maxError = Math.max(result.maxError, error);
          result.maxScaledError = Math.max(result.maxScaledError, scaled);
          result.passed &&= scaled <= 1e-9;
          result.comparisons++;
        }
        result.samples++;
        if (result.samples % 48 === 0) {
          onProgress(result.samples / (frames * 3));
          await yieldTask(signal);
        }
      }
    }
    onProgress(1);
    return result;
  } finally {
    js.dispose();
    wasm?.dispose();
  }
}
