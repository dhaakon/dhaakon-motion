import { cargo, run } from './setup-rust.mjs';

// Validation only: never provisions or changes the project-local toolchain.
run(cargo, ['fmt', '--all', '--', '--check']);
run(cargo, ['test', '--workspace', '--locked']);
run(cargo, ['clippy', '--workspace', '--all-targets', '--locked', '--', '-D', 'warnings']);
run(cargo, ['clippy', '--target', 'wasm32-unknown-unknown', '-p', 'motion-wasm', '--locked', '--', '-D', 'warnings']);
