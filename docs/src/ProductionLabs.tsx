import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@dhaakon/ui';
import {
  MotionValue, Timeline, Track, Transport, Tween,
  captureScene, drawOutput, frames, loadSheet, saveSheet, signalOutput, validateSheet,
} from '@dhaakon/motion';
import {
  Transport as ReactTransport, Sequence, Track as ReactTrack, Tween as ReactTween,
  Cue, Marker, Region, useMotionValue, usePlayhead, useTransport, useTransportState,
} from '@dhaakon/motion/react';
import { expectSample, snapshotTimeline } from '@dhaakon/motion/testing';

export { GestureGallery, GestureProductionLabs, gestureBenchmarks } from './GestureLabs';

const control = (label: string, action: () => void, accent = false) =>
  <Button variant={accent ? 'accent' : 'outline'} size="sm" onClick={action}>{label}</Button>;

export function TimecodeConformLab() {
  const transportRef = useRef<Transport | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const lowerRef = useRef<HTMLDivElement | null>(null);
  const [head, setHead] = useState({ timecode: '00:00:00;00', frame: 0, state: 'idle', rate: 1 });
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    const show = new Timeline({ name: '29.97 DF master', frameRate: '29.97df' })
      .marker('PRE-ROLL', 0, { color: '#2d62ff' })
      .marker('PROGRAM', '00:00:01;00', { color: '#ff5a1f' })
      .marker('OUT', '00:00:03;15', { color: '#d9ff43' });
    const opener = new Timeline({ name: 'opener', frameRate: '29.97df' })
      .add(new Tween({ name: 'hero', from: { x: -90, opacity: 0 }, to: { x: 0, opacity: 1 }, delay: '6f', duration: '24f', easing: 'dhaakon',
        onUpdate: ({ x, opacity }) => { if (heroRef.current) { heroRef.current.style.transform = `translateX(${x}px)`; heroRef.current.style.opacity = String(opacity); } } }), 0)
      .add(new Tween({ name: 'lower', from: { y: 32, opacity: 0 }, to: { y: 0, opacity: 1 }, duration: '00:00:00;18', repeat: 1, repeatDelay: '6f', yoyo: true,
        onUpdate: ({ y, opacity }) => { if (lowerRef.current) { lowerRef.current.style.transform = `translateY(${y}px)`; lowerRef.current.style.opacity = String(opacity); } } }), '00:00:01;00');
    show.add(opener, 0)
      .cue('TAKE', '00:00:01;00', (e) => setEvents((old) => [`${e.direction > 0 ? 'FWD' : 'REV'} · TAKE · ${e.frame?.timecode ?? '—'}`, ...old].slice(0, 4)))
      .cue('ROLL', '00:00:02;12', (e) => setEvents((old) => [`${e.direction > 0 ? 'FWD' : 'REV'} · ROLL · ${e.frame?.timecode ?? '—'}`, ...old].slice(0, 4)));
    const transport = new Transport({ root: show, frameRate: '29.97df', snap: true, loop: true });
    transportRef.current = transport;
    let last = -1;
    const unsubscribe = transport.subscribe((info) => {
      if (info.frame !== last) { last = info.frame; setHead({ timecode: info.timecode, frame: info.frame, state: transport.state, rate: transport.rate }); }
    });
    transport.play();
    return () => { unsubscribe(); transport.dispose(); };
  }, []);

  const jump = (marker: string) => { const t = transportRef.current; const found = t?.root.markers.find((m) => m.name === marker); if (t && found) t.seek(found.time); };
  return <div className="lab lab-timecode">
    <div className="lab-console-head"><span>MASTER · 29.97 DF · FRAME LOCK</span><strong>{head.timecode}</strong><small>F {head.frame.toString().padStart(5, '0')}</small></div>
    <div className="tc-stage"><div className="tc-safe"/><div ref={heroRef} className="tc-hero"><small>SCORSESE CENTER / STAGE A</small><b>VIRTUAL<br/>PRODUCTION</b></div><div ref={lowerRef} className="tc-lower">CAM 02 <i/> PROGRAM</div></div>
    <div className="marker-strip">{['PRE-ROLL','PROGRAM','OUT'].map((name, i) => <button key={name} style={{ left: `${i * 43 + 3}%` }} onClick={() => jump(name)}><i/>{name}</button>)}</div>
    <div className="lab-controls">{control('− 1 frame', () => transportRef.current?.step(-1))}{control(head.state === 'playing' ? 'Pause' : 'Play', () => { const t = transportRef.current; t?.toggle(); if (t) setHead((h) => ({ ...h, state: t.state })); }, true)}{control('+ 1 frame', () => transportRef.current?.step(1))}{control(head.rate < 0 ? 'Forward' : 'Reverse', () => { const t = transportRef.current; t?.reverse(); if (t) setHead((h) => ({ ...h, rate: t.rate })); })}</div>
    <div className="event-log">{events.length ? events.map((event) => <code key={event}>{event}</code>) : <code>waiting for cue crossings…</code>}</div>
  </div>;
}

