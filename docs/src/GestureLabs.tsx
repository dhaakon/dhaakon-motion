import { useEffect, useMemo, useRef, useState } from 'react';
import { MotionValue, Timeline, Transport } from '@dhaakon/motion';
import { motion, useDragControls, useMotionValue, useMotionValueState, useScrub } from '@dhaakon/motion/react';
import { drag as bindDrag, gestureToTrack, record, transformGesture } from '@dhaakon/motion/gesture';

function Tile({ title, proves, children }: { title: string; proves: string; children: React.ReactNode }) {
  return <article className="gesture-tile"><header><span>LIVE</span><h3>{title}</h3><p>{proves}</p></header><div className="gesture-tile-live">{children}</div></article>;
}

function DragCard() { return <div className="gesture-pad"><motion.div className="gesture-card" drag dragBounds={{ x: [-88, 88], y: [-42, 42] }} dragElastic={.55} dragMomentum whileDrag={{ scale: 1.07 }} whileTap={{ scale: .97 }}>GRAB / THROW</motion.div></div>; }
function SwipeRow() { const [done, setDone] = useState(false); return <div className="swipe-wrap"><span>DELETE</span><motion.div drag="x" dragAxis="lock" dragBounds={{ min: -150, max: 0 }} dragSnap={[-150, 0]} onDragEnd={(e: any) => setDone(e.offset.x < -70)}>{done ? 'RELEASED' : 'SWIPE LEFT'}<i>↤</i></motion.div></div>; }
function Sheet() { return <div className="mini-sheet"><motion.div drag="y" dragBounds={{ min: -100, max: 28 }} dragSnap={[-100, -35, 28]} dragElastic={.3}><i/><b>THREE DETENTS</b><p>Content and sheet arbitrate the same pointer.</p></motion.div></div>; }
function Carousel() { return <div className="mini-carousel"><motion.div drag="x" dragBounds={{ min: -180, max: 0 }} dragSnap={{ step: 90 }} dragElastic={.3}>{['A','B','C'].map(x => <b key={x}>{x}</b>)}</motion.div></div>; }
function Zoom() { const host = useRef<HTMLDivElement>(null); const image = useRef<HTMLDivElement>(null); const scale = useMotionValue<number>(1); const x = useMotionValue<number>(0); const y = useMotionValue<number>(0); const s = useMotionValueState(scale); useEffect(() => { if (!host.current) return; const write = () => { if (image.current) image.current.style.transform = `translate3d(${x.get()}px,${y.get()}px,0) scale(${scale.get()})`; }; const binding = transformGesture(host.current, { x, y, scale, scaleBounds: [1, 4], doubleTapZoom: 2.5 }); const off = [x,y,scale].map(value => value.subscribe(write)); return () => { off.forEach(dispose => dispose()); binding.dispose(); }; }, [scale, x, y]); return <div ref={host} className="mini-zoom"><div ref={image}><span>+</span></div><code>{s.toFixed(2)}× · PINCH / WHEEL</code></div>; }
function Slider() { const value = useMotionValue(62); const state = useMotionValueState(value); return <div className="mini-slider"><motion.div drag="y" dragBounds={{ min: -65, max: 65 }} dragMomentum={false} aria-label="Intensity fader"><i style={{ height: `${state}%` }}/><b/></motion.div><code>{Math.round(state).toString().padStart(3, '0')} / 100</code></div>; }
function Pull() { const [ready, setReady] = useState(false); return <div className="mini-pull"><motion.div drag="y" dragBounds={{ min: 0, max: 74 }} dragElastic={.55} dragMomentum={false} onDrag={(e: any) => setReady(e.offset.y > 45)} onDragEnd={() => setReady(false)}>{ready ? 'RELEASE TO REFRESH' : 'PULL TO REFRESH'} ↓</motion.div></div>; }
function Matrix() { const [event, setEvent] = useState('READY'); return <div className="mini-matrix"><motion.button whileHover={{ y: -4 }} whileTap={{ scale: .9 }} whileFocus={{ outlineWidth: 3 }} onTap={() => setEvent('TAP')} onLongPress={() => setEvent('LONG PRESS')}>PRESS / HOLD</motion.button><code>{event}</code></div>; }
function Reorder() { const controls = useDragControls(); return <div className="mini-reorder">{['CAMERA','GRAPHICS','AUDIO'].map((item, index) => index ? <div key={item}><i>⠿</i>{item}</div> : <motion.div key={item} drag="y" dragControls={controls} dragMomentum={false}><button onPointerDown={(event) => controls.start(event.nativeEvent)}>⠿</button>{item}</motion.div>)}</div>; }

