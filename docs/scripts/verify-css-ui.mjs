import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { launchBrowser } from './browser.mjs';
import { serveBuilt } from './serve-built.mjs';

const server = process.env.DOCS_URL ? null : await serveBuilt();
const base = process.env.DOCS_URL || server.url;
const report = new URL('../../test-results/', import.meta.url);
await mkdir(report, { recursive: true });
let browser;
const checks = [];
const node = (id) => `document.querySelector('[data-testid="${id}"]')`;
const panel = node('css-ui-panel');
async function waitFor(expression, label) {
  for (let index = 0; index < 150; index++) {
    if (await browser.evaluate(`Boolean(${expression})`)) return;
    await delay(100);
  }
  throw new Error(`Timed out: ${label}`);
}
async function click(id) {
  await browser.evaluate(`${node(id)}.click()`);
}
async function screenshot(name) {
  const { data } = await browser.send('Page.captureScreenshot', { format: 'png' });
  await writeFile(new URL(`${name}.png`, report), Buffer.from(data, 'base64'));
}
const settled = () =>
  waitFor(
    `${node('css-ui-study')}?.dataset.status === 'settled' && ${panel}.getAnimations().length === 0`,
    'native effect released',
  );
const ready = () => waitFor(node('css-ui-study'), 'CSS UI route ready');

