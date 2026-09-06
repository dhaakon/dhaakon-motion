import { InspectionLab, exampleCode } from '../labs/InspectionLab';
import { Example } from '../components/Demo';
export default function InspectorPage() {
  return (
    <Example
      title="Timeline inspection + test bench"
      description="Step between samples and inject a deliberate assertion failure to see its diagnostic output."
      code={exampleCode}
    >
      <InspectionLab />
    </Example>
  );
}
