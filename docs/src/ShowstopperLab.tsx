import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Button } from '@dhaakon/ui';
import {
  MotionValue, Transport, drawOutput, frames, loadSheet, signalOutput,
  type CueSheet, type TransportOutput,
} from '@dhaakon/motion';
import { threeOutput } from '@dhaakon/motion/three';
import {
  Transport as ReactTransport, usePlayhead, useTransport, useTransportState,
} from '@dhaakon/motion/react';

type CameraState = { position: [number, number, number]; fov: number };
type RigState = { rotation: [number, number, number]; scale: number };
type RuntimeState = { camera: CameraState; rig: RigState; energy: number; overlay: number; audio: number; exposure: number };

const initialState = (): RuntimeState => ({
  camera: { position: [0, 1.1, 8.6], fov: 46 },
  rig: { rotation: [0, 0, 0], scale: .72 },
  energy: .08, overlay: 0, audio: 0, exposure: .72,
});

const showSheet: CueSheet = {
  $schema: 'dhaakon-motion/cue-sheet/1',
  name: 'STAGE 12 / IMPOSSIBLE TAKE', frameRate: 24,
  markers: [
    { name: 'STANDBY', at: '0f', color: '#2d62ff' },
    { name: 'TAKE', at: '24f', color: '#ff5a1f' },
    { name: 'HERO', at: '72f', color: '#d9ff43' },
    { name: 'OUT', at: '132f', color: '#f0eee8' },
  ],
  regions: [{ name: 'PROGRAM', from: '24f', to: '132f', payload: { bus: 'PGM' } }],
  cues: [
    { name: 'CAM 2 TAKE', at: '24f', payload: { signal: { osc: '/switcher/take/2', tally: 'RED' } } },
    { name: 'LED WALL GO', at: '48f', payload: { signal: { dmx: [1, 255], universe: 1 } } },
    { name: 'MUSIC HIT', at: '72f', payload: { signal: { midi: [144, 60, 118], audio: 'sting-01' } } },
    { name: 'BLACK', at: '132f', payload: { signal: { osc: '/switcher/black', dmx: [1, 0] } } },
  ],
  items: [
    {
      type: 'timeline', name: 'VIRTUAL CAMERA + LED VOLUME', at: '0f', items: [
        { type: 'track', name: 'camera-path', target: 'camera', keyframes: [
          { at: '0f', value: { position: [0, 1.1, 8.6], fov: 46 } },
          { at: '48f', value: { position: [-2.5, 1.8, 6.2], fov: 38 }, easing: 'dhaakon' },
          { at: '96f', value: { position: [2.1, .55, 5.1], fov: 31 }, easing: 'easeInOutCubic' },
          { at: '144f', value: { position: [0, 1.2, 7.4], fov: 44 }, easing: 'dhaakon' },
        ] },
        { type: 'track', name: 'scene-rig', target: 'rig', keyframes: [
          { at: '0f', value: { rotation: [0, 0, 0], scale: .72 } },
          { at: '72f', value: { rotation: [.5, 3.2, .15], scale: 1.08 }, easing: 'dhaakon' },
          { at: '144f', value: { rotation: [.1, 6.28, 0], scale: .78 }, easing: 'easeInOutCubic' },
        ] },
        { type: 'track', name: 'volume-energy', target: 'energy', keyframes: [
          { at: '0f', value: .08 }, { at: '24f', value: .22 },
          { at: '72f', value: 1, easing: 'easeOutBack' }, { at: '132f', value: .12 },
        ] },
        { type: 'track', name: 'exposure', target: 'exposure', keyframes: [
          { at: '0f', value: .72 }, { at: '72f', value: 1.36 }, { at: '144f', value: .8 },
        ] },
      ],
    },
    {
      type: 'timeline', name: 'GRAPHICS + SOUND', at: '18f', items: [
        { type: 'tween', name: 'title-in', target: 'overlay', from: 0, to: 1, delay: '6f', duration: '24f', repeat: 1, repeatDelay: '54f', yoyo: true, easing: 'dhaakon' },
        { type: 'track', name: 'audio-envelope', target: 'audio', keyframes: [
          { at: '0f', value: 0 }, { at: '12f', value: .15 }, { at: '54f', value: .92 }, { at: '114f', value: 0 },
        ] },
      ],
    },
  ],
};

function hash(values: string[]) {
  let value = 2166136261;
  for (const line of values) for (let index = 0; index < line.length; index += 1) value = Math.imul(value ^ line.charCodeAt(index), 16777619);
  return (value >>> 0).toString(16).padStart(8, '0');
}

function offlinePass() {
  const state = initialState();
  const timeline = loadSheet(showSheet, { targets: {
    camera: (value: CameraState) => { state.camera = value; }, rig: (value: RigState) => { state.rig = value; },
    energy: (value: number) => { state.energy = value; }, overlay: (value: number) => { state.overlay = value; },
    audio: (value: number) => { state.audio = value; }, exposure: (value: number) => { state.exposure = value; },
  } });
  const transport = new Transport({ root: timeline, frameRate: 24, snap: true });
  const samples: string[] = [];
  for (const info of frames(transport, { to: '144f' })) samples.push(`${info.frame}:${JSON.stringify(state)}`);
  transport.dispose();
  return hash(samples);
}

