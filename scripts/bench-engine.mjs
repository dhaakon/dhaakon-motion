import { performance } from 'node:perf_hooks';
import { cpus, platform, arch } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { sourceMotion, inputs, root } from './engine-fixtures.mjs';

const { motion, sourceSha256 } = await sourceMotion();
let runtime;
if (existsSync(root + 'wasm/node/motion_wasm.js')) {
  const bindings = createRequire(import.meta.url)(root + 'wasm/node/motion_wasm.js');
  runtime = motion.createWasmRuntime(bindings, bindings.wasm_memory());
} else
  console.warn(
    'Wasm artifact unavailable: measuring JS only. Run npm run build:wasm for comparison.',
  );
const quick = process.argv.includes('--quick');
const rounds = quick ? 1 : 3,
  warmup = quick ? 10 : 60,
  measured = quick ? 30 : 180;
let sink = 0;
const publish = (value) => {
  sink += typeof value === 'number' ? value : value.position.x + value.color.length;
};
const workloads = [
  ...(quick ? [100, 1000] : [100, 1000, 10_000]).flatMap((count) => [
    { count, compound: false, keys: 2 },
    { count, compound: true, keys: 2 },
  ]),
  ...[8, 256, 1024].map((keys) => ({ count: 1000, compound: false, keys })),
];
const results = [];
try {
  for (const workload of workloads) {
    for (const backend of ['interpreter', 'compiled-js', ...(runtime ? ['compiled-wasm'] : [])]) {
      const samples = [],
        construction = [];
      try {
        for (let round = 0; round < rounds; round++) {
          globalThis.gc?.();
          const authored = inputs(workload.count, workload.compound, workload.keys);
          const started = performance.now();
          let step, dispose;
          if (backend === 'interpreter') {
            const tracks = authored.map((input) => new motion.Track({ ...input, apply: publish }));
            step = (ms) => {
              for (const track of tracks) track.sampleAt(ms);
            };
          } else {
            const player = motion.createCompiledPlayer(motion.compileTracks(authored), {
              backend: backend === 'compiled-wasm' ? 'wasm' : 'js',
              runtime,
              bindings: Object.fromEntries(authored.map((input) => [input.id, publish])),
            });
            step = (ms) => player.sampleAt(ms);
            dispose = () => player.dispose();
          }
          construction.push(performance.now() - started);
          try {
            for (let i = 0; i < warmup; i++) step((i * 37) % 1999);
            for (let i = 0; i < measured; i++) {
              const start = performance.now();
              step((i * 37) % 1999);
              samples.push(performance.now() - start);
            }
          } finally {
            dispose?.();
          }
        }
      } catch (error) {
        const reason = String(error);
        const resourceLimit = reason.includes('RESOURCE_LIMIT');
        const result = {
          ...workload,
          backend,
          status: resourceLimit ? 'resource-limit' : 'error',
          reason,
        };
        results.push(result);
        console.log(JSON.stringify(result));
        if (!resourceLimit) process.exitCode = 1;
        continue;
      }
      samples.sort((a, b) => a - b);
      construction.sort((a, b) => a - b);
      const result = {
        ...workload,
        backend,
        samples: samples.length,
        p50Ms: samples[Math.floor(samples.length * 0.5)],
        p95Ms: samples[Math.floor(samples.length * 0.95)],
        p99Ms: samples[Math.floor(samples.length * 0.99)],
        constructionMs: construction[Math.floor(construction.length / 2)],
      };
      results.push(result);
      console.log(JSON.stringify(result));
    }
  }
} finally {
  runtime?.dispose();
}
await mkdir(root + 'test-results', { recursive: true });
const report = {
  environment: {
    node: process.version,
    platform: platform(),
    arch: arch(),
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
  },
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceSha256,
  method: {
    rounds,
    warmup,
    measured,
    time: '(sample * 37) % 1999',
    includes:
      'evaluation, actual Wasm boundary when selected, shape materialization, callback publication',
    excludes:
      'DOM/GPU/React, browser paint, encoding; construction reported separately; module startup not measured',
    decision: 'exploratory shared-host timings; not a CI threshold or automatic promotion',
  },
  results,
  sink,
};
await writeFile(
  root + 'test-results/engine-benchmark.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log('Report: test-results/engine-benchmark.json');
