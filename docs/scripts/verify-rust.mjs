import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { launchBrowser } from './browser.mjs';
import { serveBuilt } from './serve-built.mjs';

// Actual built-browser execution, not a simulated Wasm evaluator. Performance
// readouts are exploratory; this check asserts behavior, not speedup or pixels.
const manifest = JSON.parse(
  await readFile(new URL('../../wasm/manifest.json', import.meta.url), 'utf8'),
);
const expectedBinary = manifest.artifacts['wasm/web/motion_wasm_bg.wasm'];
const server = process.env.DOCS_URL ? null : await serveBuilt();
const base = (process.env.DOCS_URL || server.url).replace(/\/$/, '');
const reportDirectory = new URL('../../test-results/', import.meta.url);
await mkdir(reportDirectory, { recursive: true });
const results = [];
let browser;

const element = (testId) => `document.querySelector('[data-testid="${testId}"]')`;
const dataset = (testId, key) => `${element(testId)}?.dataset.${key}`;
const wasmResponses = (since = 0) =>
  browser.events
    .slice(since)
    .filter(
      (event) =>
        event.method === 'Network.responseReceived' &&
        new URL(event.params.response.url).pathname.endsWith('.wasm'),
    );

async function waitFor(expression, description) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (await browser.evaluate(`Boolean(${expression})`)) return;
    await delay(100);
  }
  throw new Error(`Timed out: ${description}`);
}

async function click(testId) {
  await waitFor(`${element(testId)} && !${element(testId)}.disabled`, `${testId} enabled`);
  await browser.evaluate(`${element(testId)}.click()`);
}

