import { useState } from 'react';
import { Button } from '@dhaakon/ui';
import { Motion, motion } from '@dhaakon/motion/react';
import { Demo } from '../components/Demo';

function ReactComposition() {
  const [run, setRun] = useState(0);
  return (
    <Demo
      title="React composition"
      note="motion.* writes styles on the frame loop, so the component tree does not rerender at 60fps."
    >
      <div className="composition">
        {['Frame', 'Cue', 'Take'].map((label, index) => (
          <motion.article
            key={`${label}-${run}`}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: index * 80, duration: 440 }}
          >
            <small>0{index + 1}</small>
            <b>{label}</b>
            <span>Ready</span>
          </motion.article>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setRun((value) => value + 1);
        }}
      >
        Recompose ↻
      </Button>
    </Demo>
  );
}

function RenderPropDemo() {
  const [run, setRun] = useState(0);
  return (
    <Demo
      title="Render prop"
      note="Use Motion when animation values belong in markup, SVG, canvas props, or component composition."
    >
      <div className="dial" key={run}>
        <Motion from={0} to={100} duration={900}>
          {(value) => (
            <>
              <svg viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="48" />
                <circle
                  className="dial-progress"
                  cx="60"
                  cy="60"
                  r="48"
                  style={{ strokeDashoffset: 302 - (302 * value) / 100 }}
                />
              </svg>
              <strong>{Math.round(value)}%</strong>
            </>
          )}
        </Motion>
      </div>
      <Button variant="outline" size="sm" onClick={() => setRun((n) => n + 1)}>
        Replay value ↻
      </Button>
    </Demo>
  );
}

function SceneStateExample() {
  const [mode, setMode] = useState<'rehearsal' | 'preview' | 'live'>('rehearsal');
  const live = mode === 'live';
  const preview = mode === 'preview';
  return (
    <div className="state-example">
      <div className="scene-stage">
        <div className="scene-grid" />
        <motion.div
          className="camera-frame"
          initial={{ x: -26, opacity: 0, scale: 0.96 }}
          animate={{
            x: live ? 30 : preview ? 14 : 0,
            opacity: 1,
            scale: live ? 1.04 : 1,
            borderColor: live ? '#ff5a1f' : preview ? '#2d62ff' : '#f0eee8',
          }}
          transition={{ duration: 560 }}
        >
          <span>CAM 02</span>
          <b>{mode.toUpperCase()}</b>
        </motion.div>
        <motion.div
          className="lower-third"
          initial={{ y: 26, opacity: 0 }}
          animate={{ y: live ? 0 : 18, opacity: live ? 1 : 0.32 }}
          transition={{ duration: 440 }}
        >
          SCENE 04 <i /> TAKE 02
        </motion.div>
        <motion.i
          className="tally"
          initial={{ scale: 0 }}
          animate={{
            scale: live ? 1 : 0.62,
            backgroundColor: live ? '#ff5a1f' : preview ? '#2d62ff' : '#777770',
          }}
        />
      </div>
      <div className="state-controls">
        {(['rehearsal', 'preview', 'live'] as const).map((state) => (
          <Button
            key={state}
            variant={mode === state ? 'accent' : 'outline'}
            size="sm"
            onClick={() => setMode(state)}
          >
            {state}
          </Button>
        ))}
      </div>
    </div>
  );
}

const reactCode = `import { motion, MotionConfig } from '@dhaakon/motion/react';

<MotionConfig transition={{ duration: 360 }}>
  <motion.article
    initial={{ y: 24, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
  >
    <CourseCard />
  </motion.article>
</MotionConfig>`;

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

export {
  ReactComposition,
  RenderPropDemo,
  SceneStateExample,
  reactCode,
  revealCode,
  stateReactCode,
};
