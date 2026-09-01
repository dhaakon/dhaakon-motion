import { useEffect, useRef, useState } from 'react';
import { Button } from '@dhaakon/ui';
import { MotionValue, Timeline, Tween } from '@dhaakon/motion';
import { useReducedMotion } from '@dhaakon/motion/react';
import * as THREE from 'three';

const SHOW_DURATION = 9200;

const vertexShader = `
  uniform float uTime;
  uniform float uEnergy;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vWave;

  void main() {
    float waveA = sin(position.y * 4.8 + uTime * 2.2);
    float waveB = cos(position.x * 5.2 - uTime * 1.7);
    float displacement = (waveA + waveB) * 0.065 * uEnergy;
    vec3 transformed = position + normal * displacement;
    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
    vWorldPosition = worldPosition.xyz;
    vNormal = normalize(normalMatrix * normal);
    vWave = displacement;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = `
  uniform vec3 uAccent;
  uniform vec3 uSecondary;
  uniform float uEnergy;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vWave;

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - max(dot(viewDirection, vNormal), 0.0), 2.2);
    float edge = smoothstep(0.05, 0.19, abs(vWave));
    vec3 base = mix(uSecondary * 0.22, uAccent, fresnel + edge * 0.35);
    vec3 color = base + uAccent * fresnel * (0.55 + uEnergy * 0.25);
    gl_FragColor = vec4(color, 0.94);
  }
