import { Code } from '../components/Demo';

const claudeInstall = `# From the dhaakon-motion repository root — every project
mkdir -p ~/.claude/skills
ln -s "$PWD/skills/dhaakon-ui-motion" ~/.claude/skills/dhaakon-ui-motion

# …or one consumer project only
mkdir -p /path/to/app/.claude/skills
ln -s "$PWD/skills/dhaakon-ui-motion" /path/to/app/.claude/skills/dhaakon-ui-motion`;

const codexInstall = `# From the dhaakon-motion repository root
mkdir -p "\${CODEX_HOME:-$HOME/.codex}/skills"
ln -s "$PWD/skills/dhaakon-ui-motion" "\${CODEX_HOME:-$HOME/.codex}/skills/dhaakon-ui-motion"`;

const task = `build an accessible experiment inspector.
Use Dhaakon UI components and tokens, choose the appropriate motion execution path,
support reduced motion, and verify keyboard operation and lifecycle cleanup.`;

const claudePrompt = `/dhaakon-ui-motion ${task}`;
const codexPrompt = `Use $dhaakon-ui-motion to ${task}`;

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
        A version-controlled agent skill for Claude Code and Codex that teaches an agent how the two
        kits fit together. Its canonical source lives at <code>skills/dhaakon-ui-motion/</code>; the
        skill never grants permission to publish, deploy, push, or upgrade a consumer.
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
        Keep one canonical copy in Git and expose it with a symlink. Both tools read the same{' '}
        <code>SKILL.md</code> and references; only the location and invocation differ. Open a new
        agent session after installing so skill discovery refreshes.
      </p>
      <div className="api-entry-list agent-skill-cards agent-skill-tools">
        <article>
          <h2>Claude Code</h2>
          <p>
            Personal skills live in <code>~/.claude/skills/</code>; a consumer project can carry its
            own in <code>.claude/skills/</code>. Claude loads the skill when a task matches its
            description, or on demand with <code>/dhaakon-ui-motion</code>.
          </p>
          <small>metadata from SKILL.md frontmatter</small>
        </article>
        <article>
          <h2>Codex</h2>
          <p>
            Skills live in <code>$CODEX_HOME/skills/</code> (default <code>~/.codex</code>). Name it
            in the prompt as <code>$dhaakon-ui-motion</code>; Codex reads each repository&rsquo;s{' '}
            <code>AGENTS.md</code> natively.
          </p>
          <small>display name and default prompt from agents/openai.yaml</small>
        </article>
      </div>
      <h3>Claude Code</h3>
      <Code>{claudeInstall}</Code>
      <Code>{claudePrompt}</Code>
      <h3>Codex</h3>
      <Code>{codexInstall}</Code>
      <Code>{codexPrompt}</Code>
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
