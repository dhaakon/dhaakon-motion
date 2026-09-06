import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { launchBrowser } from '../docs/scripts/browser.mjs';

// This gate consumes existing release artifacts. It never builds source/Wasm,
// installs registry packages, publishes, or changes a deployed service.
const root = fileURLToPath(new URL('../', import.meta.url));
const results = join(root, 'test-results');
const reportPath = join(results, 'packed-engine-report.json');
const localRequire = createRequire(import.meta.url);
const children = new Set();
const report = { format: 'dhaakon-motion/packed-engine/1', passed: false, checks: {}, limits: [
  'Uses the existing installed React version, not a React 18/19 compatibility matrix.',
  'SSR renderToString only; no streaming, hydration, React StrictMode, GPU, pixels, or audio certification.',
  'Browser consumer is built with installed esbuild and explicit exported-Wasm asset copying; not every bundler/CSP/CDN policy.',
  'ESM and CJS identities are checked independently, not across mixed module formats.',
] };
let work, browser, server, cleanupPromise;

async function run(command, args, cwd) {
  return new Promise((resolveRun, reject) => {
    const child = execFile(command, args, {
      cwd, encoding: 'utf8', timeout: 60_000, maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, npm_config_offline: 'true', npm_config_audit: 'false', npm_config_fund: 'false', npm_config_update_notifier: 'false' },
    }, (error, stdout, stderr) => {
      children.delete(child);
      if (error) reject(new Error(`${basename(command)} ${args[0]} failed:\n${stdout}\n${stderr}`, { cause: error }));
      else resolveRun({ stdout, stderr });
    });
    children.add(child);
  });
}