`;

function phaseAt(progress: number) {
  if (progress < 0.16) return 'BOOT / ACQUIRE';
  if (progress < 0.42) return 'ORBIT / BUILD';
  if (progress < 0.7) return 'IMPACT / RESOLVE';
  if (progress < 0.9) return 'SIGNAL / RELEASE';
  return 'HOLD / RETURN';
}

export function ThreeShowcase() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timelineRef = useRef<Timeline | null>(null);
  const reversedRef = useRef(false);
  const progressRef = useRef<HTMLSpanElement | null>(null);
  const rangeRef = useRef<HTMLInputElement | null>(null);
  const phaseRef = useRef<HTMLElement | null>(null);
  const timeRef = useRef<HTMLElement | null>(null);
  const drawRef = useRef<HTMLElement | null>(null);
  const triangleRef = useRef<HTMLElement | null>(null);
  const [status, setStatus] = useState<'playing' | 'paused' | 'reduced'>('paused');
  const [error, setError] = useState('');
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch {
      setError('WebGL is unavailable in this browser. The timeline controls and code remain available below.');
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

    const scene = new THREE.Scene();
    const background = new THREE.Color('#08090b');
    scene.background = background;
    scene.fog = new THREE.FogExp2('#08090b', 0.042);

    const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 70);
    camera.position.set(0.4, 1.2, 8.8);

    const world = new THREE.Group();
    world.rotation.order = 'YXZ';
    scene.add(world);

    const uniforms = {
      uTime: { value: 0 },
      uEnergy: { value: 0.2 },
      uAccent: { value: new THREE.Color('#ff5a1f') },
      uSecondary: { value: new THREE.Color('#2d62ff') },
    };
    const coreMaterial = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.24, 4), coreMaterial);
    world.add(core);

    const shellMaterial = new THREE.MeshBasicMaterial({ color: '#d9ff43', wireframe: true, transparent: true, opacity: 0.22 });
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.58, 2), shellMaterial);
    world.add(shell);

    const ringMaterial = new THREE.MeshStandardMaterial({ color: '#f0eee8', emissive: '#ff5a1f', emissiveIntensity: 0.18, roughness: 0.28, metalness: 0.74 });
    const rings = [
      new THREE.Mesh(new THREE.TorusGeometry(2.08, 0.025, 12, 180), ringMaterial),
      new THREE.Mesh(new THREE.TorusGeometry(2.52, 0.018, 10, 180), ringMaterial.clone()),
      new THREE.Mesh(new THREE.TorusGeometry(3.03, 0.012, 8, 180), ringMaterial.clone()),
    ];
    rings[0].rotation.x = Math.PI * 0.5;
    rings[1].rotation.set(Math.PI * 0.3, Math.PI * 0.13, 0);
    rings[2].rotation.set(Math.PI * 0.63, -Math.PI * 0.18, 0);
    world.add(...rings);

    const satellites: THREE.Mesh[] = [];
    const satelliteGeometry = new THREE.OctahedronGeometry(0.13, 0);
    for (let index = 0; index < 8; index += 1) {
      const material = new THREE.MeshStandardMaterial({
        color: index % 2 ? '#d9ff43' : '#ff5a1f',
        emissive: index % 2 ? '#718810' : '#8f2505',
        emissiveIntensity: 0.8,
        roughness: 0.34,
      });
      const satellite = new THREE.Mesh(satelliteGeometry, material);
      satellites.push(satellite);
      world.add(satellite);
    }

    const particleCount = 2200;
    const positions = new Float32Array(particleCount * 3);
    for (let index = 0; index < particleCount; index += 1) {
      const ratio = index / particleCount;
      const angle = ratio * Math.PI * 34 + Math.sin(index * 12.9898) * 0.65;
      const radius = 2.6 + ratio * 6.8 + Math.sin(index * 78.233) * 0.42;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = (ratio - 0.5) * 5.5 + Math.cos(index * 0.37) * 0.42;
      positions[index * 3 + 2] = Math.sin(angle) * radius;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({ color: '#647cff', size: 0.022, sizeAttenuation: true, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.rotation.x = -0.18;
    scene.add(particles);

    const grid = new THREE.GridHelper(32, 32, '#2d62ff', '#1c2029');
    grid.position.y = -2.42;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.42;
    scene.add(grid);

    const stageMaterial = new THREE.MeshStandardMaterial({ color: '#090a0d', roughness: 0.25, metalness: 0.82 });
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.42, 0.22, 96), stageMaterial);
    stage.position.y = -2.3;
    scene.add(stage);

    const ambient = new THREE.HemisphereLight('#b7c7ff', '#180b08', 0.45);
    const key = new THREE.PointLight('#ff5a1f', 38, 18, 1.7);
    key.position.set(4, 3.4, 3);
    const fill = new THREE.PointLight('#2d62ff', 26, 20, 1.5);
    fill.position.set(-4.5, -0.5, 2.5);
    const rim = new THREE.SpotLight('#d9ff43', 50, 24, Math.PI * 0.23, 0.7, 1.6);
    rim.position.set(0, 7, -3);
    rim.target = core;
    scene.add(ambient, key, fill, rim);

    const cameraSignal = new MotionValue({
      position: [0.4, 1.2, 8.8], target: [0, -0.1, 0], fov: 44, roll: 0,
    });
    const rigSignal = new MotionValue({
      position: [0, -0.05, 0], rotation: [-0.08, -0.55, 0.02], scale: 0.72, energy: 0.2, shell: 0.08,
      accent: '#ff5a1f', secondary: '#2d62ff',
    });
    const lightSignal = new MotionValue({
      key: 22, fill: 12, rim: 18, exposure: 0.72, fog: 0.057,
      keyColor: '#ff5a1f', fillColor: '#2d62ff', background: '#08090b',
    });
    const particleSignal = new MotionValue({
      rotation: [0, 0, 0], scale: 0.62, size: 0.012, opacity: 0.16, ringGlow: 0.06,
    });

    const unsubscriptions = [
      cameraSignal.subscribe(() => {
        const value = cameraSignal.get();
        camera.position.set(value.position[0], value.position[1], value.position[2]);
        camera.fov = value.fov;
        camera.updateProjectionMatrix();
        camera.lookAt(value.target[0], value.target[1], value.target[2]);
        camera.rotateZ(value.roll);
      }),
      rigSignal.subscribe(() => {
        const value = rigSignal.get();
        world.position.set(value.position[0], value.position[1], value.position[2]);
        world.rotation.set(value.rotation[0], value.rotation[1], value.rotation[2]);
        world.scale.setScalar(value.scale);
        uniforms.uEnergy.value = value.energy;
        uniforms.uAccent.value.setStyle(value.accent);
        uniforms.uSecondary.value.setStyle(value.secondary);
        shellMaterial.opacity = value.shell;
      }),
      lightSignal.subscribe(() => {
        const value = lightSignal.get();
        key.intensity = value.key;
        fill.intensity = value.fill;
        rim.intensity = value.rim;
        key.color.setStyle(value.keyColor);
        fill.color.setStyle(value.fillColor);
        renderer.toneMappingExposure = value.exposure;
        (scene.fog as THREE.FogExp2).density = value.fog;
        background.setStyle(value.background);
      }),
      particleSignal.subscribe(() => {
        const value = particleSignal.get();
        particles.rotation.set(value.rotation[0], value.rotation[1], value.rotation[2]);
        particles.scale.setScalar(value.scale);
        particleMaterial.size = value.size;
        particleMaterial.opacity = value.opacity;
        rings.forEach((ring, index) => {
          const material = ring.material as THREE.MeshStandardMaterial;
          material.emissiveIntensity = value.ringGlow * (index + 1);
        });
      }),
    ];

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    const sequence = new Timeline({
      repeat: Infinity,
      yoyo: true,
      onUpdate: (time, progress) => {
        uniforms.uTime.value = time / 1000;
        shell.rotation.y = time * 0.00024;
        shell.rotation.x = Math.sin(time * 0.00031) * 0.28;
        rings[0].rotation.z = time * 0.00018;
        rings[1].rotation.y = time * -0.00023;
        rings[2].rotation.z = time * 0.00015;
        satellites.forEach((satellite, index) => {
          const angle = time * (0.00034 + index * 0.000012) + index * Math.PI * 0.25;
          const radius = 2.05 + (index % 3) * 0.42;
          satellite.position.set(Math.cos(angle) * radius, Math.sin(angle * 1.7) * 0.78, Math.sin(angle) * radius);
          satellite.rotation.set(angle * 0.7, angle * 1.1, angle * 0.4);
          satellite.scale.setScalar(0.55 + Math.sin(angle * 2.0) * 0.18 + progress * 0.34);
        });
        renderer.render(scene, camera);

        const clamped = Math.max(0, Math.min(1, progress));
        const phase = phaseAt(clamped);
        if (progressRef.current) progressRef.current.style.transform = `scaleX(${clamped})`;
        if (rangeRef.current) rangeRef.current.value = String(Math.round(clamped * 1000));
        if (phaseRef.current) phaseRef.current.textContent = phase;
        if (timeRef.current) timeRef.current.textContent = `${(time / 1000).toFixed(2)}s`;
        if (drawRef.current) drawRef.current.textContent = String(renderer.info.render.calls);
        if (triangleRef.current) triangleRef.current.textContent = renderer.info.render.triangles.toLocaleString();
        canvas.dataset.progress = clamped.toFixed(3);
        canvas.dataset.phase = phase;
        canvas.setAttribute('aria-label', `Three.js production sequence: ${phase.toLowerCase()}, ${Math.round(clamped * 100)} percent`);
      },
    }).label('show', 0)
      .add(new Tween({
        from: cameraSignal.get(),
        to: { position: [-4.2, 2.55, 5.8], target: [0.15, -0.35, 0], fov: 31, roll: -0.055 },
        duration: SHOW_DURATION,
        easing: 'dhaakon',
        onUpdate: (value) => cameraSignal.set(value),
      }), 'show')
      .add(new Tween({
        from: rigSignal.get(),
        to: { position: [0.25, 0.18, 0], rotation: [0.42, 5.9, -0.18], scale: 1.18, energy: 2.8, shell: 0.58, accent: '#d9ff43', secondary: '#ff5a1f' },
        duration: SHOW_DURATION,
        easing: 'easeInOutCubic',
        onUpdate: (value) => rigSignal.set(value),
      }), 'show')
      .add(new Tween({
        from: lightSignal.get(),
        to: { key: 74, fill: 46, rim: 92, exposure: 1.42, fog: 0.018, keyColor: '#d9ff43', fillColor: '#7045ff', background: '#120806' },
        duration: SHOW_DURATION,
        easing: 'easeInOutCubic',
        onUpdate: (value) => lightSignal.set(value),
      }), 'show')
      .add(new Tween({
        from: particleSignal.get(),
        to: { rotation: [0.42, 2.5, -0.18], scale: 1.18, size: 0.052, opacity: 0.82, ringGlow: 1.15 },
        duration: SHOW_DURATION,
        easing: 'easeOutCubic',
        onUpdate: (value) => particleSignal.set(value),
      }), 'show');

    timelineRef.current = sequence;
    reversedRef.current = false;
    sequence.render(reducedMotion ? SHOW_DURATION * 0.62 : 0);
    resize();
    if (reducedMotion) setStatus('reduced');
    else { sequence.play(); setStatus('playing'); }

    return () => {
      sequence.stop();
      timelineRef.current = null;
      resizeObserver.disconnect();
      unsubscriptions.forEach((unsubscribe) => unsubscribe());
      scene.traverse((object) => {
        const renderable = object as THREE.Mesh | THREE.Points;
        renderable.geometry?.dispose();
        const materials = Array.isArray(renderable.material) ? renderable.material : renderable.material ? [renderable.material] : [];
        materials.forEach((material) => material.dispose());
      });
      renderer.dispose();
    };
  }, [reducedMotion]);

  const play = () => { timelineRef.current?.play(); setStatus('playing'); };
  const pause = () => { timelineRef.current?.pause(); setStatus('paused'); };
  const restart = () => {
    if (reversedRef.current) timelineRef.current?.reverse();
    reversedRef.current = false;
    timelineRef.current?.stop().play();
    setStatus('playing');
  };
  const reverse = () => {
    reversedRef.current = !reversedRef.current;
    timelineRef.current?.reverse().play();
    setStatus('playing');
  };

  return <div className="three-demo">
    <div className="three-viewport" ref={hostRef}>
      <canvas ref={canvasRef} role="img" aria-label="Three.js production animation loading" />
      {error && <p className="three-error">{error}</p>}
      <div className="three-topline"><span><i /> LIVE WEBGL</span><b>DM / XR-01</b><em className={`three-status three-status--${status}`}>{status}</em></div>
      <div className="three-hud" aria-hidden="true">
        <p>SEQUENCE <strong ref={phaseRef}>BOOT / ACQUIRE</strong></p>
        <dl><div><dt>TIME</dt><dd ref={timeRef}>0.00s</dd></div><div><dt>DRAWS</dt><dd ref={drawRef}>0</dd></div><div><dt>TRIS</dt><dd ref={triangleRef}>0</dd></div></dl>
      </div>
      <div className="three-property-map" aria-hidden="true"><span>CAMERA</span><span>TRANSFORM</span><span>SHADER</span><span>LIGHT</span><span>PARTICLES</span></div>
      <div className="three-progress"><span ref={progressRef} /></div>
    </div>
    <div className="three-controls">
      <div className="three-buttons"><Button variant="accent" size="sm" onClick={play}>Play</Button><Button variant="outline" size="sm" onClick={pause}>Pause</Button><Button variant="outline" size="sm" onClick={reverse}>Reverse</Button><Button variant="outline" size="sm" onClick={restart}>Restart ↻</Button></div>
      <label><span>SCRUB SHARED CLOCK</span><input ref={rangeRef} type="range" min="0" max="1000" defaultValue="0" aria-label="Scrub Three.js sequence" onInput={(event) => { const progress = Number(event.currentTarget.value) / 1000; timelineRef.current?.pause().seek(progress); setStatus('paused'); }} /></label>
    </div>
  </div>;
}
