/** Experimental opt-in compiled execution. Existing imports and clocks remain unchanged. */
export { compileTracks, createCompiledPlayer } from './backends/compiler';
export type {
  CompiledPlan,
  CompiledPlayer,
  CompiledPlayerOptions,
  CompiledTrackInput,
  CompileDiagnostic,
} from './backends/compiler';
export {
  createJsEvaluator,
  validateNumericPlan,
  NUMERIC_IR_VERSION,
  numericLimits,
} from './backends/numeric';
export type { NumericPlan, NumericTrack, NumericCurve, NumericEvaluator } from './backends/numeric';
export { createWasmRuntime, loadWasmRuntime } from './backends/wasm';
export type { WasmRuntime, MotionWasmBindings } from './backends/wasm';
export { encodeNumericPlan, NUMERIC_BINARY_VERSION } from './backends/binary';
