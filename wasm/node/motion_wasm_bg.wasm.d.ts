/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const create: (a: number, b: number) => [number, number, number];
export const create_binary: (a: number, b: number) => [number, number, number];
export const free: (a: number) => [number, number];
export const sample: (a: number, b: number) => [number, number];
export const values_len: (a: number) => [number, number, number];
export const values_ptr: (a: number) => [number, number, number];
export const version: () => number;
export const wasm_memory: () => any;
export const __wbindgen_externrefs: WebAssembly.Table;
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
export const __externref_table_dealloc: (a: number) => void;
export const __wbindgen_start: () => void;