function makeOfflinePass() {
  const value = new MotionValue({ x: 0, energy: 0, exposure: .7 });
  const show = new Timeline({ name: 'offline-master' })
    .add(new Track({ name: 'camera+shader', target: value, keyframes: [
      { at: '0f', value: { x: 0, energy: 0, exposure: .7 } },
      { at: '24f', value: { x: 100, energy: 1, exposure: 1.4 }, easing: 'dhaakon' },
      { at: '48f', value: { x: 12, energy: .25, exposure: .85 }, easing: 'easeInOutCubic' },
    ] }), 0);
  const transport = new Transport({ root: show, frameRate: 24, snap: true });
  const samples: string[] = [];
  for (const info of frames(transport, { to: '48f' })) {
    const v = value.get();
    samples.push(`${info.frame}:${v.x.toFixed(4)}:${v.energy.toFixed(4)}:${v.exposure.toFixed(4)}`);
  }
  transport.dispose();
  return samples;
}

function hashStrings(values: string[]) {
  let hash = 2166136261;
  for (const value of values) for (let i = 0; i < value.length; i += 1) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function OfflineRenderLab() {
  const [result, setResult] = useState(() => { const a = makeOfflinePass(); const b = makeOfflinePass(); return { a, b, run: 1 }; });
  const render = () => { const a = makeOfflinePass(); const b = makeOfflinePass(); setResult((old) => ({ a, b, run: old.run + 1 })); };
  const aHash = hashStrings(result.a); const bHash = hashStrings(result.b);
  const thumbs = [0, 8, 16, 24, 32, 40, 48].map((frame) => ({ frame, x: Number(result.a[frame]?.split(':')[1] ?? 0) }));
  return <div className="lab lab-offline">
    <div className="render-verdict"><span>EXPORT AUDIT / PASS {String(result.run).padStart(2, '0')}</span><strong>{aHash === bHash ? 'BIT-STABLE' : 'MISMATCH'}</strong><small>2 × {result.a.length} frames</small></div>
    <div className="filmstrip">{thumbs.map(({ frame, x }) => <div key={frame}><div className="film-frame"><i style={{ transform: `translateX(${Math.min(72, x * .72)}px) rotate(${x * .18}deg)` }}/></div><code>{String(frame).padStart(2, '0')}f</code></div>)}</div>
    <div className="hash-compare"><div><small>PASS A · RGBA + STATE</small><code>fnv1a:{aHash}</code></div><i>=</i><div><small>PASS B · CLEAN PROCESS</small><code>fnv1a:{bHash}</code></div></div>
    <div className="lab-controls">{control('Render twice + compare', render, true)}<span>No RAF · no wall clock · exact rational frame steps</span></div>
  </div>;
}

export function NestedCueLab() {
  const transportRef = useRef<Transport | null>(null);
  const [snapshot, setSnapshot] = useState({ timecode: '00:00:00:00', progress: 0, event: 'STANDBY' });
  const [ascii, setAscii] = useState('');
  useEffect(() => {
    const log = (label: string) => (e: { direction: 1 | -1 }) => setSnapshot((s) => ({ ...s, event: `${e.direction > 0 ? 'FORWARD' : 'REVERSE'} / ${label}` }));
    const titles = new Timeline({ name: 'TITLES', repeat: 1, repeatDelay: '6f', yoyo: true })
      .marker('TITLE-IN', 0).cue('KEY', '12f', log('KEY TITLE')).add(new Tween({ name: 'title-opacity', duration: '24f' }), 0);
    const cameras = new Timeline({ name: 'CAMERAS' })
      .region('CAM-2', '0f', '36f', { onEnter: log('CAM 2 LIVE'), onExit: log('CAM 2 OUT') })
      .add(new Track({ name: 'dolly', keyframes: [{ at: '0f', value: 0 }, { at: '36f', value: 1 }], apply: () => {} }), 0);
    const audio = new Timeline({ name: 'AUDIO' }).cue('STING', '8f', log('ROLL STING')).add(new Tween({ name: 'gain-envelope', duration: '48f' }), 0);
    const act = new Timeline({ name: 'ACT 01' }).marker('ACT-01', 0).add(titles, 0).add(cameras, '12f').add(audio, '24f');
    const master = new Timeline({ name: 'SHOW MASTER' }).marker('TOP', 0).marker('BREAK', '00:00:03:00').add(act, 0).cue('BLACK', '00:00:03:00', log('BLACKOUT'));
    const transport = new Transport({ root: master, frameRate: 24, loop: true });
    transportRef.current = transport; setAscii(master.toAscii({ width: 34 }));
    const off = transport.subscribe((info) => setSnapshot((s) => ({ ...s, timecode: info.timecode, progress: transport.progress })));
    transport.play(); return () => { off(); transport.dispose(); };
  }, []);
  return <div className="lab lab-nested">
    <div className="nested-head"><span>{snapshot.event}</span><strong>{snapshot.timecode}</strong></div>
    <div className="lane-stack">{[['MASTER',0,100],['ACT 01',2,84],['TITLES',3,31],['CAMERAS',18,38],['AUDIO',34,50]].map(([name,left,width], index) => <div key={String(name)}><code>{name}</code><span><i className={`lane-${index}`} style={{ left: `${left}%`, width: `${width}%` }}/><b style={{ left: `${snapshot.progress * 100}%` }}/></span></div>)}</div>
    <pre className="mini-ascii">{ascii}</pre>
    <div className="lab-controls">{control('Top', () => transportRef.current?.seek(0))}{control('Next marker', () => { const t = transportRef.current; const m = t?.root.nextMarker(t.time); if (t && m) t.seek(m.time); })}{control('Reverse cues', () => transportRef.current?.reverse(), true)}</div>
  </div>;
}

type BusState = { x: number; rotate: number; energy: number; gain: number; dmx: number };
export function MultiOutputLab() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null); const domRef = useRef<HTMLDivElement | null>(null); const cubeRef = useRef<HTMLDivElement | null>(null);
  const transportRef = useRef<Transport | null>(null); const valueRef = useRef(new MotionValue<BusState>({ x: 0, rotate: 0, energy: .1, gain: 0, dmx: 0 }));
  const [status, setStatus] = useState({ tc: '00:00:00:00', gain: 0, dmx: 0, packet: '—', draws: 0 });
  useEffect(() => {
    const value = valueRef.current;
    const timeline = new Timeline({ name: 'unified-output-bus' }).add(new Tween<BusState>({ name: 'all-properties', from: value.get(), to: { x: 210, rotate: 330, energy: 1, gain: .86, dmx: 255 }, duration: '72f', repeat: Infinity, repeatDelay: '6f', yoyo: true, easing: 'dhaakon', onUpdate: (v) => value.set(v) }), 0)
      .cue('OSC TAKE', '24f', () => {}, { payload: { signal: { address: '/switcher/take', value: 1 } } })
      .cue('MIDI NOTE', '48f', () => {}, { payload: { signal: { midi: [144, 60, 127] } } });
    const transport = new Transport({ root: timeline, frameRate: 24 }); transportRef.current = transport;
    let draws = 0;
    const dom = drawOutput(() => { const v = value.get(); if (domRef.current) domRef.current.style.transform = `translateX(${v.x}px)`; }, { name: 'DOM writer' });
    const three = drawOutput(() => { const v = value.get(); if (cubeRef.current) cubeRef.current.style.transform = `rotateX(${v.rotate * .65}deg) rotateY(${v.rotate}deg) scale(${.72 + v.energy * .28})`; }, { name: 'Three.js renderer' });
    const canvas = drawOutput((info) => { const node = canvasRef.current; const ctx = node?.getContext('2d'); if (!node || !ctx) return; const v = value.get(); ctx.clearRect(0, 0, node.width, node.height); ctx.strokeStyle = '#d9ff43'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = 0; x <= node.width; x += 3) { const y = node.height / 2 + Math.sin(x * .055 + info.time * .01) * v.energy * 32; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); draws += 1; }, { name: 'Canvas draw' });
    const signal = signalOutput((payload) => setStatus((s) => ({ ...s, packet: JSON.stringify(payload) })), { name: 'OSC/MIDI/DMX' });
    const detachers = [dom, three, canvas, signal].map((output) => transport.attach(output));
    const off = transport.subscribe((info) => { const v = value.get(); setStatus((s) => ({ ...s, tc: info.timecode, gain: v.gain, dmx: Math.round(v.dmx), draws })); });
    transport.play(); return () => { off(); detachers.forEach((detach) => detach()); transport.dispose(); };
  }, []);
  return <div className="lab lab-bus">
    <div className="bus-stage"><div className="bus-dom"><small>DOM</small><div ref={domRef}>LOWER / THIRD</div></div><div className="bus-three"><small>THREE.JS</small><div className="cube-scene"><div ref={cubeRef} className="css-cube"><i/><i/><i/></div></div></div><div className="bus-canvas"><small>CANVAS</small><canvas ref={canvasRef} width={320} height={110}/></div></div>
    <div className="bus-meter"><span>AUDIO GAIN<i style={{ width: `${status.gain * 100}%` }}/></span><span>DMX UNIVERSE 1<i style={{ width: `${status.dmx / 2.55}%` }}/></span></div>
    <div className="packet"><b>{status.tc}</b><code>{status.packet}</code><small>{status.draws} synchronized draws</small></div>
    <div className="lab-controls">{control('Pause every output', () => transportRef.current?.toggle(), true)}{control('Seek 48f', () => transportRef.current?.seek('48f'))}</div>
  </div>;
}