try {
  browser = await launchBrowser();
  await browser.send('Page.enable');
  await browser.send('Runtime.enable');
  await browser.send('Network.enable');
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1050,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => {
    const request = window.requestAnimationFrame, cancel = window.cancelAnimationFrame;
    const pending = new Set(); window.__cssCheck = { pending, requests: 0, disableWaapi: false };
    window.requestAnimationFrame = callback => { window.__cssCheck.requests++; const id = request(time => { pending.delete(id); callback(time); }); pending.add(id); return id; };
    window.cancelAnimationFrame = id => { pending.delete(id); cancel(id); };
    const native = Element.prototype.animate;
    Element.prototype.animate = function(...args) {
      if (window.__cssCheck.disableWaapi) throw new Error('Injected WAAPI failure');
      return native.apply(this, args);
    };
  })();`,
  });
  await browser.send('Page.navigate', { url: base + '/css-ui' });
  await ready();
  await settled();
  assert.equal(await browser.evaluate(`${panel}.hidden`), true);
  await browser.evaluate(`${node('css-ui-trigger')}.focus()`);
  await browser.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    text: '\r',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
  });
  await browser.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
  });
  await waitFor(
    `${node('css-ui-trigger')}.getAttribute('aria-expanded') === 'true'`,
    'keyboard disclosure opens',
  );
  await settled();
  assert.equal(await browser.evaluate(`${panel}.hidden || ${panel}.inert`), false);
  assert.equal(await browser.evaluate(`getComputedStyle(${panel}).opacity`), '1');
  assert.equal(
    await browser.evaluate(`${node('css-ui-backend')}.textContent`),
    'Browser / Web Animations',
  );
  assert.equal(await browser.evaluate(`${node('css-ui-duration')}.textContent`), '360 ms');
  await screenshot('css-ui-desktop');
  checks.push('Keyboard operation, actual WAAPI, shared UI timing and final CSS');

  await click('css-ui-slow');
  await settled();
  await click('css-ui-trigger');
  await settled();
  const requestsBefore = await browser.evaluate('window.__cssCheck.requests');
  await click('css-ui-trigger');
  await waitFor(`${panel}.getAnimations().length === 1`, 'native animation is active');
  const sampled = await browser.evaluate(`(() => {
    const animation = ${panel}.getAnimations()[0];
    animation.pause(); animation.currentTime = 350;
    return { opacity: Number(getComputedStyle(${panel}).opacity), duration: animation.effect.getTiming().duration };
  })()`);
  assert(
    sampled.opacity > 0 && sampled.opacity < 1,
    'Native interpolation produces an intermediate value',
  );
  assert.equal(sampled.duration, 1440);
  await click('css-ui-trigger');
  const retarget = await browser.evaluate(`(() => {
    const animation = ${panel}.getAnimations()[0];
    animation.pause(); animation.currentTime = 0;
    return { first: Number(animation.effect.getKeyframes()[0].opacity), actual: Number(getComputedStyle(${panel}).opacity), inert: ${panel}.inert, hidden: ${panel}.hidden };
  })()`);
  assert(
    Math.abs(retarget.first - sampled.opacity) < 1e-5,
    'Retarget begins at the interrupted computed value',
  );
  assert.equal(retarget.inert, true);
  assert.equal(retarget.hidden, false);
  assert.equal(
    await browser.evaluate('window.__cssCheck.requests'),
    requestsBefore,
    'CSS playback schedules no application animation frames',
  );
  // Reopen before the paused close finishes: its stale completion must not hide the panel.
  await click('css-ui-trigger');
  await browser.evaluate(`${panel}.getAnimations()[0].finish()`);
  await settled();
  assert.equal(await browser.evaluate(`${panel}.hidden`), false);
  checks.push(
    'Paused native midpoint, interruption continuity, stale-exit suppression, zero app RAF',
  );

  await browser.evaluate(
    `(() => { const input = ${panel}.querySelector('input'); input.value = 'Keep this input'; input.focus(); })()`,
  );
  await click('css-ui-close-inside');
  assert.equal(
    await browser.evaluate(`document.activeElement === ${node('css-ui-trigger')}`),
    true,
  );
  await settled();
  assert.equal(await browser.evaluate(`${panel}.hidden`), true);
  await click('css-ui-trigger');
  await settled();
  assert.equal(await browser.evaluate(`${panel}.querySelector('input').value`), 'Keep this input');
  checks.push('Immediate inert/ARIA, focus return, exit presence and input preservation');

  await click('css-ui-trigger');
  await click('css-ui-reduce');
  await settled();
  assert.equal(await browser.evaluate(`${panel}.hidden`), true);
  await click('css-ui-trigger');
  await settled();
  assert.equal(await browser.evaluate(`${node('css-ui-study')}.dataset.backend`), 'instant');
  assert.equal(await browser.evaluate(`${panel}.hidden`), false);
  checks.push('Reduced-motion change during playback settles without waiting for delay');

  await click('css-ui-reduce');
  await settled();
  await browser.evaluate('window.__cssCheck.disableWaapi = true');
  await click('css-ui-trigger');
  await settled();
  await click('css-ui-trigger');
  await settled();
  assert.equal(await browser.evaluate(`${node('css-ui-study')}.dataset.backend`), 'instant');
  assert.equal(await browser.evaluate(`getComputedStyle(${panel}).opacity`), '1');
  await browser.evaluate('window.__cssCheck.disableWaapi = false');
  checks.push('Browser failure keeps content usable with an explicit immediate fallback');

  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await browser.evaluate(`${node('css-ui-study')}.scrollIntoView({ block: 'start' })`);
  assert.equal(await browser.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await screenshot('css-ui-mobile');
  await click('css-ui-trigger');
  await browser.evaluate(
    `window.__cssHeld = ${panel}.getAnimations()[0]; window.__cssHeld.pause()`,
  );
  await click('css-ui-mount');
  await waitFor(`!${node('css-ui-study')}`, 'study unmounted');
  assert.equal(await browser.evaluate('window.__cssHeld.playState'), 'idle');
  await click('css-ui-mount');
  await ready();
  await settled();
  await click('css-ui-trigger');
  await browser.evaluate(
    `window.__cssHeld = ${panel}.getAnimations()[0]; window.__cssHeld.pause(); document.querySelector('.wordmark').click()`,
  );
  await waitFor(
    'location.pathname === "/" && document.querySelector(".overview-intro")',
    'client navigation',
  );
  assert.equal(await browser.evaluate('window.__cssHeld.playState'), 'idle');
  assert.equal(await browser.evaluate('window.__cssCheck.pending.size'), 0);
  checks.push('390px layout, active unmount and route cleanup release native effects');

  await browser.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await browser.send('Page.navigate', { url: base + '/css-ui' });
  await ready();
  await click('css-ui-trigger');
  await settled();
  assert.equal(await browser.evaluate(`${node('css-ui-study')}.dataset.reduced`), 'true');
  assert.equal(await browser.evaluate(`${node('css-ui-study')}.dataset.backend`), 'instant');
  assert.equal(await browser.evaluate(`${panel}.hidden`), false);
  assert.deepEqual(
    browser.events.filter((event) => event.method === 'Runtime.exceptionThrown'),
    [],
  );
  assert.equal(
    browser.events.filter(
      (event) =>
        event.method === 'Network.requestWillBeSent' &&
        /\.wasm(?:\?|$)/.test(event.params.request.url),
    ).length,
    0,
  );
  checks.push('System reduced motion, no uncaught exceptions, no Wasm request');
  await writeFile(
    new URL('css-ui.json', report),
    JSON.stringify({ base, checks, passed: true }, null, 2),
  );
  console.log(
    `PASS: ${checks.length} real-browser CSS/UI checks; browser-owned playback, interruption, accessibility and cleanup.`,
  );
} catch (error) {
  if (browser) {
    await screenshot('css-ui-failure').catch(() => {});
    console.error(await browser.evaluate('document.body.innerText.slice(-6500)').catch(() => ''));
  }
  throw error;
} finally {
  await browser?.close();
  await server?.close();
}
