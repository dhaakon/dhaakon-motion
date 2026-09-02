import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Badge, Button } from '@dhaakon/ui';
import { Timeline, Tween, Transport, scheduler, loadSheet, validateSheet } from '@dhaakon/motion';
import { Motion, MotionConfig, Reveal, motion, useInView, useMotionValue, useMotionValueState } from '@dhaakon/motion/react';
import {
  InspectionLab, MultiOutputLab, NestedCueLab, OfflineRenderLab, ReactLifecycleLab,
  SerializableShowLab, TimecodeConformLab, productionLabCode,
} from './ProductionLabs';

const ThreeShowcase = lazy(() => import('./ThreeShowcase').then((module) => ({ default: module.ThreeShowcase })));

const tweenCode = `import { Tween, Easing } from '@dhaakon/motion';

new Tween({
  from: { x: 0, opacity: 0 },
  to: { x: 240, opacity: 1 },
  duration: 600,
  easing: Easing.dhaakon,
  onUpdate: value => render(value)
}).play();`;

const reactCode = `import { motion, MotionConfig } from '@dhaakon/motion/react';

<MotionConfig transition={{ duration: 360 }}>
  <motion.article
    initial={{ y: 24, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
  >
    <CourseCard />
  </motion.article>
</MotionConfig>`;

const timelineCode = `const sequence = new Timeline()
  .label('entrance')
  .add(titleTween, 'entrance')
  .add(bodyTween, 'entrance+=80')
  .add(actionTween, 'entrance+=160');

sequence.play();`;

const revealCode = `import { Reveal } from '@dhaakon/motion/react';

<Reveal
  as="section"
  from={{ y: 36, opacity: 0 }}
  to={{ y: 0, opacity: 1 }}
  amount={0.2}
  once
>
  <CourseModule />
</Reveal>`;

const cueReactCode = `import { Timeline, Tween } from '@dhaakon/motion';
import { useEffect, useRef } from 'react';

function CueStack() {
  const rows = useRef<Array<HTMLDivElement | null>>([]);
  const sequence = useRef<Timeline | null>(null);

  const play = () => {
    sequence.current?.stop();
    const next = new Timeline().label('take');

    rows.current.forEach((node, index) => {
      next.add(new Tween({
        from: { x: -80, opacity: 0, scale: 0.94 },
        to: { x: 0, opacity: 1, scale: 1 },
        duration: 620,
        onUpdate: ({ x, opacity, scale }) => {
          node!.style.transform =
            \`translateX(\${x}px) scale(\${scale})\`;
          node!.style.opacity = String(opacity);
        }
      }), \`take+=\${index * 110}\`);
    });

    sequence.current = next.play();
  };

  useEffect(() => { play(); return () => sequence.current?.stop(); }, []);
  return <CueRows refs={rows} onReplay={play} />;
}`;

const stateReactCode = `import { motion } from '@dhaakon/motion/react';

function SceneState({ mode }: { mode: 'rehearsal' | 'live' }) {
  const live = mode === 'live';

  return (
    <div className="scene">
      <motion.div
        className="camera-frame"
        initial={{ x: -24, opacity: 0 }}
        animate={{ x: live ? 22 : 0, opacity: 1, scale: live ? 1.04 : 1 }}
      />
      <motion.div
        className="lower-third"
        initial={{ y: 28, opacity: 0 }}
        animate={{ y: live ? 0 : 18, opacity: live ? 1 : 0.35 }}
      >SCENE 04 · TAKE 02</motion.div>
      <motion.i
        initial={{ scale: 0 }}
        animate={{ scale: live ? 1 : 0.6, backgroundColor: live ? '#ff5a1f' : '#6b6b67' }}
      />
    </div>
  );
}`;

const canvasReactCode = `import { useEffect, useRef } from 'react';
import { useMotionValue } from '@dhaakon/motion/react';

function SignalCanvas() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const signal = useMotionValue(0);

  useEffect(() => signal.subscribe(() => {
    drawSignal(canvas.current!, signal.get());
  }), [signal]);

  useEffect(() => {
    const tween = signal.animate(1, {
      duration: 2400,
      easing: 'linear',
      repeat: Infinity,
      yoyo: true
    });
    return () => tween.cancel();
  }, [signal]);

  return <canvas ref={canvas} />;
}`;

