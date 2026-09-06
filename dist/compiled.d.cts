import { Direction, MotionValueShape, TrackOptions, TimelineItem, RenderContext } from '@dhaakon/motion';

/** Private interchange contract. Creation/editing only; never serialized per frame. */
interface NumericCurve {
    kind: string;
    args: readonly number[];
}
interface NumericTrack {
    id: string;
    times: readonly number[];
    values: readonly (readonly number[])[];
    easings: readonly NumericCurve[];
    /** -1 represents infinite repeat without nonfinite JSON. */
    repeat: number;
    repeatDelay: number;
    direction: Direction;
}
interface NumericPlan {
    version: 1;
    tracks: readonly NumericTrack[];
}
declare const NUMERIC_IR_VERSION = 1;
declare const numericLimits: Readonly<{
    tracks: 100000;
    keys: 4096;
    width: 64;
    scalars: 4000000;
    output: 1000000;
}>;
/** Validate at the trust boundary, including budgets before allocating output storage. */
declare function validateNumericPlan(plan: NumericPlan): number;
interface NumericEvaluator {
    readonly backend: 'js' | 'wasm';
    readonly length: number;
    /** Borrowed internal view, valid until next sample/create/free. Hosts must copy before callbacks. */
    sample(ms: number): Float64Array;
    dispose(): void;
}
declare function createJsEvaluator(plan: NumericPlan): NumericEvaluator;

/** Shape of the generated wasm-bindgen module; module initialization stays explicit. */
interface MotionWasmBindings {
    version(): number;
    create(json: string): number;
    create_binary?(bytes: Uint8Array): number;
    sample(handle: number, ms: number): void;
    values_ptr(handle: number): number;
    values_len(handle: number): number;
    free(handle: number): void;
}
interface WasmRuntime {
    readonly backend: 'wasm';
    readonly abiVersion: 1;
    createEvaluator(plan: NumericPlan): NumericEvaluator;
    /** Terminal runtime cleanup. A new runtime is needed after this call. */
    dispose(): void;
}
/** No global registry, fetch, worker, clock or browser access at module import time. */
declare function createWasmRuntime(bindings: MotionWasmBindings, memory: WebAssembly.Memory): WasmRuntime;
/**
 * Application-controlled async boundary. Return an initialized generated module and memory.
 * Supports browser URLs, precompiled modules, bytes, SSR and CJS without guessing asset URLs.
 * Loader failures reject; callers can deliberately retain JS, never replay a partially sampled frame.
 */
declare function loadWasmRuntime(load: () => Promise<{
    bindings: MotionWasmBindings;
    memory: WebAssembly.Memory;
}>): Promise<WasmRuntime>;

interface CompiledTrackInput<T extends MotionValueShape = MotionValueShape> extends Omit<TrackOptions<T>, 'apply' | 'target'> {
    id: string;
}
interface CompileDiagnostic {
    readonly id: string;
    readonly reason: string;
}
interface CompiledPlan {
    readonly version: 1;
    readonly portable: boolean;
    readonly diagnostics: readonly CompileDiagnostic[];
    readonly ir: NumericPlan;
    /** Detached authoring data, preserving frame literals and easing descriptors. */
    readonly authored: readonly CompiledTrackInput[];
    readonly totalDuration: number;
}
/** Explicit immutable compilation, never a silent conversion of mutable live Tween/Timeline objects. */
declare function compileTracks(inputs: readonly CompiledTrackInput[], options?: {
    requirePortable?: boolean;
}): CompiledPlan;
interface CompiledPlayerOptions {
    backend?: 'js' | 'wasm' | 'auto';
    runtime?: WasmRuntime;
    bindings?: Readonly<Record<string, (value: MotionValueShape, context?: RenderContext) => void>>;
}
interface CompiledPlayer extends TimelineItem {
    readonly diagnostics: {
        readonly engine: 'js' | 'wasm' | 'js-host';
        readonly reasons: readonly CompileDiagnostic[];
    };
    /** Synchronous sampling, copying results out of Wasm before any host callback. */
    sampleAt(ms: number, context?: RenderContext): void;
    get(id: string): MotionValueShape | undefined;
    /** Terminal for this explicitly owned compiled player; legacy Transport.dispose stays reusable. */
    dispose(): void;
}
declare function createCompiledPlayer(plan: CompiledPlan, options?: CompiledPlayerOptions): CompiledPlayer;

declare const NUMERIC_BINARY_VERSION = 1;
/** Creation-time DHM1 little-endian wire data. No JSON/string conversion in Wasm sampling. */
declare function encodeNumericPlan(plan: NumericPlan): Uint8Array;

export { type CompileDiagnostic, type CompiledPlan, type CompiledPlayer, type CompiledPlayerOptions, type CompiledTrackInput, type MotionWasmBindings, NUMERIC_BINARY_VERSION, NUMERIC_IR_VERSION, type NumericCurve, type NumericEvaluator, type NumericPlan, type NumericTrack, type WasmRuntime, compileTracks, createCompiledPlayer, createJsEvaluator, createWasmRuntime, encodeNumericPlan, loadWasmRuntime, numericLimits, validateNumericPlan };
