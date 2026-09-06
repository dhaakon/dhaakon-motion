import { GestureProductionLabs } from '../GestureLabs';
export default function GestureLabsPage() {
  return (
    <>
      <GestureProductionLabs />
      <p className="route-note">
        Benchmarks are environment-specific. Reproduce the synthetic velocity benchmark with{' '}
        <code>node docs/scripts/gesture-bench.mjs</code>; it is not a browser rendering score.
      </p>
    </>
  );
}
