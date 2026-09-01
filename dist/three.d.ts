import * as THREE from 'three';
import { B as MotionValueShape, K as Keyframe, b as TrackOptions, c as Track, g as FrameInfo, a as TransportOutput } from './track-cepHoOcR.js';

/** One `renderer.render()` (or `composer.render()`) per tick, after every value for that instant has been written. */
declare function threeOutput(options: {
    renderer: Pick<THREE.WebGLRenderer, 'render'>;
    scene: THREE.Scene;
    camera: THREE.Camera;
    composer?: {
        render(): void;
    };
    onBeforeRender?(info: FrameInfo): void;
    name?: string;
}): TransportOutput;
type ObjectLike = Pick<THREE.Object3D, 'position' | 'rotation' | 'scale'>;
interface ObjectKeyframeValue {
    [key: string]: MotionValueShape | undefined;
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: number | [number, number, number];
}
/** A `Track` that writes position/rotation/scale onto any object with those three vector-like properties. */
declare function objectTrack(object: ObjectLike, keyframes: Keyframe<ObjectKeyframeValue>[], options?: Omit<TrackOptions<ObjectKeyframeValue>, 'keyframes' | 'apply' | 'target'>): Track<ObjectKeyframeValue>;
type UniformValue = number | string | number[];
type UniformHost = {
    uniforms: Record<string, {
        value: unknown;
    }>;
};
/** A `Track` that writes named shader uniforms — a color string calls `.setStyle()` on the uniform's current value, an array calls `.fromArray()`, anything else is assigned directly. */
declare function uniformTrack(material: UniformHost, keyframes: Keyframe<Record<string, UniformValue>>[], options?: Omit<TrackOptions<Record<string, UniformValue>>, 'keyframes' | 'apply' | 'target'>): Track<Record<string, UniformValue>>;
type CameraLike = Pick<THREE.PerspectiveCamera, 'position' | 'updateProjectionMatrix' | 'rotateZ'> & {
    fov: number;
    lookAt(x: number, y: number, z: number): void;
};
interface CameraKeyframeValue {
    [key: string]: MotionValueShape | undefined;
    position?: [number, number, number];
    target?: [number, number, number];
    fov?: number;
    roll?: number;
}
/** A `Track` for a perspective camera: position, look-at target, field of view, and roll (rotation about the view axis). */
declare function cameraTrack(camera: CameraLike, keyframes: Keyframe<CameraKeyframeValue>[], options?: Omit<TrackOptions<CameraKeyframeValue>, 'keyframes' | 'apply' | 'target'>): Track<CameraKeyframeValue>;
/** A helper for `renderFrames`: captures the renderer's canvas as a `Blob` after each tick. */
declare function frameCapture(renderer: {
    domElement: {
        toBlob?(callback: (blob: Blob | null) => void, type?: string, quality?: number): void;
    };
}): () => Promise<Blob>;

export { type CameraKeyframeValue, type ObjectKeyframeValue, type UniformValue, cameraTrack, frameCapture, objectTrack, threeOutput, uniformTrack };
