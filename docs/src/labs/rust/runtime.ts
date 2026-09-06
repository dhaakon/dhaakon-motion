import { createWasmRuntime, type WasmRuntime } from '@dhaakon/motion/compiled';

// Cache module initialization, not a disposable runtime. Each page visit owns its handles.
let initialization: Promise<typeof import('../../../../wasm/web/motion_wasm.js')> | undefined;

export async function loadExperimentalRuntime(): Promise<WasmRuntime> {
  initialization ??= (async () => {
    const [bindings, asset] = await Promise.all([
      import('../../../../wasm/web/motion_wasm.js'),
      import('../../../../wasm/web/motion_wasm_bg.wasm?url'),
    ]);
    await bindings.default({ module_or_path: asset.default });
    return bindings;
  })().catch((error: unknown) => {
    initialization = undefined;
    throw error;
  });
  const bindings = await initialization;
  return createWasmRuntime(bindings, bindings.wasm_memory());
}
