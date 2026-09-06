import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { launchBrowser } from '../docs/scripts/browser.mjs';
import { serveBuilt } from '../docs/scripts/serve-built.mjs';
import { root } from './engine-fixtures.mjs';

const server = await serveBuilt();
let browser;
try {
  browser = await launchBrowser();
  await browser.send('Runtime.enable');
  await browser.send('Page.navigate', { url: server.url + '/svg-cue-sheet?render=1' });
  for (let i = 0; i < 150; i++) {
    if (await browser.evaluate('Boolean(window.__dhaakonCueRender)')) break;
    await delay(100);
  }
  assert(
    await browser.evaluate('Boolean(window.__dhaakonCueRender)'),
    'Render adapter unavailable',
  );
  await browser.evaluate('document.fonts.ready.then(()=>true)');
  const results = [];
  for (const width of process.argv.includes('--all-sizes') ? [960, 1920, 3840] : [1920]) {
    for (const frame of [0, 72, 168, 264, 372, 456, 575]) {
      const started = performance.now();
      const png = await browser.evaluate(`window.__dhaakonCueRender.png(${frame},${width})`);
      const captureAndTransferMs = performance.now() - started;
      const profile = await browser.evaluate('window.__dhaakonCueRender.profile');
      assert(profile && Number.isFinite(profile.totalMs), 'Rebuild docs for stage profiling');
      results.push({
        ...profile,
        captureAndTransferMs,
        pngBytes: Buffer.byteLength(png, 'base64'),
      });
      console.log(JSON.stringify(results.at(-1)));
    }
  }
  await mkdir(root + 'test-results', { recursive: true });
  await writeFile(
    root + 'test-results/cue-profile.json',
    JSON.stringify(
      {
        renderer: 'Chrome/SwiftShader SVG snapshot',
        includes:
          'combined evaluation+host writes, XML serialization, image decode, canvas draw submission, canvas export (deferred raster/flush/readback + PNG encoding), CDP transfer',
        excludes: 'isolated GPU completion, disk writes and GStreamer encoding',
        note: 'Read-only preview profiling; does not replace the master MP4. Shared software-renderer host, not real-device FPS.',
        results,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await browser?.close();
  await server.close();
}
