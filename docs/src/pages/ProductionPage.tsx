import { ShowstopperLab } from '../ShowstopperLab';
import { showstopperCode } from '../examples/threeCode';
import { Code } from '../components/Demo';
import { DemoViewport } from '../components/DemoViewport';
export default function ProductionPage() {
  return (
    <>
      <DemoViewport label="Stage 12" height={640}>
        <ShowstopperLab />
      </DemoViewport>
      <p className="route-note">
        The WebGL stage is real; production cue packets and audio meters are visualized here without
        connecting external devices.
      </p>
      <details className="show-code">
        <summary>Integrated production pattern</summary>
        <Code>{showstopperCode}</Code>
      </details>
    </>
  );
}