async function cleanup() {
  if (cleanupPromise) return cleanupPromise;
  cleanupPromise = (async () => {
    for (const child of children) child.kill('SIGTERM');
    const errors = [];
    try { await browser?.close(); } catch (error) { errors.push(error); }
    if (server) {
      server.closeAllConnections();
      await new Promise((resolveClose) => server.close(resolveClose));
    }
    if (work) {
      // Only delete the exact unique directory created by this invocation.
      assert.equal(dirname(work), results);
      assert(basename(work).startsWith('packed-engine-'));
      try { await rm(work, { recursive: true, force: true, maxRetries: 3 }); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, 'Packed consumer cleanup failed');
  })();
  return cleanupPromise;
}

for (const [signal, exitCode] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  process.once(signal, () => { cleanup().finally(() => process.exit(exitCode)); });
}

// Written into isolated ESM and CJS consumers. Imports resolve from that
// consumer, never through repository source aliases or an in-memory source build.
async function nodeConsumer(mode, load, resolveExport) {
  const assert = (await import('node:assert/strict')).default;
  const { readFile } = await import('node:fs/promises');
  const originalFetch = globalThis.fetch;
  const originalWasm = globalThis.WebAssembly;
  let fetches = 0, implicitWasmCalls = 0;
  globalThis.fetch = () => { fetches++; throw new Error('Unexpected fetch in packed Node consumer'); };
  globalThis.WebAssembly = new Proxy(originalWasm, {
    get(target, key) {
      if (['compile', 'compileStreaming', 'instantiate', 'instantiateStreaming', 'Module', 'Instance'].includes(key)) {
        return () => { implicitWasmCalls++; throw new Error('Wasm initialized during ordinary package import/SSR'); };
      }
      return Reflect.get(target, key);
    },
  });
  const owned = [];
  try {
    const core = await load('@dhaakon/motion');
    const compiled = await load('@dhaakon/motion/compiled');
    const adapter = await load('@dhaakon/motion/react');
    const css = await load('@dhaakon/motion/css');
    assert.equal(typeof css.createCssAnimator, 'function');
    assert.equal(css.createCssMotionTokens({ duration: '200ms', durationFast: '120ms', durationSlow: '360ms', ease: 'linear' }).feedback.duration, 200);
    const reactModule = await load('react');
    const React = reactModule.default ?? reactModule;
    const ReactDOMServer = await load('react-dom/server');
    function Probe() {
      const value = adapter.useMotionValue(7);
      assert(value instanceof core.MotionValue, 'React adapter must use the packed root MotionValue');
      return React.createElement('span', null, adapter.useMotionValueState(value));
    }
    const html = ReactDOMServer.renderToString(React.createElement(adapter.MotionConfig, { reducedMotion: 'always' }, React.createElement(Probe)));
    assert.equal(html, '<span>7</span>');
    const cssHtml = ReactDOMServer.renderToString(React.createElement(adapter.MotionConfig, { reducedMotion: 'always' },
      React.createElement(adapter.cssMotion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, 'data-css': 'ssr' }, 'CSS surface')));
    assert(cssHtml.includes('opacity:1'));
    assert(cssHtml.includes('CSS surface'));
    assert.equal(fetches, 0);
    assert.equal(implicitWasmCalls, 0);
    assert.equal(core.scheduler.size, 0);
    globalThis.WebAssembly = originalWasm;

    // Factory metadata and registry identity catch an accidentally bundled second core.
    const source = { id: 'x', easing: core.steps(4, 'start'), keyframes: [{ at: 0, value: 0 }, { at: 1000, value: 100 }] };
    const plan = compiled.compileTracks([source], { requirePortable: true });
    let customCalls = 0;
    core.registerEasing(`packed-${mode}`, (t) => { customCalls++; return t * t; });
    const host = compiled.createCompiledPlayer(compiled.compileTracks([{ ...source, easing: `packed-${mode}` }]));
    owned.push(host);
    assert.equal(host.diagnostics.engine, 'js-host');
    host.sampleAt(500);
    assert.equal(host.get('x'), 25);
    assert.equal(customCalls, 1);

    const js = compiled.createCompiledPlayer(plan);
    owned.push(js);
    const transport = new core.Transport({ root: new core.Timeline({ frameRate: 24 }).add(js), frameRate: 24 });
    owned.push(transport);
    transport.seek(100);
    assert.equal(js.get('x'), 25);

    const assets = [
      '@dhaakon/motion', '@dhaakon/motion/compiled', '@dhaakon/motion/react', '@dhaakon/motion/css',
      '@dhaakon/motion/wasm/node/motion_wasm.js', '@dhaakon/motion/wasm/node/motion_wasm_bg.wasm',
      '@dhaakon/motion/wasm/web/motion_wasm.js', '@dhaakon/motion/wasm/web/motion_wasm_bg.wasm',
      '@dhaakon/motion/wasm/web/motion_wasm.d.ts', '@dhaakon/motion/wasm/manifest.json',
    ];
    const paths = Object.fromEntries(assets.map((id) => [id, resolveExport(id)]));
    for (const path of Object.values(paths)) assert((await readFile(path)).length > 0);
    const nodeModule = await load('@dhaakon/motion/wasm/node/motion_wasm.js');
    const nodeBindings = nodeModule.default ?? nodeModule;
    assert.equal(typeof nodeBindings.wasm_memory, 'function');
    const runtime = compiled.createWasmRuntime(nodeBindings, nodeBindings.wasm_memory());
    owned.push(runtime);
    const nativePlayer = compiled.createCompiledPlayer(plan, { backend: 'wasm', runtime });
    owned.push(nativePlayer);
    assert.equal(nativePlayer.diagnostics.engine, 'wasm');
    let comparisons = 0;
    for (const time of [-1, 0, 1, 100, 250, 500, 999, 1000, 1250]) {
      js.sampleAt(time); nativePlayer.sampleAt(time);
      assert.equal(nativePlayer.get('x'), js.get('x'));
      comparisons++;
    }
    const evaluator = runtime.createEvaluator(plan.ir);
    owned.push(evaluator);
    evaluator.sample(100);
    nodeBindings.wasm_memory().grow(1);
    assert.equal(evaluator.sample(100)[0], 25);

    const webBindings = await import('@dhaakon/motion/wasm/web/motion_wasm.js');
    const bytes = await readFile(paths['@dhaakon/motion/wasm/web/motion_wasm_bg.wasm']);
    assert.equal(bytes.subarray(0, 4).toString('hex'), '0061736d');
    await webBindings.default({ module_or_path: bytes });
    const webRuntime = compiled.createWasmRuntime(webBindings, webBindings.wasm_memory());
    owned.push(webRuntime);
    const webPlayer = compiled.createCompiledPlayer(plan, { backend: 'wasm', runtime: webRuntime });
    owned.push(webPlayer);
    webPlayer.sampleAt(100);
    assert.equal(webPlayer.get('x'), 25);
    assert.equal(fetches, 0, 'Node web loader initialized from supplied bytes without fetching');
    return { mode, ssr: html, reactVersion: React.version, fetches, implicitWasmCalls, numericComparisons: comparisons + 2, paths };
  } finally {
    for (const item of owned.reverse()) item.dispose();
    globalThis.fetch = originalFetch;
    globalThis.WebAssembly = originalWasm;
  }
}

