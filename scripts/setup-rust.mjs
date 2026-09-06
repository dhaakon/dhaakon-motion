import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const rustVersion = '1.94.1';
export const bindgenVersion = '0.2.114';
export const rustEnv = {
  ...process.env,
  CARGO_HOME: join(root, '.tools/cargo'),
  RUSTUP_HOME: join(root, '.tools/rustup'),
  RUSTUP_TOOLCHAIN: rustVersion,
  PATH: `${join(root, '.tools/cargo/bin')}:${process.env.PATH ?? ''}`,
};
export const cargo = join(rustEnv.CARGO_HOME, 'bin/cargo');
export const bindgen = join(root, '.tools/wasm-bindgen/bin/wasm-bindgen');
const localCompiler = join(root, '.tools/host-cc/usr/bin/x86_64-linux-gnu-gcc-15');
function configureLocalCompiler() {
  if (existsSync(localCompiler)) {
    rustEnv.CC = localCompiler;
    rustEnv.CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER = localCompiler;
  }
}
configureLocalCompiler();

function provisionLocalCompiler() {
  // Optional Ubuntu x64 bootstrap for the audited host: extracted files only,
  // never apt install, root privileges, package registration or system changes.
  const packages = [
    ['gcc-15-x86-64-linux-gnu', 'df0e5375c9e981b18e396c2e9ec1e359f226576a9b94a311bf07603f3ca6023a'],
    ['libgcc-15-dev', '32fa5bde1891f46fd4f422e466c863fb78e834b634e1aa08211c8eea68870af5'],
    ['cpp-15-x86-64-linux-gnu', '1649aa71c45b047feda5b9ca303c94799bdba5befa5c9de9735cbfc59c3ef93f'],
  ];
  for (const [name, expected] of packages) {
    const filename = `${name}_15.2.0-16ubuntu1_amd64.deb`;
    const downloaded = join(root, '.tools', filename);
    run('curl', ['--fail', '--location', '--silent', '--show-error', '--output', downloaded,
      `https://archive.ubuntu.com/ubuntu/pool/main/g/gcc-15/${filename}`]);
    if (createHash('sha256').update(readFileSync(downloaded)).digest('hex') !== expected) {
      throw new Error(`Pinned ${name} checksum mismatch; package was not extracted.`);
    }
    run('dpkg-deb', ['--extract', downloaded, join(root, '.tools/host-cc')]);
  }
  configureLocalCompiler();
  run(localCompiler, ['--version']);
}

export function run(command, args) {
  execFileSync(command, args, { cwd: root, env: rustEnv, stdio: 'inherit' });
}

// Deliberately explicit provisioning, never an import/build-time network side effect.
// Other hosts can provision the pinned toolchain manually into these local homes.
export function setup() {
  if (process.platform !== 'linux' || process.arch !== 'x64') {
    throw new Error('Automatic provisioning supports Linux x64 only. Install the pinned Rust toolchain and wasm-bindgen into .tools on this host.');
  }
  mkdirSync(join(root, '.tools'), { recursive: true });
  if (process.argv.includes('--local-cc') && !existsSync(localCompiler)) provisionLocalCompiler();
  const rustup = join(rustEnv.CARGO_HOME, 'bin/rustup');
  if (!existsSync(rustup)) {
    const installer = join(root, '.tools/rustup-init-1.28.2');
    run('curl', ['--fail', '--location', '--silent', '--show-error', '--output', installer,
      'https://static.rust-lang.org/rustup/archive/1.28.2/x86_64-unknown-linux-gnu/rustup-init']);
    const expected = '20a06e644b0d9bd2fbdbfd52d42540bdde820ea7df86e92e533c073da0cdd43c';
    const actual = createHash('sha256').update(readFileSync(installer)).digest('hex');
    if (actual !== expected) throw new Error('Pinned rustup installer checksum mismatch; installer was not executed.');
    chmodSync(installer, 0o700);
    run(installer, ['-y', '--no-modify-path', '--profile', 'minimal', '--default-toolchain', 'none']);
  }
  run(rustup, ['set', 'auto-self-update', 'disable']);
  run(rustup, ['toolchain', 'install', rustVersion, '--profile', 'minimal', '--component', 'clippy,rustfmt', '--target', 'wasm32-unknown-unknown']);
  let installed = '';
  if (existsSync(bindgen)) installed = execFileSync(bindgen, ['--version'], { encoding: 'utf8' }).trim();
  if (installed !== `wasm-bindgen ${bindgenVersion}`) {
    run(cargo, ['install', '--locked', '--version', bindgenVersion, '--root', join(root, '.tools/wasm-bindgen'), 'wasm-bindgen-cli']);
  }
  run(cargo, ['--version']);
  run(bindgen, ['--version']);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) setup();
