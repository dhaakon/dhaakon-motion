import { describe, expect, test } from 'vitest';
import {
  Track,
  Timeline,
  Transport,
  steps,
  registerEasing,
  Easing,
  type MotionValueShape,
} from '@dhaakon/motion';
import {
  compileTracks,
  createCompiledPlayer,
  createJsEvaluator,
  createWasmRuntime,
  loadWasmRuntime,
  validateNumericPlan,
  encodeNumericPlan,
  type CompiledTrackInput,
  type NumericPlan,
} from '@dhaakon/motion/compiled';

const linear: CompiledTrackInput = {
  id: 'x',
  easing: 'linear',
  keyframes: [
    { at: 0, value: 0 },
    { at: 1000, value: 100 },
  ],
};
const compound: CompiledTrackInput = {
  id: 'shape',
  easing: 'linear',
  keyframes: [
    { at: 0, value: { position: [0, 10, 20], color: '#102030', width: '001px', opacity: 0 } },
    { at: 1000, value: { position: [100, 200, 300], color: '#ff5a1f', width: '80px', opacity: 1 } },
  ],
};

describe('compiled authored contracts', () => {
  test('binary creation has a bounded versioned header and preserves authoring rate literals', () => {
    const plan = compileTracks([{ ...linear, frameRate: '24' }]);
    expect(plan.authored[0].frameRate).toBe('24');
    const bytes = encodeNumericPlan(plan.ir);
    expect([...bytes.subarray(0, 4)]).toEqual([68, 72, 77, 49]);
    expect(new DataView(bytes.buffer).getUint32(4, true)).toBe(1);
    expect(new DataView(bytes.buffer).getUint32(8, true)).toBe(1);
  });
  test('a shadowed registry name or mutable builtin never masquerades as a Rust builtin', () => {
    const fn = registerEasing('linear', () => 0.25);
    const player = createCompiledPlayer(compileTracks([{ ...linear, easing: fn }]));
    expect(player.diagnostics.engine).toBe('js-host');
    player.sampleAt(500);
    expect(player.get('x')).toBe(25);
    player.dispose();
    const original = Easing.linear;
    try {
      Easing.linear = () => 0.75;
      const replaced = createCompiledPlayer(compileTracks([linear]));
      expect(replaced.diagnostics.engine).toBe('js-host');
      replaced.sampleAt(500);
      expect(replaced.get('x')).toBe(75);
      replaced.dispose();
    } finally {
      Easing.linear = original;
    }
  });
  test('detaches and freezes authoring without freezing caller values', () => {
    const value = { x: 0 };
    const input = {
      id: 'x',
      easing: 'linear',
      keyframes: [
        { at: '0f', value },
        { at: '24f', value: { x: 100 } },
      ],
      frameRate: 24,
    };
    const plan = compileTracks([input]);
    value.x = 70;
    input.keyframes[1].value.x = 200;
    const player = createCompiledPlayer(plan);
    player.sampleAt(500);
    expect(player.get('x')).toEqual({ x: 50 });
    expect(Object.isFrozen(value)).toBe(false);
    expect(plan.authored[0].keyframes[1].at).toBe('24f');
    expect(Object.isFrozen(plan.ir.tracks[0].values[0])).toBe(true);
    player.dispose();
  });

  test.each(['normal', 'reverse', 'alternate', 'alternate-reverse'] as const)(
    'matches Track scalar and compound, %s direction, random/reverse seeks',
    (direction) => {
      for (const source of [linear, compound]) {
        const input = { ...source, direction, repeat: 3, repeatDelay: 25 };
        const player = createCompiledPlayer(compileTracks([input]));
        let expected: MotionValueShape = 0;
        const reference = new Track({
          ...input,
          apply(value) {
            expected = value;
          },
        });
        let seed = 947;
        for (let sample = 0; sample < 250; sample++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          const time = sample < 5 ? [-1, 0, 500, 1000, 5000][sample] : seed % 5000;
          reference.sampleAt(time);
          player.sampleAt(time);
          expect(player.get(input.id)).toEqual(expected);
        }
        player.dispose();
      }
    },
  );

  test('sorts keys once and preserves duplicate segment boundaries and endpoint spelling', () => {
    const input = {
      id: 'units',
      easing: 'linear',
      keyframes: [
        { at: 100, value: '020px' },
        { at: 0, value: '001px' },
        { at: 50, value: '010px' },
        { at: 50, value: '030px' },
      ],
    };
    const player = createCompiledPlayer(compileTracks([input]));
    const reference = new Track({ ...input, apply() {} });
    for (const time of [0, 10, 49.9, 50, 50.1, 99, 100]) {
      player.sampleAt(time);
      expect(player.get('units')).toBe(reference.valueAt(time));
    }
    player.dispose();
  });

  test('supports steps-start descriptor in numeric execution', () => {
    const player = createCompiledPlayer(compileTracks([{ ...linear, easing: steps(4, 'start') }]));
    expect(player.diagnostics.engine).toBe('js');
    player.sampleAt(100);
    expect(player.get('x')).toBe(25);
  });

  test('classifies discrete/optional/custom values and keeps host callbacks inline', () => {
    const calls: string[] = [];
    const plan = compileTracks([
      {
        ...linear,
        id: 'first',
        easing: (t) => {
          calls.push('ease');
          return t;
        },
      },
      {
        id: 'discrete',
        keyframes: [
          { at: 0, value: false },
          { at: 1000, value: true },
        ],
      },
    ]);
    const player = createCompiledPlayer(plan, {
      backend: 'auto',
      bindings: {
        first() {
          calls.push('first');
        },
        discrete() {
          calls.push('discrete');
        },
      },
    });
    expect(player.diagnostics.engine).toBe('js-host');
    expect(plan.diagnostics.map((item) => item.id)).toEqual(['first', 'discrete']);
    player.sampleAt(500);
    expect(calls).toEqual(['ease', 'first', 'discrete']);
    expect(player.get('discrete')).toBe(false);
    expect(() => compileTracks(plan.authored, { requirePortable: true })).toThrow(
      'Portable compilation',
    );
  });

  test('does not fabricate wasm selection and never hot-switches an existing player', () => {
    const plan = compileTracks([linear]);
    expect(() => createCompiledPlayer(plan, { backend: 'wasm' })).toThrow('runtime');
    const player = createCompiledPlayer(plan, { backend: 'auto' });
    expect(player.diagnostics.engine).toBe('js');
    expect(player.diagnostics.reasons[0].reason).toContain('not supplied');
    expect(() => createCompiledPlayer({ ...plan })).toThrow('Expected a plan');
  });

  test('callbacks see complete portable state; rejects reentry and stops publication on dispose', () => {
    const calls: string[] = [];
    const player = createCompiledPlayer(compileTracks([linear, { ...linear, id: 'y' }]), {
      bindings: {
        x() {
          expect(player.get('y')).toBe(50);
          expect(() => player.sampleAt(900)).toThrow('Reentrant');
          calls.push('x');
          player.dispose();
        },
        y() {
          calls.push('y');
        },
      },
    });
    player.sampleAt(500);
    expect(calls).toEqual(['x']);
    expect(() => player.sampleAt(0)).toThrow('disposed');
    player.dispose();
  });

  test('caller callback exceptions are not retried and sampling guard recovers', () => {
    let calls = 0;
    const player = createCompiledPlayer(compileTracks([linear]), {
      bindings: {
        x() {
          calls++;
          if (calls === 1) throw new Error('host');
        },
      },
    });
    expect(() => player.sampleAt(100)).toThrow('host');
    player.sampleAt(200);
    expect(calls).toBe(2);
    expect(player.get('x')).toBe(20);
  });

  test('can be driven by the existing Timeline and synchronous Transport', () => {
    const player = createCompiledPlayer(compileTracks([linear]));
    const timeline = new Timeline({ frameRate: 24 }).add(player);
    const transport = new Transport({ root: timeline, frameRate: 24 });
    transport.seek(500);
    expect(player.get('x')).toBe(50);
    transport.dispose();
    // Transport teardown does not permanently free externally owned compiled data.
    transport.seek(250);
    expect(player.get('x')).toBe(25);
    transport.dispose();
    player.dispose();
  });

  test('validates malformed plans, ids, nesting, reserved keys, accessors and finite samples', () => {
    expect(() => compileTracks([linear, linear])).toThrow('unique');
    expect(() => compileTracks([{ ...linear, repeat: 0.5 }])).toThrow('repeat');
    expect(() => compileTracks([{ ...linear, keyframes: [{ at: NaN, value: 0 }] }])).toThrow(
      'times',
    );
    expect(() =>
      compileTracks([
        { ...linear, keyframes: [{ at: 0, value: JSON.parse('{"__proto__":{"x":1}}') }] },
      ]),
    ).toThrow('Reserved');
    let read = false;
    const value = {
      get x() {
        read = true;
        return 1;
      },
    };
    expect(() => compileTracks([{ ...linear, keyframes: [{ at: 0, value }] }])).toThrow(
      'accessors',
    );
    expect(read).toBe(false);
    expect(() => validateNumericPlan({ version: 2 } as unknown as NumericPlan)).toThrow('version');
    const player = createCompiledPlayer(compileTracks([linear]));
    expect(() => player.sampleAt(NaN)).toThrow('finite');
    expect(() => player.sampleAt(Infinity)).toThrow('finite');
  });

  test('numeric evaluator owns input and returns finite zero/submillisecond samples', () => {
    const plan = compileTracks([
      {
        ...linear,
        repeat: Infinity,
        direction: 'alternate',
        keyframes: [
          { at: 0, value: 0 },
          { at: 0.1, value: 100 },
        ],
      },
    ]);
    const evaluator = createJsEvaluator(plan.ir);
    expect(evaluator.sample(0.15)[0]).toBeCloseTo(50);
    expect(evaluator.sample(0.25)[0]).toBeCloseTo(50);
    const zero = createCompiledPlayer(
      compileTracks([
        {
          ...linear,
          repeat: Infinity,
          keyframes: [
            { at: 0, value: 20 },
            { at: 0, value: 30 },
          ],
        },
      ]),
    );
    zero.sampleAt(900);
    expect(zero.get('x')).toBe(20);
    evaluator.dispose();
    expect(() => evaluator.sample(1)).toThrow('disposed');
  });
});

