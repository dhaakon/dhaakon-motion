import {
  TweenPlayground,
  EasingTracks,
  MotionValueDemo,
  tweenCode,
} from '../examples/TweenExamples';
import { Code } from '../components/Demo';
export default function TweensPage() {
  return (
    <>
      <div className="demo-grid">
        <TweenPlayground />
        <EasingTracks />
        <MotionValueDemo />
      </div>
      <Code>{tweenCode}</Code>
    </>
  );
}