const threeReactCode = `import { MotionValue, Timeline, Tween } from '@dhaakon/motion';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

function ThreeProductionSequence() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const { renderer, scene, camera, rig, material, lights, particles } =
      createThreeScene(canvas.current!);

    const frame = new MotionValue({
      camera: { position: [0, 1, 9], fov: 44 },
      rig: { rotation: [0, 0, 0], scale: 0.7 },
      shader: { energy: 0.2, accent: '#ff5a1f' },
      light: { key: 20, fill: 12, exposure: 0.7 },
      particles: { size: 0.01, opacity: 0.15 }
    });

    // One subscription can write any property in any renderer.
    const unsubscribe = frame.subscribe(() => {
      const value = frame.get();
      camera.position.fromArray(value.camera.position);
      camera.fov = value.camera.fov;
      rig.rotation.fromArray(value.rig.rotation);
      rig.scale.setScalar(value.rig.scale);
      material.uniforms.uEnergy.value = value.shader.energy;
      material.uniforms.uAccent.value.setStyle(value.shader.accent);
      lights.key.intensity = value.light.key;
      lights.fill.intensity = value.light.fill;
      renderer.toneMappingExposure = value.light.exposure;
      particles.material.size = value.particles.size;
      particles.material.opacity = value.particles.opacity;
    });

    const show = new Timeline({
      repeat: Infinity,
      yoyo: true,
      onUpdate: () => renderer.render(scene, camera)
    }).add(new Tween({
      from: frame.get(),
      to: finaleState,
      duration: 9200,
      easing: 'dhaakon',
      onUpdate: value => frame.set(value)
    }), 0).play();

    return () => { show.stop(); unsubscribe(); renderer.dispose(); };
  }, []);

  return <canvas ref={canvas} />;
}`;

const transportCode = `import { Timeline, Tween, Transport } from '@dhaakon/motion';

const show = new Timeline({ frameRate: 24 })
  .add(titleTween, 0)
  .add(bodyTween, '14f')
  .cue('flash', '46f', () => flashLight());

const transport = new Transport({ root: show, frameRate: 24, loop: true });
transport.play();
transport.step(1);                 // ±1 frame
transport.seek('00:00:01:12');     // any timecode, '12f', '1.5s', or ms
transport.subscribe((info) => { clock.textContent = info.timecode; });`;

const sheetCode = `import { loadSheet, validateSheet } from '@dhaakon/motion';

const { ok, errors } = validateSheet(json);
if (!ok) throw new Error(errors[0].message);

const timeline = loadSheet(json, {
  targets: { x: (value) => (box.style.transform = \`translateX(\${value}px)\`) },
});
timeline.toAscii(); // a stable text rendering of the tree`;

function Code({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  return <div className="code"><button onClick={() => { navigator.clipboard?.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1200); }}>{copied ? 'COPIED' : 'COPY'}</button><pre><code>{children}</code></pre></div>;
}

function TweenPlayground() {
  const [run, setRun] = useState(0);
  return <Demo title="Object tween" note="One tween interpolates transform, opacity, and color as a single value.">
    <div className="stage stage-grid"><motion.div key={run} className="motion-block" initial={{ x: 0, rotate: -8, scale: .8, opacity: .2, backgroundColor: '#2d62ff' }} animate={{ x: 230, rotate: 8, scale: 1, opacity: 1, backgroundColor: '#ff5a1f' }} transition={{ duration: 760, easing: 'dhaakon' }}><span>01</span></motion.div></div>
    <Button variant="outline" size="sm" onClick={() => setRun((n) => n + 1)}>Replay tween ↻</Button>
  </Demo>;
}

function EasingTracks() {
  const [run, setRun] = useState(0);
  const curves = ['linear', 'easeOutCubic', 'easeOutBack', 'dhaakon'] as const;
  return <Demo title="Easing field" note="The house curve settles decisively without feeling abrupt.">
    <div className="easing-list" key={run}>{curves.map((name) => <div className="ease-row" key={name}><code>{name}</code><div className="ease-track"><motion.i initial={{ x: 0 }} animate={{ x: 210 }} transition={{ duration: 900, easing: name }} /></div></div>)}</div>
    <Button variant="outline" size="sm" onClick={() => setRun((n) => n + 1)}>Run curves →</Button>
  </Demo>;
}

function TimelinePlayground() {
  const refs = useRef<Array<HTMLDivElement | null>>([]); const timeline = useRef<Timeline | null>(null);
  const play = () => {
    timeline.current?.stop();
    const next = new Timeline();
    refs.current.forEach((node, index) => {
      if (!node) return;
      next.add(new Tween({ from: { x: -28, opacity: 0 }, to: { x: 0, opacity: 1 }, duration: 520, easing: 'dhaakon',
        onUpdate: ({ x, opacity }) => { node.style.transform = `translateX(${x}px)`; node.style.opacity = String(opacity); } }), index === 0 ? 0 : index * 90);
    });
    timeline.current = next.play();
  };
  useEffect(() => { play(); return () => { timeline.current?.stop(); }; }, []);
  return <Demo title="Timeline composition" note="Labels, absolute offsets, and < / > alignment compose without nesting timers.">
    <div className="timeline-stack">{['Direction', 'Editorial rhythm', 'Interaction'].map((label, i) => <div key={label} ref={(node) => { refs.current[i] = node; }} className="timeline-row"><b>0{i + 1}</b><span>{label}</span><small>+{i * 90}ms</small></div>)}</div>
    <Button variant="outline" size="sm" onClick={play}>Replay sequence ↻</Button>
  </Demo>;
}

