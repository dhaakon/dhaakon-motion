import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { bindgen, bindgenVersion, cargo, root, run, rustEnv, rustVersion } from './setup-rust.mjs';

if (!existsSync(cargo) || !existsSync(bindgen)) {
  throw new Error('Missing project-local Rust tools. Run node scripts/setup-rust.mjs first.');
}
const actual = execFileSync(bindgen, ['--version'], { encoding: 'utf8' }).trim();
if (actual !== `wasm-bindgen ${bindgenVersion}`) throw new Error(`Expected wasm-bindgen ${bindgenVersion}; got ${actual}.`);
run(cargo, ['build', '--locked', '--release', '--target', 'wasm32-unknown-unknown', '-p', 'motion-wasm']);
const input = join(root, 'target/wasm32-unknown-unknown/release/motion_wasm.wasm');
for (const [folder, target] of [['web', 'web'], ['node', 'nodejs']]) {
  const destination = join(root, 'wasm', folder);
  mkdirSync(destination, { recursive: true });
  run(bindgen, [input, '--target', target, '--out-dir', destination, '--out-name', 'motion_wasm']);
  if (folder === 'node') writeFileSync(join(destination, 'package.json'), '{"type":"commonjs","private":true}\n');
}

function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  });
}
const sources = [
  'Cargo.toml', 'Cargo.lock', 'rust-toolchain.toml', '.cargo/config.toml',
  'scripts/build-wasm.mjs', 'scripts/setup-rust.mjs',
  ...filesIn(join(root, 'crates')).filter((path) => path.endsWith('.rs') || path.endsWith('/Cargo.toml')).map((path) => relative(root, path)),
].sort();
const sourceHash = createHash('sha256');
for (const path of sources) sourceHash.update(path).update('\0').update(readFileSync(join(root, path))).update('\0');
const artifacts = Object.fromEntries(['web', 'node'].flatMap((folder) => filesIn(join(root, 'wasm', folder))).sort().map((path) => {
  const data = readFileSync(path);
  return [relative(root, path), { bytes: data.byteLength, sha256: createHash('sha256').update(data).digest('hex') }];
}));
const manifest = {
  format: 'dhaakon-motion/numeric-wasm-artifacts/1', abiVersion: 1, irVersion: 1, binaryVersion: 1,
  rustToolchain: rustVersion, wasmBindgen: bindgenVersion, target: 'wasm32-unknown-unknown',
  rustc: execFileSync(join(dirname(cargo), 'rustc'), ['--version', '--verbose'], { env: rustEnv, encoding: 'utf8' }).trim(),
  sourceSha256: sourceHash.digest('hex'), sources, artifacts,
  scope: 'Numeric kernel only; not scene, renderer, TypeScript compiler or pixel provenance.',
};
writeFileSync(join(root, 'wasm/manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
