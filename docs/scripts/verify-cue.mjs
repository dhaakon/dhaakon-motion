import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { launchBrowser } from './browser.mjs';
import { serveBuilt } from './serve-built.mjs';

const manifest = JSON.parse(
  await readFile(new URL('../public/media/ink-signal-v2.json', import.meta.url), 'utf8'),
);
const server = process.env.DOCS_URL ? null : await serveBuilt();
const base = process.env.DOCS_URL || server.url;
let browser;
const report = new URL('../../test-results/', import.meta.url);
await mkdir(report, { recursive: true });
async function waitFor(expression, description) {
  for (let i = 0; i < 150; i++) {
    if (await browser.evaluate(`Boolean(${expression})`)) return;
    await delay(100);
  }
  throw new Error(`Timed out: ${description}`);
}
try {
  browser = await launchBrowser();
  await browser.send('Runtime.enable');
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1050,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.send('Page.navigate', { url: base + '/svg-cue-sheet?render=1' });
  await waitFor('window.__dhaakonCueRender', 'render API');
  await browser.evaluate(`void (()=>{
    const video=document.createElement('video');video.muted=true;video.preload='auto';video.src=${JSON.stringify('/media/' + manifest.filename)};
    video.style='position:fixed;top:0;left:0;width:192px;height:108px;z-index:9999';document.body.append(video);window.__verifyVideo=video;
  })()`);
  await waitFor('window.__verifyVideo.readyState>=2', 'MP4 loaded');
  const meta = await browser.evaluate(
    '({width:window.__verifyVideo.videoWidth,height:window.__verifyVideo.videoHeight,duration:window.__verifyVideo.duration})',
  );
  assert.deepEqual(meta, { width: 1920, height: 1080, duration: 24 });
  const results = [];
  for (const frame of [0, 24, 72, 132, 168, 264, 300, 372, 396, 456, 504, 575]) {
    const result = await browser.evaluate(`(async()=>{
      const frame=${frame},video=window.__verifyVideo;
      const decoded=await new Promise((resolve,reject)=>{
        let handle=0;const timer=setTimeout(()=>{video.cancelVideoFrameCallback(handle);reject(new Error('Decode timeout: '+frame));},6000);
        const callback=(_now,meta)=>{const actual=Math.floor(meta.mediaTime*24+1e-5);if(actual===frame){clearTimeout(timer);resolve(actual);}else handle=video.requestVideoFrameCallback(callback);};
        handle=video.requestVideoFrameCallback(callback);video.currentTime=(frame+.25)/24;
      });
      const png=await window.__dhaakonCueRender.png(frame,1920);
      const image=new Image();image.src='data:image/png;base64,'+png;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const live=ctx.getImageData(0,0,1920,1080).data;
      ctx.drawImage(video,0,0);const offline=ctx.getImageData(0,0,1920,1080).data;
      let absolute=0,squared=0,foreground=0,foregroundCount=0;
      for(let i=0;i<live.length;i+=4){for(let c=0;c<3;c++){const d=Math.abs(live[i+c]-offline[i+c]);absolute+=d;squared+=d*d;if(Math.max(live[i],live[i+1],live[i+2])>60){foreground+=d;foregroundCount++;}}}
      return {frame,decoded,meanAbsolute:absolute/(1920*1080*3),rmse:Math.sqrt(squared/(1920*1080*3)),foregroundMean:foreground/Math.max(1,foregroundCount)};
    })()`);
    assert.equal(result.decoded, frame);
    assert(
      result.meanAbsolute < 5 && result.rmse < 16 && result.foregroundMean < 14,
      `Excessive lossy image difference: ${JSON.stringify(result)}`,
    );
    results.push(result);
    console.log(JSON.stringify(result));
  }
  // Exercise the actual live page separately from the offline-only adapter.
  await browser.send('Page.navigate', { url: base + '/svg-cue-sheet' });
  await waitFor('document.querySelector("video")?.readyState>=2', 'live comparison');
  for (const frame of [168, 396, 504, 575, 0]) {
    await browser.evaluate(
      `void (()=>{const input=document.querySelector('input[type="range"]');input.value='${frame}';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.svg-cue-compare').scrollIntoView({block:'center'});})()`,
    );
    await waitFor(
      `document.querySelector('[aria-label="Offline MP4 frame"]')?.textContent==='${String(frame).padStart(3, '0')}' && document.querySelector('[aria-label="Frame sync delta"]')?.textContent==='+0F'`,
      'paused decoded sync ' + frame,
    );
    assert.equal(
      await browser.evaluate('Number(document.querySelector("svg[data-frame]").dataset.frame)'),
      frame,
    );
  }
  await browser.evaluate(
    `void (()=>{const input=document.querySelector('input[type="range"]');input.value='300';input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await waitFor(
    `document.querySelector('[aria-label="Offline MP4 frame"]')?.textContent==="300"`,
    'hero decoded',
  );
  const { data } = await browser.send('Page.captureScreenshot', { format: 'png' });
  await writeFile(new URL('cue-v2-comparison.png', report), Buffer.from(data, 'base64'));
  await browser.evaluate(`document.querySelector('[aria-label="Solo ink"]').click()`);
  assert.equal(
    await browser.evaluate(
      `document.querySelector('[data-layer="trace"]').getAttribute('display')`,
    ),
    'none',
  );
  await browser.evaluate(
    '[...document.querySelectorAll("button")].find(n=>n.textContent==="Restore layers").click()',
  );
  assert.equal(
    await browser.evaluate(
      `document.querySelector('[data-layer="trace"]').getAttribute('display')`,
    ),
    'inline',
  );
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  assert(
    await browser.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),
    'Mobile horizontal overflow',
  );
  const mobile = await browser.send('Page.captureScreenshot', { format: 'png' });
  await writeFile(new URL('cue-v2-mobile.png', report), Buffer.from(mobile.data, 'base64'));
  assert.deepEqual(
    browser.events.filter((event) => event.method === 'Runtime.exceptionThrown'),
    [],
  );
  await writeFile(
    new URL('cue-v2-parity.json', report),
    JSON.stringify({ base, manifest, results }, null, 2),
  );
  console.log(
    'PASS: 12 decoded-frame image comparisons, live paused seeks, layer controls, mobile layout.',
  );
} finally {
  await browser?.close();
  await server?.close();
}