async function browserConsumer(core, compiled, initialize, bindings, wasmUrl) {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  check(location.pathname === '/motion-test/', 'Consumer must run at a non-root base');
  check(window.__packedFetches.length === 0, 'Package imports must not fetch Wasm');
  const sources = [
    { id: 'x', easing: core.steps(4, 'start'), keyframes: [{ at: 0, value: 0 }, { at: 1000, value: 100 }] },
    { id: 'position', easing: 'linear', keyframes: [{ at: 0, value: { x: 0, y: 100 } }, { at: 1000, value: { x: 100, y: 0 } }] },
  ];
  const plan = compiled.compileTracks(sources, { requirePortable: true });
  const js = compiled.createCompiledPlayer(plan);
  check(js.diagnostics.engine === 'js', 'JS fallback must be immediately available');
  js.sampleAt(100);
  check(js.get('x') === 25, 'Packed root/compiled easing factory identity');
  const owned = [js];
  try {
    const runtime = await compiled.loadWasmRuntime(async () => {
      await initialize({ module_or_path: wasmUrl });
      return { bindings, memory: bindings.wasm_memory() };
    });
    owned.push(runtime);
    const player = compiled.createCompiledPlayer(plan, { backend: 'wasm', runtime });
    owned.push(player);
    check(player.diagnostics.engine === 'wasm', 'Actual initialized Wasm backend must be selected');
    const root = new core.Timeline({ frameRate: 24 }).add(player);
    const transport = new core.Transport({ root, frameRate: 24 });
    owned.push(transport);
    let comparisons = 0;
    for (const time of [-1, 0, 1, 100, 250, 500, 999, 1000, 1250]) {
      js.sampleAt(time); player.sampleAt(time);
      for (const input of sources) {
        check(JSON.stringify(player.get(input.id)) === JSON.stringify(js.get(input.id)), `Wasm value mismatch: ${input.id}@${time}`);
        comparisons++;
      }
    }
    transport.seek(100);
    check(player.get('x') === 25, 'Existing synchronous Transport drives Wasm player');
    bindings.wasm_memory().grow(1);
    transport.seek(500);
    check(player.get('x') === 50, 'Wasm view refresh after actual memory growth');
    transport.play();
    await new Promise((resolveFrame) => requestAnimationFrame(resolveFrame));
    transport.pause();
    check(window.__packedFetches.length === 1, 'One explicit Wasm fetch expected');
    check(window.__packedFetches[0] === wasmUrl.href, 'Wasm URL must preserve /motion-test/assets/');
    const result = { passed: true, pathname: location.pathname, engine: player.diagnostics.engine, numericComparisons: comparisons, wasmUrl: wasmUrl.href, wasmFetches: [...window.__packedFetches] };
    for (const item of owned.reverse()) item.dispose();
    owned.length = 0;
    check(core.scheduler.size === 0, 'Packed scheduler tasks must be cleaned up');
    check(window.__packedFrames.size === 0, 'No animation frame survives cleanup');
    document.querySelector('output').textContent = 'Packed JS + Wasm passed';
    return { ...result, pendingFrames: window.__packedFrames.size, schedulerTasks: core.scheduler.size };
  } finally { for (const item of owned.reverse()) item.dispose(); }
}

