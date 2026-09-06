import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { sourceMotion, parityInputs, root } from './engine-fixtures.mjs';
import { cargo, rustEnv } from './setup-rust.mjs';

const { motion, sourceSha256 } = await sourceMotion();
const bindings = createRequire(import.meta.url)(root + 'wasm/node/motion_wasm.js');
const runtime = motion.createWasmRuntime(bindings, bindings.wasm_memory());
const web = await import('../wasm/web/motion_wasm.js');
const webOutput = await web.default({
  module_or_path: await readFile(root + 'wasm/web/motion_wasm_bg.wasm'),
});
const webRuntime = motion.createWasmRuntime(web, webOutput.memory);
let comparisons = 0;
function close(actual, expected, path = 'value') {
  if (typeof expected === 'number') {
    assert(
      Number.isFinite(actual) && Math.abs(actual - expected) <= 1e-9 + 1e-10 * Math.abs(expected),
      `${path}: ${actual} != ${expected}`,
    );
    comparisons++;
  } else if (expected && typeof expected === 'object') {
    assert.deepEqual(Object.keys(actual), Object.keys(expected), `${path} shape`);
    for (const key of Object.keys(expected)) close(actual[key], expected[key], `${path}.${key}`);
  } else assert.equal(actual, expected, path);
}
const authored = parityInputs();
authored.push({
  id: 'sub-ms',
  repeat: Infinity,
  direction: 'alternate',
  easing: 'linear',
  keyframes: [
    { at: 0, value: 0 },
    { at: 0.1, value: 100 },
  ],
});
authored.push({
  id: 'zero',
  repeat: Infinity,
  easing: 'linear',
  keyframes: [
    { at: 0, value: 5 },
    { at: 0, value: 7 },
  ],
});
const plan = motion.compileTracks(authored, { requirePortable: true });
const times = [
  -10,
  0,
  0.05,
  0.1,
  0.15,
  500,
  2000,
  2025,
  8100,
  ...Array.from({ length: 250 }, (_, i) => (i * 137) % 8999),
];
const js = motion.createJsEvaluator(plan.ir),
  wasm = runtime.createEvaluator(plan.ir),
  webEval = webRuntime.createEvaluator(plan.ir);