test('Wasm wrapper refreshes memory views, isolates runtime lifetime, rejects ABI and failed loading', async () => {
  const memory = new WebAssembly.Memory({ initial: 1 });
  let next = 0;
  const live = new Set<number>();
  const bindings = {
    version: () => 1,
    create() {
      const id = ++next;
      live.add(id);
      return id;
    },
    sample(id: number, ms: number) {
      if (!live.has(id)) throw new Error('stale');
      new Float64Array(memory.buffer)[id] = ms;
    },
    values_ptr(id: number) {
      return id * 8;
    },
    values_len() {
      return 1;
    },
    free(id: number) {
      live.delete(id);
    },
  };
  const runtime = createWasmRuntime(bindings, memory);
  const first = runtime.createEvaluator(compileTracks([linear]).ir);
  expect(first.sample(2)[0]).toBe(2);
  memory.grow(1);
  expect(first.sample(3)[0]).toBe(3);
  const second = runtime.createEvaluator(compileTracks([linear]).ir);
  first.dispose();
  first.dispose();
  expect(second.sample(4)[0]).toBe(4);
  runtime.dispose();
  runtime.dispose();
  expect(live.size).toBe(0);
  expect(() => second.sample(5)).toThrow('disposed');
  expect(() => createWasmRuntime({ ...bindings, version: () => 2 }, memory)).toThrow('ABI');
  await expect(
    loadWasmRuntime(async () => {
      throw new Error('CSP blocked');
    }),
  ).rejects.toThrow('CSP blocked');
});
