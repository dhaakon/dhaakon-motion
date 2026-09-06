import { SerializableShowLab, exampleCode } from '../labs/SerializableShowLab';
import { Example } from '../components/Demo';
export default function CueSheetsPage() {
  return (
    <>
      <Example
        title="Portable show + scene state"
        description="Edit JSON and validate it before replacing the running show. Targets stay in application code."
        code={exampleCode}
      >
        <SerializableShowLab />
      </Example>
      <p className="route-next">
        <a href="/svg-cue-sheet">Explore the advanced layered SVG cue sheet ↗</a>
      </p>
    </>
  );
}
