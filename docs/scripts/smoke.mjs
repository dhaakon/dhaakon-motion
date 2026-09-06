import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchBrowser } from './browser.mjs';

const dist = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
await stat(resolve(dist, 'index.html')).catch(() => {
  throw new Error('Build first: npm run docs:check');
});
const registry = await readFile(new URL('../src/routes.ts', import.meta.url), 'utf8');
const paths = [...registry.matchAll(/path: '([^']+)'/g)].map((match) => match[1]);
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
};
const server = createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = resolve(dist, '.' + path);
    if (file !== dist && !file.startsWith(dist + sep)) {
      response.writeHead(403).end();
      return;
    }
    if (!extname(path)) file = resolve(dist, 'index.html');
    const content = await readFile(file);
    const headers = {
      'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Accept-Ranges': 'bytes',
    };
    const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (range) {
      const start = Number(range[1]),
        end = Math.min(Number(range[2] || content.length - 1), content.length - 1);
      if (start > end) {
        response.writeHead(416).end();
        return;
      }
      response.writeHead(206, {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${content.length}`,
        'Content-Length': end - start + 1,
      });
      response.end(content.subarray(start, end + 1));
    } else {
      response.writeHead(200, { ...headers, 'Content-Length': content.length });
      response.end(content);
    }
  } catch {
    response.writeHead(404).end('Not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = process.env.DOCS_URL || `http://127.0.0.1:${server.address().port}`;
const report = new URL('../../test-results/', import.meta.url);
await mkdir(report, { recursive: true });
let browser;
try {
  browser = await launchBrowser();
  await browser.send('Runtime.enable');
  await browser.send('Page.enable');
  await browser.send('Network.enable');
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1050,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
    (() => {
      const pending = new Set(), request = requestAnimationFrame, cancel = cancelAnimationFrame;
      window.__motionSmoke = { pending };
      window.requestAnimationFrame = callback => { const id = request(time => { pending.delete(id); callback(time); }); pending.add(id); return id; };
      window.cancelAnimationFrame = id => { pending.delete(id); cancel(id); };
    })();`,
  });
  const waitFor = async (expression, description) => {
    for (let attempt = 0; attempt < 150; attempt++) {
      if (await browser.evaluate(`Boolean(${expression})`)) return;
      await delay(100);
    }
    console.error(
      await browser.evaluate(
        '({ title: document.title, text: document.body.innerText.slice(0, 1800), status: [...document.querySelectorAll("[role=status], [role=alert]")].map(node => node.outerHTML.slice(0, 500)) })',
      ),
    );
    console.error(browser.events.filter((event) => event.method === 'Runtime.exceptionThrown'));
    throw new Error('Timed out: ' + description);
  };
  const ready = () =>
    waitFor(
      `document.querySelector('.page-heading h1') && !document.querySelector('.route-message[role="status"]') && !document.querySelector('.route-message[role="alert"]')`,
      'route ready',
    );
  const screenshot = async (name) => {
    const { data } = await browser.send('Page.captureScreenshot', { format: 'png' });
    await writeFile(new URL(name + '.png', report), Buffer.from(data, 'base64'));
  };
  await browser.send('Page.navigate', { url: base + '/' });
  await ready();
  assert.equal(
    await browser.evaluate('document.querySelectorAll("canvas,video").length'),
    0,
    'Overview mounts no renderers',
  );
  assert.equal(await browser.evaluate('window.__motionSmoke.pending.size'), 0, 'Overview is idle');
  await screenshot('overview-desktop');
  const results = [];
  for (const path of paths.filter((path) => path !== '/')) {
    const mark = browser.events.length;
    // Real deep load, then client-side navigation back: exercise both lifecycles.
    await browser.send('Page.navigate', { url: base + path });
    await waitFor(`location.pathname === ${JSON.stringify(path)}`, 'deep route');
    await ready();
    await delay(200);
    assert.equal(await browser.evaluate('document.querySelectorAll(".page-heading h1").length'), 1);
    if (path === '/svg-cue-sheet') {
      await waitFor('document.querySelector("video")?.readyState >= 2', 'offline MP4 decode');
      const video = await browser.evaluate(
        '({ duration: document.querySelector("video").duration, width: document.querySelector("video").videoWidth, height: document.querySelector("video").videoHeight })',
      );
      assert.deepEqual(video, { duration: 24, width: 1920, height: 1080 });
      await browser.evaluate('void (window.__comparisonVideo = document.querySelector("video"))');
      await screenshot('svg-comparison');
    }
    if (path === '/gesture-labs')
      await browser.evaluate(
        '[...document.querySelectorAll("button")].find(node => node.textContent === "ARM A TAKE")?.click()',
      );
    const errors = browser.events
      .slice(mark)
      .filter((event) => event.method === 'Runtime.exceptionThrown');
    assert.deepEqual(errors, [], `Uncaught exception on ${path}`);
    await browser.evaluate('document.querySelector(".wordmark").click()');
    await waitFor(
      'location.pathname === "/" && document.querySelector(".overview-intro")',
      'client-side overview',
    );
    await waitFor('window.__motionSmoke.pending.size === 0', 'animation cleanup after ' + path);
    assert.equal(
      await browser.evaluate('document.querySelectorAll("canvas,video").length'),
      0,
      path + ' renderer cleanup',
    );
    if (path === '/svg-cue-sheet')
      assert.equal(
        await browser.evaluate('window.__comparisonVideo.paused'),
        true,
        'MP4 stopped on unmount',
      );
    results.push({ path, deepLink: 'pass', cleanup: 'pass' });
    console.log(`PASS ${path} — deep link, runtime, cleanup`);
  }
  await browser.send('Page.navigate', { url: base + '/#json-svg-cue-sheet' });
  await waitFor(
    'location.pathname === "/svg-cue-sheet" && document.querySelector("video")',
    'legacy SVG bookmark',
  );
  await browser.evaluate('document.querySelector(".wordmark").click()');
  await waitFor('location.pathname === "/"', 'overview');
  await browser.evaluate('history.back()');
  await waitFor(
    'location.pathname === "/svg-cue-sheet" && document.querySelector("video")',
    'back navigation',
  );
  await browser.evaluate('history.forward()');
  await waitFor(
    'location.pathname === "/" && document.querySelector(".overview-intro")',
    'forward navigation',
  );
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await browser.evaluate('document.querySelector(".nav-toggle").click()');
  assert.equal(
    await browser.evaluate('document.querySelector(".nav-toggle").getAttribute("aria-expanded")'),
    'true',
  );
  await browser.evaluate(`document.querySelector('.docs-nav a[href="/transport"]').click()`);
  await waitFor(
    'location.pathname === "/transport" && document.querySelector(".lab-timecode")',
    'mobile route',
  );
  assert.equal(
    await browser.evaluate('document.querySelector(".nav-toggle").getAttribute("aria-expanded")'),
    'false',
  );
  assert.equal(
    await browser.evaluate('document.documentElement.scrollWidth <= innerWidth'),
    true,
    'Mobile overflow',
  );
  await screenshot('transport-mobile');
  await browser.send('Page.navigate', { url: base + '/not-a-feature' });
  await waitFor('document.title.startsWith("Page not found")', '404 route');
  const media = await fetch(base + '/media/dhaakon-ink-signal-v2-1920x1080-24fps.mp4', {
    headers: { Range: 'bytes=0-31' },
  });
  assert.equal(media.status, 206, 'MP4 byte-range support');
  assert.equal((await media.arrayBuffer()).byteLength, 32);
  await writeFile(
    new URL('docs-smoke.json', report),
    JSON.stringify(
      {
        base,
        testedAt: new Date().toISOString(),
        routes: results,
        navigation: 'pass',
        mobile: 'pass',
        media: 'pass',
      },
      null,
      2,
    ),
  );
  console.log('PASS legacy links, history, mobile navigation, 404, MP4 range requests');
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
