import { Code } from '../components/Demo';
const entries = [
  [
    '@dhaakon/motion',
    'Tween, Track, Timeline, Transport, MotionValue, physics, timecode, cue sheets, offline frames.',
    'src/index.ts',
  ],
  [
    '@dhaakon/motion/react',
    'motion.*, Motion, Reveal, hooks, and declarative transport ownership.',
    'src/react.tsx',
  ],
  [
    '@dhaakon/motion/gesture',
    'Pointer arena, drag, pinch, keyboard controls, velocity, and recording.',
    'src/gesture/index.ts',
  ],
  [
    '@dhaakon/motion/three',
    'Three.js property bindings, camera tracks, and ordered rendering.',
    'src/three.ts',
  ],
  ['@dhaakon/motion/audio', 'Realtime and offline Web Audio adapters.', 'src/audio.ts'],
  [
    '@dhaakon/motion/midi',
    'Live MIDI cue output. Requires an application-owned port.',
    'src/midi.ts',
  ],
  [
    '@dhaakon/motion/testing',
    'Manual clocks, frame snapshots, and timeline assertions.',
    'src/testing.ts',
  ],
  [
    '@dhaakon/motion/devtools',
    'Optional inspection panel and debug instrumentation.',
    'src/devtools.ts',
  ],
];
export default function ApiPage() {
  return (
    <>
      <div className="api-entry-list">
        {entries.map(([name, description, file]) => (
          <article key={name}>
            <h2>
              <code>{name}</code>
            </h2>
            <p>{description}</p>
            <small>{file}</small>
          </article>
        ))}
      </div>
      <h2>Development contract</h2>
      <p>
        Author frame-based positions with an explicit frame rate on the timeline. Outputs render
        after value writes. Dispose transports, gesture bindings, and render resources when their
        owner unmounts.
      </p>
      <Code>
        {
          'npm run check        # types + source tests + built entry points\nnpm run docs:check   # route build + asset budgets\nnpm run docs:smoke   # real Chrome route / cleanup checks'
        }
      </Code>
      <p className="route-note">
        Repository contributors: start with <code>docs/ARCHITECTURE.md</code>. No fixed size claims
        or competitor rankings are used here; measure the current build. For consumer interface
        work, use the <a href="/agent-skill">Dhaakon UI + Motion agent skill</a>.
      </p>
    </>
  );
}
