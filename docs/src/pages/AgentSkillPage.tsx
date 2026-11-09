import { Code } from '../components/Demo';

const install = `# From the dhaakon-motion repository root
mkdir -p "\${CODEX_HOME:-$HOME/.codex}/skills"
ln -s "$PWD/skills/dhaakon-ui-motion" "\${CODEX_HOME:-$HOME/.codex}/skills/dhaakon-ui-motion"`;

const prompt = `Use $dhaakon-ui-motion to build an accessible experiment inspector.
Use Dhaakon UI components and tokens, choose the appropriate motion execution path,
support reduced motion, and verify keyboard operation and lifecycle cleanup.`;

const decision = `UI semantics + appearance
  @dhaakon/ui                 components, provider, semantic tokens
  @dhaakon/ui/app             operational and research composites
  @dhaakon/ui/site            editorial dhaakon.com patterns

Motion execution
  cssMotion                   browser-owned UI presentation
  motion + gesture            reactive and input-driven values
  Timeline + Transport        cues, seeking, frame control, outputs
  /compiled + explicit Wasm   dense numeric Canvas / Three evaluation`;

export default function AgentSkillPage() {
  return (
    <>
      <p className="route-note">
        A version-controlled Codex skill that teaches an agent how the two kits fit together. Its
        canonical source lives at <code>skills/dhaakon-ui-motion/</code>; the skill never grants
        permission to publish, deploy, push, or upgrade a consumer.
      </p>
      <div className="api-entry-list agent-skill-cards">
        <article>
          <h2>Inspect before composing</h2>
          <p>
            The agent checks installed versions and export maps, reads each repository contract, and
            reuses the existing component registry before inventing a substitute.
          </p>
          <small>source and registry versions can differ</small>
        </article>
        <article>
          <h2>Choose an execution path</h2>
          <p>
            CSS, reactive JavaScript, Transport, and Rust/Wasm are distinct tools. The skill routes
            work by interaction and renderer requirements rather than promising one universal
            backend.
          </p>
          <small>UI meaning remains owned by UI state</small>
        </article>
        <article>
          <h2>Return evidence</h2>
          <p>
            Keyboard outcomes, reduced motion, cleanup, package versions, exact frames, and decoded
            pixels are verified when the work makes those contracts relevant.
          </p>
          <small>claims stay proportional to checks</small>
        </article>
      </div>
      <h2>Install from this checkout</h2>
      <p>
        Keep one canonical copy in Git and expose it to Codex with a symlink. Restart or open a new
        agent session after installation so skill discovery refreshes.
      </p>
      <Code>{install}</Code>
      <h2>Invoke it</h2>
      <Code>{prompt}</Code>
      <h2>The decision model</h2>
      <Code>{decision}</Code>
      <p className="route-note">
        The skill contains focused references for UI selection and accessibility, motion ownership
        and timing, accessible exit presence, gestures, production timelines, Canvas/Three, and
        offline verification. Read the reciprocal{' '}
        <a href="https://ui.dhaakon.com/#/agent-skill">Dhaakon UI guide ↗</a> for the component-side
        view.
      </p>
    </>
  );
}