function MotionValueDemo() {
  const value = useMotionValue<number>(0); const current = useMotionValueState(value);
  const go = (target: number) => value.animate(target, { duration: 520, easing: 'dhaakon' });
  return <Demo title="Motion values" note="An external store can drive canvas, WebGL, audio, or React without coupling the core to the DOM.">
    <div className="value-readout"><strong>{current.toFixed(1)}</strong><div className="value-line"><i style={{ width: `${current}%` }} /></div></div>
    <div className="button-row"><Button variant="outline" size="sm" onClick={() => go(0)}>Zero</Button><Button variant="accent" size="sm" onClick={() => go(100)}>One hundred</Button></div>
  </Demo>;
}

function ReactComposition() {
  const [visible, setVisible] = useState(true);
  return <Demo title="React composition" note="motion.* writes styles on the frame loop, so the component tree does not rerender at 60fps.">
    <div className="composition">{visible && ['Frame', 'Cue', 'Take'].map((label, index) => <motion.article key={label} initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: index * 80, duration: 440 }}><small>0{index + 1}</small><b>{label}</b><span>Ready</span></motion.article>)}</div>
    <Button variant="outline" size="sm" onClick={() => { setVisible(false); requestAnimationFrame(() => setVisible(true)); }}>Recompose ↻</Button>
  </Demo>;
}

function RenderPropDemo() {
  const [run, setRun] = useState(0);
  return <Demo title="Render prop" note="Use Motion when animation values belong in markup, SVG, canvas props, or component composition.">
    <div className="dial" key={run}><Motion from={0} to={100} duration={900}>{(value) => <><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="48"/><circle className="dial-progress" cx="60" cy="60" r="48" style={{ strokeDashoffset: 302 - 302 * value / 100 }}/></svg><strong>{Math.round(value)}%</strong></>}</Motion></div>
    <Button variant="outline" size="sm" onClick={() => setRun((n) => n + 1)}>Replay value ↻</Button>
  </Demo>;
}

function CueSequenceExample() {
  const refs = useRef<Array<HTMLDivElement | null>>([]); const timeline = useRef<Timeline | null>(null); const clock = useRef<HTMLElement | null>(null);
  const play = () => {
    timeline.current?.stop();
    const next = new Timeline({ onUpdate: (time) => { if (clock.current) clock.current.textContent = `${String(Math.floor(time / 1000)).padStart(2, '0')}:${String(Math.floor((time % 1000) / 10)).padStart(2, '0')}`; } }).label('take');
    refs.current.forEach((node, index) => {
      if (!node) return;
      next.add(new Tween({ from: { x: -80, opacity: 0, scale: .94 }, to: { x: 0, opacity: 1, scale: 1 }, duration: 620, easing: 'dhaakon',
        onUpdate: ({ x, opacity, scale }) => { node.style.transform = `translateX(${x}px) scale(${scale})`; node.style.opacity = String(opacity); } }), `take+=${index * 110}`);
    });
    timeline.current = next.play();
  };
  useEffect(() => { play(); return () => { timeline.current?.stop(); }; }, []);
  return <div className="cue-example"><div className="cue-head"><span>PROGRAM / A</span><strong ref={clock}>00:00</strong></div><div className="cue-stack">{[
    ['01','OPEN','Standby playback'], ['02','KEY','Bring lower third'], ['03','TAKE','Camera two + tally'], ['04','ROLL','Record ISO feeds'],
  ].map(([number, cue, detail], index) => <div className="cue-row" key={cue} ref={(node) => { refs.current[index] = node; }}><small>{number}</small><b>{cue}</b><span>{detail}</span><i /></div>)}</div><Button variant="outline" size="sm" onClick={play}>Run cue stack ↻</Button></div>;
}

