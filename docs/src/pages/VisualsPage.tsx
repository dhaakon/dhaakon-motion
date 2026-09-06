import { HeroMotionGraphic } from '../HeroMotionGraphic';
import { AmbientShader } from '../AmbientShader';
import { DemoViewport } from '../components/DemoViewport';
export default function VisualsPage() {
  return (
    <>
      <DemoViewport label="Hero motion graphic" height={520}>
        <HeroMotionGraphic />
      </DemoViewport>
      <DemoViewport label="Procedural shader" height={320}>
        <div className="shader-study">
          <AmbientShader
            variant="field"
            scheme="dark"
            tint={['#2d62ff', '#8a5cff']}
            intensity={0.7}
            speed={0.8}
            seed={1}
          />
          <h2>Field / 01</h2>
          <p>One isolated shader study. No background GPU work on the rest of the docs.</p>
        </div>
      </DemoViewport>
    </>
  );
}
