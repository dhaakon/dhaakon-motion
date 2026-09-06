// src/three.ts
import { Track } from "@dhaakon/motion";
function threeOutput(options) {
  return {
    name: options.name ?? "three",
    onTick(info) {
      options.onBeforeRender?.(info);
      if (options.composer) options.composer.render();
      else options.renderer.render(options.scene, options.camera);
    }
  };
}
function objectTrack(object, keyframes, options = {}) {
  return new Track({
    ...options,
    keyframes,
    apply: (value) => {
      if (value.position) object.position.set(...value.position);
      if (value.rotation) object.rotation.set(...value.rotation);
      if (value.scale != null) {
        if (typeof value.scale === "number") object.scale.setScalar(value.scale);
        else object.scale.set(...value.scale);
      }
    }
  });
}
function applyUniformValue(uniforms, key, value) {
  const uniform = uniforms[key];
  if (!uniform) return;
  const current = uniform.value;
  if (typeof value === "string" && current?.setStyle) {
    current.setStyle(value);
    return;
  }
  if (Array.isArray(value) && current?.fromArray) {
    current.fromArray(value);
    return;
  }
  uniform.value = value;
}
function uniformTrack(material, keyframes, options = {}) {
  return new Track({
    ...options,
    keyframes,
    apply: (value) => {
      for (const [key, v] of Object.entries(value)) applyUniformValue(material.uniforms, key, v);
    }
  });
}
function cameraTrack(camera, keyframes, options = {}) {
  let previousRoll = 0;
  return new Track({
    ...options,
    keyframes,
    apply: (value) => {
      if (value.position) camera.position.set(...value.position);
      if (value.fov != null) {
        camera.fov = value.fov;
        camera.updateProjectionMatrix();
      }
      if (value.target) {
        camera.lookAt(...value.target);
        previousRoll = 0;
      }
      if (value.roll != null) {
        camera.rotateZ(value.roll - previousRoll);
        previousRoll = value.roll;
      }
    }
  });
}
function frameCapture(renderer) {
  return () => new Promise((resolve, reject) => {
    const canvas = renderer.domElement;
    if (!canvas.toBlob) {
      reject(new Error("frameCapture: the renderer's canvas has no toBlob()."));
      return;
    }
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("frameCapture: toBlob() returned null."));
    });
  });
}
export {
  cameraTrack,
  frameCapture,
  objectTrack,
  threeOutput,
  uniformTrack
};
//# sourceMappingURL=three.js.map