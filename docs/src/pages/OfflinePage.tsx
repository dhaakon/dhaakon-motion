import { OfflineRenderLab, exampleCode } from '../labs/OfflineRenderLab';
import { Example } from '../components/Demo';
export default function OfflinePage() {
  return (
    <>
      <Example
        title="Deterministic state sampling"
        description="Two freshly constructed timelines produce 49 inclusive state samples, then compare hashes. This tests state determinism, not pixel identity or separate worker processes."
        code={exampleCode}
      >
        <OfflineRenderLab />
      </Example>
      <a className="comparison-callout" href="/svg-cue-sheet">
        <span>SEE THE ACTUAL VIDEO</span>
        <h2>MP4 × live tween / 24 fps ↗</h2>
        <p>
          Compare the 24-second, 1920 × 1080 H.264 master with its 23-target SVG timeline. Browser
          decode scheduling and lossy compression are distinct from deterministic state sampling.
        </p>
      </a>
    </>
  );
}
