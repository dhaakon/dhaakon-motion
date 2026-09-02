import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('../../../../dhaakon-network/ui/node_modules/playwright')); }

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome' });
const page = await browser.newPage();
const results = await page.evaluate(async () => {
  class Estimator {
    constructor() { this.samples = []; }
    push(x, t) { this.samples.push({ x, t }); while (this.samples.length > 20 || t - this.samples[0].t > 100) this.samples.shift(); }
    velocity(now) {
      const latest = this.samples.at(-1), previous = this.samples.at(-2); if (!latest || !previous || now - latest.t > 60 || latest.t - previous.t > 60) return 0;
      let w = 0, mt = 0, mx = 0; for (const s of this.samples) { const n = Math.exp(-(now-s.t)/40); w += n; mt += s.t*n; mx += s.x*n; } mt /= w; mx /= w;
      let d = 0, n = 0; for (const s of this.samples) { const weight = Math.exp(-(now-s.t)/40); d += weight*(s.t-mt)**2; n += weight*(s.t-mt)*(s.x-mx); } return d ? n/d : 0;
    }
  }
  let seed = 0x5eed; const jitter = () => { seed = Math.imul(seed,1664525)+1013904223|0; return ((seed>>>0)/4294967296-.5)*2; };
  const sample = (position, duration=200, pause=0) => { const points=[]; for(let t=0;t<=duration;t+=1000/120) points.push({t:t+jitter(),x:position(t)+jitter()*.5}); if(pause) points.push({t:duration+pause,x:position(duration)}); return points; };
  const run = (points, truth) => { const estimator=new Estimator(); for(const p of points) estimator.push(p.x,p.t); const now=points.at(-1).t; const ours=estimator.velocity(now); const last=points.length<2?0:(points.at(-1).x-points.at(-2).x)/(points.at(-1).t-points.at(-2).t); const error=v=>truth===0?Math.abs(v):Math.abs((v-truth)/truth)*100; return { ours, last, oursError:error(ours), lastError:error(last) }; };
  const cases = {
    constant: run(sample(t=>.8*t), .8),
    deceleration: run(sample(t=>1.2*t-.0015*t*t), .6),
    wobble: run(sample(t=>.55*t+2*Math.sin(t/18)), .55+2/18*Math.cos(200/18)),
    pause: run(sample(t=>.8*t,200,80), 0),
  };
  const latency = await new Promise(resolve => {
    const target=document.createElement('div'); document.body.append(target); const out={ immediate:[], frame:[] }; let pending=0, eventAt=0;
    target.addEventListener('pointermove', e => { eventAt=performance.now(); out.immediate.push(performance.now()-eventAt); if(!pending) pending=requestAnimationFrame(()=>{pending=0;out.frame.push(performance.now()-eventAt);if(out.frame.length===20) resolve({immediate:out.immediate.reduce((a,b)=>a+b)/out.immediate.length,frame:out.frame.reduce((a,b)=>a+b)/out.frame.length});}); });
    let sent=0; const send=()=>{target.dispatchEvent(new PointerEvent('pointermove',{clientX:sent}));if(++sent<20)setTimeout(send,18)};send();
  });
  return { userAgent:navigator.userAgent, cases, latency };
});
await browser.close();
console.log(JSON.stringify(results, null, 2));
