import { useEffect, useRef } from 'react';
import { MotionValue, Transport, drawOutput } from '@dhaakon/motion';

/**
 * An ambient shader field that sits behind a section's content.
 *
 * Deliberately built on raw WebGL rather than Three.js: this is one fullscreen
 * triangle and one fragment shader, so a background costs a few kilobytes and
 * no dependency, and several can coexist without pulling a scene graph onto
 * every page.
 *
 * Time comes from a `Transport` driving a `drawOutput`, so these run on the
 * same shared frame loop as the rest of the page (one requestAnimationFrame
 * for everything) and stop cleanly when the section scrolls away or the tab
 * is hidden.
 *
 * Non-intrusive is the whole design brief, so: it renders a *deviation* from
 * whatever the section's own background already is (never its own opaque
 * ground), the motion is measured in tens of seconds, it fades in rather than
 * popping, it never paints while offscreen, it degrades to nothing at all
 * without WebGL, and `prefers-reduced-motion` gets a single static frame.
 */

export type AmbientVariant = 'field' | 'grid' | 'scan' | 'bloom' | 'grain';

export interface AmbientShaderProps {
  /** Which field to draw. Each reads as a different kind of signal, not a different amount of noise. */
  variant?: AmbientVariant;
  /** Two colors the field mixes between, as hex. */
  tint?: [string, string];
  /** 0–1. Already scaled per `scheme`; 1 is "as strong as this should ever get". */
  intensity?: number;
  /** Multiplies the field's own (already slow) rate. */
  speed?: number;
  /** Decorrelates two fields that share a variant. */
  seed?: number;
  /** Picks a sensible blend mode and intensity ceiling for the ground it sits on. */
  scheme?: 'dark' | 'light';
  /** Overrides the blend mode `scheme` would choose. */
  blend?: 'screen' | 'multiply' | 'normal';
  className?: string;
}

const VARIANTS: AmbientVariant[] = ['field', 'grid', 'scan', 'bloom', 'grain'];