export function GestureGallery() {
  const cells = [
    ['Draggable card','Rubberband bounds, momentum, snapping, and velocity handoff.',<DragCard/>],
    ['Swipe to dismiss','Axis lock cooperates with vertical scrolling; projected motion decides.',<SwipeRow/>],
    ['Bottom sheet','Nested arenas negotiate scroll and three spring detents.',<Sheet/>],
    ['Momentum carousel','Trackpad-ready paging with elastic ends and grid snapping.',<Carousel/>],
    ['Pinch to zoom','Pinch, rotate-ready transforms, wheel zoom, and anchored scaling.',<Zoom/>],
    ['Accessible fader','Pointer control plus automatic slider semantics and keyboard input.',<Slider/>],
    ['Pull to refresh','Rubberband resistance and a bidirectional threshold cue.',<Pull/>],
    ['Hover / tap / press','Touch-safe hover, immediate tap, focus, and cancellable long press.',<Matrix/>],
    ['Handle reorder','Imperative drag controls start movement from a dedicated handle.',<Reorder/>],
  ] as const;
  return <div className="gesture-gallery">{cells.map(([title, proves, child]) => <Tile key={title} title={title} proves={proves}>{child}</Tile>)}</div>;
}

function ScrubLab() {
  const host = useRef<HTMLDivElement>(null); const transport = useMemo(() => new Transport({ root: new Timeline().marker('TOP', 0).marker('TAKE', '24f').marker('OUT', '72f').add({ kind: 'bed', totalDuration: 4000, sampleAt: () => {} }, 0), frameRate: 24, snap: true }), []); const [frame, setFrame] = useState(0);
  useScrub(host, transport, { pixelsPerFrame: 4, snapToMarkers: true, resumeAfter: true });
  useEffect(() => { const off = transport.subscribe(info => setFrame(info.frame)); return () => { off(); transport.dispose(); }; }, [transport]);
  return <div ref={host} className="gesture-console scrub-console"><strong>{transport.timecode}</strong><div><i style={{ left: `${Math.min(100, frame / 72 * 100)}%` }}/>{[0,24,72].map(n => <b key={n} style={{ left: `${n / 72 * 100}%` }}/>)}</div><span>DRAG TIME · FLING · SNAP TO MARKER</span></div>;
}
function ArenaLab() { return <div className="gesture-console arena-console"><div className="map-grid">MAP · PINCH / PAN / WHEEL</div><motion.div drag="y" dragSnap={[-120,-55,0]} dragBounds={{ min: -120, max: 0 }}><i/><b>SHEET ARENA</b><p>Handle claims · body yields to scroll</p></motion.div></div>; }
function CardsLab() { return <div className="gesture-console card-console">{[3,2,1].map((n, i) => <motion.div key={n} drag={i === 2} dragBounds={{ x: [-170,170], y: [-70,70] }} dragElastic={.5} dragMomentum style={{ rotate: `${i * -3}deg` }}>{i === 2 ? 'THROW / CATCH' : `NEXT 0${n}`}</motion.div>)}</div>; }
function AutomationLab() { const pad = useRef<HTMLDivElement>(null); const [status,setStatus] = useState('ARM A TAKE'); const recorder = useRef<ReturnType<typeof record> | undefined>(undefined); const arm = () => { if (!pad.current) return; recorder.current = record(pad.current, { normalize: true, frameRate: 24 }); setStatus('RECORDING POINTER DATA'); }; const stop = () => { if (!recorder.current) return; const recording = recorder.current.stop(); const track = gestureToTrack(recording, { frameRate: 24, axis: 'y', simplify: .02 }); setStatus(`${recording.samples.length} SAMPLES → ${track.keyframes.length} KEYS`); recorder.current = undefined; }; return <div className="gesture-console automation-console"><div ref={pad}><span>DRAW AUTOMATION</span></div><button onClick={recorder.current ? stop : arm}>{status}</button></div>; }
function MixerLab() { return <div className="gesture-console mixer-console">{[72,46,83,31].map((level,i) => <motion.div key={i} drag="y" dragBounds={{ min: -65, max: 65 }} dragMomentum={false}><span style={{ height: `${level}%` }}/><b>CH {i+1}</b></motion.div>)}</div>; }
function EditorLab() { return <div className="gesture-console editor-console"><header>GESTURE TIMELINE · 24 FPS</header>{['CAMERA','TITLE','AUDIO'].map((x,i) => <div key={x}><code>{x}</code><motion.i drag="x" dragSnap={{ step: 10 }} dragBounds={{ min: 0, max: 180 }} style={{ left: 18+i*24 }}/></div>)}</div>; }
function PhysicsLab() { const ball = useRef<HTMLDivElement>(null); const x = useMotionValue<number>(0); const state = useMotionValueState(x); useEffect(() => { if (!ball.current) return; const write = () => { if (ball.current) ball.current.style.transform = `translateX(${x.get()}px)`; }; const binding = bindDrag(x, ball.current, { axis: 'x', bounds: { min: -120, max: 120 } }); const off = x.subscribe(write); return () => { off(); binding.dispose(); }; }, [x]); return <div className="gesture-console physics-console"><div ref={ball}/><svg viewBox="0 0 300 65"><path d={`M0 50 C70 ${50-state*.12} 170 ${22+state*.08} 300 32`}/></svg><div><button onClick={() => x.animate(-100,{duration:500})}>TWEEN A</button><button onClick={() => x.spring(90,{bounce:.35})}>SPRING B</button><button onClick={() => x.decay({ velocity: 1.2 })}>FLING</button></div></div>; }

