const threeReactCode = `import { MotionValue, Timeline, Tween } from '@dhaakon/motion';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

function ThreeProductionSequence() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const { renderer, scene, camera, rig, material, lights, particles } =
      createThreeScene(canvas.current!);

    const frame = new MotionValue({
      camera: { position: [0, 1, 9], fov: 44 },
      rig: { rotation: [0, 0, 0], scale: 0.7 },
      shader: { energy: 0.2, accent: '#ff5a1f' },
      light: { key: 20, fill: 12, exposure: 0.7 },
      particles: { size: 0.01, opacity: 0.15 }
    });

    // One subscription can write any property in any renderer.
    const unsubscribe = frame.subscribe(() => {
      const value = frame.get();
      camera.position.fromArray(value.camera.position);
      camera.fov = value.camera.fov;
      rig.rotation.fromArray(value.rig.rotation);
      rig.scale.setScalar(value.rig.scale);
      material.uniforms.uEnergy.value = value.shader.energy;
      material.uniforms.uAccent.value.setStyle(value.shader.accent);
      lights.key.intensity = value.light.key;
      lights.fill.intensity = value.light.fill;
      renderer.toneMappingExposure = value.light.exposure;
      particles.material.size = value.particles.size;
      particles.material.opacity = value.particles.opacity;
    });

    const show = new Timeline({
      repeat: Infinity,
      yoyo: true,
      onUpdate: () => renderer.render(scene, camera)
    }).add(new Tween({
      from: frame.get(),
      to: finaleState,
      duration: 9200,
      easing: 'dhaakon',
      onUpdate: value => frame.set(value)
    }), 0).play();

    return () => { show.stop(); unsubscribe(); renderer.dispose(); };
  }, []);

  return <canvas ref={canvas} />;
}`;

const showstopperCode = `// One portable show file is the source of truth.
const timeline = loadSheet(showSheet, {
  targets: { camera, rig, energy, exposure, overlay, audio },
  cues: { take: routeSwitcher, black: blackout }
});

const transport = new Transport({
  root: timeline, frameRate: 24, snap: true,
  loop: ['0f', '144f']
});

transport.attach(threeOutput({ renderer, scene, camera }));
transport.attach(drawOutput(drawAudioScope));
transport.attach(audioOutput(audioContext));
transport.attach(signalOutput(sendOSC));
transport.attach(midiOutput(midiPort));
const trace = transport.trace({ capacity: 240 });

// React owns lifecycle and controls, not the frame loop.
<Transport transport={transport}>
  <ProgramMonitor />
  <FrameControls />
  <TimelineInspector trace={trace} />
</Transport>

// The same cue sheet renders without a wall clock.
await renderFrames(loadSheet(showSheet, bindings), captureFrame, {
  frameRate: 24, to: '144f'
});`;
export { threeReactCode, showstopperCode };
