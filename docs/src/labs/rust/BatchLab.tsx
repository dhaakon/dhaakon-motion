import { useEffect, useRef, useState } from 'react';
import {
  compileTracks,
  createCompiledPlayer,
  type CompiledPlayer,
  type WasmRuntime,
} from '@dhaakon/motion/compiled';
import {
  BATCH_ACTS,
  BATCH_CHANNELS,
  BATCH_COUNTS,
  BATCH_DURATION_MS,
  batchFrameCount,
  batchFrameTime,
  batchMaxDelta,
  createBatchTracks,
  type BatchFps,
  type BatchPoint,
} from './batch';

interface Measurements {
  frames: number;
  js: number;
  wasm: number | null;
  drawJs: number;
  drawWasm: number | null;
  delta: number | null;
  compile: number;
  createJs: number;
  createWasm: number | null;
}
interface Session {
  sample(frame: number, fps: BatchFps): void;
  dispose(): void;
}
const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
const ms = (value: number | null | undefined) => (value == null ? '—' : `${value.toFixed(2)} ms`);

/** Canvas2D is a shared host renderer: Rust evaluates channels, not pixels or GPU shaders. */
function drawField(canvas: HTMLCanvasElement, points: readonly BatchPoint[], time: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This study needs Canvas2D support');
  const width = canvas.width;
  const height = canvas.height;
  const unit = width / 640;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#080e14';
  ctx.fillRect(0, 0, width, height);
  const halo = ctx.createRadialGradient(
    width * 0.5,
    height * 0.48,
    0,
    width * 0.5,
    height * 0.48,
    width * 0.53,
  );
  halo.addColorStop(0, '#0f2835');
  halo.addColorStop(0.65, '#0b1823');
  halo.addColorStop(1, '#080e14');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, width, height);
  ctx.lineWidth = unit * 0.65;
  ctx.strokeStyle = 'rgba(138, 193, 208, 0.07)';
  ctx.beginPath();
  for (let x = 0; x < width; x += width / 16) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = 0; y < height; y += width / 16) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
  const px = (point: BatchPoint) => width * (0.5 + point.x * 0.45);
  const py = (point: BatchPoint) => height * (0.49 + point.y * 0.61);
  ctx.strokeStyle = 'rgba(137, 226, 216, 0.11)';
  ctx.beginPath();
  ctx.ellipse(width * 0.5, height * 0.49, width * 0.385, height * 0.395, 0, 0, Math.PI * 2);
  ctx.moveTo(width * 0.46, height * 0.49);
  ctx.lineTo(width * 0.54, height * 0.49);
  ctx.moveTo(width * 0.5, height * 0.45);
  ctx.lineTo(width * 0.5, height * 0.53);
  ctx.stroke();

  // A deterministic sparse weave connects the sampled positions. No accumulated trails.
  ctx.strokeStyle = 'rgba(104, 216, 232, 0.11)';
  ctx.beginPath();
  for (let i = 0; i < points.length; i += 7) {
    const a = points[i];
    const b = points[(i + 7) % points.length];
    if (!a || !b || Math.hypot(a.x - b.x, a.y - b.y) > 0.35) continue;
    ctx.moveTo(px(a), py(a));
    ctx.lineTo(px(b), py(b));
  }
  ctx.stroke();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (!point) continue;
    const x = px(point);
    const y = py(point);
    const size = Math.max(0.35, point.radius * (1 + point.depth * 0.22)) * unit;
    ctx.globalAlpha = Math.max(0, Math.min(1, point.alpha));
    ctx.fillStyle = `hsl(${point.hue.toFixed(1)} 80% ${64 + point.depth * 12}%)`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    if (i % 13 === 0) {
      ctx.globalAlpha *= 0.3;
      ctx.beginPath();
      ctx.arc(x, y, size * 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(188, 250, 247, 0.55)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(point.twist) * size * 7, y + Math.sin(point.twist) * size * 7);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#9badb9';
  ctx.font = `${9 * unit}px monospace`;
  ctx.textAlign = 'left';
  ctx.fillText('D / FIELD RESEARCH', 20 * unit, 26 * unit);
  ctx.textAlign = 'right';
  ctx.fillText(
    `${String(points.length).padStart(4, '0')} NODES · 07 CHANNELS`,
    width - 20 * unit,
    26 * unit,
  );
  ctx.fillStyle = '#6b929f';
  ctx.textAlign = 'left';
  const act = [...BATCH_ACTS].reverse().find((item) => time >= item.at) ?? BATCH_ACTS[0];
  ctx.fillText(act.label.toUpperCase(), 20 * unit, height - 19 * unit);
  ctx.textAlign = 'right';
  ctx.fillText(`${(time / 1_000).toFixed(3)} s / 08.000 s`, width - 20 * unit, height - 19 * unit);
}