function ControlSurface({ enableAudio, verify, offlineHash, packet, trace }: {
  enableAudio(): void; verify(): void; offlineHash: string; packet: string; trace: string;
}) {
  const transport = useTransport(); const playhead = usePlayhead({ fps: 15 }); const state = useTransportState();
  const nextMarker = () => { const marker = transport.root.nextMarker(transport.time); transport.seek(marker?.time ?? 0); };
  return <>
    <div className="show-hud">
      <div><small>MASTER TIMECODE</small><strong>{playhead.timecode}</strong></div>
      <div><small>FRAME</small><strong>{String(playhead.frame).padStart(4, '0')}</strong></div>
      <div><small>TRANSPORT</small><strong>{state.state.toUpperCase()}</strong></div>
      <div><small>OFFLINE HASH</small><strong>{offlineHash || 'NOT RUN'}</strong></div>
    </div>
    <div className="show-scrub"><i style={{ transform: `scaleX(${playhead.progress})` }}/>{transport.root.markers.map((marker) => <button key={marker.name} style={{ left: `${marker.time / transport.duration * 100}%` }} onClick={() => transport.seek(marker.time)} title={marker.name}/>)}</div>
    <div className="show-controls">
      <Button variant="accent" size="sm" onClick={() => transport.toggle()}>{state.state === 'playing' ? 'Pause take' : 'Roll take'}</Button>
      <Button variant="outline" size="sm" onClick={() => transport.step(-1)}>−1f</Button>
      <Button variant="outline" size="sm" onClick={() => transport.step(1)}>+1f</Button>
      <Button variant="outline" size="sm" onClick={nextMarker}>Next cue</Button>
      <Button variant="outline" size="sm" onClick={() => transport.reverse()}>Reverse</Button>
      <Button variant="outline" size="sm" onClick={enableAudio}>Enable audio</Button>
      <Button variant="outline" size="sm" onClick={verify}>Verify offline</Button>
    </div>
    <div className="show-diagnostics"><code>{packet}</code><span>{trace}</span></div>
  </>;
}

