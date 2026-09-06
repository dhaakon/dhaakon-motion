import { MultiOutputLab, exampleCode } from '../labs/MultiOutputLab';
import { CanvasSignalExample, canvasReactCode } from '../examples/CanvasExample';
import { Example } from '../components/Demo';
import { DemoViewport } from '../components/DemoViewport';
export default function OutputsPage() {
  return (
    <>
      <Example
        title="One transport, multiple destinations"
        description="DOM, CSS 3D, and Canvas render live. Audio, DMX, and OSC/MIDI readouts are simulations; this demo does not connect to hardware."
        code={exampleCode}
      >
        <DemoViewport label="Output bus">
          <MultiOutputLab />
        </DemoViewport>
      </Example>
      <Example
        title="Canvas signal"
        description="A MotionValue subscription draws a waveform without React updates for every frame."
        code={canvasReactCode}
      >
        <DemoViewport label="Canvas signal">
          <CanvasSignalExample />
        </DemoViewport>
      </Example>
    </>
  );
}
