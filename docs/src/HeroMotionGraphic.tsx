import { useEffect, useRef, useState } from 'react';
import { Timeline, Track, Transport, drawOutput } from '@dhaakon/motion';

type HeroState = { phase: number; breath: number; spread: number; drift: number };
const durationFrames = 288;
const durationMs = 12000;

export function HeroMotionGraphic() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const focusRef = useRef<SVGGElement | null>(null);
  const rigRef = useRef<SVGGElement | null>(null);
  const nodeRefs = useRef<Array<SVGCircleElement | null>>([]);
  const pathRefs = useRef<Array<SVGPathElement | null>>([]);
  const timecodeRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef<HTMLElement | null>(null);
  const energyRef = useRef<HTMLElement | null>(null);
  const scrubRef = useRef<HTMLInputElement | null>(null);
  const transportRef = useRef<Transport | null>(null);
  const stateRef = useRef<HeroState>({ phase: 0, breath: .28, spread: .72, drift: 0 });
  const [cue, setCue] = useState('DRIFT');
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const state = stateRef.current;
    const show = new Timeline({ name: 'hero-signal-field', frameRate: 24 })
      .marker('DRIFT', '0f').marker('FOLD', '72f').marker('BLOOM', '144f').marker('RETURN', '216f')
      .cue('DRIFT', '0f', () => setCue('DRIFT'))
      .cue('FOLD', '72f', () => setCue('FOLD'))
      .cue('BLOOM', '144f', () => setCue('BLOOM'))
      .cue('RETURN', '216f', () => setCue('RETURN'))
      .add(new Track<number>({ name: 'phase', frameRate: 24, keyframes: [{ at: '0f', value: 0 }, { at: '288f', value: Math.PI * 2, easing: 'linear' }], apply: (value) => { state.phase = value; } }), '0f')
      .add(new Track<number>({ name: 'breath', frameRate: 24, keyframes: [{ at: '0f', value: .28 }, { at: '144f', value: .58, easing: 'easeInOutCubic' }, { at: '288f', value: .28, easing: 'easeInOutCubic' }], apply: (value) => { state.breath = value; } }), '0f')
      .add(new Track<number>({ name: 'spread', frameRate: 24, keyframes: [{ at: '0f', value: .72 }, { at: '96f', value: .94, easing: 'easeInOutCubic' }, { at: '192f', value: .8, easing: 'easeInOutCubic' }, { at: '288f', value: .72, easing: 'easeInOutCubic' }], apply: (value) => { state.spread = value; } }), '0f')
      .add(new Track<number>({ name: 'drift', frameRate: 24, keyframes: [{ at: '0f', value: -1 }, { at: '144f', value: 1, easing: 'easeInOutCubic' }, { at: '288f', value: -1, easing: 'easeInOutCubic' }], apply: (value) => { state.drift = value; } }), '0f');

    const draw = (info: { time: number; frame: number; timecode: string }) => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
      const phase = state.phase;
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, 'rgba(45,98,255,.04)'); gradient.addColorStop(.52, 'rgba(240,238,232,.18)'); gradient.addColorStop(1, 'rgba(255,90,31,.07)');
      ctx.strokeStyle = gradient;
      for (let band = 0; band < 7; band += 1) {
        const offset = Math.sin(phase + band * .68) * (18 + state.breath * 18);
        const y = height * (.2 + band * .1) + offset;
        ctx.beginPath(); ctx.moveTo(-20, y);
        ctx.bezierCurveTo(width * .22, y - 82 * state.spread, width * .67, y + 76 * state.spread + state.drift * 18, width + 20, y - 10);
        ctx.lineWidth = band % 3 === 0 ? 1.4 : .7; ctx.stroke();
      }
      for (let index = 0; index < 16; index += 1) {
        const angle = phase * (index % 2 ? -.22 : .28) + index * 2.399;
        const radius = (52 + (index % 6) * 34) * state.spread;
        const x = width * .56 + Math.cos(angle) * radius;
        const y = height * .48 + Math.sin(angle * 1.17) * radius * .62;
        ctx.beginPath(); ctx.arc(x, y, index % 5 === 0 ? 2.1 : 1, 0, Math.PI * 2);
        ctx.fillStyle = index % 5 === 0 ? 'rgba(217,255,67,.62)' : 'rgba(240,238,232,.32)'; ctx.fill();
      }

      if (rigRef.current) rigRef.current.setAttribute('transform', `rotate(${Math.sin(phase) * 7} 300 300)`);
      if (focusRef.current) focusRef.current.setAttribute('transform', `translate(${300 + state.drift * 13} 300) scale(${.9 + state.breath * .16})`);
      nodeRefs.current.forEach((node, index) => {
        if (!node) return;
        const angle = phase * (index % 2 ? -.34 : .26) + index * Math.PI / 4;
        const radius = (142 + (index % 3) * 37) * state.spread;
        node.setAttribute('cx', String(300 + Math.cos(angle) * radius));
        node.setAttribute('cy', String(300 + Math.sin(angle) * radius * .58));
        node.setAttribute('r', String(index % 3 === 0 ? 3.2 : 1.8));
      });
      pathRefs.current.forEach((path, index) => { if (path) path.style.opacity = String(.14 + state.breath * (.18 + index * .035)); });
      if (timecodeRef.current) timecodeRef.current.textContent = info.timecode;
      if (frameRef.current) frameRef.current.textContent = String(info.frame).padStart(4, '0');
      if (energyRef.current) energyRef.current.style.transform = `scaleX(${.22 + state.breath})`;
      if (scrubRef.current) scrubRef.current.value = String(Math.round((info.time / durationMs) * 1000));
    };

    const transport = new Transport({ root: show, frameRate: 24, loop: ['0f', `${durationFrames}f`] });
    transportRef.current = transport;
    const detach = transport.attach(drawOutput(draw, { name: 'hero DOM + SVG + Canvas' }));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { transport.seek('144f', { cues: 'skip' }); setPlaying(false); } else transport.play();
    return () => { detach(); transport.dispose(); transportRef.current = null; };
  }, []);

  const toggle = () => { const transport = transportRef.current; if (!transport) return; transport.toggle(); setPlaying(transport.state === 'playing'); };
  return <div className="hero-art hero-motion">
    <canvas ref={canvasRef}/>
    <svg viewBox="0 0 600 600" aria-label="An abstract multi-renderer composition driven by Dhaakon Motion">
      <defs>
        <linearGradient id="hero-spectrum" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2d62ff"/><stop offset=".58" stopColor="#f0eee8"/><stop offset="1" stopColor="#ff5a1f"/></linearGradient>
        <radialGradient id="hero-haze"><stop offset="0" stopColor="#d9ff43" stopOpacity=".16"/><stop offset=".46" stopColor="#2d62ff" stopOpacity=".1"/><stop offset="1" stopColor="#2d62ff" stopOpacity="0"/></radialGradient>
      </defs>
      <g className="hero-signal-paths">{[0,1,2,3].map((index) => <path ref={(node) => { pathRefs.current[index] = node; }} key={index} d={`M-30 ${165 + index * 78} C125 ${80 + index * 54}, 410 ${510 - index * 58}, 640 ${180 + index * 72}`}/>)}</g>
      <g ref={rigRef} className="hero-rig"><ellipse cx="300" cy="300" rx="226" ry="116"/><ellipse cx="300" cy="300" rx="184" ry="156" transform="rotate(34 300 300)"/><ellipse cx="300" cy="300" rx="184" ry="156" transform="rotate(-34 300 300)"/>{Array.from({ length: 8 }, (_, index) => <circle ref={(node) => { nodeRefs.current[index] = node; }} key={index} cx="300" cy="300" r="2"/>)}</g>
      <g ref={focusRef} className="hero-motion-focus"><circle r="104"/><circle r="67"/><circle r="24"/></g>
    </svg>
    <div className="hero-motion-top"><span><i/> LIVE SIGNAL STUDY</span><b>ONE CLOCK / 04 TRACKS / 03 OUTPUTS</b></div>
    <div className="hero-motion-hud"><div><small>TIMECODE</small><strong ref={timecodeRef}>00:00:00:00</strong></div><div><small>FRAME</small><strong ref={frameRef}>0000</strong></div><div><small>PHASE</small><strong>{cue}</strong></div></div>
    <div className="hero-energy"><i ref={energyRef}/></div>
    <div className="hero-motion-controls"><button onClick={toggle}>{playing ? 'PAUSE' : 'PLAY'}</button><input ref={scrubRef} aria-label="Scrub hero composition" type="range" min={0} max={1000} defaultValue={0} onInput={(event) => transportRef.current?.seek((Number(event.currentTarget.value) / 1000) * durationMs)}/></div>
  </div>;
}