try {
  for (const time of times) {
    const expected = js.sample(time);
    close(Array.from(wasm.sample(time)), Array.from(expected), `node@${time}`);
    close(Array.from(webEval.sample(time)), Array.from(expected), `web@${time}`);
  }
  // Force growth between frames and create/free a second plan; all views must refresh.
  bindings.wasm_memory().grow(1);
  const another = runtime.createEvaluator(plan.ir);
  another.dispose();
  close(Array.from(wasm.sample(137)), Array.from(js.sample(137)), 'memory-growth');
  const handle = bindings.create(JSON.stringify(plan.ir));
  bindings.free(handle);
  assert.throws(() => bindings.sample(handle, 0));
  assert.throws(() => bindings.free(handle));
  assert.throws(() => bindings.create('{"version":999,"tracks":[]}'));
  assert.throws(() => bindings.create('{"version":1,"tracks":null}'));
  const native = JSON.parse(
    execFileSync(
      cargo,
      ['run', '--locked', '--quiet', '--release', '-p', 'motion-core', '--example', 'sample'],
      {
        cwd: root,
        env: rustEnv,
        input: JSON.stringify({ plan: plan.ir, times }),
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
      },
    ),
  );
  assert.equal(native.version, 1);
  assert.equal(native.frames.length, times.length);
  times.forEach((time, i) =>
    close(native.frames[i], Array.from(js.sample(time)), `native@${time}`),
  );
  // Check materialized colors/units as strings, not just underlying channel tolerances.
  const materialized = [
    motion.createCompiledPlayer(plan),
    motion.createCompiledPlayer(plan, { backend: 'wasm', runtime }),
  ];
  try {
    for (const time of times) {
      materialized.forEach((player) => player.sampleAt(time));
      for (const input of authored)
        close(
          materialized[1].get(input.id),
          materialized[0].get(input.id),
          `materialized@${time}.${input.id}`,
        );
    }
  } finally {
    materialized.forEach((player) => player.dispose());
  }

  if (typeof bindings.create_binary === 'function') {
    const bytes = motion.encodeNumericPlan(plan.ir);
    const binaryHandle = bindings.create_binary(bytes);
    try {
      bindings.sample(binaryHandle, 137);
      close(
        Array.from(
          new Float64Array(
            bindings.wasm_memory().buffer,
            bindings.values_ptr(binaryHandle),
            bindings.values_len(binaryHandle),
          ),
        ),
        Array.from(js.sample(137)),
        'binary',
      );
    } finally {
      bindings.free(binaryHandle);
    }
    for (const length of [0, 1, 11, bytes.length - 1])
      assert.throws(() => bindings.create_binary(bytes.slice(0, length)));
    const bad = bytes.slice();
    bad[4] = 99;
    assert.throws(() => bindings.create_binary(bad));
    assert.throws(() => bindings.create_binary(new Uint8Array([...bytes, 0])));
  } else throw new Error('Rebuild Wasm: create_binary is required for current conformance');

  // Full 576-frame flagship CONTROL STATE, not pixels/geometry/cues. All groups currently start at zero.
  const score = motion.advancedCueSheet;
  const tracks = score.items.flatMap((group) => {
    assert.equal(group.at, '0f');
    assert.equal(group.frameRate, 24);
    return group.items.map((track) => {
      assert.equal(track.at, '0f');
      return { ...track, id: track.target, frameRate: 24 };
    });
  });
  const flagshipPlan = motion.compileTracks(tracks, { requirePortable: true });
  const current = {},
    reference = motion.loadSheet(score, {
      targets: Object.fromEntries(
        tracks.map((track) => [
          track.id,
          (value) => {
            current[track.id] = value;
          },
        ]),
      ),
    });
  const players = [
    motion.createCompiledPlayer(flagshipPlan),
    motion.createCompiledPlayer(flagshipPlan, { backend: 'wasm', runtime }),
  ];
  const sequential = Array.from({ length: 576 }, (_, i) => i),
    reverse = [...sequential].reverse(),
    shuffled = [...sequential].sort((a, b) => ((a * 137) % 577) - ((b * 137) % 577));
  for (const frames of [sequential, reverse, shuffled]) {
    for (const frame of frames) {
      const time = (frame * 1000) / 24;
      reference.sampleAt(time, { direction: 1, fireCues: false });
      for (const player of players) {
        player.sampleAt(time);
        for (const track of tracks)
          close(player.get(track.id), current[track.id], `flagship.${frame}.${track.id}`);
      }
    }
  }
  players.forEach((player) => player.dispose());
  await mkdir(root + 'test-results', { recursive: true });
  await writeFile(
    root + 'test-results/wasm-conformance.json',
    JSON.stringify(
      {
        passed: true,
        sourceSha256,
        numericComparisons: comparisons,
        curves: 17,
        directions: 4,
        numericSamples: times.length,
        runtimes: ['compiled-js', 'node-wasm', 'web-module-wasm-in-node', 'native-rust'],
        flagship: {
          frames: 576,
          orders: ['sequential', 'reverse', 'permuted'],
          targets: tracks.length,
          stateOnly: true,
        },
        limits: 'No browser pixels/GPU/audio parity claim. Browser loading checked separately.',
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `PASS: ${comparisons} numeric comparisons; native/JS/Wasm kernels, memory growth/stale handles, all 576 flagship control frames in three orders.`,
  );
} finally {
  js.dispose();
  wasm.dispose();
  webEval.dispose();
  runtime.dispose();
  webRuntime.dispose();
}