const VERTEX = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAGMENT = `
precision mediump float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;
uniform float uIntensity;
uniform float uSeed;
uniform float uFade;
uniform int uVariant;
uniform vec3 uTintA;
uniform vec3 uTintB;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  float t = uTime;
  float signal = 0.0;

  if (uVariant == 0) {
    // field — two low-frequency layers drifting against each other. The
    // threshold sits above the noise's own mean on purpose: only the upper
    // tail lights, so this reads as drifting patches rather than a wash.
    float n = fbm(p * 1.9 + vec2(t * 0.045, -t * 0.030) + uSeed);
    float m = fbm(p * 3.4 - vec2(t * 0.020, t * 0.035) + uSeed * 1.7);
    signal = smoothstep(0.66, 1.05, n * 0.70 + m * 0.45);
  } else if (uVariant == 1) {
    // grid — hairlines, the site's own structural device, breathing in patches
    vec2 g = vUv * vec2(26.0, 15.0) + vec2(t * 0.012, -t * 0.008);
    vec2 d = abs(fract(g) - 0.5);
    float lines = max(smoothstep(0.46, 0.5, d.x), smoothstep(0.46, 0.5, d.y));
    float patch = smoothstep(0.35, 0.85, fbm(p * 1.5 + vec2(t * 0.02, 0.0) + uSeed));
    signal = lines * patch;
  } else if (uVariant == 2) {
    // scan — a slow sweep, like a waveform monitor at rest
    float band = sin((vUv.y * 2.6 - t * 0.09) * 6.2831853);
    signal = smoothstep(0.55, 1.0, band) * smoothstep(0.25, 0.80, fbm(p * 1.2 + vec2(0.0, t * 0.03) + uSeed));
  } else if (uVariant == 3) {
    // bloom — one soft source, mostly offscreen, wandering
    vec2 c = vec2(sin(t * 0.035 + uSeed) * 0.42 * aspect, 0.62 + sin(t * 0.021) * 0.06);
    signal = smoothstep(0.85, 0.0, distance(p, c)) * (0.65 + 0.35 * fbm(p * 2.2 + t * 0.02));
  } else {
    // grain — sensor noise, stepped so it reads as texture and not as flicker
    float cell = hash(floor(vUv * uResolution * 0.5) + floor(t * 10.0));
    float patch = smoothstep(0.30, 0.90, fbm(p * 1.3 + vec2(t * 0.015, -t * 0.010) + uSeed));
    signal = cell * patch;
  }

  vec3 tint = mix(uTintA, uTintB, clamp(fbm(p * 1.6 + uSeed), 0.0, 1.0));
  gl_FragColor = vec4(tint, clamp(signal, 0.0, 1.0) * uIntensity * uFade);
}`;

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? [...value].map((c) => c + c).join('') : value;
  const int = parseInt(full.slice(0, 6), 16);
  return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('AmbientShader: shader failed to compile', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function AmbientShader({
  variant = 'field',
  tint = ['#ff5a1f', '#2d62ff'],
  intensity = 0.5,
  speed = 1,
  seed = 0,
  scheme = 'dark',
  blend,
  className,
}: AmbientShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    // A light ground can take far less deviation than a dark one before it reads as dirt.
    const ceiling = scheme === 'light' ? 0.1 : 0.22;
    const strength = Math.max(0, Math.min(1, intensity)) * ceiling;
    const tintA = hexToRgb(tint[0]);
    const tintB = hexToRgb(tint[1]);
    const variantIndex = Math.max(0, VARIANTS.indexOf(variant));

    let gl: WebGLRenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let uniforms: Record<string, WebGLUniformLocation | null> = {};
    let transport: Transport | null = null;
    let detachDraw: (() => void) | null = null;
    let visible = false;
    let disposed = false;
    const fade = new MotionValue<number>(0);

    /** WebGL contexts are a scarce per-page resource, so one is only created once a section is actually reached. */
    function init(): boolean {
      const context = canvas!.getContext('webgl', {
        alpha: true, premultipliedAlpha: false, antialias: false,
        depth: false, stencil: false, powerPreference: 'low-power',
      }) as WebGLRenderingContext | null;
      if (!context) return false;
      gl = context;

      const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
      const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
      if (!vertex || !fragment) return false;
      program = gl.createProgram();
      if (!program) return false;
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn('AmbientShader: program failed to link', gl.getProgramInfoLog(program));
        return false;
      }
      gl.useProgram(program);

      // One triangle large enough to cover clip space — cheaper than a quad and has no seam.
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'aPos');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      for (const name of ['uResolution', 'uTime', 'uIntensity', 'uSeed', 'uFade', 'uVariant', 'uTintA', 'uTintB']) {
        uniforms[name] = gl.getUniformLocation(program, name);
      }
      gl.uniform1i(uniforms.uVariant, variantIndex);
      gl.uniform1f(uniforms.uIntensity, strength);
      gl.uniform1f(uniforms.uSeed, seed);
      gl.uniform3f(uniforms.uTintA, ...tintA);
      gl.uniform3f(uniforms.uTintB, ...tintB);
      resize();
      return true;
    }

    function resize() {
      if (!gl) return;
      const rect = canvas!.getBoundingClientRect();
      // A soft field carries no detail worth resolving, so it renders below device
      // resolution and is upscaled — a large saving nobody can see.
      const scale = Math.min(1.5, window.devicePixelRatio || 1) * 0.6;
      const width = Math.max(1, Math.round(rect.width * scale));
      const height = Math.max(1, Math.round(rect.height * scale));
      if (canvas!.width === width && canvas!.height === height) return;
      canvas!.width = width;
      canvas!.height = height;
      gl.viewport(0, 0, width, height);
      gl.uniform2f(uniforms.uResolution, width, height);
    }

    function render(timeMs: number) {
      if (!gl || !program) return;
      gl.uniform1f(uniforms.uTime, (timeMs / 1000) * speed);
      gl.uniform1f(uniforms.uFade, fade.get());
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function start() {
      if (disposed || transport || !gl) return;
      // An hour of runtime before the loop seam, which no visitor will reach.
      transport = new Transport({ duration: 3_600_000, loop: true });
      detachDraw = transport.attach(drawOutput((info) => render(info.time), { name: 'ambient-shader' }));
      transport.play();
    }

    function stop() {
      transport?.pause();
      detachDraw?.();
      transport?.dispose();
      detachDraw = null;
      transport = null;
    }

    function activate() {
      if (disposed || gl) return;
      if (!init()) { teardownGl(false); return; }
      canvas!.style.opacity = '1';
      if (reduced) { fade.set(1); render(0); return; }   // one static frame, no clock
      fade.animate(1, { duration: 1400, easing: 'dhaakon' });
      if (visible && !document.hidden) start();
    }

    /** `release` gives the context back to the browser; never do that while *responding* to a loss, or the restore handler loops. */
    function teardownGl(release = true) {
      stop();
      if (gl) {
        if (buffer) gl.deleteBuffer(buffer);
        if (program) gl.deleteProgram(program);
        if (release) gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
      gl = null; program = null; buffer = null; uniforms = {};
    }

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) { activate(); if (!reduced && !document.hidden) start(); }
      else stop();
    }, { rootMargin: '120px' });
    observer.observe(canvas);

    const onVisibility = () => { if (document.hidden) stop(); else if (visible && !reduced) start(); };
    document.addEventListener('visibilitychange', onVisibility);

    const resizeObserver = new ResizeObserver(() => { resize(); if (reduced && gl) render(0); });
    resizeObserver.observe(canvas);

    const onLost = (event: Event) => { event.preventDefault(); stop(); };
    const onRestored = () => { teardownGl(false); if (visible) activate(); };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    return () => {
      disposed = true;
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      fade.stop();
      teardownGl();
    };
  }, [variant, intensity, speed, seed, scheme, tint[0], tint[1]]);

  const mode = blend ?? (scheme === 'light' ? 'multiply' : 'screen');
  return (
    <canvas
      ref={canvasRef}
      className={`ambient-shader${className ? ` ${className}` : ''}`}
      style={{ mixBlendMode: mode, opacity: 0 }}
      aria-hidden="true"
    />
  );
}