export function BatchLab({ runtime }: { runtime: WasmRuntime | null }) {
  const [count, setCount] = useState<number>(1024);
  const [fps, setFps] = useState<BatchFps>(24);
  const [frame, setFrame] = useState(84);
  const [playing, setPlaying] = useState(false);
  const [measurements, setMeasurements] = useState<Measurements | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wasmError, setWasmError] = useState<string | null>(null);
  const jsCanvas = useRef<HTMLCanvasElement>(null);
  const wasmCanvas = useRef<HTMLCanvasElement>(null);
  const session = useRef<Session | null>(null);
  const frameRef = useRef(frame);
  const fpsRef = useRef(fps);
  frameRef.current = frame;
  fpsRef.current = fps;

  useEffect(() => {
    const left = jsCanvas.current;
    const right = wasmCanvas.current;
    if (!left || !right) return;
    setPlaying(false);
    setError(null);
    setWasmError(null);
    setMeasurements(null);
    let js: CompiledPlayer | undefined;
    let wasm: CompiledPlayer | undefined;
    let observer: ResizeObserver | undefined;
    let disposed = false;
    try {
      const started = performance.now();
      const tracks = createBatchTracks(count);
      const plan = compileTracks(tracks, { requirePortable: true });
      const compile = performance.now() - started;
      const jsPoints: BatchPoint[] = new Array(count);
      const wasmPoints: BatchPoint[] = new Array(count);
      const bindings = (points: BatchPoint[]) =>
        Object.fromEntries(
          tracks.map((track, index) => [
            track.id,
            (value: unknown) => {
              points[index] = value as BatchPoint;
            },
          ]),
        );
      let before = performance.now();
      js = createCompiledPlayer(plan, { backend: 'js', bindings: bindings(jsPoints) });
      const createJs = performance.now() - before;
      let createWasm: number | null = null;
      if (runtime) {
        try {
          before = performance.now();
          wasm = createCompiledPlayer(plan, {
            backend: 'wasm',
            runtime,
            bindings: bindings(wasmPoints),
          });
          createWasm = performance.now() - before;
        } catch (cause) {
          setWasmError(cause instanceof Error ? cause.message : String(cause));
        }
      }
      const jsTimes: number[] = [];
      const wasmTimes: number[] = [];
      let frames = 0;
      let lastTime = batchFrameTime(frameRef.current, fpsRef.current);
      const redraw = () => {
        drawField(left, jsPoints, lastTime);
        drawField(right, wasm ? wasmPoints : [], lastTime);
      };
      const resize = () => {
        if (disposed) return;
        for (const canvas of [left, right]) {
          const width = Math.max(1, canvas.getBoundingClientRect().width);
          const ratio = Math.min(window.devicePixelRatio || 1, 2);
          const physicalWidth = Math.max(1, Math.round(width * ratio));
          const physicalHeight = Math.max(1, Math.round((width * ratio * 11) / 16));
          if (canvas.width !== physicalWidth || canvas.height !== physicalHeight) {
            canvas.width = physicalWidth;
            canvas.height = physicalHeight;
          }
        }
        redraw();
      };
      const owned: Session = {
        sample(nextFrame, nextFps) {
          if (disposed) return;
          lastTime = batchFrameTime(nextFrame, nextFps);
          let jsTime = 0;
          let wasmTime = 0;
          const sampleJs = () => {
            const start = performance.now();
            js!.sampleAt(lastTime);
            jsTime = performance.now() - start;
          };
          const sampleWasm = () => {
            if (!wasm) return;
            const start = performance.now();
            wasm.sampleAt(lastTime);
            wasmTime = performance.now() - start;
          };
          // Alternate evaluation order; neither pane is driven by the other pane's values.
          if (frames % 2) {
            sampleWasm();
            sampleJs();
          } else {
            sampleJs();
            sampleWasm();
          }
          frames++;
          jsTimes.push(jsTime);
          if (wasm) wasmTimes.push(wasmTime);
          if (jsTimes.length > 120) jsTimes.shift();
          if (wasmTimes.length > 120) wasmTimes.shift();
          const delta = wasm ? batchMaxDelta(jsPoints, wasmPoints) : null;
          let start = performance.now();
          drawField(left, jsPoints, lastTime);
          const drawJs = performance.now() - start;
          start = performance.now();
          drawField(right, wasm ? wasmPoints : [], lastTime);
          const drawWasm = wasm ? performance.now() - start : null;
          setMeasurements({
            frames,
            js: median(jsTimes),
            wasm: wasm ? median(wasmTimes) : null,
            drawJs,
            drawWasm,
            delta,
            compile,
            createJs,
            createWasm,
          });
        },
        dispose() {
          if (disposed) return;
          disposed = true;
          observer?.disconnect();
          try {
            wasm?.dispose();
          } finally {
            js?.dispose();
          }
        },
      };
      session.current = owned;
      resize();
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(resize);
        observer.observe(left);
        observer.observe(right);
      }
      return () => {
        session.current = null;
        owned.dispose();
      };
    } catch (cause) {
      session.current = null;
      disposed = true;
      observer?.disconnect();
      try {
        wasm?.dispose();
      } finally {
        js?.dispose();
      }
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [count, runtime]);

  useEffect(() => {
    try {
      session.current?.sample(frame, fps);
    } catch (cause) {
      setPlaying(false);
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [frame, fps, count, runtime]);

  useEffect(() => {
    if (!playing) return;
    const anchor = performance.now();
    const startFrame = frameRef.current;
    const total = batchFrameCount(fps);
    let request = 0;
    let stopped = false;
    const tick = (now: number) => {
      if (stopped) return;
      setFrame((startFrame + Math.floor(((now - anchor) * fps) / 1_000)) % total);
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(request);
    };
  }, [playing, fps, count, runtime]);

  const total = batchFrameCount(fps);
  const seek = (next: number) => {
    setPlaying(false);
    setFrame(Math.max(0, Math.min(total - 1, next)));
  };
  const wasmReady = runtime != null && !wasmError && !error && measurements?.wasm != null;
  const delta = measurements?.delta;
  const parity =
    error || wasmError ? 'error' : delta == null ? 'waiting' : delta <= 1e-7 ? 'pass' : 'fail';

  return (
    <div
      className="rust-batch"
      data-testid="rust-batch"
      data-count={count}
      data-frame={frame}
      data-fps={fps}
      data-playing={playing}
    >
      <div className="rust-batch-controls">
        <label>
          Workload{' '}
          <select
            data-testid="rust-batch-count"
            value={count}
            onChange={(event) => {
              setPlaying(false);
              setCount(Number(event.target.value));
            }}
          >
            {BATCH_COUNTS.map((size) => (
              <option key={size} value={size}>
                {size.toLocaleString()} points / {(size * 7).toLocaleString()} channels
              </option>
            ))}
          </select>
        </label>
        <label>
          Timeline rate{' '}
          <select
            data-testid="rust-batch-fps"
            value={fps}
            onChange={(event) => {
              const next = Number(event.target.value) as BatchFps;
              setPlaying(false);
              setFrame(Math.min(batchFrameCount(next) - 1, Math.round((frame * next) / fps)));
              setFps(next);
            }}
          >
            <option value={24}>24 fps</option>
            <option value={60}>60 fps</option>
          </select>
        </label>
        <button
          data-testid="rust-batch-play"
          disabled={!!error}
          onClick={() => setPlaying((value) => !value)}
        >
          {playing ? 'Pause field' : 'Play field'}
        </button>
        <button
          data-testid="rust-batch-step-back"
          aria-label="Previous batch frame"
          onClick={() => seek(frame - 1)}
          disabled={frame === 0 || !!error}
        >
          −1 frame
        </button>
        <button
          data-testid="rust-batch-step-forward"
          aria-label="Next batch frame"
          onClick={() => seek(frame + 1)}
          disabled={frame === total - 1 || !!error}
        >
          +1 frame
        </button>
      </div>
      <div className="rust-batch-panes">
        <div className="rust-batch-pane">
          <div className="rust-batch-pane-heading">
            <strong>Compiled JavaScript</strong>
            <span>Reference evaluator</span>
          </div>
          <canvas
            className="rust-batch-canvas"
            style={{ width: '100%', height: 'auto', aspectRatio: '16 / 11', display: 'block' }}
            width={640}
            height={440}
            ref={jsCanvas}
            data-testid="rust-batch-js"
            data-backend={error ? 'error' : 'js'}
            aria-label="Compiled JavaScript point field at the shared timeline frame"
          />
        </div>
        <div className="rust-batch-pane">
          <div className="rust-batch-pane-heading">
            <strong>Rust / WebAssembly</strong>
            <span>{wasmReady ? 'Actual Wasm evaluator' : 'Runtime not active'}</span>
          </div>
          <div style={{ position: 'relative' }}>
            <canvas
              className="rust-batch-canvas"
              style={{ width: '100%', height: 'auto', aspectRatio: '16 / 11', display: 'block' }}
              width={640}
              height={440}
              ref={wasmCanvas}
              data-testid="rust-batch-wasm"
              data-backend={wasmReady ? 'wasm' : 'unavailable'}
              aria-label={
                wasmReady
                  ? 'Rust WebAssembly point field at the shared timeline frame'
                  : 'Rust field unavailable until its runtime is enabled'
              }
            />
            {!wasmReady && (
              <div
                className="rust-batch-unavailable"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeItems: 'center',
                  padding: 28,
                  textAlign: 'center',
                }}
              >
                {wasmError ?? 'Enable the Rust runtime above to evaluate this second field.'}
              </div>
            )}
          </div>
        </div>
      </div>
      <label className="rust-batch-scrub">
        Shared frame{' '}
        <output>
          {frame} / {total - 1} · {(batchFrameTime(frame, fps) / 1_000).toFixed(3)} s
        </output>
        <input
          data-testid="rust-batch-scrub"
          aria-label="Shared batch timeline frame"
          type="range"
          min={0}
          max={total - 1}
          step={1}
          value={frame}
          disabled={!!error}
          onChange={(event) => seek(Number(event.target.value))}
        />
      </label>
      <div className="rust-batch-acts" aria-label="Point field acts">
        {BATCH_ACTS.map((act) => (
          <button key={act.at} onClick={() => seek(Math.round((act.at * fps) / 1_000))}>
            {act.label}
          </button>
        ))}
      </div>
      {error && <p role="alert">Field stopped: {error}</p>}
      <div
        className="rust-batch-metrics"
        data-testid="rust-batch-metrics"
        data-samples={measurements?.frames ?? 0}
      >
        <div>
          <span>Sample + materialize p50</span>
          <strong>
            JS {ms(measurements?.js)} / Wasm {ms(measurements?.wasm)}
          </strong>
          <small>
            Rolling {Math.min(measurements?.frames ?? 0, 120)} frames · alternating sample order
          </small>
        </div>
        <div>
          <span>Canvas2D submission / last frame</span>
          <strong>
            JS {ms(measurements?.drawJs)} / Wasm {ms(measurements?.drawWasm)}
          </strong>
          <small>Same host renderer · excludes deferred raster / GPU completion</small>
        </div>
        <div>
          <span>Creation, separately measured</span>
          <strong>Author + compile {ms(measurements?.compile)}</strong>
          <small>
            JS player {ms(measurements?.createJs)} · Wasm player {ms(measurements?.createWasm)} ·
            excludes module load
          </small>
        </div>
      </div>
      <p
        className="rust-batch-parity"
        data-testid="rust-batch-parity"
        data-status={parity}
        data-compared={delta == null ? 0 : count * BATCH_CHANNELS.length}
        data-max-error={delta ?? ''}
      >
        {delta == null
          ? 'Numeric comparison waits for the Rust runtime.'
          : `${parity === 'pass' ? 'State agrees' : 'State mismatch'} · ${(count * BATCH_CHANNELS.length).toLocaleString()} channels · maximum absolute delta ${delta.toExponential(2)} (tolerance 1e−7).`}
      </p>
      <p className="rust-note">
        {BATCH_DURATION_MS / 1_000} seconds, four formations, one quantized clock. Each engine
        evaluates its own complete plan at the same timestamp. The selected fps is a timeline
        target, not a measured display rate; overloaded frames may be skipped. Timings are
        exploratory on this device, include JavaScript publication, and do not establish a general
        speedup or pixel parity.
      </p>
    </div>
  );
}
