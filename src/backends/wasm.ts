import {
  NUMERIC_IR_VERSION,
  validateNumericPlan,
  type NumericEvaluator,
  type NumericPlan,
} from './numeric';
import { encodeNumericPlan } from './binary';

/** Shape of the generated wasm-bindgen module; module initialization stays explicit. */
export interface MotionWasmBindings {
  version(): number;
  create(json: string): number;
  create_binary?(bytes: Uint8Array): number;
  sample(handle: number, ms: number): void;
  values_ptr(handle: number): number;
  values_len(handle: number): number;
  free(handle: number): void;
}
export interface WasmRuntime {
  readonly backend: 'wasm';
  readonly abiVersion: 1;
  createEvaluator(plan: NumericPlan): NumericEvaluator;
  /** Terminal runtime cleanup. A new runtime is needed after this call. */
  dispose(): void;
}

/** No global registry, fetch, worker, clock or browser access at module import time. */
export function createWasmRuntime(
  bindings: MotionWasmBindings,
  memory: WebAssembly.Memory,
): WasmRuntime {
  if (bindings.version() !== NUMERIC_IR_VERSION)
    throw new Error('Motion Wasm ABI version mismatch');
  if (!memory || !memory.buffer) throw new Error('Motion Wasm memory is required');
  const evaluators = new Set<NumericEvaluator>();
  let disposed = false;
  return {
    backend: 'wasm',
    abiVersion: 1,
    createEvaluator(plan) {
      if (disposed) throw new Error('Motion Wasm runtime is disposed');
      const length = validateNumericPlan(plan);
      const handle = bindings.create_binary
        ? bindings.create_binary(encodeNumericPlan(plan))
        : bindings.create(JSON.stringify(plan));
      let freed = false;
      let view: Float64Array | undefined;
      const evaluator: NumericEvaluator = {
        backend: 'wasm',
        length,
        sample(ms) {
          if (freed || disposed) throw new Error('Compiled evaluator is disposed');
          if (!Number.isFinite(ms) || Math.abs(ms) > 1e15)
            throw new Error('Compiled sample time must be finite and within ±1e15ms');
          bindings.sample(handle, ms);
          const pointer = bindings.values_ptr(handle);
          const count = bindings.values_len(handle);
          if (
            count !== length ||
            !Number.isSafeInteger(pointer) ||
            pointer < 0 ||
            pointer % 8 ||
            pointer + count * 8 > memory.buffer.byteLength
          )
            throw new Error('Motion Wasm returned an invalid output buffer');
          if (!view || view.buffer !== memory.buffer || view.byteOffset !== pointer)
            view = new Float64Array(memory.buffer, pointer, count);
          return view;
        },
        dispose() {
          if (freed) return;
          freed = true;
          view = undefined;
          evaluators.delete(evaluator);
          bindings.free(handle);
        },
      };
      evaluators.add(evaluator);
      return evaluator;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const errors: unknown[] = [];
      for (const evaluator of [...evaluators]) {
        try {
          evaluator.dispose();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length) throw new AggregateError(errors, 'Motion Wasm runtime cleanup failed');
    },
  };
}

/**
 * Application-controlled async boundary. Return an initialized generated module and memory.
 * Supports browser URLs, precompiled modules, bytes, SSR and CJS without guessing asset URLs.
 * Loader failures reject; callers can deliberately retain JS, never replay a partially sampled frame.
 */
export async function loadWasmRuntime(
  load: () => Promise<{ bindings: MotionWasmBindings; memory: WebAssembly.Memory }>,
): Promise<WasmRuntime> {
  const { bindings, memory } = await load();
  return createWasmRuntime(bindings, memory);
}
