import { useEffect, useRef, useState } from 'react';
import { Badge, Button } from '@dhaakon/ui';
import { Easing, MotionValue, Timeline, Tween, interpolate, scheduler } from '@dhaakon/motion';
import { Motion, MotionConfig, Reveal, motion, useMotionValue, useMotionValueState } from '@dhaakon/motion/react';

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
  const value = useMotionValue(0); const current = useMotionValueState(value);
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

function Demo({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return <article className="demo"><header><span>LIVE</span><h3>{title}</h3><p>{note}</p></header><div className="demo-body">{children}</div></article>;
}

export function App({ version }: { version: string }) {
  return <MotionConfig transition={{ duration: 360, easing: 'dhaakon' }}>
    <header className="site-head"><a className="wordmark" href="#top"><i>◇</i> DHAAKON / MOTION</a><nav><a href="#playground">Playground</a><a href="#react">React</a><a href="#api">API</a></nav><Badge tone="accent">v{version}</Badge></header>
    <main id="top">
      <section className="hero"><div className="hero-copy"><p className="eyebrow">[ MOTION SYSTEM 02 ] · BUILT FROM DHAAK-ANIM</p><h1>Movement with<br/><em>direction.</em></h1><p className="lead">A compact tween engine for interfaces, timelines, canvas, and React compositions. One frame loop. Zero core dependencies.</p><div className="install"><code>npm i @dhaakon/motion</code><span>↗ VERDACCIO :21760</span></div></div><HeroOrbit /></section>
      <section className="metrics"><div><strong>1</strong><span>shared frame loop</span></div><div><strong>0</strong><span>core dependencies</span></div><div><strong>2</strong><span>entry points</span></div><div><strong>{scheduler.size}</strong><span>active right now</span></div></section>
      <Reveal as="section" className="section" id="playground" amount={0.12}><SectionTitle number="01" title="Core playground" subtitle="The old syntax remains familiar; the clock underneath is entirely new."/><div className="demo-grid"><TweenPlayground/><EasingTracks/><TimelinePlayground/><MotionValueDemo/></div></Reveal>
      <Reveal as="section" className="section inverse" id="react" amount={0.08}><SectionTitle number="02" title="React, composed" subtitle="Declarative when it helps. Imperative at the frame boundary."/><div className="demo-grid"><ReactComposition/><RenderPropDemo/></div><div className="code-grid"><div><h3>DOM composition</h3><p>Use <code>motion.*</code> for transform and style animation without a React render on every frame.</p><Code>{reactCode}</Code></div><div><h3>Reveal on scroll</h3><p><code>Reveal</code>, <code>whileInView</code>, and <code>useInView</code> share the same observer and respect reduced-motion preferences.</p><Code>{revealCode}</Code></div></div></Reveal>
      <Reveal as="section" className="section" id="api" amount={0.08}><SectionTitle number="03" title="Small surface, deep control" subtitle="Every primitive can be used alone or nested into a composition."/><div className="api-grid"><Api name="Tween" text="Play, pause, stop, cancel, reverse, seek, repeat, yoyo, delay, and await finished."/><Api name="Timeline" text="Sequence or overlap tweens with milliseconds, labels, <, >, and relative offsets."/><Api name="MotionValue" text="Observable animation state for React, canvas, WebGL, audio, and custom renderers."/><Api name="motion.*" text="Typed React elements with animate, whileInView, viewport, and reduced-motion handling."/><Api name="interpolate" text="Numbers, unit strings, colors, arrays, and deeply nested objects."/><Api name="FrameScheduler" text="One requestAnimationFrame for every active tween; injectable for deterministic tests."/></div><div className="code-grid"><Code>{tweenCode}</Code><Code>{timelineCode}</Code></div></Reveal>
      <Reveal as="section" className="principles" amount={0.2}><p className="eyebrow">[ OPERATING PRINCIPLES ]</p><div><h2>Motion clarifies state.</h2><h2>Composition beats choreography.</h2><h2>Reduced motion is a first-class mode.</h2></div></Reveal>
    </main>
    <footer><span>◇ DHAAKON MOTION</span><span>MIT · TYPESCRIPT · REACT 18/19</span><a href="http://dhaakon-ubuntu:21724/dhaakon-ubuntu/dhaakon-motion">SOURCE ↗</a></footer>
  </MotionConfig>;
}

function HeroOrbit() {
  return <div className="hero-art"><div className="orbit orbit-a"/><div className="orbit orbit-b"/><motion.div className="hero-core" initial={{ rotate: 0, scale: .92 }} animate={{ rotate: 360, scale: 1 }} transition={{ duration: 9000, easing: 'linear', repeat: Infinity }}><span>DM</span></motion.div><p><b>FRAME</b><br/>SYNCHRONIZED</p></div>;
}
function SectionTitle({ number, title, subtitle }: { number: string; title: string; subtitle: string }) { return <header className="section-title"><p>[ {number} ]</p><div><h2>{title} ↘</h2><p>{subtitle}</p></div></header>; }
function Api({ name, text }: { name: string; text: string }) { return <article><span>+</span><h3>{name}</h3><p>{text}</p></article>; }
