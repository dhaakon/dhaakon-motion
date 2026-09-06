import { useEffect, useRef, useState } from 'react';
import { compileTracks, type WasmRuntime } from '@dhaakon/motion/compiled';
import { Code } from '../components/Demo';
import { DemoViewport } from '../components/DemoViewport';
import { ScoreLab } from '../labs/rust/ScoreLab';
import { BatchLab } from '../labs/rust/BatchLab';
import { loadExperimentalRuntime } from '../labs/rust/runtime';
import { createScoreInputs, SCORE_FPS, SCORE_FRAMES } from '../labs/rust/score';
import { verifyScore, type VerificationResult } from '../labs/rust/verification';
import '../labs/rust/rust.css';

const integration = `import { Timeline, Transport } from '@dhaakon/motion';
import { compileTracks, createCompiledPlayer,
  loadWasmRuntime } from '@dhaakon/motion/compiled';
import wasmUrl from '@dhaakon/motion/wasm/web/motion_wasm_bg.wasm?url';

// Run in an owned React effect or application startup, not during render.
const runtime = await loadWasmRuntime(async () => {
  const bindings = await import('@dhaakon/motion/wasm/web/motion_wasm.js');
  const module = await bindings.default({ module_or_path: wasmUrl });
  return { bindings, memory: module.memory };
});
const plan = compileTracks([{
  id: 'aperture', frameRate: 60, easing: 'dhaakon',
  keyframes: [
    { at: '0f', value: { radius: 0, ink: '#baff5b' } },
    { at: '120f', value: { radius: 300, ink: '#67deff' } },
  ],
}], { requirePortable: true });
const player = createCompiledPlayer(plan, {
  backend: 'wasm', runtime,
  bindings: { aperture: (value) => draw(value) }, // your SVG/Canvas writer
});
const transport = new Transport({
  root: new Timeline({ frameRate: 60 }).add(player), frameRate: 60,
});
transport.play();
// Effect cleanup: dispose transport, player, then your owned runtime.
// If loading completes after unmount, dispose that late runtime too.`;