function LifecycleConsole({ onEvent }: { onEvent: (event: string) => void }) {
  const transport = useTransport(); const playhead = usePlayhead({ fps: 12 }); const state = useTransportState();
  return <div className="lifecycle-console"><div><small>REACT OWNER</small><strong>{state.state.toUpperCase()}</strong><code>{playhead.timecode}</code></div><div className="react-scene"><span style={{ transform: `translateX(${playhead.progress * 180}px)` }}>R</span></div><input type="range" min={0} max={1000} value={Math.round(playhead.progress * 1000)} onChange={(e) => transport.seek((Number(e.target.value) / 1000) * transport.duration)} /><div className="lab-controls">{control(state.state === 'playing' ? 'Pause' : 'Play', () => transport.toggle(), true)}{control('Unmount branch', () => onEvent('REQUEST / BRANCH TOGGLE'))}{control('Reverse', () => transport.reverse())}</div></div>;
}

export function ReactLifecycleLab() {
  const x = useMotionValue<number>(0); const opacity = useMotionValue<number>(0); const [mounted, setMounted] = useState(true); const [events, setEvents] = useState<string[]>(['MOUNT / TRANSPORT']);
  const log = (event: string) => setEvents((old) => [event, ...old].slice(0, 6));
  return <div className="lab lab-react">
    <ReactTransport frameRate={24} loop={[0, '72f']} autoplay onStateChange={(state) => log(`STATE / ${state.toUpperCase()}`)}>
      <Marker name="TOP" at="0f"/><Cue name="TAKE" at="18f" onFire={(e) => log(`${e.direction > 0 ? 'FORWARD' : 'REVERSE'} / TAKE`)}/><Region name="PROGRAM" from="24f" to="60f" onEnter={() => log('ENTER / PROGRAM')} onExit={() => log('EXIT / PROGRAM')}/>
      <Sequence name="graphics-package" at="6f"><ReactTween target={x} from={0} to={1} delay="6f" duration="30f" repeat={1} repeatDelay="4f" yoyo/>{mounted && <ReactTrack target={opacity} keyframes={[{ at: '0f', value: 0 }, { at: '12f', value: 1 }, { at: '48f', value: .2 }]}/>}</Sequence>
      <LifecycleConsole onEvent={() => { setMounted((value) => !value); log(mounted ? 'UNMOUNT / OPTIONAL TRACK' : 'MOUNT / OPTIONAL TRACK'); }}/>
    </ReactTransport>
    <div className="lifecycle-log">{events.map((event, i) => <code key={`${event}-${i}`}>{event}</code>)}</div>
    <div className="lifecycle-status"><span>strict-safe registration</span><span>cleanup on unmount</span><span>no 60fps React renders</span></div>
  </div>;
}