function SceneStateExample() {
  const [mode, setMode] = useState<'rehearsal' | 'preview' | 'live'>('rehearsal'); const live = mode === 'live'; const preview = mode === 'preview';
  return <div className="state-example"><div className="scene-stage"><div className="scene-grid"/><motion.div className="camera-frame" initial={{ x: -26, opacity: 0, scale: .96 }} animate={{ x: live ? 30 : preview ? 14 : 0, opacity: 1, scale: live ? 1.04 : 1, borderColor: live ? '#ff5a1f' : preview ? '#2d62ff' : '#f0eee8' }} transition={{ duration: 560 }}><span>CAM 02</span><b>{mode.toUpperCase()}</b></motion.div><motion.div className="lower-third" initial={{ y: 26, opacity: 0 }} animate={{ y: live ? 0 : 18, opacity: live ? 1 : .32 }} transition={{ duration: 440 }}>SCENE 04 <i/> TAKE 02</motion.div><motion.i className="tally" initial={{ scale: 0 }} animate={{ scale: live ? 1 : .62, backgroundColor: live ? '#ff5a1f' : preview ? '#2d62ff' : '#777770' }} /></div><div className="state-controls">{(['rehearsal','preview','live'] as const).map((state) => <Button key={state} variant={mode === state ? 'accent' : 'outline'} size="sm" onClick={() => setMode(state)}>{state}</Button>)}</div></div>;
}

function CanvasSignalExample() {
  const canvas = useRef<HTMLCanvasElement | null>(null); const signal = useMotionValue<number>(0); const animation = useRef<Tween<number> | null>(null);
  const draw = () => {
    const node = canvas.current; if (!node) return; const rect = node.getBoundingClientRect(); const ratio = Math.min(2, window.devicePixelRatio || 1);
    node.width = Math.max(1, Math.round(rect.width * ratio)); node.height = Math.max(1, Math.round(rect.height * ratio));
    const ctx = node.getContext('2d'); if (!ctx) return; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); const width = rect.width; const height = rect.height; const progress = signal.get();
    node.dataset.signal = progress.toFixed(3); node.setAttribute('aria-label', `Animated signal at ${Math.round(progress * 100)} percent`);
    ctx.fillStyle = '#101010'; ctx.fillRect(0, 0, width, height); ctx.strokeStyle = 'rgba(240,238,232,.14)'; ctx.lineWidth = 1;
    for (let x = 24; x < width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 28; y < height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    ctx.beginPath(); for (let x = 0; x <= width; x += 4) { const y = height / 2 + Math.sin((x / width * Math.PI * 5) + progress * Math.PI * 2) * (18 + progress * 34) * Math.sin(x / width * Math.PI); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.strokeStyle = '#ff5a1f'; ctx.lineWidth = 2; ctx.stroke();
    const x = 22 + progress * (width - 44); const y = height / 2 + Math.sin((x / width * Math.PI * 5) + progress * Math.PI * 2) * (18 + progress * 34) * Math.sin(x / width * Math.PI);
    ctx.fillStyle = '#d9ff43'; ctx.fillRect(x - 5, y - 5, 10, 10); ctx.fillStyle = '#f0eee8'; ctx.font = '10px IBM Plex Mono'; ctx.fillText(`${Math.round(progress * 100)}% SIGNAL`, 16, 22);
  };
  const play = () => { animation.current?.cancel(); signal.set(0); animation.current = signal.animate(1, { duration: 2400, easing: 'linear', repeat: Infinity, yoyo: true }); };
  useEffect(() => { const unsubscribe = signal.subscribe(draw); const resize = new ResizeObserver(draw); if (canvas.current) resize.observe(canvas.current); play(); draw(); return () => { unsubscribe(); resize.disconnect(); animation.current?.cancel(); }; }, [signal]);
  return <div className="canvas-example"><canvas ref={canvas} role="img"/><Button variant="outline" size="sm" onClick={play}>Restart signal ↻</Button></div>;
}

function TransportScrubberExample() {
  const rowsRef = useRef<Array<HTMLDivElement | null>>([]);
  const flashRef = useRef<HTMLElement | null>(null);
  const clockRef = useRef<HTMLElement | null>(null);
  const scrubRef = useRef<HTMLInputElement | null>(null);
  const transportRef = useRef<Transport | null>(null);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const labels = ['OPEN', 'KEY', 'ROLL'];
    const timeline = new Timeline({ frameRate: 24, name: 'scrub' });
    labels.forEach((_, index) => {
      const tween = new Tween<{ x: number; opacity: number }>({
        from: { x: -70, opacity: 0 }, to: { x: 0, opacity: 1 }, duration: '18f', easing: 'dhaakon',
        onUpdate: ({ x, opacity }) => { const node = rowsRef.current[index]; if (node) { node.style.transform = `translateX(${x}px)`; node.style.opacity = String(opacity); } },
      });
      timeline.add(tween, index === 0 ? 0 : `${index * 14}f`);
    });
    timeline.cue('flash', '46f', () => {
      const node = flashRef.current; if (!node) return;
      node.classList.add('flash-on'); setTimeout(() => node.classList.remove('flash-on'), 220);
    });
    const transport = new Transport({ root: timeline, frameRate: 24, loop: true });
    transportRef.current = transport;
    const unsubscribe = transport.subscribe((info) => {
      if (clockRef.current) clockRef.current.textContent = info.timecode;
      if (scrubRef.current && document.activeElement !== scrubRef.current) {
        const duration = transport.duration;
        scrubRef.current.value = String(duration ? Math.round((info.time / duration) * 1000) : 0);
      }
    });
    transport.play();
    return () => { unsubscribe(); transport.dispose(); };
  }, []);

  const toggle = () => { const t = transportRef.current; if (!t) return; t.toggle(); setPlaying(t.state === 'playing'); };
  const scrub = (event: ChangeEvent<HTMLInputElement>) => {
    const t = transportRef.current; if (!t) return;
    t.seek((Number(event.target.value) / 1000) * t.duration);
  };

  return <div className="cue-example transport-example">
    <div className="cue-head"><span>TRANSPORT / 24 FPS</span><i ref={flashRef} className="flash-dot" /><strong ref={clockRef}>00:00:00:00</strong></div>
    <div className="cue-stack">{['OPEN', 'KEY', 'ROLL'].map((label, index) => <div className="cue-row" key={label} ref={(node) => { rowsRef.current[index] = node; }}><small>0{index + 1}</small><b>{label}</b><span>frame {index * 14}</span><i /></div>)}</div>
    <input ref={scrubRef} className="transport-scrub" type="range" min={0} max={1000} defaultValue={0} onChange={scrub} aria-label="Scrub the transport" />
    <div className="button-row">
      <Button variant="outline" size="sm" onClick={() => transportRef.current?.step(-1)}>⏮ frame</Button>
      <Button variant="outline" size="sm" onClick={toggle}>{playing ? 'Pause ⏸' : 'Play ▶'}</Button>
      <Button variant="outline" size="sm" onClick={() => transportRef.current?.step(1)}>frame ⏭</Button>
    </div>
  </div>;
}

