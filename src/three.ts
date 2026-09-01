import type * as THREE from 'three';
import { Track, type Keyframe, type TrackOptions } from './track';
import type { MotionValueShape } from './interpolate';
import type { FrameInfo, TransportOutput } from './transport';

/** One `renderer.render()` (or `composer.render()`) per tick, after every value for that instant has been written. */
export function threeOutput(options: {
  renderer: Pick<THREE.WebGLRenderer, 'render'>;
  scene: THREE.Scene;
  camera: THREE.Camera;
  composer?: { render(): void };
  onBeforeRender?(info: FrameInfo): void;
  name?: string;
}): TransportOutput {
  return {
    name: options.name ?? 'three',
    onTick(info) {
      options.onBeforeRender?.(info);
      if (options.composer) options.composer.render();
      else options.renderer.render(options.scene, options.camera);
    },
  };
}

type ObjectLike = Pick<THREE.Object3D, 'position' | 'rotation' | 'scale'>;
export interface ObjectKeyframeValue {
  [key: string]: MotionValueShape | undefined;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
}
/** A `Track` that writes position/rotation/scale onto any object with those three vector-like properties. */
export function objectTrack(
  object: ObjectLike,
  keyframes: Keyframe<ObjectKeyframeValue>[],
  options: Omit<TrackOptions<ObjectKeyframeValue>, 'keyframes' | 'apply' | 'target'> = {},
): Track<ObjectKeyframeValue> {
  return new Track<ObjectKeyframeValue>({
    ...options,
    keyframes,
    apply: (value) => {
      if (value.position) object.position.set(...value.position);
      if (value.rotation) object.rotation.set(...value.rotation);
      if (value.scale != null) {
        if (typeof value.scale === 'number') object.scale.setScalar(value.scale);
        else object.scale.set(...value.scale);
      }
    },
  });
}

export type UniformValue = number | string | number[];
type UniformHost = { uniforms: Record<string, { value: unknown }> };
function applyUniformValue(uniforms: Record<string, { value: unknown }>, key: string, value: UniformValue) {
  const uniform = uniforms[key];
  if (!uniform) return;
  const current = uniform.value as { setStyle?: (style: string) => void; fromArray?: (a: number[]) => void } | undefined;
  if (typeof value === 'string' && current?.setStyle) { current.setStyle(value); return; }
  if (Array.isArray(value) && current?.fromArray) { current.fromArray(value); return; }
  uniform.value = value;
}
/** A `Track` that writes named shader uniforms — a color string calls `.setStyle()` on the uniform's current value, an array calls `.fromArray()`, anything else is assigned directly. */
export function uniformTrack(
  material: UniformHost,
  keyframes: Keyframe<Record<string, UniformValue>>[],
  options: Omit<TrackOptions<Record<string, UniformValue>>, 'keyframes' | 'apply' | 'target'> = {},
): Track<Record<string, UniformValue>> {
  return new Track<Record<string, UniformValue>>({
    ...options,
    keyframes,
    apply: (value) => { for (const [key, v] of Object.entries(value)) applyUniformValue(material.uniforms, key, v); },
  });
}

type CameraLike = Pick<THREE.PerspectiveCamera, 'position' | 'updateProjectionMatrix' | 'rotateZ'> & { fov: number; lookAt(x: number, y: number, z: number): void };
export interface CameraKeyframeValue {
  [key: string]: MotionValueShape | undefined;
  position?: [number, number, number];
  target?: [number, number, number];
  fov?: number;
  roll?: number;
}
/** A `Track` for a perspective camera: position, look-at target, field of view, and roll (rotation about the view axis). */
export function cameraTrack(
  camera: CameraLike,
  keyframes: Keyframe<CameraKeyframeValue>[],
  options: Omit<TrackOptions<CameraKeyframeValue>, 'keyframes' | 'apply' | 'target'> = {},
): Track<CameraKeyframeValue> {
  return new Track<CameraKeyframeValue>({
    ...options,
    keyframes,
    apply: (value) => {
      if (value.position) camera.position.set(...value.position);
      if (value.fov != null) { camera.fov = value.fov; camera.updateProjectionMatrix(); }
      if (value.target) camera.lookAt(...value.target);
      if (value.roll != null) camera.rotateZ(value.roll);
    },
  });
}

/** A helper for `renderFrames`: captures the renderer's canvas as a `Blob` after each tick. */
export function frameCapture(renderer: { domElement: { toBlob?(callback: (blob: Blob | null) => void, type?: string, quality?: number): void } }) {
  return (): Promise<Blob> => new Promise((resolve, reject) => {
    const canvas = renderer.domElement;
    if (!canvas.toBlob) { reject(new Error("frameCapture: the renderer's canvas has no toBlob().")); return; }
    canvas.toBlob((blob) => { if (blob) resolve(blob); else reject(new Error('frameCapture: toBlob() returned null.')); });
  });
}