try {
  await mkdir(results, { recursive: true });
  for (const file of ['dist/index.js', 'dist/index.cjs', 'dist/compiled.js', 'dist/compiled.cjs', 'dist/compiled.d.ts', 'wasm/web/motion_wasm.js', 'wasm/node/motion_wasm.js', 'wasm/manifest.json']) {
    await stat(join(root, file)).catch(() => { throw new Error(`Missing ${file}; build package and Wasm artifacts before running this gate.`); });
  }
  work = await mkdtemp(join(results, 'packed-engine-'));
  const packDir = join(work, 'pack'), consumer = join(work, 'consumer');
  await mkdir(packDir); await mkdir(consumer);
  report.stage = 'pack';
  const packResult = JSON.parse((await run('npm', ['pack', '--json', '--offline', '--ignore-scripts', '--pack-destination', packDir], root)).stdout);
  assert.equal(packResult.length, 1);
  const pack = packResult[0];
  assert.equal(basename(pack.filename), pack.filename);
  const tarball = join(packDir, pack.filename);
  report.artifact = { name: pack.name, version: pack.version, bytes: pack.size, files: pack.files.length, sha256: createHash('sha256').update(await readFile(tarball)).digest('hex') };
  await writeFile(join(consumer, 'package.json'), JSON.stringify({ name: 'dhaakon-packed-engine-consumer', private: true, type: 'module' }) + '\n');
  report.stage = 'offline-install';
  await run('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', '--omit=optional', tarball], consumer);
  const packageRoot = join(consumer, 'node_modules/@dhaakon/motion');
  assert.equal(await realpath(packageRoot), packageRoot, 'Motion must be installed from tarball, not symlinked to the repository');
  for (const id of ['react', 'react-dom']) {
    const target = dirname(localRequire.resolve(`${id}/package.json`));
    await symlink(target, join(consumer, 'node_modules', id), 'dir');
  }
  const consumerRequire = createRequire(join(consumer, 'package.json'));
  for (const mode of ['esm', 'cjs']) {
    report.stage = `node-${mode}`;
    const prefix = mode === 'esm'
      ? "import { fileURLToPath } from 'node:url'; const load = (id) => import(id); const resolveExport = (id) => fileURLToPath(import.meta.resolve(id));"
      : 'const load = async (id) => require(id); const resolveExport = (id) => require.resolve(id);';
    const entry = join(consumer, `check.${mode === 'esm' ? 'mjs' : 'cjs'}`);
    await writeFile(entry, `${prefix}\n(${nodeConsumer.toString()})(${JSON.stringify(mode)}, load, resolveExport).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exitCode = 1; });\n`);
    const result = JSON.parse((await run(process.execPath, [entry], consumer)).stdout);
    for (const path of Object.values(result.paths)) assert(path.startsWith(packageRoot + sep), `Export resolved outside packed package: ${path}`);
    report.checks[mode] = result;
  }

  report.stage = 'packed-declarations';
  await writeFile(join(consumer, 'types.mts'), `
    import { Timeline, Transport, steps, type TimelineItem } from '@dhaakon/motion';
    import { compileTracks, createCompiledPlayer, createWasmRuntime, type CompiledTrackInput } from '@dhaakon/motion/compiled';
    import initialize, * as web from '@dhaakon/motion/wasm/web/motion_wasm.js';
    import * as node from '@dhaakon/motion/wasm/node/motion_wasm.js';
    const source: CompiledTrackInput = { id: 'x', easing: steps(4, 'start'), keyframes: [{ at: 0, value: 0 }, { at: 100, value: 100 }] };
    const plan = compileTracks([source], { requirePortable: true });
    const player = createCompiledPlayer(plan);
    const item: TimelineItem = player;
    const transport = new Transport({ root: new Timeline().add(item) });
    transport.seek(50); player.sampleAt(50); player.get('x');
    const webRuntime = createWasmRuntime(web, web.wasm_memory());
    const nodeRuntime = createWasmRuntime(node, node.wasm_memory());
    void initialize; void webRuntime; void nodeRuntime;
  `);
  await writeFile(join(consumer, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { strict: true, noEmit: true, target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', lib: ['ES2022', 'DOM'], types: [], skipLibCheck: false },
    files: ['types.mts'],
  }) + '\n');
  const typed = await run(process.execPath, [localRequire.resolve('typescript/bin/tsc'), '--project', join(consumer, 'tsconfig.json'), '--listFiles'], consumer);
  const motionDeclarations = typed.stdout.split('\n').filter((path) => path.includes('@dhaakon/motion/') && /\.d\.(?:ts|cts)$/.test(path));
  assert(motionDeclarations.some((path) => path.endsWith('/dist/compiled.d.ts')));
  assert(motionDeclarations.every((path) => path.startsWith(packageRoot + sep)), 'Types must come from packed declarations');
  report.checks.declarations = { mode: 'ESM NodeNext strict', declarationFiles: motionDeclarations.length, emits: false };

  report.stage = 'browser-consumer-build';
  const publicRoot = join(work, 'public'), assets = join(publicRoot, 'motion-test/assets');
  await mkdir(assets, { recursive: true });
  const bundle = await build({
    absWorkingDir: consumer, stdin: { resolveDir: consumer, sourcefile: 'packed-browser-consumer.mjs', loader: 'js', contents: `
      import * as core from '@dhaakon/motion';
      import * as compiled from '@dhaakon/motion/compiled';
      import initialize, * as bindings from '@dhaakon/motion/wasm/web/motion_wasm.js';
      (${browserConsumer.toString()})(core, compiled, initialize, bindings, new URL('./motion_wasm_bg.wasm', import.meta.url))
        .then(result => { window.__packedReport = result; })
        .catch(error => { window.__packedReport = { passed: false, error: error.stack || String(error) }; });
    ` },
    // The temp consumer is under ignored test-results: do not inherit the repo's source aliases.
    tsconfigRaw: { compilerOptions: {} },
    outfile: join(assets, 'app.js'), bundle: true, platform: 'browser', format: 'esm', target: 'es2022', write: false, metafile: true, logLevel: 'silent',
  });
  for (const input of Object.keys(bundle.metafile.inputs)) {
    if (input === 'packed-browser-consumer.mjs') continue;
    assert(resolve(consumer, input).startsWith(packageRoot + sep), `Browser bundle used a non-packed module: ${input}`);
  }
  await writeFile(join(assets, 'app.js'), bundle.outputFiles[0].contents);
  await copyFile(consumerRequire.resolve('@dhaakon/motion/wasm/web/motion_wasm_bg.wasm'), join(assets, 'motion_wasm_bg.wasm'));
  await writeFile(join(publicRoot, 'motion-test/index.html'), '<!doctype html><html><head><meta charset="utf-8"><title>Packed Motion consumer</title><link rel="icon" href="data:,"></head><body><main><h1>Packed Motion consumer</h1><output>Loading</output></main><script type="module" src="./assets/app.js"></script></body></html>');
  report.checks.browserBundle = { bytes: bundle.outputFiles[0].contents.length, packedInputs: Object.keys(bundle.metafile.inputs) };

  report.stage = 'chrome';
  const requests = [];
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (!pathname.startsWith('/motion-test/')) { response.writeHead(404).end('Not found'); return; }
      const path = resolve(publicRoot, '.' + (pathname === '/motion-test/' ? '/motion-test/index.html' : pathname));
      if (!path.startsWith(join(publicRoot, 'motion-test') + sep)) { response.writeHead(403).end(); return; }
      const data = await readFile(path);
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm' }[extname(path)] || 'application/octet-stream';
      requests.push({ path: pathname, mime, bytes: data.length });
      response.writeHead(200, { 'Content-Type': mime, 'Content-Length': data.length, 'Cache-Control': 'no-store' }).end(data);
    } catch { response.writeHead(404).end('Not found'); }
  });
  await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolveListen); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await launchBrowser();
  await browser.send('Runtime.enable'); await browser.send('Page.enable'); await browser.send('Network.enable');
  await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__packedFetches = []; window.__packedFrames = new Set();
    const originalFetch = fetch, originalRequest = requestAnimationFrame, originalCancel = cancelAnimationFrame;
    window.fetch = (...args) => { window.__packedFetches.push(String(args[0])); return originalFetch(...args); };
    window.requestAnimationFrame = callback => { const id = originalRequest(time => { window.__packedFrames.delete(id); callback(time); }); window.__packedFrames.add(id); return id; };
    window.cancelAnimationFrame = id => { window.__packedFrames.delete(id); originalCancel(id); };
  ` });
  await browser.send('Page.navigate', { url: origin + '/motion-test/' });
  let browserResult;
  for (let attempt = 0; attempt < 150; attempt++) {
    browserResult = await browser.evaluate('window.__packedReport');
    if (browserResult) break;
    await delay(100);
  }
  assert(browserResult, 'Packed browser consumer timed out');
  assert(browserResult.passed, browserResult.error);
  const exceptions = browser.events.filter((event) => event.method === 'Runtime.exceptionThrown');
  assert.deepEqual(exceptions, [], 'Browser must not report unhandled exceptions');
  const failed = browser.events.filter((event) => event.method === 'Network.loadingFailed');
  assert.deepEqual(failed, [], 'Browser package/asset requests must not fail');
  assert(requests.some((request) => request.path === '/motion-test/assets/motion_wasm_bg.wasm' && request.mime === 'application/wasm'));
  report.checks.browser = { ...browserResult, product: (await browser.send('Browser.getVersion')).product, requests };
  report.passed = true;
  report.stage = 'complete';
  console.log('PASS: packed ESM/CJS identity + Node React SSR without fetch/init, real node/web Wasm, Chrome /motion-test/ loader and cleanup.');
} catch (error) {
  report.error = error.stack || String(error);
  process.exitCode = 1;
  console.error(report.error);
} finally {
  try { await cleanup(); } catch (error) { report.passed = false; report.cleanupError = String(error); process.exitCode = 1; console.error(error); }
  await mkdir(results, { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
}
