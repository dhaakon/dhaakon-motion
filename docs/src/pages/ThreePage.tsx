import { ThreeShowcase } from '../ThreeShowcase';
import { threeReactCode } from '../examples/threeCode';
import { Code } from '../components/Demo';
import { DemoViewport } from '../components/DemoViewport';
export default function ThreePage() {
  return (
    <>
      <DemoViewport label="Three.js renderer" height={560}>
        <ThreeShowcase />
      </DemoViewport>
      <div className="channel-grid">
        {[
          ['Camera', 'position · target · FOV'],
          ['Scene graph', 'position · rotation · scale'],
          ['GPU shader', 'time · energy · color'],
          ['Lighting', 'intensity · exposure · fog'],
          ['Particles', 'size · opacity · transform'],
          ['Interface', 'phase · clock · scrubber'],
        ].map(([title, text]) => (
          <div key={title}>
            <b>{title}</b>
            <small>{text}</small>
          </div>
        ))}
      </div>
      <Code>{threeReactCode}</Code>
    </>
  );
}
