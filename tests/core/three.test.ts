import { test, expect, vi } from 'vitest';
import { Transport } from '@dhaakon/motion';
import { createTestScheduler } from '@dhaakon/motion/testing';
import { threeOutput, objectTrack, uniformTrack, cameraTrack } from '@dhaakon/motion/three';

test('threeOutput renders exactly once per tick and never while paused', () => {
  const render = vi.fn();
  const output = threeOutput({ renderer: { render }, scene: {} as never, camera: {} as never });
  const { driver, scheduler: loop } = createTestScheduler();
  const transport = new Transport({ scheduler: loop, duration: 100 });
  transport.attach(output);
  expect(render).not.toHaveBeenCalled();
  transport.play();
  driver.step(10);
  expect(render).toHaveBeenCalledTimes(1);
  transport.pause();
  driver.step(9999);
  expect(render).toHaveBeenCalledTimes(1);
});

test('objectTrack writes position/rotation/scale onto a stub Object3D shape', () => {
  const object = { position: { set: vi.fn() }, rotation: { set: vi.fn() }, scale: { set: vi.fn(), setScalar: vi.fn() } };
  const t = objectTrack(object as never, [
    { at: 0, value: { position: [0, 0, 0], scale: 1 } },
    { at: 100, value: { position: [10, 20, 30], scale: 2 }, easing: 'linear' },
  ]);
  t.sampleAt(50);
  expect(object.position.set).toHaveBeenCalledWith(5, 10, 15);
  expect(object.scale.setScalar).toHaveBeenCalledWith(1.5);
});

test('uniformTrack writes numeric uniforms directly and color uniforms via setStyle', () => {
  const color = { setStyle: vi.fn() };
  const material = { uniforms: { uEnergy: { value: 0 }, uColor: { value: color } } };
  const t = uniformTrack(material as never, [
    { at: 0, value: { uEnergy: 0, uColor: '#000000' } },
    { at: 100, value: { uEnergy: 10, uColor: '#ffffff' }, easing: 'linear' },
  ]);
  t.sampleAt(0);
  expect(material.uniforms.uEnergy.value).toBe(0);
  expect(color.setStyle).toHaveBeenCalledWith('#000000');
});

test('cameraTrack writes position, fov (with a projection-matrix update), and look-at target', () => {
  const camera = { position: { set: vi.fn() }, updateProjectionMatrix: vi.fn(), rotateZ: vi.fn(), lookAt: vi.fn(), fov: 50 };
  const t = cameraTrack(camera as never, [
    { at: 0, value: { position: [0, 0, 10], fov: 50, target: [0, 0, 0] } },
    { at: 100, value: { position: [0, 0, 5], fov: 30, target: [0, 1, 0] }, easing: 'linear' },
  ]);
  t.sampleAt(100);
  expect(camera.position.set).toHaveBeenCalledWith(0, 0, 5);
  expect(camera.fov).toBe(30);
  expect(camera.updateProjectionMatrix).toHaveBeenCalled();
  expect(camera.lookAt).toHaveBeenCalledWith(0, 1, 0);
});

test('camera roll does not accumulate when sampling the same frame or seeking backward', () => {
  let roll = 0;
  const camera = { position: { set() {} }, updateProjectionMatrix() {}, rotateZ(value: number) { roll += value; }, lookAt() { roll = 0; }, fov: 50 };
  const track = cameraTrack(camera as never, [{ at: 0, value: { roll: 0 } }, { at: 100, value: { roll: 1 }, easing: 'linear' }]);
  track.sampleAt(50); track.sampleAt(50);
  expect(roll).toBe(.5);
  track.sampleAt(20);
  expect(roll).toBeCloseTo(.2);
});
