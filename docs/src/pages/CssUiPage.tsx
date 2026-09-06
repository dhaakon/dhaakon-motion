import { CssUiLab } from '../labs/CssUiLab';
import { Code } from '../components/Demo';

const pattern = `import { Card, tokens } from '@dhaakon/ui';
import { createCssMotionTokens } from '@dhaakon/motion/css';
import { CssMotionConfig, cssMotion } from '@dhaakon/motion/react';

const uiMotion = createCssMotionTokens(tokens.motion);
const variants = {
  closed: { opacity: 0, transform: 'translateY(8px)' },
  open: { opacity: 1, transform: 'translateY(0px)' },
};

<CssMotionConfig tokens={uiMotion}>
  <cssMotion.div
    initial={false}
    animate={open ? 'open' : 'closed'}
    variants={variants}
    transition={open ? 'surface.enter' : 'surface.exit'}
  >
    <Card>Research session</Card>
  </cssMotion.div>
</CssMotionConfig>

// Disclosure semantics remain with your UI component:
// aria-expanded on the trigger; aria-controls links to an instance-safe panel ID.
// On close, restore focus if needed and immediately make the panel inert/aria-hidden.
// Keep it rendered through exit; hide it only after onMotionComplete.
// If reopened, stale completion callbacks are invalidated automatically.`;

export default function CssUiPage() {
  return (
    <>
      <p className="route-note">
        CSS for interfaces. Structured values for graphics. One motion vocabulary with explicit
        execution paths—not a universal renderer.
      </p>
      <CssUiLab />
      <div className="css-ui-principles">
        <section>
          <p className="eyebrow">01 / AUTHOR</p>
          <h3>Speak CSS, not matrices.</h3>
          <p>
            Transforms, opacity, colors, percentages, calc() and custom properties stay CSS values.
            The browser decides interpolation support; unregistered custom properties can be
            discrete. Use explicit units for dimensional values.
          </p>
        </section>
        <section>
          <p className="eyebrow">02 / COORDINATE</p>
          <h3>The UI owns meaning.</h3>
          <p>
            Dhaakon UI provides the accessible button, card and timing tokens. Disclosure state,
            focus and presence stay in React. The motion layer handles interruption, reduced motion
            and native-effect cleanup.
          </p>
        </section>
        <section>
          <p className="eyebrow">03 / EXECUTE</p>
          <h3>Use the right path.</h3>
          <p>
            cssMotion uses browser-owned Web Animations, or applies final CSS immediately when
            unavailable. Existing motion and Transport remain the JS-driven path. Canvas and
            Three.js can opt into the separate Rust/Wasm evaluator.
          </p>
        </section>
      </div>
      <details className="show-code" open>
        <summary>Shared dhaakon-ui tokens and CSS variants</summary>
        <Code>{pattern}</Code>
      </details>
      <p className="route-note">
        This first slice animates presentation, not intrinsic height. Opening changes layout
        immediately; opacity and transform animate afterward. It does not implement layout
        measurement, automatic exit presence, spring-to-WAAPI compilation or transport-driven CSS
        seeking. Do not independently animate the same properties through CSS transitions or another
        library.
      </p>
      <p className="route-note">
        Browser-owned playback is not a blanket GPU guarantee.{' '}
        <a href="https://web.dev/articles/animations-guide" target="_blank" rel="noreferrer">
          Transforms and opacity are compositor-friendly candidates ↗
        </a>
        . Compare that path with the <a href="/rust/experimental">Rust / Wasm graphics lab ↗</a>.
      </p>
    </>
  );
}