const sheetSource = `{
  "$schema": "dhaakon-motion/cue-sheet/1",
  "frameRate": 24,
  "markers": [{ "name": "verse", "at": "1s" }],
  "cues": [{ "name": "blackout", "at": "verse+=12f" }],
  "items": [
    { "type": "tween", "target": "x", "at": 0, "duration": "24f", "easing": "dhaakon", "from": 0, "to": 220 }
  ]
}`;

function CueSheetExample() {
  const [source, setSource] = useState(sheetSource);
  const [ascii, setAscii] = useState('');
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const transportRef = useRef<Transport | null>(null);

  const load = () => {
    transportRef.current?.dispose();
    try {
      const parsed = JSON.parse(source);
      const validated = validateSheet(parsed);
      if (!validated.ok) { setError(validated.errors.map((e) => `${e.path}: ${e.message}`).join('\n')); return; }
      const timeline = loadSheet(validated.sheet, {
        targets: { x: (value: number) => { if (boxRef.current) boxRef.current.style.transform = `translateX(${value}px)`; } },
      }, { strict: false });
      setAscii(timeline.toAscii());
      setError(null);
      const duration = Number.isFinite(timeline.totalDuration) ? timeline.totalDuration : timeline.duration;
      const transport = new Transport({ root: timeline, duration });
      transportRef.current = transport;
      transport.play();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => { load(); return () => transportRef.current?.dispose(); }, []);

  return <div className="sheet-example">
    <div className="sheet-body">
      <textarea className="sheet-textarea" value={source} onChange={(event) => setSource(event.target.value)} spellCheck={false} />
      <div className="sheet-preview">
        <div className="sheet-stage"><div ref={boxRef} className="sheet-block" /></div>
        {error ? <pre className="sheet-error">{error}</pre> : <pre className="sheet-ascii">{ascii}</pre>}
      </div>
    </div>
    <Button variant="accent" size="sm" onClick={load}>Load sheet ▸</Button>
  </div>;
}

function ComplexExample({ number, title, description, code, delay = 0, children }: { number: string; title: string; description: string; code: string; delay?: number; children: React.ReactNode }) {
  const compact = number === '06.1';
  const copy = compact ? 'Author in frames or SMPTE. The 29.97 DF Transport handles conversion, cues, scrubbing, and exact frame steps.' : description;
  return <Reveal as="article" className={`complex-example${compact ? ' complex-example--compact' : ''}`} from={{ y: 38, opacity: 0 }} amount={0.08} transition={{ duration: 600, delay }}><header><span>[ {number} ]</span><h3>{title}</h3><p>{copy}</p><Badge tone="accent">React + TypeScript</Badge></header><div className="complex-body"><div className="complex-live">{children}</div><Code>{code}</Code></div></Reveal>;
}

function Demo({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return <article className="demo"><header><span>LIVE</span><h3>{title}</h3><p>{note}</p></header><div className="demo-body">{children}</div></article>;
}

function RevealCell({ delay, children }: { delay: number; children: React.ReactNode }) {
  return <Reveal className="reveal-cell" from={{ y: 34, opacity: 0 }} transition={{ duration: 520, delay }}>{children}</Reveal>;
}

function CodePanel({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  return <Reveal className="code-panel" from={{ y: 24, opacity: 0 }} transition={{ duration: 480, delay }}>{children}</Reveal>;
}

function DeferredThreeShowcase() {
  const [ref, nearViewport] = useInView<HTMLDivElement>({ once: true, margin: '700px 0px' });
  return <div className="three-deferred" ref={ref}>{nearViewport
    ? <Suspense fallback={<div className="three-loading">INITIALIZING WEBGL RENDER TARGET…</div>}><ThreeShowcase/></Suspense>
    : <div className="three-loading">THREE.JS COMPOSITION LOADS NEAR VIEWPORT</div>}
  </div>;
}

export function App({ version }: { version: string }) {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    }));
    return () => cancelAnimationFrame(frame);
  }, []);

  return <MotionConfig transition={{ duration: 360, easing: 'dhaakon' }}>
    <motion.header className="site-head" initial={{ y: -18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 440 }}><a className="wordmark" href="#top"><i>◇</i> DHAAKON / MOTION</a><nav><a href="#why">Why</a><a href="#playground">Playground</a><a href="#react">React</a><a href="#compositions">Compositions</a><a href="#three">Three.js</a><a href="#transport">Transport</a><a href="#api">API</a></nav><Badge tone="accent">v{version}</Badge></motion.header>
    <main id="top">
      <section className="hero"><div className="hero-copy"><motion.p className="eyebrow" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 100 }}>[ MOTION SYSTEM 02 ] · BUILT FROM DHAAK-ANIM</motion.p><motion.h1 initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 160 }}>Movement with<br/><em>direction.</em></motion.h1><motion.p className="lead" initial={{ y: 22, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 240 }}>A compact tween engine for interfaces, timelines, canvas, and React compositions. One frame loop. Zero core dependencies.</motion.p><motion.div className="install" initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 320 }}><code>npm i @dhaakon/motion</code><span>↗ VERDACCIO :21760</span></motion.div></div><HeroOrbit /></section>
      <section className="metrics">{[['1','shared frame loop'],['0','core dependencies'],['2','entry points'],[String(scheduler.size),'active right now']].map(([value,label], index) => <Reveal as="div" key={label} from={{ y: 20, opacity: 0 }} transition={{ delay: index * 65 }}><strong>{value}</strong><span>{label}</span></Reveal>)}</section>
      <section className="section why-section" id="why"><SectionTitle number="01" title="Animation is a systems problem" subtitle="A transition moves one element. An engine coordinates an experience."/><div className="why-intro"><Reveal className="why-thesis" from={{ x: -30, opacity: 0 }}><p className="eyebrow">[ THE PRODUCTION THRESHOLD ]</p><h3>Time becomes infrastructure when more than one thing must move together.</h3><p>CSS is ideal for an isolated hover or disclosure. The moment a cue must synchronize a camera, shader, DOM overlay, waveform, particles, and audio envelope—and still pause, seek, reverse, test, and honor reduced motion—you need one authority for time.</p></Reveal><div className="why-points">{[['01','One clock','Independent timers drift. A shared scheduler keeps every renderer on the same frame.'],['02','Real control','Timelines make a whole composition pauseable, reversible, seekable, repeatable, and deterministic.'],['03','Renderer freedom','Values are not CSS. The same interpolation can target React, SVG, Canvas, WebGL, audio, or hardware.'],['04','Separation','Application state describes intent; the engine resolves time; each renderer writes its own pixels.']].map(([number,title,text], index) => <Reveal as="article" key={title} from={{ y: 24, opacity: 0 }} transition={{ delay: index * 65 }}><span>{number}</span><h4>{title}</h4><p>{text}</p></Reveal>)}</div></div><Reveal className="engine-map" from={{ y: 34, opacity: 0 }} amount={0.2}><div className="engine-intent"><small>APPLICATION INTENT</small><strong>“Take scene live”</strong></div><i>→</i><div className="engine-clock"><small>DHAAKON MOTION</small><strong>Timeline + one frame loop</strong><span>pause · seek · reverse · test</span></div><i>→</i><div className="engine-targets">{['DOM','SVG','CANVAS','THREE.JS','AUDIO'].map((target) => <b key={target}>{target}</b>)}</div></Reveal></section>
      <section className="section" id="playground"><SectionTitle number="02" title="Core playground" subtitle="The old syntax remains familiar; the clock underneath is entirely new."/><div className="demo-grid"><RevealCell delay={0}><TweenPlayground/></RevealCell><RevealCell delay={70}><EasingTracks/></RevealCell><RevealCell delay={140}><TimelinePlayground/></RevealCell><RevealCell delay={210}><MotionValueDemo/></RevealCell></div></section>
      <section className="section inverse" id="react"><SectionTitle number="03" title="React, composed" subtitle="Declarative when it helps. Imperative at the frame boundary."/><div className="demo-grid"><RevealCell delay={0}><ReactComposition/></RevealCell><RevealCell delay={90}><RenderPropDemo/></RevealCell></div><div className="code-grid"><CodePanel><h3>DOM composition</h3><p>Use <code>motion.*</code> for transform and style animation without a React render on every frame.</p><Code>{reactCode}</Code></CodePanel><CodePanel delay={100}><h3>Reveal on scroll</h3><p><code>Reveal</code>, <code>whileInView</code>, and <code>useInView</code> share the same observer and respect reduced-motion preferences.</p><Code>{revealCode}</Code></CodePanel></div></section>
      <section className="section compositions-section" id="compositions"><SectionTitle number="04" title="Production compositions" subtitle="Complete patterns for cueing, application state, and non-DOM render targets."/><div className="complex-stack"><ComplexExample number="04.1" title="Overlapping cue stack" description="A labeled Timeline drives four technical-direction cues from one deterministic clock. Replay, pause, seek, or reverse the entire stack as a unit." code={cueReactCode}><CueSequenceExample/></ComplexExample><ComplexExample number="04.2" title="State-driven scene" description="React owns the semantic state while motion interpolates between rehearsal, preview, and live visual states without remounting the composition." code={stateReactCode}><SceneStateExample/></ComplexExample><ComplexExample number="04.3" title="Canvas signal renderer" description="A MotionValue feeds a custom canvas renderer directly. React mounts the composition; the shared frame loop handles every subsequent draw." code={canvasReactCode}><CanvasSignalExample/></ComplexExample></div></section>
      <section className="section three-section" id="three"><SectionTitle number="05" title="One clock. Every property." subtitle="A live Three.js production sequence driven by the same renderer-agnostic values used everywhere else."/><Reveal className="three-shell" from={{ y: 42, opacity: 0 }} amount={0.08} transition={{ duration: 700 }}><DeferredThreeShowcase/></Reveal><div className="three-explain"><Reveal className="three-copy" from={{ x: -28, opacity: 0 }}><p className="eyebrow">[ REACT × MOTION × THREE.JS ]</p><h3>This is not a spinning-cube demo.</h3><p>One 9.2-second timeline interpolates deeply nested objects and writes them directly into the Three.js scene graph. It coordinates the camera, focal length, scene transforms, procedural shader uniforms, colors, three light rigs, fog density, tone-mapping exposure, 2,200 particles, orbital geometry, and the HTML telemetry overlay.</p><p>React mounts the renderer and owns the controls. It does not rerender at 60fps. Dhaakon Motion advances one deterministic clock, and Three.js renders once after every group of property writes.</p><div className="channel-grid">{[['01','Camera','position · target · FOV · roll'],['02','Scene graph','position · rotation · scale'],['03','GPU shader','time · energy · two colors'],['04','Lighting','color · intensity · exposure · fog'],['05','Particles','size · opacity · transform'],['06','Interface','phase · clock · scrubber · telemetry']].map(([number,title,properties]) => <div key={title}><span>{number}</span><b>{title}</b><small>{properties}</small></div>)}</div></Reveal><CodePanel delay={100}><h3>React renderer binding</h3><p>A <code>MotionValue</code> subscription is the adapter. No Three.js-specific API is required inside the engine.</p><Code>{threeReactCode}</Code></CodePanel></div></section>
      <section className="section transport-section" id="transport"><SectionTitle number="06" title="The production control room" subtitle="Seven live, inspectable systems: timecode authoring through deterministic export, multi-renderer playback, portable show files, and regression tooling."/><div className="feature-manifest"><span>FRAME-ACCURATE</span><span>OFFLINE-STABLE</span><span>REACT-NATIVE</span><span>SERIALIZABLE</span><span>INSPECTABLE</span></div><div className="complex-stack production-stack"><ComplexExample number="06.1" title="SMPTE conform desk" description="A 29.97 drop-frame master contains nested graphics, frame delays, SMPTE durations, markers, bidirectional cues, snapping, looping, and exact frame stepping. Tween timing inherits the Transport timebase—there are no manual frame conversions." code={productionLabCode.timecode}><TimecodeConformLab/></ComplexExample><ComplexExample number="06.2" title="Deterministic offline render farm" description="Two clean 49-frame passes sample camera, shader, and exposure state without requestAnimationFrame or wall-clock accumulation. Their state hashes match frame for frame, modeling resumable pixel export and render-farm verification." code={productionLabCode.offline}><OfflineRenderLab/></ComplexExample><ComplexExample number="06.3" title="Nested cue orchestration" description="A show master nests an act, graphics package, camera move, and audio bed with repeats, marker jumps, overlapping regions, and cues that fire correctly while traveling both forward and backward." code={productionLabCode.nested}><NestedCueLab/></ComplexExample><ComplexExample number="06.4" title="One transport, six outputs" description="A single deep value drives DOM transforms, a Three.js scene representation, Canvas waveform, audio gain, DMX level, and OSC/MIDI cue packets. Values write first; renderers draw once after the same tick." code={productionLabCode.outputs}><MultiOutputLab/></ComplexExample><ComplexExample number="06.5" title="React composition lifecycle" description="Declarative sequences register into an owned Transport, survive controlled playback and StrictMode, update MotionValues off the React render path, and cleanly add or remove an optional track at runtime." code={productionLabCode.react}><ReactLifecycleLab/></ComplexExample><ComplexExample number="06.6" title="Portable show + scene state" description="Edit a nested production cue sheet, validate it, bind named application targets, play it, capture scene state, and round-trip the live Timeline back to portable JSON without embedding renderer objects." code={productionLabCode.sheet}><SerializableShowLab/></ComplexExample><ComplexExample number="06.7" title="Timeline inspection + test bench" description="Scrub an inspection tree at exact frames, snapshot values and structure, then inject a deliberate regression. A failed assertion includes the mismatched sample and ASCII timeline needed to diagnose it." code={productionLabCode.inspection}><InspectionLab/></ComplexExample></div></section>
      <section className="section" id="api"><SectionTitle number="07" title="Small surface, deep control" subtitle="Every primitive can be used alone or nested into a composition."/><div className="api-grid"><Api index={0} name="Tween" text="Play, pause, stop, cancel, reverse, seek, repeat, yoyo, delay, and await finished."/><Api index={1} name="Timeline" text="Nests, sequences, or overlaps items with milliseconds, labels, timecodes, <, >, and relative offsets."/><Api index={2} name="Transport" text="The clock authority: rate, loop, chase(), and any number of attached outputs."/><Api index={3} name="Track" text="N-keyframe animation with per-segment easing — the general form of a two-key Tween."/><Api index={4} name="MotionValue" text="Observable animation state for React, canvas, WebGL, audio, and custom renderers."/><Api index={5} name="motion.*" text="Typed React elements with animate, whileInView, viewport, and reduced-motion handling."/><Api index={6} name="interpolate" text="Numbers, unit strings, colors, arrays, and deeply nested objects."/><Api index={7} name="loadSheet" text="Builds a live Timeline from a JSON cue sheet, with named target bindings and validation."/><Api index={8} name="FrameScheduler" text="One requestAnimationFrame for every active tween; injectable for deterministic tests."/></div><div className="code-grid"><CodePanel><Code>{tweenCode}</Code></CodePanel><CodePanel delay={100}><Code>{timelineCode}</Code></CodePanel></div></section>
      <section className="principles"><Reveal className="principles-label" from={{ x: -24, opacity: 0 }}><p className="eyebrow">[ OPERATING PRINCIPLES ]</p></Reveal><div>{['Motion clarifies state.','Composition beats choreography.','Reduced motion is a first-class mode.'].map((line,index) => <Reveal key={line} from={{ x: 32, opacity: 0 }} transition={{ delay: index * 90 }}><h2>{line}</h2></Reveal>)}</div></section>
    </main>
    <footer><span>◇ DHAAKON MOTION</span><span>MIT · TYPESCRIPT · REACT 18/19</span><a href="http://dhaakon-ubuntu:21724/dhaakon-ubuntu/dhaakon-motion">SOURCE ↗</a></footer>
  </MotionConfig>;
}

function HeroOrbit() {
  return <div className="hero-art"><div className="orbit orbit-a"/><div className="orbit orbit-b"/><motion.div className="hero-core" initial={{ rotate: 0, scale: .92 }} animate={{ rotate: 360, scale: 1 }} transition={{ duration: 9000, easing: 'linear', repeat: Infinity }}><span>DM</span></motion.div><p><b>FRAME</b><br/>SYNCHRONIZED</p></div>;
}
function SectionTitle({ number, title, subtitle }: { number: string; title: string; subtitle: string }) { return <Reveal as="header" className="section-title" from={{ y: 30, opacity: 0 }} amount={0.35}><p>[ {number} ]</p><div><h2>{title} ↘</h2><p>{subtitle}</p></div></Reveal>; }
function Api({ index, name, text }: { index: number; name: string; text: string }) { return <Reveal as="article" from={{ y: 22, opacity: 0 }} amount={0.35} transition={{ delay: index * 55 }}><span>+</span><h3>{name}</h3><p>{text}</p></Reveal>; }
