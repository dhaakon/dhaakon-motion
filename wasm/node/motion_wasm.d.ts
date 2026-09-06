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
