import { expect, test, vi } from 'vitest';
import { Track, spring, type EasingInput } from '@dhaakon/motion';
import {
  compileTracks, createCompiledPlayer, createWasmRuntime, validateNumericPlan,
  type CompiledPlayer, type MotionWasmBindings, type NumericPlan,
} from '@dhaakon/motion/compiled';

function numericPlan(): NumericPlan {
  return { version: 1, tracks: [{
    id: 'x', times: [0, 100], values: [[0], [100]],
    easings: [{ kind: 'linear', args: [] }], repeat: 0, repeatDelay: 0, direction: 'normal',
  }] };
}

function fakeBindings(overrides: Partial<MotionWasmBindings> = {}): MotionWasmBindings {
  let next = 0;
  return { version: () => 1, create: () => ++next, sample() {}, values_ptr: () => 8, values_len: () => 1, free() {}, ...overrides };
}

test('host-only easing disposal prevents subsequent publication and value resurrection', () => {
  let player: CompiledPlayer;
  const binding = vi.fn();
  const plan = compileTracks([{ id: 'x', keyframes: [{ at: 0, value: 0 }, { at: 100, value: 100 }], easing(t) { player.dispose(); return t; } }]);
  player = createCompiledPlayer(plan, { bindings: { x: binding } });
  expect(player.diagnostics.engine).toBe('js-host');
  player.sampleAt(50);
  expect(binding).not.toHaveBeenCalled();
  expect(player.get('x')).toBeUndefined();
});

test('numeric validation rejects sparse channel arrays instead of producing NaN', () => {
  const plan = numericPlan();
  plan.tracks[0].values = [new Array<number>(1), [100]];
  expect(() => validateNumericPlan(plan)).toThrow();
});

test('numeric validation rejects sparse segment-easing arrays before execution', () => {
  const plan = numericPlan();
  plan.tracks[0].easings = new Array(1);
  expect(() => validateNumericPlan(plan)).toThrow();
});

test('authored repeat -1 cannot impersonate the private infinite-repeat sentinel', () => {
  expect(() => compileTracks([{ id: 'x', repeat: -1, keyframes: [{ at: 0, value: 0 }, { at: 100, value: 100 }] }])).toThrow(/repeat/i);
});

test.each([
  ['steps', 4, 'invalid'], ['steps', 4, 'start', 'extra'], ['spring', {}, 'extra'],
])('compiler does not silently normalize malformed %s descriptors', (...descriptor) => {
  expect(() => compileTracks([{ id: 'x', keyframes: [{ at: 0, value: 0 }, { at: 100, value: 100 }], easing: descriptor as EasingInput }])).toThrow();
});

test('tagged spring easing compilation retains the function actually authored', () => {
  const options = { stiffness: 170, damping: 26, mass: 1 };
  const easing = spring(options);
  options.stiffness = 10;
  const input = { id: 'x', easing, keyframes: [{ at: 0, value: 0 }, { at: 100, value: 100 }] };
  const player = createCompiledPlayer(compileTracks([input]));
  const reference = new Track({ ...input, apply() {} });
  player.sampleAt(25);
  expect(player.get('x')).toBeCloseTo(reference.valueAt(25), 8);
  player.dispose();
});

test('sparse-array snapshots retain authored length and holes on the host path', () => {
  const value = new Array<number>(3);
  value[0] = 1;
  const player = createCompiledPlayer(compileTracks([{ id: 'x', keyframes: [{ at: 0, value }] }]));
  player.sampleAt(0);
  const snapshot = player.get('x') as number[];
  expect(snapshot.length).toBe(3);
  expect(1 in snapshot).toBe(false);
  expect(2 in snapshot).toBe(false);
  player.dispose();
});

test('array metadata does not become an interpolated numeric channel', () => {
  const from = Object.assign([0], { label: 10 });
  const to = Object.assign([100], { label: 20 });
  const input = { id: 'x', easing: 'linear', keyframes: [{ at: 0, value: from }, { at: 100, value: to }] };
  const player = createCompiledPlayer(compileTracks([input]));
  const reference = new Track({ ...input, apply() {} });
  player.sampleAt(50);
  expect(player.get('x')).toEqual(reference.valueAt(50));
  expect(Object.hasOwn(player.get('x') as object, 'label')).toBe(false);
  player.dispose();
});

test('Wasm serialization cannot substitute unvalidated data through caller toJSON hooks', () => {
  let submitted: NumericPlan | undefined;
  const runtime = createWasmRuntime(fakeBindings({ create(json) { submitted = JSON.parse(json); return 1; } }), new WebAssembly.Memory({ initial: 1 }));
  const substitute = vi.fn(() => ({ version: 1, tracks: [{ ...numericPlan().tracks[0], values: [[900], [999]] }] }));
  const plan = Object.assign(numericPlan(), { toJSON: substitute });
  // Rejecting the hook or serializing a validated canonical snapshot is acceptable.
  try { runtime.createEvaluator(plan); } catch { /* A defensive rejection is valid. */ }
  expect(substitute).not.toHaveBeenCalled();
  if (submitted) expect(submitted.tracks[0].values).toEqual([[0], [100]]);
  runtime.dispose();
});

test('Wasm output pointers must be finite integers before constructing a view', () => {
  const runtime = createWasmRuntime(fakeBindings({ values_ptr: () => NaN }), new WebAssembly.Memory({ initial: 1 }));
  const evaluator = runtime.createEvaluator(numericPlan());
  try { expect(() => evaluator.sample(50)).toThrow(/invalid output buffer/i); }
  finally { runtime.dispose(); }
});

test('runtime cleanup attempts every independent handle even if one free traps', () => {
  const freed: number[] = [];
  const runtime = createWasmRuntime(fakeBindings({ free(handle) { freed.push(handle); if (handle === 1) throw new Error('free trap'); } }), new WebAssembly.Memory({ initial: 1 }));
  runtime.createEvaluator(numericPlan());
  runtime.createEvaluator(numericPlan());
  expect(() => runtime.dispose()).toThrow();
  expect(freed).toEqual([1, 2]);
  runtime.dispose();
});
