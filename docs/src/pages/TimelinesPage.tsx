import { TimelinePlayground, CueSequenceExample, cueReactCode } from '../examples/TimelineExamples';
import { NestedCueLab, exampleCode } from '../labs/NestedCueLab';
import { Example } from '../components/Demo';
import { DemoViewport } from '../components/DemoViewport';
export default function TimelinesPage() {
  return (
    <>
      <TimelinePlayground />
      <Example
        title="Overlapping cue stack"
        description="Four editorial cues share one labeled timeline."
        code={cueReactCode}
      >
        <CueSequenceExample />
      </Example>
      <Example
        title="Nested cue orchestration"
        description="Inspect nested sequences, repeat regions, and reverse cue traversal."
        code={exampleCode}
      >
        <DemoViewport label="Nested cues">
          <NestedCueLab />
        </DemoViewport>
      </Example>
    </>
  );
}