const productionSheet = `{
  "$schema": "dhaakon-motion/cue-sheet/1",
  "name": "VP Stage / Scene 12",
  "frameRate": 24,
  "markers": [{ "name": "top", "at": "0f" }, { "name": "take", "at": "36f" }],
  "cues": [{ "name": "tally", "at": "36f", "payload": { "signal": "CAM_2_RED" } }],
  "regions": [{ "name": "program", "from": "36f", "to": "96f" }],
  "items": [{
    "type": "timeline", "name": "graphics", "at": "12f",
    "items": [
      { "type": "tween", "name": "lower-third", "target": "x", "from": 0, "to": 220, "delay": "6f", "duration": "24f", "easing": "dhaakon" },
      { "type": "track", "name": "exposure", "target": "exposure", "keyframes": [{ "at": "0f", "value": 0.7 }, { "at": "48f", "value": 1.25 }] }
    ]
  }]
}`;

export function SerializableShowLab() {
  const [source, setSource] = useState(productionSheet); const [report, setReport] = useState(''); const [error, setError] = useState(''); const [x, setX] = useState(0); const [exposure, setExposure] = useState(.7); const transportRef = useRef<Transport | null>(null);
  const load = () => { transportRef.current?.dispose(); try { const parsed = JSON.parse(source); const valid = validateSheet(parsed); if (!valid.ok) throw new Error(valid.errors.map((e) => `${e.path}: ${e.message}`).join('\n')); const timeline = loadSheet(valid.sheet, { targets: { x: setX, exposure: setExposure }, cues: { tally: () => {} } }); const scene = { x: new MotionValue(x), exposure: new MotionValue(exposure) }; const captured = captureScene(scene); const roundtrip = saveSheet(timeline); setReport(`${timeline.toAscii({ width: 27 })}\n\nSCENE STATE\n${JSON.stringify(captured, null, 2)}\n\nROUND-TRIP: ${roundtrip.items.length} root item(s)`); setError(''); const t = new Transport({ root: timeline, frameRate: 24, loop: true }); transportRef.current = t; t.play(); } catch (err) { setError((err as Error).message); } };
  useEffect(() => { load(); return () => transportRef.current?.dispose(); }, []);
  return <div className="lab lab-sheet"><textarea value={source} onChange={(e) => setSource(e.target.value)} spellCheck={false}/><div className="sheet-audit"><div className="scene-card" style={{ filter: `brightness(${exposure})` }}><i style={{ transform: `translateX(${Math.min(130, x * .6)}px)` }}>SCENE 12</i></div><pre className={error ? 'error' : ''}>{error || report}</pre><div className="lab-controls">{control('Validate · load · round-trip', load, true)}{control('Export JSON', () => navigator.clipboard?.writeText(source))}</div></div></div>;
}

