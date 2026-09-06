/* tslint:disable */
/* eslint-disable */

export function create(plan_json: string): number;

/**
 * Additive binary-v1 creation. Uses the same validation, arena and sampling ABI.
 */
export function create_binary(bytes: Uint8Array): number;

export function free(handle: number): void;

export function sample(handle: number, milliseconds: number): void;

/**
 * Number of f64 values, not bytes. Reading after free is outside the contract.
 */
export function values_len(handle: number): number;

/**
 * Byte offset into this instance's exported memory; refresh after memory growth.
 */
export function values_ptr(handle: number): number;

export function version(): number;

/**
 * The WebAssembly.Memory for this module instance, usable by web and Node glue.
 */
export function wasm_memory(): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly create: (a: number, b: number) => [number, number, number];
    readonly create_binary: (a: number, b: number) => [number, number, number];
    readonly free: (a: number) => [number, number];
    readonly sample: (a: number, b: number) => [number, number];
    readonly values_len: (a: number) => [number, number, number];
    readonly values_ptr: (a: number) => [number, number, number];
    readonly version: () => number;
    readonly wasm_memory: () => any;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
