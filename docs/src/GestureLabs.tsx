import { useEffect, useMemo, useRef, useState } from 'react';
import { MotionValue, Timeline, Transport, projectFling } from '@dhaakon/motion';
import { motion, useDragControls, useMotionValue, useMotionValueState, useScrub } from '@dhaakon/motion/react';
import { drag as bindDrag, gestureToTrack, record, transformGesture } from '@dhaakon/motion/gesture';

function Tile({ title, proves, children }: { title: string; proves: string; children: React.ReactNode }) {
  return <article className="gesture-tile"><header><span>LIVE</span><h3>{title}</h3><p>{proves}</p></header><div className="gesture-tile-live">{children}</div></article>;
}

function DragCard() { return <div className="gesture-pad"><motion.div className="gesture-card" drag="x" dragBounds={{ min: -88, max: 88 }} dragElastic={.55} dragMomentum whileDrag={{ scale: 1.07 }} whileTap={{ scale: .97 }}>GRAB / THROW</motion.div></div>; }
function SwipeRow() {
  const row = useRef<HTMLDivElement>(null); const x = useMemo(() => new MotionValue<number>(0), []); const [done, setDone] = useState(false);
  useEffect(() => { if (!row.current) return; const node = row.current; const write = () => { node.style.transform = `translateX(${x.get()}px)`; }; const binding = bindDrag(x, node, { axis: 'x', bounds: { min: -150, max: 0 }, snap: [-150, 0], ariaLabel: 'Dismiss item', onEnd: (_event, outcome) => setDone(outcome.target < -75) }); const off = x.subscribe(write); write(); return () => { x.stop(); off(); binding.dispose(); }; }, [x]);
  return <div className="swipe-wrap"><span>DELETE</span><div ref={row}>{done ? 'RELEASED' : 'SWIPE LEFT'}<i>↤</i></div></div>;
}
function Sheet() { return <div className="mini-sheet"><motion.div drag="y" dragBounds={{ min: -100, max: 28 }} dragSnap={[-100, -35, 28]} dragElastic={.3}><i/><b>THREE DETENTS</b><p>Drag vertically to choose a resting point.</p></motion.div></div>; }
function Carousel() {
  const rail = useRef<HTMLDivElement>(null); const x = useMemo(() => new MotionValue<number>(0), []);
  useEffect(() => { if (!rail.current) return; const node = rail.current; let wheelTimer: ReturnType<typeof setTimeout> | undefined; const write = () => { node.style.transform = `translateX(${x.get()}px)`; }; const settle = () => x.spring(Math.max(-180, Math.min(0, Math.round(x.get() / 90) * 90)), { bounce: .18 }); const wheel = (event: WheelEvent) => { if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return; event.preventDefault(); x.stop(); x.set(Math.max(-180, Math.min(0, x.get() - event.deltaX))); if (wheelTimer) clearTimeout(wheelTimer); wheelTimer = setTimeout(settle, 90); }; const binding = bindDrag(x, node, { axis: 'x', bounds: { min: -180, max: 0 }, snap: { step: 90 }, elastic: .3, step: 90, ariaLabel: 'Carousel position' }); const off = x.subscribe(write); node.addEventListener('wheel', wheel, { passive: false }); write(); return () => { if (wheelTimer) clearTimeout(wheelTimer); x.stop(); node.removeEventListener('wheel', wheel); off(); binding.dispose(); }; }, [x]);
  return <div className="mini-carousel"><div ref={rail}>{['A','B','C'].map(item => <b key={item}>{item}</b>)}</div></div>;
}
function Zoom() { const host = useRef<HTMLDivElement>(null); const image = useRef<HTMLDivElement>(null); const scale = useMotionValue<number>(1); const x = useMotionValue<number>(0); const y = useMotionValue<number>(0); const s = useMotionValueState(scale); useEffect(() => { if (!host.current) return; const write = () => { if (image.current) image.current.style.transform = `translate3d(${x.get()}px,${y.get()}px,0) scale(${scale.get()})`; }; const binding = transformGesture(host.current, { x, y, scale, scaleBounds: [1, 4], doubleTapZoom: 2.5 }); const off = [x,y,scale].map(value => value.subscribe(write)); return () => { off.forEach(dispose => dispose()); binding.dispose(); }; }, [scale, x, y]); return <div ref={host} className="mini-zoom"><div ref={image}><span>+</span></div><code>{s.toFixed(2)}× · PINCH / WHEEL</code></div>; }
function Fader({ initial, label, compact = false }: { initial: number; label: string; compact?: boolean }) {
  const track = useRef<HTMLDivElement>(null); const fill = useRef<HTMLElement>(null); const handle = useRef<HTMLElement>(null); const readout = useRef<HTMLElement>(null); const position = useMemo(() => new MotionValue<number>(0), []);
  useEffect(() => {
    if (!track.current || !handle.current) return;
    const node = handle.current; const height = Math.max(1, track.current.clientHeight || (compact ? 170 : 120)); const level = () => Math.max(0, Math.min(100, 100 - position.get() / height * 100)); const setLevel = (next: number) => { position.stop(); position.set((100 - Math.max(0, Math.min(100, next))) / 100 * height); };
    const write = () => { const next = Math.round(level()); node.style.top = `${position.get() / height * 100}%`; node.setAttribute('aria-valuenow', String(next)); node.setAttribute('aria-valuetext', `${next} percent`); if (fill.current) fill.current.style.height = `${next}%`; if (readout.current) readout.current.textContent = String(next).padStart(3, '0'); };
    const onKey = (event: KeyboardEvent) => { let next = level(); if (event.key === 'ArrowUp' || event.key === 'ArrowRight') next += event.shiftKey ? 10 : 5; else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') next -= event.shiftKey ? 10 : 5; else if (event.key === 'PageUp') next += 10; else if (event.key === 'PageDown') next -= 10; else if (event.key === 'Home') next = 0; else if (event.key === 'End') next = 100; else return; event.preventDefault(); setLevel(next); };
    node.setAttribute('role', 'slider'); node.setAttribute('aria-label', `${label} level`); node.setAttribute('aria-valuemin', '0'); node.setAttribute('aria-valuemax', '100'); node.setAttribute('aria-orientation', 'vertical'); node.addEventListener('keydown', onKey); position.set((100 - initial) / 100 * height);
    const binding = bindDrag(position, node, { axis: 'y', bounds: { min: 0, max: height }, momentum: false, immediate: true, keyboard: false }); const off = position.subscribe(write); write();
    return () => { position.stop(); node.removeEventListener('keydown', onKey); off(); binding.dispose(); };
  }, [compact, initial, label, position]);
  return <div className={`bound-fader${compact ? ' bound-fader--compact' : ''}`}><div ref={track} className="fader-track"><i ref={fill}/><b ref={handle} tabIndex={0}/></div><code><span ref={readout}/> {compact ? label : '/ 100'}</code></div>;
}
function Slider() { return <div className="mini-slider"><Fader initial={62} label="Intensity"/></div>; }
function Pull() { const [ready, setReady] = useState(false); return <div className="mini-pull"><motion.div drag="y" dragBounds={{ min: 0, max: 74 }} dragSnap={[0]} dragElastic={.55} dragMomentum={false} onDrag={(e: any) => setReady(e.offset.y > 45)} onDragEnd={() => setReady(false)}>{ready ? 'RELEASE TO REFRESH' : 'PULL TO REFRESH'} ↓</motion.div></div>; }
function Matrix() { const [event, setEvent] = useState('READY'); return <div className="mini-matrix"><motion.button whileHover={{ y: -4 }} whileTap={{ scale: .9 }} whileFocus={{ outlineWidth: 3 }} onTap={() => setEvent('TAP')} onLongPress={() => setEvent('LONG PRESS')}>PRESS / HOLD</motion.button><code>{event}</code></div>; }
const reorderGap = 5;
function ReorderItem({ item, index, total, move }: { item: string; index: number; total: number; move(item: string, to: number): void }) {
  const controls = useDragControls(); const row = useRef<HTMLDivElement>(null); const [dragKey, resetDrag] = useState(0);
  const stride = () => Math.max(1, row.current?.offsetHeight || 29) + reorderGap;
  const targetFor = (offset: number) => Math.max(0, Math.min(total - 1, index + Math.round(offset / stride())));
  const onKeyDown = (event: React.KeyboardEvent) => {
    let target = index;
    if (event.key === 'ArrowUp') target -= 1;
    else if (event.key === 'ArrowDown') target += 1;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = total - 1;
    else return;
    event.preventDefault(); move(item, Math.max(0, Math.min(total - 1, target)));
  };
  return <motion.div key={dragKey} ref={row} role="listitem" drag="y" dragListener={false} dragKeyboard={false} dragControls={controls} dragBounds={() => ({ min: -index * stride(), max: (total - index - 1) * stride() })} dragElastic={.12} dragMomentum={false} whileDrag={{ scale: 1.03 }} onDragEnd={(event: any) => { const target = targetFor(event.offset.y); resetDrag(value => value + 1); move(item, target); }}><button type="button" aria-label={`Move ${item}, position ${index + 1} of ${total}`} aria-keyshortcuts="ArrowUp ArrowDown Home End" onKeyDown={onKeyDown} onPointerDown={(event) => controls.start(event.nativeEvent)}>⠿</button>{item}</motion.div>;
}
export function Reorder() {
  const [items, setItems] = useState(['CAMERA','GRAPHICS','AUDIO']);
  const move = (item: string, target: number) => setItems(current => { const from = current.indexOf(item); if (from < 0 || from === target) return current; const next = [...current]; next.splice(target, 0, next.splice(from, 1)[0]); return next; });
  return <div className="mini-reorder" role="list" aria-label="Production channel order">{items.map((item, index) => <ReorderItem key={item} item={item} index={index} total={items.length} move={move}/>)}</div>;
}

export function GestureGallery() {
  const cells = [
    ['Draggable card','Rubberband bounds, momentum, and velocity handoff.',<DragCard/>],
    ['Swipe to dismiss','Axis lock cooperates with vertical scrolling; projected motion decides.',<SwipeRow/>],
    ['Bottom sheet','Vertical dragging settles across three spring detents.',<Sheet/>],
    ['Momentum carousel','Trackpad-ready paging with elastic ends and grid snapping.',<Carousel/>],
    ['Pinch to zoom','Pinch, wheel zoom, double-tap reset, and anchored scaling.',<Zoom/>],
    ['Accessible fader','Scaled pointer control plus accurate slider semantics and keyboard input.',<Slider/>],
    ['Pull to refresh','Rubberband resistance, release-threshold feedback, and spring reset.',<Pull/>],
    ['Hover / tap / press','Touch-safe hover, immediate tap, focus, and cancellable long press.',<Matrix/>],
    ['Handle reorder','Imperative drag controls start movement from a dedicated handle.',<Reorder/>],
  ] as const;
  return <div className="gesture-gallery">{cells.map(([title, proves, child]) => <Tile key={title} title={title} proves={proves}>{child}</Tile>)}</div>;
}

function ScrubLab() {
  const host = useRef<HTMLDivElement>(null); const transport = useMemo(() => new Transport({ root: new Timeline().marker('TOP', 0).marker('TAKE', '24f').marker('OUT', '72f').add({ kind: 'bed', totalDuration: 3000, sampleAt: () => {} }, 0), frameRate: 24, snap: true }), []); const [head, setHead] = useState({ frame: 0, timecode: '00:00:00:00' });
  useScrub(host, transport, { pixelsPerFrame: 4, snapToMarkers: true, resumeAfter: true });
  useEffect(() => { const off = transport.subscribe(info => setHead({ frame: info.frame, timecode: info.timecode })); return () => { off(); transport.dispose(); }; }, [transport]);
  return <div ref={host} className="gesture-console scrub-console"><strong>{head.timecode}</strong><div><i style={{ left: `${Math.max(0, Math.min(100, head.frame / 72 * 100))}%` }}/>{[0,24,72].map(n => <b key={n} style={{ left: `${n / 72 * 100}%` }}/>)}</div><span>F {head.frame.toString().padStart(3, '0')} · DRAG TIME · FLING · SNAP TO MARKER</span></div>;
}
function ArenaLab() { const map = useRef<HTMLDivElement>(null); const x = useMemo(() => new MotionValue<number>(0), []); const y = useMemo(() => new MotionValue<number>(0), []); const scale = useMemo(() => new MotionValue<number>(1), []); const rotation = useMemo(() => new MotionValue<number>(0), []); const [zoom,setZoom] = useState(1); useEffect(() => { if (!map.current) return; const write = () => { if (map.current) map.current.style.transform = `translate3d(${x.get()}px,${y.get()}px,0) rotate(${rotation.get()}deg) scale(${scale.get()})`; setZoom(scale.get()); }; const binding = transformGesture(map.current, { x, y, scale, rotation, scaleBounds: [1, 3], doubleTapZoom: 2 }); const off = [x,y,scale,rotation].map(value => value.subscribe(write)); return () => { off.forEach(dispose => dispose()); binding.dispose(); }; }, [rotation,scale,x,y]); return <div className="gesture-console arena-console"><div ref={map} className="map-grid"><span>MAP · PINCH / WHEEL ZOOM</span><b>{zoom.toFixed(2)}×</b></div><motion.div className="arena-sheet" drag="y" dragSnap={[-120,-55,0]} dragBounds={{ min: -120, max: 0 }}><i/><b>SHEET ARENA</b><p>DRAG · THREE DETENTS</p></motion.div></div>; }
function CardsLab() { const card = useRef<HTMLDivElement>(null); const x = useMemo(() => new MotionValue<number>(0), []); const y = useMemo(() => new MotionValue<number>(0), []); const [status,setStatus] = useState('THROW / CATCH'); useEffect(() => { if (!card.current) return; const write = () => { if (card.current) card.current.style.transform = `translate3d(${x.get()}px,${y.get()}px,0) rotate(${x.get()*.08}deg)`; }; const binding = bindDrag({ x, y }, card.current, { axis: 'any', bounds: { x: [-190,190], y: [-72,72] }, elastic: .45, momentum: false, immediate: true, onStart: () => setStatus('CAUGHT · VELOCITY IN'), onEnd: event => { const target = projectFling(x.get(), event.velocity.x); if (Math.abs(target) > 110) { setStatus(target > 0 ? 'THROWN RIGHT' : 'THROWN LEFT'); x.decay({ velocity: event.velocity.x, power: 1 }); } else { setStatus('SPRING RETURN'); x.spring(0, { bounce: .3 }); y.spring(0, { bounce: .2 }); } } }); const off = [x,y].map(value => value.subscribe(write)); return () => { x.stop(); y.stop(); off.forEach(dispose => dispose()); binding.dispose(); }; }, [x,y]); const undo = () => { x.spring(0,{bounce:.2}); y.spring(0,{bounce:.2}); setStatus('UNDO · SPRING HOME'); }; return <div className="gesture-console card-console">{[3,2].map((n,i) => <div key={n} style={{ transform: `rotate(${(i+1)*-3}deg)` }}>NEXT 0{n}</div>)}<div ref={card} className="throw-card">{status}</div><button onClick={undo}>UNDO THROW</button></div>; }
function AutomationLab() { const pad = useRef<HTMLDivElement>(null); const [armed,setArmed] = useState(false); const [status,setStatus] = useState('ARM A TAKE'); const [points,setPoints] = useState<Array<{x:number;y:number}>>([]); const recorder = useRef<ReturnType<typeof record> | undefined>(undefined); useEffect(() => () => { recorder.current?.stop(); recorder.current = undefined; }, []); const arm = () => { if (!pad.current) return; recorder.current?.stop(); setPoints([]); recorder.current = record(pad.current, { normalize: true, frameRate: 24 }); setArmed(true); setStatus('RECORDING · DRAW IN FIELD'); }; const stop = () => { if (!recorder.current) return; const recording = recorder.current.stop(); const track = gestureToTrack(recording, { frameRate: 24, axis: 'y', simplify: .02 }); setStatus(`${recording.samples.length} SAMPLES → ${track.keyframes.length} KEYS`); recorder.current = undefined; setArmed(false); }; const draw = (event: React.PointerEvent) => { if (!armed || !event.buttons) return; const rect = event.currentTarget.getBoundingClientRect(); setPoints(old => [...old.slice(-79), { x: event.clientX-rect.left, y: event.clientY-rect.top }]); }; return <div className="gesture-console automation-console"><div ref={pad} onPointerMove={draw}><svg><polyline points={points.map(point => `${point.x},${point.y}`).join(' ')}/></svg><span>{armed ? 'PERFORM THE CURVE' : 'DRAW AUTOMATION'}</span></div><button onClick={armed ? stop : arm}>{status}</button></div>; }
function MixerLab() { return <div className="gesture-console mixer-console">{[72,46,83,31].map((level,i) => <Fader key={i} initial={level} label={`CH ${i+1}`} compact/>)}</div>; }
function TimelineMarker({ name, initial }: { name: string; initial: number }) { const marker = useRef<HTMLElement>(null); const readout = useRef<HTMLElement>(null); const time = useMemo(() => new MotionValue(initial), [initial]); useEffect(() => { if (!marker.current) return; const write = () => { if (marker.current) marker.current.style.transform = `translateX(${time.get()}px)`; if (readout.current) readout.current.textContent = `${Math.round(time.get()/10)}f`; }; const binding = bindDrag(time, marker.current, { axis: 'x', bounds: { min: 0, max: 180 }, snap: { step: 10 }, momentum: false, immediate: true, step: 10, ariaLabel: `${name} marker` }); const off = time.subscribe(write); write(); return () => { off(); binding.dispose(); }; }, [name,time]); return <div><code>{name}</code><i ref={marker} tabIndex={0}/><b ref={readout}/></div>; }
export function EditorLab() { return <div className="gesture-console editor-console"><header>GESTURE TIMELINE · 24 FPS</header><TimelineMarker name="CAMERA" initial={18}/><TimelineMarker name="TITLE" initial={42}/><TimelineMarker name="AUDIO" initial={66}/></div>; }
function PhysicsLab() { const ball = useRef<HTMLDivElement>(null); const x = useMotionValue<number>(0); const state = useMotionValueState(x); useEffect(() => { if (!ball.current) return; const write = () => { if (ball.current) ball.current.style.transform = `translateX(${x.get()}px)`; }; const binding = bindDrag(x, ball.current, { axis: 'x', bounds: { min: -120, max: 120 } }); const off = x.subscribe(write); return () => { off(); binding.dispose(); }; }, [x]); return <div className="gesture-console physics-console"><div ref={ball}/><svg viewBox="0 0 300 65"><path d={`M0 50 C70 ${50-state*.12} 170 ${22+state*.08} 300 32`}/></svg><div><button onClick={() => x.animate(-100,{duration:500})}>TWEEN A</button><button onClick={() => x.spring(90,{bounce:.35})}>SPRING B</button><button onClick={() => x.decay({ velocity: 1.2, min: -120, max: 120 })}>FLING</button></div></div>; }

const labs = [
  ['08.1','Scrub the show','A horizontal gesture becomes the production clock. Inertia carries the playhead in either direction and settles on authored markers.',<ScrubLab/>,`useScrub(viewport, transport, {\n  pixelsPerFrame: 4, momentum: true,\n  snapToMarkers: true, resumeAfter: true\n});`],
  ['08.2','Sheet over a map','Pinch or wheel-zoom the map while the foreground sheet independently settles at three vertical detents.',<ArenaLab/>,`transformGesture(map, { x, y, scale, rotation });\ndrag(sheetY, sheet, {\n  axis: 'y', bounds: [-120, 0],\n  snap: [-120, -55, 0]\n});`],
  ['08.3','Card stack throw','Projected fling chooses dismiss or return; coupled rotation follows the same value, and Undo springs an interrupted throw home.',<CardsLab/>,`const projected = projectFling(x.get(), event.velocity.x);\nMath.abs(projected) > dismissLine\n  ? x.decay({ velocity: event.velocity.x })\n  : x.spring(0);\nconst undo = () => x.spring(0);`],
  ['08.4','Performer automation','A live pointer take becomes a visible path and a simplified, frame-aligned Track with a measured key count.',<AutomationLab/>,`const take = recorder.stop();\nconst track = gestureToTrack(take, {\n  frameRate: 24, axis: 'y', simplify: .02\n});\nconsole.log(take.samples.length, track.keyframes.length);`],
  ['08.5','Multi-touch mixer','Four independent pointer sessions drive correctly scaled faders with vertical-slider semantics and keyboard control.',<MixerLab/>,`channels.map(({ position, handle, height }) =>\n  drag(position, handle, {\n    axis: 'y', bounds: { min: 0, max: height },\n    momentum: false\n  })\n);`],
  ['08.6','Gesture timeline editor','Three bounded markers support pointer and keyboard input, settle to the same ten-pixel grid, and report their current frame.',<EditorLab/>,`drag(markerTime, marker, {\n  axis: 'x', bounds: { min: 0, max: 180 },\n  snap: { step: 10 }, ariaLabel: name\n});`],
  ['08.7','Interruptible physics','Tween, spring, fling, and grab hand current position and analytic velocity to one another without a jump.',<PhysicsLab/>,`value.animate(A).cancel();\nvalue.spring(B);       // inherits current velocity\nvalue.decay();         // same MotionValue, same scheduler\ndrag(value, ball);     // re-grab without discontinuity`],
] as const;

export function GestureProductionLabs() { return <div className="gesture-production">{labs.map(([number,title,description,live,code]) => <article key={number}><header><span>[ {number} ]</span><h3>{title}</h3><p>{description}</p></header><div className="gesture-lab-body"><div>{live}</div><pre><code>{code}</code></pre></div></article>)}</div>; }

export const gestureBenchmarks = [
  ['Constant stroke · 120 Hz','1.13% error','2.60% error'],
  ['Deceleration at lift','25.26% error','24.43% error'],
  ['Drift + sine wobble','8.42% error','20.54% error'],
  ['Pause then lift','0 px/ms','0.074 px/ms'],
  ['Frame-coalesced write','4.37 ms','—'],
  ['Immediate write','0.005 ms','—'],
] as const;
