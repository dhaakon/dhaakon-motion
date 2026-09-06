import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchBrowser } from './browser.mjs';
import { serveBuilt } from './serve-built.mjs';

const preview = process.argv.includes('--preview');
const root = fileURLToPath(new URL('../../', import.meta.url));
const exportsRoot = join(root, 'exports');
await mkdir(exportsRoot, { recursive: true });
const output = await mkdtemp(join(exportsRoot, preview ? 'cue-preview-' : 'cue-master-'));
const server = process.env.DOCS_URL ? null : await serveBuilt();
let browser;
try {
  browser = await launchBrowser();
  await browser.send('Runtime.enable');
  await browser.send('Page.navigate', {
    url: (process.env.DOCS_URL || server.url) + '/svg-cue-sheet?render=1',
  });
  for (let attempt = 0; attempt < 150; attempt++) {
    if (await browser.evaluate('Boolean(window.__dhaakonCueRender)')) break;
    await delay(100);
  }
  const info = await browser.evaluate(
    'window.__dhaakonCueRender && ({frames:window.__dhaakonCueRender.frames,fps:window.__dhaakonCueRender.fps,source:window.__dhaakonCueRender.source})',
  );
  assert(info, 'Render adapter did not initialize. Check the built SVG route.');
  await browser.evaluate('document.fonts.ready.then(()=>true)');
  console.log(`Rendering ${info.frames} frames at ${info.fps} fps → ${output}`);
  const frames = preview
    ? [24, 72, 132, 168, 264, 300, 372, 396, 456, 504, 575]
    : Array.from({ length: info.frames }, (_, i) => i);
  const hashes = [];
  for (const frame of frames) {
    const png = Buffer.from(
      await browser.evaluate(`window.__dhaakonCueRender.png(${frame},${preview ? 960 : 1920})`),
      'base64',
    );
    await writeFile(join(output, `frame-${String(frame).padStart(4, '0')}.png`), png);
    hashes.push({ frame, sha256: createHash('sha256').update(png).digest('hex') });
    if (preview || frame % 24 === 0) console.log(`Frame ${frame}/${info.frames - 1}`);
  }
  const exceptions = browser.events.filter((event) => event.method === 'Runtime.exceptionThrown');
  assert.deepEqual(exceptions, [], 'Browser exceptions during export');
  await writeFile(join(output, 'frames.json'), JSON.stringify(hashes, null, 2));
  if (!preview) {
    const movie = join(output, 'master.mp4');
    const args = [
      '-e',
      'multifilesrc',
      `location=${join(output, 'frame-%04d.png')}`,
      'index=0',
      `stop-index=${info.frames - 1}`,
      'caps=image/png,framerate=24/1',
      '!',
      'pngdec',
      '!',
      'videoconvert',
      '!',
      'video/x-raw,format=I420,colorimetry=bt709',
      '!',
      'x264enc',
      'pass=qual',
      'quantizer=18',
      'speed-preset=fast',
      'threads=4',
      'key-int-max=24',
      '!',
      'video/x-h264,profile=high',
      '!',
      'h264parse',
      '!',
      'mp4mux',
      'faststart=true',
      '!',
      'filesink',
      `location=${movie}`,
    ];
    await new Promise((resolve, reject) => {
      const encoder = spawn('gst-launch-1.0', args, { stdio: 'inherit' });
      encoder.on('error', reject);
      encoder.on('exit', (code) =>
        code === 0 ? resolve() : reject(new Error(`GStreamer exited ${code}`)),
      );
    });
    const video = await readFile(movie);
    const filename = 'dhaakon-ink-signal-v2-1920x1080-24fps.mp4';
    const media = join(root, 'docs/public/media');
    const manifest = {
      filename,
      width: 1920,
      height: 1080,
      frames: info.frames,
      fps: info.fps,
      duration: info.frames / info.fps,
      bytes: video.length,
      sha256: createHash('sha256').update(video).digest('hex'),
      sourceSha256: createHash('sha256').update(info.source).digest('hex'),
      encoder: 'GStreamer x264enc / quality 18 / high / I420 / BT.709',
      frameRange: [0, info.frames - 1],
    };
    await copyFile(movie, join(media, filename));
    await writeFile(join(media, 'ink-signal-v2.json'), JSON.stringify(manifest, null, 2) + '\n');
    console.log(JSON.stringify(manifest, null, 2));
  }
  console.log(`PASS: ${preview ? 'preview' : 'master'} saved in ${output}`);
} finally {
  await browser?.close();
  await server?.close();
}