async function setInput(testId, value) {
  await browser.evaluate(`void (() => {
    const input = ${element(testId)};
    if (!input) throw new Error('Missing input: ${testId}');
    const prototype = input.tagName === 'SELECT'
      ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, ${JSON.stringify(String(value))});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
}

async function screenshot(name) {
  const { data } = await browser.send('Page.captureScreenshot', { format: 'png' });
  await writeFile(new URL(`${name}.png`, reportDirectory), Buffer.from(data, 'base64'));
}

async function navigate(path) {
  await browser.send('Page.navigate', { url: base + path });
  await waitFor(`location.pathname === ${JSON.stringify(path)}`, path);
  await waitFor(
    `document.querySelector('.page-heading h1') && !document.querySelector('.route-message')`,
    `${path} route ready`,
  );
}

async function readyExperiment() {
  await waitFor(
    `${element('rust-experimental')} && ${element('rust-runtime')}`,
    'experimental page mounted',
  );
}

async function activateLab(testId, index) {
  await browser.evaluate(`void (() => {
    const viewport = document.querySelectorAll('.demo-viewport')[${index}];
    if (!viewport) throw new Error('Missing viewport: ${testId}');
    viewport.scrollIntoView({ block: 'start' });
    const toggle = viewport.querySelector('.demo-runtime button');
    if (toggle?.textContent === 'Start demo') toggle.click();
  })()`);
  await waitFor(element(testId), `${testId} mounted in its viewport`);
}

async function leaveAndCheckCleanup() {
  await browser.evaluate('document.querySelector(".wordmark").click()');
  await waitFor(
    'location.pathname === "/" && document.querySelector(".overview-intro")',
    'client-side overview',
  );
  await waitFor('window.__rustBrowserCheck.pending.size === 0', 'all animation frames canceled');
  assert.equal(await browser.evaluate('document.querySelectorAll("canvas,video").length'), 0);
  assert.equal(await browser.evaluate(`Boolean(${element('rust-experimental')})`), false);
}

function assertNoExceptions(since = 0) {
  assert.deepEqual(
    browser.events.slice(since).filter((event) => event.method === 'Runtime.exceptionThrown'),
    [],
    'No uncaught browser exceptions',
  );
}

try {
  browser = await launchBrowser();
  await browser.send('Runtime.enable');
  await browser.send('Page.enable');
  await browser.send('Network.enable');
  await browser.send('Network.setCacheDisabled', { cacheDisabled: true });
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1050,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => {
      const pending = new Set();
      const request = window.requestAnimationFrame;
      const cancel = window.cancelAnimationFrame;
      window.__rustBrowserCheck = { pending };
      window.requestAnimationFrame = callback => {
        const id = request(time => { pending.delete(id); callback(time); });
        pending.add(id);
        return id;
      };
      window.cancelAnimationFrame = id => { pending.delete(id); cancel(id); };
    })();`,
  });

  await navigate('/');
  assert.equal(await browser.evaluate('window.__rustBrowserCheck.pending.size'), 0);
  assert.equal(wasmResponses().length, 0, 'Overview never downloads Wasm');
  await navigate('/rust/experimental');
  await readyExperiment();
  assert.equal(await browser.evaluate(dataset('rust-runtime', 'status')), 'idle');
  assert.equal(wasmResponses().length, 0, 'Visiting the experiment does not opt into Wasm');
  await activateLab('rust-score', 0);
  assert.equal(await browser.evaluate(dataset('rust-score', 'backend')), 'js');
  const initialFrame = Number(await browser.evaluate(dataset('rust-score', 'frame')));
  await click('rust-score-next');
  await waitFor(
    `${dataset('rust-score', 'frame')} === '${initialFrame + 1}'`,
    'JavaScript score works before Wasm loads',
  );
  results.push({
    check: 'root and route imports stay lazy; JavaScript score works',
    status: 'pass',
  });

  const loadMark = browser.events.length;
  await click('rust-load');
  await waitFor(`${dataset('rust-runtime', 'status')} === 'ready'`, 'real Wasm initialization');
  const response = wasmResponses(loadMark).at(-1)?.params.response;
  assert(response, 'Explicit loading fetched the actual Wasm asset');
  assert.equal(response.status, 200);
  assert.equal(response.mimeType, 'application/wasm');
  const asset = await fetch(response.url);
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get('content-type')?.split(';')[0], 'application/wasm');
  const bytes = Buffer.from(await asset.arrayBuffer());
  assert.equal(bytes.length, expectedBinary.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedBinary.sha256);
  results.push({
    check: 'emitted Wasm download matches the generated Rust artifact',
    status: 'pass',
    url: response.url,
    ...expectedBinary,
  });

  await browser.evaluate(`void (() => {
    const select = document.querySelector('[aria-label="Score engine"]');
    if (!select) throw new Error('Score engine selector missing');
    select.value = 'wasm';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor(`${dataset('rust-score', 'backend')} === 'wasm'`, 'score selects the Wasm player');
  for (const frame of [83, 240, 431, 612, 719, 0, 431]) {
    await setInput('rust-score-frame', frame);
    await waitFor(`${dataset('rust-score', 'frame')} === '${frame}'`, `exact score frame ${frame}`);
  }
  await click('rust-score-previous');
  await waitFor(`${dataset('rust-score', 'frame')} === '430'`, 'reverse score step');
  await click('rust-score-next');
  await waitFor(`${dataset('rust-score', 'frame')} === '431'`, 'forward score step');
  const acts = await browser.evaluate('document.querySelectorAll("[data-rust-act]").length');
  assert(acts >= 3, 'The layered score has multiple independently addressable acts');
  await browser.evaluate(`document.querySelector('[data-rust-act="${acts - 1}"]').click()`);
  await waitFor(
    `document.querySelector('[data-rust-act="${acts - 1}"]')?.getAttribute('aria-pressed') === 'true'`,
    'act navigation selects the authored section',
  );
  await setInput('rust-score-frame', 431);
  await waitFor(`${dataset('rust-score', 'frame')} === '431'`, 'score playback start frame');
  await click('rust-score-play');
  await waitFor(
    `Number(${dataset('rust-score', 'frame')}) !== 431`,
    'real score playback advances',
  );
  await click('rust-score-play');
  await setInput('rust-score-frame', 431);
  await browser.evaluate(`${element('rust-score')}.scrollIntoView({ block: 'center' })`);
  await screenshot('rust-score-desktop');
  for (const frame of [72, 216, 360, 504, 648]) {
    await setInput('rust-score-frame', frame);
    await waitFor(
      `${dataset('rust-score', 'frame')} === '${frame}'`,
      `visual review frame ${frame}`,
    );
    await screenshot(`rust-score-act-${frame}`);
  }
  await click('rust-verify');
  await waitFor(
    `${dataset('rust-verification', 'status')} === 'passed'`,
    'all-frame JS/Wasm state conformance',
  );
  const verification = await browser.evaluate(`({
    comparisons: Number(${dataset('rust-verification', 'comparisons')}),
    maxError: Number(${dataset('rust-verification', 'maxError')})
  })`);
  assert(verification.comparisons > 1000);
  assert(Number.isFinite(verification.maxError) && verification.maxError <= 1e-7);
  results.push({
    check: 'score frame seeking and numerical conformance',
    status: 'pass',
    ...verification,
  });
  for (const backend of ['js', 'wasm']) {
    await browser.evaluate(`void (() => {
      const select = document.querySelector('[aria-label="Score engine"]');
      select.value = '${backend}';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(
      `${dataset('rust-score', 'backend')} === '${backend}'`,
      `explicit score engine switch to ${backend}`,
    );
    for (const frame of [83, 431]) {
      await setInput('rust-score-frame', frame);
      await waitFor(
        `${dataset('rust-score', 'frame')} === '${frame}'`,
        `${backend} score matched-frame control ${frame}`,
      );
    }
  }

  await activateLab('rust-batch', 1);
  assert.equal(await browser.evaluate(dataset('rust-batch-js', 'backend')), 'js');
  const workloads = [];
  for (const count of [256, 1024, 2048]) {
    await setInput('rust-batch-count', count);
    await waitFor(`${dataset('rust-batch', 'count')} === '${count}'`, `workload ${count}`);
    for (const fps of [24, 60]) {
      await setInput('rust-batch-fps', fps);
      await waitFor(`${dataset('rust-batch', 'fps')} === '${fps}'`, `batch frame rate ${fps}`);
      await setInput('rust-batch-scrub', 83);
      await waitFor(`${dataset('rust-batch', 'frame')} === '83'`, 'same-frame batch seeking');
      await waitFor(
        `${dataset('rust-batch-parity', 'status')} === 'pass' && ${dataset('rust-batch-parity', 'compared')} === '${count * 7}'`,
        `batch numerical parity ${count} tracks at ${fps} fps`,
      );
      assert.equal(await browser.evaluate(dataset('rust-batch-wasm', 'backend')), 'wasm');
      const comparison = await browser.evaluate(`({
        compared: Number(${dataset('rust-batch-parity', 'compared')}),
        maxError: Number(${dataset('rust-batch-parity', 'maxError')})
      })`);
      assert.equal(comparison.compared, count * 7);
      assert(Number.isFinite(comparison.maxError) && comparison.maxError <= 1e-7);
      workloads.push({ count, fps, frame: 83, ...comparison });
    }
  }
  await click('rust-batch-step-back');
  await waitFor(`${dataset('rust-batch', 'frame')} === '82'`, 'batch reverse step');
  await click('rust-batch-step-forward');
  await waitFor(`${dataset('rust-batch', 'frame')} === '83'`, 'batch forward step');
  await click('rust-batch-play');
  await waitFor(
    `${dataset('rust-batch', 'playing')} === 'true' && Number(${dataset('rust-batch', 'frame')}) !== 83`,
    'batch advances under the shared clock',
  );
  await click('rust-batch-play');
  await waitFor(`${dataset('rust-batch', 'playing')} === 'false'`, 'batch pauses');
  await screenshot('rust-batch-desktop');
  results.push({
    check: 'same-FPS batch controls and real JS/Wasm comparison',
    status: 'pass',
    workloads,
  });

  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await activateLab('rust-score', 0);
  await setInput('rust-score-frame', 431);
  await waitFor(`${dataset('rust-score', 'frame')} === '431'`, 'mobile score frame');
  assert.equal(
    await browser.evaluate('document.documentElement.scrollWidth <= innerWidth'),
    true,
    'Mobile page has no horizontal overflow',
  );
  await screenshot('rust-score-mobile');
  await activateLab('rust-batch', 1);
  await screenshot('rust-batch-mobile');
  // Leave while playback is active, not only while everything is already idle.
  await click('rust-batch-play');
  await waitFor(`${dataset('rust-batch', 'playing')} === 'true'`, 'active batch before cleanup');
  await leaveAndCheckCleanup();
  assertNoExceptions();
  results.push({ check: '390px responsive layout and active route teardown', status: 'pass' });

  await browser.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await navigate('/rust/experimental');
  await readyExperiment();
  await waitFor('window.__rustBrowserCheck.pending.size === 0', 'reduced-motion initial idle');
  assert.equal(await browser.evaluate(`Boolean(${element('rust-score')})`), false);
  assert.equal(await browser.evaluate(`Boolean(${element('rust-batch')})`), false);
  await activateLab('rust-score', 0);
  await waitFor(
    'window.__rustBrowserCheck.pending.size === 0',
    'explicitly mounted score is paused',
  );
  const reducedFrame = Number(await browser.evaluate(dataset('rust-score', 'frame')));
  await click('rust-score-next');
  await waitFor(
    `${dataset('rust-score', 'frame')} === '${reducedFrame + 1}'`,
    'reduced-motion manual frame control remains available',
  );
  await leaveAndCheckCleanup();
  results.push({ check: 'reduced-motion idle startup and explicit frame control', status: 'pass' });

  await browser.send('Emulation.setEmulatedMedia', { features: [] });
  await navigate('/rust/experimental');
  await readyExperiment();
  await activateLab('rust-score', 0);
  await browser.send('Network.setBlockedURLs', { urls: ['*.wasm*'] });
  await click('rust-load');
  await waitFor(`${dataset('rust-runtime', 'status')} === 'error'`, 'network failure is surfaced');
  const failureFrame = Number(await browser.evaluate(dataset('rust-score', 'frame')));
  await click('rust-score-next');
  await waitFor(
    `${dataset('rust-score', 'frame')} === '${failureFrame + 1}'`,
    'JavaScript remains usable after a failed Wasm load',
  );
  await browser.send('Network.setBlockedURLs', { urls: [] });
  await click('rust-load');
  await waitFor(`${dataset('rust-runtime', 'status')} === 'ready'`, 'explicit retry succeeds');
  await leaveAndCheckCleanup();
  assertNoExceptions();
  results.push({ check: 'failed Wasm fetch preserves JavaScript; retry succeeds', status: 'pass' });

  // Hold a real binary request until the route owner has been destroyed. This
  // exercises the late-initialization disposal path without arbitrary delays.
  await navigate('/rust/experimental');
  await readyExperiment();
  await browser.send('Fetch.enable', {
    patterns: [{ urlPattern: '*.wasm*', requestStage: 'Request' }],
  });
  const pendingMark = browser.events.length;
  await click('rust-load');
  let paused;
  for (let attempt = 0; attempt < 150; attempt++) {
    paused = browser.events
      .slice(pendingMark)
      .find((event) => event.method === 'Fetch.requestPaused');
    if (paused) break;
    await delay(100);
  }
  assert(paused, 'The late-loading test intercepted a real binary request');
  await leaveAndCheckCleanup();
  await browser.send('Fetch.continueRequest', { requestId: paused.params.requestId });
  await browser.send('Fetch.disable');
  for (let attempt = 0; attempt < 150 && !wasmResponses(pendingMark).length; attempt++) {
    await delay(100);
  }
  assert(wasmResponses(pendingMark).length > 0, 'Binary response completed after route teardown');
  await waitFor(
    'window.__rustBrowserCheck.pending.size === 0',
    'late load leaves no frame callbacks',
  );
  assertNoExceptions();
  results.push({ check: 'route teardown during in-flight Wasm initialization', status: 'pass' });

  await writeFile(
    new URL('rust-experimental.json', reportDirectory),
    JSON.stringify({ base, testedAt: new Date().toISOString(), results }, null, 2),
  );
  console.log(
    `PASS Rust experimental route: ${results.length} browser checks, real Wasm, responsive captures, failure/retry and cleanup.`,
  );
} catch (error) {
  if (browser) {
    await screenshot('rust-experimental-failure').catch(() => {});
    console.error(
      await browser
        .evaluate(
          `({
        title: document.title,
        path: location.pathname,
        text: document.body.innerText.slice(-9000),
        hooks: [...document.querySelectorAll('[data-testid]')].map(node => ({ ...node.dataset }))
      })`,
        )
        .catch(() => null),
    );
  }
  throw error;
} finally {
  await browser?.close();
  await server?.close();
}
