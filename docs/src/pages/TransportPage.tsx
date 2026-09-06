import { TimecodeConformLab, exampleCode } from '../labs/TimecodeConformLab';
import { Example } from '../components/Demo';
export default function TransportPage() {
  return (
    <Example
      title="SMPTE conform desk"
      description="A 29.97 DF master with nested graphics, markers, cue events, looping, and exact frame steps."
      code={exampleCode}
    >
      <TimecodeConformLab />
    </Example>
  );
}
