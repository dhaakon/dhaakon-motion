import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const dist = new URL('../dist/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('.vite/manifest.json', dist), 'utf8'));
const registry = await readFile(new URL('../src/routes.ts', import.meta.url), 'utf8');
const pageNames = [...registry.matchAll(/import\('\.\/pages\/([^']+)'\)/g)].map(
  (match) => match[1],
);
assert(pageNames.length > 0, 'No lazy routes found');
const initial = new Set();
function visit(key) {
  if (initial.has(key)) return;
  const chunk = manifest[key];
  assert(chunk, `Missing chunk: ${key}`);
  initial.add(key);
  for (const imported of chunk.imports ?? []) visit(imported);
}
visit('index.html');
let raw = 0,
  gzip = 0;
for (const key of initial) {
  assert(!key.includes('Page.tsx'), `Feature eagerly imported: ${key}`);
  assert(!/three.*module/i.test(key), `Three.js eagerly imported: ${key}`);
  assert(
    !/motion_wasm|compiled|RustExperimental/i.test(key),
    `Experimental runtime eagerly imported: ${key}`,
  );
  const content = await readFile(new URL(manifest[key].file, dist));
  raw += content.byteLength;
  gzip += gzipSync(content).byteLength;
}
assert(raw < 370_000, `Initial JS exceeds 370 kB budget: ${raw}`);
assert(gzip < 120_000, `Initial gzip JS exceeds 120 kB budget: ${gzip}`);
console.log(`Initial JS: ${(raw / 1000).toFixed(1)} kB / ${(gzip / 1000).toFixed(1)} kB gzip`);
for (const name of pageNames) {
  const chunk = manifest[`src/pages/${name}.tsx`];
  assert(chunk?.isDynamicEntry, `${name} must be a lazy page entry`);
  const { size } = await stat(new URL(chunk.file, dist));
  assert(size < 110_000, `${name} exceeds the 110 kB page-chunk budget`);
  console.log(`${name}: ${(size / 1000).toFixed(1)} kB (excluding shared dependencies)`);
}
assert(
  (await stat(new URL('media/dhaakon-ink-signal-v2-1920x1080-24fps.mp4', dist))).size > 1_000_000,
  'Offline comparison video missing',
);
console.log(`PASS: ${pageNames.length} lazy pages; media present; ${fileURLToPath(dist)}`);
