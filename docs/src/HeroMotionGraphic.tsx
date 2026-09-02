import { useEffect, useRef, useState } from 'react';
import { Timeline, Track, Transport, drawOutput } from '@dhaakon/motion';

type HeroState = { orbit: number; energy: number; aperture: number; typography: number };
const targets = ['DOM', 'SVG', 'CANVAS', 'THREE', 'AUDIO', 'DMX'];

export function HeroMotionGraphic() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const coreRef = useRef<SVGGElement | null>(null);
  const rigRef = useRef<SVGGElement | null>(null);
  const scanRef = useRef<SVGLineElement | null>(null);
  const nodeRefs = useRef<Array<SVGCircleElement | null>>([]);
  const pathRefs = useRef<Array<SVGPathElement | null>>([]);
  const timecodeRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef<HTMLElement | null>(null);
  const energyRef = useRef<HTMLElement | null>(null);
  const copyRef = useRef<HTMLDivElement | null>(null);
  const scrubRef = useRef<HTMLInputElement | null>(null);
  const transportRef = useRef<Transport | null>(null);
  const stateRef = useRef<HeroState>({ orbit: 0, energy: .12, aperture: .3, typography: 0 });
  const [cue, setCue] = useState('INITIALIZE');
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const state = stateRef.current;
    const show = new Timeline({ name: 'hero-composition', frameRate: 24 })
      .marker('ORIGIN', '0f').marker('EXPAND', '48f').marker('ROUTE', '96f').marker('RESOLVE', '144f')
      .cue('EXPAND', '48f', () => setCue('EXPAND / ALL CHANNELS'))
      .cue('ROUTE', '96f', () => setCue('ROUTE / ONE CLOCK'))
      .cue('RESOLVE', '144f', () => setCue('RESOLVE / FRAME LOCK'))
      .add(new Track<number>({ name: 'orbit', frameRate: 24, keyframes: [{ at: '0f', value: 0 }, { at: '192f', value: Math.PI * 2, easing: 'linear' }], apply: (value) => { state.orbit = value; } }), '0f')
      .add(new Track<number>({ name: 'energy', frameRate: 24, keyframes: [{ at: '0f', value: .12 }, { at: '48f', value: 1, easing: 'dhaakon' }, { at: '96f', value: .38 }, { at: '144f', value: .82, easing: 'easeOutBack' }, { at: '192f', value: .12 }], apply: (value) => { state.energy = value; } }), '0f')
      .add(new Track<number>({ name: 'aperture', frameRate: 24, keyframes: [{ at: '0f', value: .3 }, { at: '64f', value: 1 }, { at: '128f', value: .55 }, { at: '192f', value: .3 }], apply: (value) => { state.aperture = value; } }), '0f')
      .add(new Track<number>({ name: 'typography', frameRate: 24, keyframes: [{ at: '0f', value: 0 }, { at: '20f', value: 1, easing: 'dhaakon' }, { at: '168f', value: 1 }, { at: '192f', value: 0 }], apply: (value) => { state.typography = value; } }), '0f');

    const draw = (info: { time: number; frame: number; timecode: string }) => {
      const rect = canvas.getBoundingClientRect(); const ratio = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(rect.width)); const height = Math.max(1, Math.round(rect.height));
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) { canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); }
      const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
      const cx = width * .5; const cy = height * .5; const phase = state.orbit; const energy = state.energy;
      ctx.strokeStyle = `rgba(45,98,255,${.1 + energy * .22})`; ctx.lineWidth = 1;
      for (let ring = 0; ring < 5; ring += 1) { ctx.beginPath(); const radius = 44 + ring * 43 + Math.sin(phase * 2 + ring) * 8 * energy; ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke(); }
      const points = Array.from({ length: 28 }, (_, index) => { const angle = phase * (index % 2 ? -1 : 1) + index * 2.399; const radius = 58 + (index % 7) * 28 * state.aperture; return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle * 1.31) * radius * .58 }; });
      for (let index = 0; index < points.length; index += 1) { const point = points[index]; const next = points[(index * 7 + 5) % points.length]; ctx.beginPath(); ctx.moveTo(point.x, point.y); ctx.lineTo(next.x, next.y); ctx.strokeStyle = `rgba(${index % 3 ? '240,238,232' : '255,90,31'},${.035 + energy * .1})`; ctx.stroke(); ctx.fillStyle = index % 4 ? 'rgba(240,238,232,.55)' : '#d9ff43'; ctx.fillRect(point.x - 1, point.y - 1, index % 4 ? 2 : 4, index % 4 ? 2 : 4); }

      if (rigRef.current) rigRef.current.setAttribute('transform', `rotate(${phase * 180 / Math.PI} 300 300)`);
      if (coreRef.current) coreRef.current.setAttribute('transform', `translate(300 300) rotate(${-phase * 270 / Math.PI}) scale(${.82 + energy * .2})`);
      if (scanRef.current) { const scan = 65 + ((info.time / 8000) % 1) * 470; scanRef.current.setAttribute('y1', String(scan)); scanRef.current.setAttribute('y2', String(scan)); }
      nodeRefs.current.forEach((node, index) => { if (!node) return; const angle = phase * (index % 2 ? -1.35 : 1) + index * Math.PI / 3; const rx = 188 + Math.sin(phase * 2 + index) * 24 * energy; const ry = 108 + index % 2 * 34; node.setAttribute('cx', String(300 + Math.cos(angle) * rx)); node.setAttribute('cy', String(300 + Math.sin(angle) * ry)); node.setAttribute('r', String(4 + energy * (index % 3 + 2))); });
      pathRefs.current.forEach((path, index) => { if (path) path.style.strokeDashoffset = String(-info.time * (.018 + index * .004)); });
      if (timecodeRef.current) timecodeRef.current.textContent = info.timecode;
      if (frameRef.current) frameRef.current.textContent = String(info.frame).padStart(4, '0');
      if (energyRef.current) energyRef.current.style.transform = `scaleX(${energy})`;
      if (copyRef.current) {
        copyRef.current.style.opacity = String(state.typography);
        copyRef.current.style.transform = `translateY(${(1 - state.typography) * 24}px)`;
      }
      if (scrubRef.current) scrubRef.current.value = String(Math.round((info.time / 8000) * 1000));
    };

    const transport = new Transport({ root: show, frameRate: 24, loop: ['0f', '192f'] });
    transportRef.current = transport; const detach = transport.attach(drawOutput(draw, { name: 'hero DOM + SVG + Canvas' }));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { transport.seek('96f', { cues: 'skip' }); setPlaying(false); } else transport.play();
    return () => { detach(); transport.dispose(); transportRef.current = null; };
  }, []);

  const toggle = () => { const transport = transportRef.current; if (!transport) return; transport.toggle(); setPlaying(transport.state === 'playing'); };
  return <div className="hero-art hero-motion">
    <canvas ref={canvasRef}/>
    <svg viewBox="0 0 600 600" aria-label="A live Dhaakon Motion multi-renderer composition">
      <defs><linearGradient id="hero-spectrum" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2d62ff"/><stop offset=".56" stopColor="#ff5a1f"/><stop offset="1" stopColor="#d9ff43"/></linearGradient><filter id="hero-glow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <g className="hero-grid-lines">{[100,200,300,400,500].map((value) => <path key={`v${value}`} d={`M${value} 45V555 M45 ${value}H555`}/>)}</g>
      <g ref={rigRef} className="hero-rig"><ellipse cx="300" cy="300" rx="218" ry="91"/><ellipse cx="300" cy="300" rx="172" ry="142" transform="rotate(58 300 300)"/><ellipse cx="300" cy="300" rx="172" ry="142" transform="rotate(-58 300 300)"/>{targets.map((target, index) => <g key={target}><circle ref={(node) => { nodeRefs.current[index] = node; }} cx="300" cy="300" r="6"/><text x={300 + Math.cos(index * Math.PI / 3) * 236} y={300 + Math.sin(index * Math.PI / 3) * 160}>{target}</text></g>)}</g>
      <g className="hero-signal-paths">{[0,1,2].map((index) => <path ref={(node) => { pathRefs.current[index] = node; }} key={index} d={`M65 ${210 + index * 90} C170 ${110 + index * 75}, 430 ${490 - index * 78}, 535 ${210 + index * 90}`}/>)}</g>
      <line ref={scanRef} className="hero-scan" x1="58" x2="542" y1="70" y2="70"/>
      <g ref={coreRef} className="hero-motion-core"><path d="M0-82 71-41 71 41 0 82-71 41-71-41Z"/><path d="M0-57 49-28 49 28 0 57-49 28-49-28Z"/><text x="0" y="10">DM</text></g>
    </svg>
    <div className="hero-motion-top"><span><i/> LIVE COMPOSITION</span><b>ONE CLOCK / 04 TRACKS / 03 OUTPUTS</b></div>
    <div ref={copyRef} className="hero-motion-copy"><small>[ ENGINE SIGNAL 01 ]</small><strong>MOTION<br/>IS THE<br/><em>SYSTEM.</em></strong></div>
    <div className="hero-motion-hud"><div><small>TIMECODE</small><strong ref={timecodeRef}>00:00:00:00</strong></div><div><small>FRAME</small><strong ref={frameRef}>0000</strong></div><div><small>CUE</small><strong>{cue}</strong></div></div>
    <div className="hero-energy"><i ref={energyRef}/></div>
    <div className="hero-motion-controls"><button onClick={toggle}>{playing ? 'PAUSE' : 'PLAY'}</button><input ref={scrubRef} aria-label="Scrub hero composition" type="range" min={0} max={1000} defaultValue={0} onInput={(event) => transportRef.current?.seek((Number(event.currentTarget.value) / 1000) * 8000)}/></div>
  </div>;
}