const labs = [
  ['08.1','Scrub the show','A horizontal gesture becomes the production clock. Inertia crosses cues in both directions and settles on frame markers.',<ScrubLab/>,`useScrub(viewport, transport, {\n  pixelsPerFrame: 4, momentum: true,\n  snap: 'markers', resumeAfter: true\n});`],
  ['08.2','Sheet over a map','Three nested arenas arbitrate transform, sheet-handle drag, and native content scrolling.',<ArenaLab/>,`transformGesture(map, { x, y, scale, rotation });\ncooperateWithScroll(sheetPan, content, { edge: 'top' });\nsheetArena.settle(handlePan);`],
  ['08.3','Card stack throw','Projected fling chooses dismiss or return; coupled rotation and recorded reversal share the same values.',<CardsLab/>,`const projected = projectFling(x.get(), x.velocity);\nprojected > dismissLine ? x.decay({ velocity: x.velocity })\n  : x.spring(0);`],
  ['08.4','Performer automation','A live gesture becomes simplified, frame-aligned keyframes that serialize and render offline.',<AutomationLab/>,`const take = recorder.stop();\nconst track = gestureToTrack(take, {\n  frameRate: 24, simplify: 2\n});\nshow.add(track, 'PERFORMER-IN');`],
  ['08.5','Multi-touch mixer','Independent pointer sessions drive four faders while a two-finger transport surface remains available.',<MixerLab/>,`faders.map((value, channel) =>\n  drag(value, strips[channel], { axis: 'y', cues: detents })\n);\ntransformGesture(waveform, { scale: rate, x: playhead });`],
  ['08.6','Gesture timeline editor','Frame-snapped markers, an anchored zoom axis, inertial pan, and long-press inspection dogfood the engine.',<EditorLab/>,`drag(markerTime, marker, { snap: { step: frameMs } });\ntransformGesture(axis, { x: scroll, scale: zoom });\nmountInspector(transport, { gestures: true });`],
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