export default function RustExperimentalPage() {
  const [runtime, setRuntime] = useState<WasmRuntime | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [loadMs, setLoadMs] = useState(0);
  const [verification, setVerification] = useState<'idle' | 'running' | 'passed' | 'failed'>(
    'idle',
  );
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [progress, setProgress] = useState(0);
  const mounted = useRef(false);
  const owned = useRef<WasmRuntime | null>(null);
  const pending = useRef(false);
  const verifyAbort = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      verifyAbort.current?.abort();
      owned.current?.dispose();
      owned.current = null;
    };
  }, []);
  const load = async () => {
    if (pending.current || owned.current) return;
    pending.current = true;
    setStatus('loading');
    setError('');
    const start = performance.now();
    try {
      const next = await loadExperimentalRuntime();
      if (!mounted.current) {
        next.dispose();
        return;
      }
      owned.current = next;
      setRuntime(next);
      setLoadMs(performance.now() - start);
      setStatus('ready');
    } catch (reason) {
      if (mounted.current) {
        setError(String(reason));
        setStatus('error');
      }
    } finally {
      pending.current = false;
    }
  };
  const verify = async () => {
    if (!runtime || verifyAbort.current) return;
    const controller = new AbortController();
    verifyAbort.current = controller;
    setVerification('running');
    setProgress(0);
    setResult(null);
    setError('');
    try {
      const plan = compileTracks(createScoreInputs(), { requirePortable: true });
      const next = await verifyScore(
        plan.ir,
        runtime,
        SCORE_FRAMES,
        SCORE_FPS,
        controller.signal,
        setProgress,
      );
      if (!controller.signal.aborted) {
        setResult(next);
        setVerification(next.passed ? 'passed' : 'failed');
      }
    } catch (reason) {
      if (!controller.signal.aborted) {
        setVerification('failed');
        setError(String(reason));
      }
    } finally {
      if (verifyAbort.current === controller) verifyAbort.current = null;
    }
  };
  return (
    <div className="rust-experimental" data-testid="rust-experimental">
      <section className="rust-intro">
        <div>
          <p className="eyebrow">EXPERIMENT 001 / COMPILED MOTION</p>
          <h2>
            Same intent.
            <br />
            <em>Different machinery.</em>
          </h2>
        </div>
        <p>
          Authored in TypeScript. Evaluated in Rust. Composed with the same React and transport
          APIs. An open laboratory for the engine beneath the image.
        </p>
      </section>
      <div className="rust-runtime" data-testid="rust-runtime" data-status={status}>
        <div>
          <span className={`rust-status-dot ${status === 'ready' ? 'is-ready' : ''}`} />
          <strong>
            {status === 'ready'
              ? 'Rust / Wasm connected'
              : status === 'loading'
                ? 'Initializing WebAssembly…'
                : status === 'error'
                  ? 'Wasm unavailable · JS remains usable'
                  : 'JavaScript ready · Rust on demand'}
          </strong>
          <p>
            {status === 'ready'
              ? `ABI 1 / f64 / ${loadMs.toFixed(0)} ms module load + initialization (cache dependent)`
              : 'The binary is fetched only when you opt in. No engine defaults change.'}
          </p>
        </div>
        <button
          data-testid="rust-load"
          className="rust-primary"
          onClick={load}
          disabled={status === 'loading' || status === 'ready'}
        >
          {status === 'ready'
            ? 'Runtime ready ✓'
            : status === 'loading'
              ? 'Loading…'
              : status === 'error'
                ? 'Retry Rust / Wasm'
                : 'Load Rust / Wasm ↗'}
        </button>
      </div>
      {error && (
        <p role="alert" className="rust-error">
          {error}
        </p>
      )}
      <DemoViewport label="Compiled vector score" height={820}>
        <ScoreLab runtime={runtime} />
      </DemoViewport>
      <section className="rust-section-heading">
        <span>02 / BATCHED EVALUATION</span>
        <h2>
          A thousand decisions.
          <br />
          One boundary crossing.
        </h2>
        <p>
          The same immutable field, sampled at the same timestamp by independent JS and Wasm
          evaluators. Canvas 2D is the shared renderer—not a Rust GPU backend.
        </p>
      </section>
      <DemoViewport label="JS / Rust particle field" height={690}>
        <BatchLab runtime={runtime} />
      </DemoViewport>
      <section className="rust-proof">
        <div>
          <span className="eyebrow">03 / SEEK WITHOUT HISTORY</span>
          <h2>
            Any frame.
            <br />
            Any order.
          </h2>
          <p>
            Run the entire 720-frame vector score forward, backward, and in a permuted order.
            Compare every numeric channel from the real Wasm kernel against the independent JS
            reference.
          </p>
          <button
            className="rust-primary"
            data-testid="rust-verify"
            onClick={verify}
            disabled={!runtime || verification === 'running'}
          >
            {verification === 'running'
              ? `Verifying ${Math.round(progress * 100)}%…`
              : 'Verify 2,160 frame samples ↗'}
          </button>
          {!runtime && (
            <p className="rust-caption">Load Rust / Wasm above to enable verification.</p>
          )}
        </div>
        <div
          className="rust-proof-result"
          data-testid="rust-verification"
          data-status={verification}
          data-comparisons={result?.comparisons ?? 0}
          data-max-error={result?.maxError ?? 0}
          role="status"
          aria-live="polite"
        >
          <span>NUMERIC STATE CONFORMANCE</span>
          <strong>
            {verification === 'passed'
              ? 'MATCH'
              : verification === 'failed'
                ? 'CHECK FAILED'
                : verification === 'running'
                  ? `${Math.round(progress * 100)}%`
                  : 'READY / —'}
          </strong>
          <p>
            {result
              ? `${result.comparisons.toLocaleString()} comparisons · max absolute error ${result.maxError.toExponential(2)}`
              : '720 frames × 3 traversal orders'}
          </p>
          <p>
            Acceptance: |Δ| / max(1, |JS|) ≤ 10⁻⁹.
            <br />
            This verifies state, not identical SVG pixels, audio or video export.
          </p>
        </div>
      </section>
      <section className="rust-boundaries">
        <h2>Power, with the boundaries visible.</h2>
        <div>
          <article>
            <span>IMPLEMENTED</span>
            <h3>Portable value programs</h3>
            <p>
              Fixed-shape numeric objects, vectors, colors and CSS units. Per-segment Bézier, spring
              easing, steps, repeats and direction folding. Batched f64 output; immutable plans;
              explicit ownership.
            </p>
          </article>
          <article>
            <span>STILL THE HOST’S JOB</span>
            <h3>Rendering & orchestration</h3>
            <p>
              React, SVG, Canvas and the existing transport remain JavaScript/browser systems.
              Arbitrary closures and changing value shapes require the host path. This is not
              automatic acceleration of every tween.
            </p>
          </article>
          <article>
            <span>NOT A PRODUCTION DEFAULT</span>
            <h3>Measure the whole frame</h3>
            <p>
              Compile, transfer and materialization costs matter. Small workloads can favor JS.
              WebGPU/wgpu rendering and native MP4 export are later milestones—not capabilities of
              this demo.
            </p>
          </article>
        </div>
      </section>
      <details className="show-code">
        <summary>React ownership & Vite integration pattern</summary>
        <Code>{integration}</Code>
        <p className="rust-caption">
          The ?url suffix is Vite-specific. The generated loader also accepts bytes or a
          WebAssembly.Module. Acquire resources in effects and keep shared runtimes caller-owned.
        </p>
      </details>
      <p className="rust-caption">
        Source: docs/src/labs/rust · Engine: src/backends + crates/motion-core · The original SVG /
        MP4 study remains available at <a href="/svg-cue-sheet">the offline comparison ↗</a>.
      </p>
    </div>
  );
}