export function ShowstopperLab() {
  const viewportRef = useRef<HTMLDivElement | null>(null); const canvasRef = useRef<HTMLCanvasElement | null>(null); const titleRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<{ context: AudioContext; gain: GainNode; oscillator: OscillatorNode } | null>(null);
  const latest = useRef(initialState()); const [transport, setTransport] = useState<Transport | null>(null); const [packet, setPacket] = useState('SIGNAL BUS / STANDBY'); const [offlineHash, setOfflineHash] = useState(''); const [traceText, setTraceText] = useState('TRACE / IDLE');

  useEffect(() => {
    const viewport = viewportRef.current; const waveform = canvasRef.current; if (!viewport || !waveform) return;
    let disposed = false; const scene = new THREE.Scene(); scene.background = new THREE.Color('#07090d'); scene.fog = new THREE.FogExp2('#07090d', .052);
    const camera = new THREE.PerspectiveCamera(46, 1, .1, 100); const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio)); renderer.toneMapping = THREE.ACESFilmicToneMapping; viewport.prepend(renderer.domElement);
    const rig = new THREE.Group(); scene.add(rig);
    const material = new THREE.MeshStandardMaterial({ color: '#2d62ff', emissive: '#ff5a1f', emissiveIntensity: .2, metalness: .62, roughness: .2, wireframe: false });
    const hero = new THREE.Mesh(new THREE.TorusKnotGeometry(1.45, .38, 180, 24, 2, 5), material); rig.add(hero);
    const cage = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.45, 1)), new THREE.LineBasicMaterial({ color: '#d9ff43', transparent: true, opacity: .28 })); rig.add(cage);
    const floor = new THREE.GridHelper(22, 28, '#2d62ff', '#182033'); floor.position.y = -2.3; scene.add(floor);
    const key = new THREE.PointLight('#ff5a1f', 35, 30); key.position.set(3, 4, 5); scene.add(key); const rim = new THREE.PointLight('#2d62ff', 24, 25); rim.position.set(-4, 1, -2); scene.add(rim);
    const starsGeometry = new THREE.BufferGeometry(); const positions = new Float32Array(900 * 3); for (let i = 0; i < positions.length; i += 3) { positions[i] = (Math.random() - .5) * 22; positions[i + 1] = (Math.random() - .5) * 12; positions[i + 2] = (Math.random() - .5) * 18; } starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); const stars = new THREE.Points(starsGeometry, new THREE.PointsMaterial({ color: '#f0eee8', size: .025, transparent: true, opacity: .5 })); scene.add(stars);

    const applyCamera = (value: CameraState) => { latest.current.camera = value; camera.position.set(...value.position); camera.fov = value.fov; camera.updateProjectionMatrix(); camera.lookAt(0, 0, 0); };
    const applyRig = (value: RigState) => { latest.current.rig = value; rig.rotation.set(...value.rotation); rig.scale.setScalar(value.scale); };
    const timeline = loadSheet(showSheet, { targets: {
      camera: applyCamera, rig: applyRig,
      energy: (value: number) => { latest.current.energy = value; material.emissiveIntensity = .15 + value * 2.8; key.intensity = 15 + value * 55; (stars.material as THREE.PointsMaterial).size = .02 + value * .055; },
      exposure: (value: number) => { latest.current.exposure = value; renderer.toneMappingExposure = value; },
      overlay: (value: number) => { latest.current.overlay = value; if (titleRef.current) { titleRef.current.style.opacity = String(value); titleRef.current.style.transform = `translateY(${(1 - value) * 34}px) scale(${.96 + value * .04})`; } },
      audio: (value: number) => { latest.current.audio = value; const audio = audioRef.current; if (audio) audio.gain.gain.setTargetAtTime(value * .035, audio.context.currentTime, .025); },
    } });
    const show = new Transport({ root: timeline, frameRate: 24, snap: true, loop: [0, '144f'] }); const trace = show.trace({ capacity: 8 });
    const outputs: TransportOutput[] = [
      threeOutput({ renderer, scene, camera, name: 'THREE / PROGRAM', onBeforeRender: (info) => { stars.rotation.y = info.time * .00005; cage.rotation.x = -info.time * .00008; } }),
      drawOutput((info) => { const ctx = waveform.getContext('2d'); if (!ctx) return; const rect = waveform.getBoundingClientRect(); const ratio = Math.min(2, window.devicePixelRatio); if (waveform.width !== Math.round(rect.width * ratio)) { waveform.width = Math.round(rect.width * ratio); waveform.height = Math.round(rect.height * ratio); } ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height); ctx.strokeStyle = '#d9ff43'; ctx.lineWidth = 1.5; ctx.beginPath(); for (let x = 0; x <= rect.width; x += 3) { const y = rect.height / 2 + Math.sin(x * .06 + info.time * .012) * (4 + latest.current.audio * 20); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }, { name: 'CANVAS / AUDIO SCOPE' }),
      signalOutput((signal, cue, info) => { setPacket(`${info.timecode} / ${cue.name} / ${JSON.stringify(signal)}`); }, { name: 'OSC + MIDI + DMX' }),
    ];
    const detach = outputs.map((output) => show.attach(output));
    const resize = () => { const rect = viewport.getBoundingClientRect(); renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / Math.max(1, rect.height); camera.updateProjectionMatrix(); }; const observer = new ResizeObserver(resize); observer.observe(viewport); resize();
    const off = show.subscribe(() => { const entry = trace.entries.at(-1); if (entry && entry.frame % 8 === 0) setTraceText(`#${entry.tick} · ${entry.frame}f · ${entry.durationMs.toFixed(2)}ms · ${entry.cues.join(', ') || 'no cue'}`); });
    if (!disposed) { setTransport(show); show.play(); }
    return () => { disposed = true; off(); detach.forEach((fn) => fn()); observer.disconnect(); show.dispose(); setTransport(null); renderer.dispose(); material.dispose(); starsGeometry.dispose(); (stars.material as THREE.Material).dispose(); viewport.removeChild(renderer.domElement); audioRef.current?.oscillator.stop(); audioRef.current?.context.close(); audioRef.current = null; };
  }, []);

  const enableAudio = () => {
    if (audioRef.current) { void audioRef.current.context.resume(); return; }
    const AudioContextClass = window.AudioContext; if (!AudioContextClass) return; const context = new AudioContextClass(); const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.type = 'sine'; oscillator.frequency.value = 52; gain.gain.value = 0; oscillator.connect(gain).connect(context.destination); oscillator.start(); audioRef.current = { context, gain, oscillator };
  };
  const verify = () => { const a = offlinePass(); const b = offlinePass(); setOfflineHash(a === b ? `PASS / ${a}` : 'MISMATCH'); };

  return <div className="showstopper-lab">
    <div ref={viewportRef} className="show-viewport">
      <div className="show-topline"><span><i/> STAGE 12 / PROGRAM</span><b>ONE TRANSPORT · EVERY TARGET</b><em>REC</em></div>
      <div ref={titleRef} className="show-title"><small>NYU / VIRTUAL PRODUCTION</small><strong>THE<br/>IMPOSSIBLE<br/>TAKE</strong><span>CAM 02 · LIVE COMPOSITE</span></div>
      <div className="show-targets">{['THREE.JS','DOM','CANVAS','AUDIO','OSC','MIDI','DMX'].map((target) => <span key={target}>{target}</span>)}</div>
      <canvas ref={canvasRef} className="show-waveform"/>
    </div>
    {transport ? <ReactTransport transport={transport}><ControlSurface enableAudio={enableAudio} verify={verify} offlineHash={offlineHash} packet={packet} trace={traceText}/></ReactTransport> : <div className="show-loading">BUILDING SERIALIZED SHOW…</div>}
  </div>;
}