function makeInspectionTimeline() {
  return new Timeline({ name: 'inspection-master', frameRate: 24 })
    .marker('TOP', 0).marker('TAKE', '24f')
    .add(new Tween({ name: 'camera.x', from: 0, to: 100, duration: '48f', easing: 'linear' }), 0)
    .add(new Timeline({ name: 'graphics' }).add(new Tween({ name: 'lower.opacity', from: 0, to: 1, duration: '12f', easing: 'linear' }), 0), '12f');
}

export function InspectionLab() {
  const [frame, setFrame] = useState(24); const [fault, setFault] = useState(false);
  const audit = useMemo(() => { const timeline = makeInspectionTimeline(); const snapshot = snapshotTimeline(timeline, ['0f','12f','24f','48f']); let assertion = 'PASS · camera.x @ 24f = 50'; try { expectSample(timeline, '24f', { 'camera.x': fault ? 49 : 50 }); } catch (err) { assertion = (err as Error).message; } timeline.sampleAt(frame * 1000 / 24); return { snapshot, assertion }; }, [frame, fault]);
  const failed = audit.assertion.startsWith('expectSample');
  return <div className="lab lab-inspect"><div className="inspect-toolbar"><span>FRAME-ACCURATE INSPECTOR</span><code>{String(frame).padStart(4,'0')}f</code><b className={failed ? 'fail' : ''}>{failed ? 'FAIL' : 'PASS'}</b></div><div className="inspect-grid"><div><div className="inspect-ruler">{[0,12,24,36,48].map((n) => <i key={n} style={{ left: `${n / 48 * 100}%` }}>{n}</i>)}</div>{audit.snapshot.inspect.children.map((node, index) => <div className="inspect-lane" key={node.name}><code>{node.name}</code><span><i style={{ left: `${node.start / 2000 * 100}%`, width: `${node.duration / 2000 * 100}%` }}/><b style={{ left: `${frame / 48 * 100}%` }}/></span>{index === 1 && node.children.map((child) => <small key={child.name}>{child.name}</small>)}</div>)}</div><pre>{failed ? audit.assertion : JSON.stringify(audit.snapshot.samples, null, 2)}</pre></div><input type="range" min={0} max={48} value={frame} onChange={(e) => setFrame(Number(e.target.value))}/><div className="lab-controls">{control('Step −1f', () => setFrame((f) => Math.max(0, f - 1)))}{control('Step +1f', () => setFrame((f) => Math.min(48, f + 1)))}{control(fault ? 'Restore assertion' : 'Inject regression', () => setFault((v) => !v), fault)}</div></div>;
}

