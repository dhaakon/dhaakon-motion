import {
  ReactComposition,
  RenderPropDemo,
  SceneStateExample,
  reactCode,
  revealCode,
  stateReactCode,
} from '../examples/ReactExamples';
import { ReactLifecycleLab, exampleCode } from '../labs/ReactLifecycleLab';
import { Code, Example } from '../components/Demo';
import { DemoViewport } from '../components/DemoViewport';
export default function ReactPage() {
  return (
    <>
      <div className="demo-grid">
        <ReactComposition />
        <RenderPropDemo />
      </div>
      <Code>{reactCode}</Code>
      <Example
        title="State-driven scene"
        description="Application state selects rehearsal, preview, or live."
        code={stateReactCode}
      >
        <SceneStateExample />
      </Example>
      <Example
        title="React ownership"
        description="Mount and remove a sequence branch while the transport runs."
        code={exampleCode}
      >
        <DemoViewport label="React lifecycle">
          <ReactLifecycleLab />
        </DemoViewport>
      </Example>
      <details className="show-code">
        <summary>Scroll reveal pattern</summary>
        <p>Reveal respects reduced motion and observes visibility.</p>
        <Code>{revealCode}</Code>
      </details>
    </>
  );
}