export const productionLabCode = {
  timecode: `const master = new Timeline({ name: 'show' })
  .marker('PROGRAM', '00:00:01;00')
  .add(new Tween({
    delay: '6f', duration: '00:00:00;24',
    repeat: 1, repeatDelay: '6f', yoyo: true
  }), 0)
  .cue('TAKE', '00:00:01;00', takeCamera);

// Tween timing inherits this rational timebase. No frameToMs().
const transport = new Transport({
  root: master, frameRate: '29.97df', snap: true
});
transport.seek('01:00:00;00');
transport.step(-1);`,
  offline: `const pass = async () => {
  const frames: string[] = [];
  await renderFrames(show, async info => {
    renderer.render(scene, camera);
    const rgba = gl.readPixels(0, 0, width, height);
    frames.push(await sha256(rgba, serializeScene()));
  }, { frameRate: '23.976', from: '01:00:00:00', to: '96f' });
  return frames;
};

expect(await pass()).toEqual(await pass()); // identical clocks + pixels`,
  nested: `const act = new Timeline({ name: 'ACT 01' })
  .marker('TOP', '01:00:00:00')
  .add(titles.repeat(2).yoyo(), 'TOP')
  .add(cameraMove, 'TOP+=12f')
  .add(audioBed, '<+=8f')
  .region('PROGRAM', 'TOP+=24f', 'TOP+=96f', {
    onEnter: () => tally.on(), onExit: () => tally.off()
  })
  .cue('TAKE', 'TOP+=36f', routeSwitcher);

master.add(act, 'REEL-2').add(credits, '>-=12f');
master.seekToMarker('TOP');
console.log(master.toAscii());`,
  outputs: `const transport = new Transport({ root: show, frameRate: 24 });
transport.attach(drawOutput(() => writeDOM(values.get())));
transport.attach(threeOutput({ renderer, scene, camera, composer }));
transport.attach(drawOutput(() => drawCanvas(ctx, values.get())));
transport.attach(audioOutput(audioContext));
transport.attach(midiOutput(midiPort));
transport.attach(signalOutput((packet) => osc.send(packet)));

// Every writer samples first; each renderer draws once, on one transport tick.
transport.play();`,
  react: `<Transport frameRate={24} loop autoplay outputs={outputs}>
  <Marker name="TOP" at="0f" />
  <Sequence name="graphics" at="6f" repeat={1} repeatDelay="4f" yoyo>
    <Tween target={position} from={0} to={1} delay="6f" duration="30f" />
    {mounted && <Track target={opacity} keyframes={fadeKeyframes} />}
    <Cue name="TAKE" at="18f" onFire={routeSwitcher} />
    <Region name="PROGRAM" from="24f" to="60f" onEnter={tallyOn} onExit={tallyOff} />
  </Sequence>
  <ControlSurface />
</Transport> // StrictMode-safe registration + deterministic cleanup`,
  sheet: `const result = validateSheet(JSON.parse(source));
if (!result.ok) return showErrors(result.errors);

const timeline = loadSheet(result.sheet, {
  targets: { camera, exposure, lowerThird },
  cues: { tally: sendTally, take: routeSwitcher },
  createItem: (item) => item.type === 'audio' ? makeClip(item) : undefined
});

const state = captureScene(targets);
applyScene(savedStates.program, targets, { transition: { duration: '12f' } });
const portableJSON = JSON.stringify(saveSheet(timeline));`,
  inspection: `const { driver, scheduler } = createTestScheduler();
const transport = new Transport({ root: show, frameRate: 24, scheduler });
const trace = transport.trace({ capacity: 240 });

transport.play();
stepFrames(driver, 24, 24);
expectSample(show, '24f', { 'camera.x': 50, 'lower.opacity': 1 });
expect(snapshotTimeline(show, ['0f','12f','24f','48f']))
  .toMatchSnapshot();

// Failure output includes exact values plus the entire ASCII timeline.
console.log(trace.toText(), show.inspect(), show.toAscii());`,
};
