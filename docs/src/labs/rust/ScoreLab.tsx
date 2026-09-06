import { useEffect, useMemo, useRef, useState } from 'react';
import { Timeline, Transport } from '@dhaakon/motion';
import { compileTracks, createCompiledPlayer, type WasmRuntime } from '@dhaakon/motion/compiled';
import { ScoreScene } from './ScoreScene';
import {
  createScoreInputs,
  SCORE_ACTS,
  SCORE_FPS,
  SCORE_FRAMES,
  SCORE_INITIAL_VALUES,
} from './score';

export function ScoreLab({ runtime }: { runtime: WasmRuntime | null }) {
  const plan = useMemo(() => compileTracks(createScoreInputs(), { requirePortable: true }), []);
  const [backend, setBackend] = useState<'js' | 'wasm'>(runtime ? 'wasm' : 'js');
  const [frame, setFrame] = useState(210);
  const [values, setValues] = useState<Record<string, unknown>>(SCORE_INITIAL_VALUES);
  const [playing, setPlaying] = useState(false);
  const [reverse, setReverse] = useState(false);
  const [error, setError] = useState('');
  const [sampleMs, setSampleMs] = useState(0);
  const owner = useRef<Transport | null>(null);
  const position = useRef(210);
  const selected = backend === 'wasm' && runtime ? 'wasm' : 'js';
  useEffect(() => {
    if (runtime) setBackend('wasm');
  }, [runtime]);
  useEffect(() => {
    let player: ReturnType<typeof createCompiledPlayer> | undefined;
    let transport: Transport | undefined;
    let lastFrame = -1;
    setPlaying(false);
    setReverse(false);
    setError('');
    try {
      player = createCompiledPlayer(plan, { backend: selected, runtime: runtime ?? undefined });
      const timeline = new Timeline({ frameRate: SCORE_FPS });
      // A single compiled group remains an ordinary item on the existing transport.
      let samplingStart = 0;
      timeline.add({
        kind: 'compiled',
        totalDuration: plan.totalDuration,
        sampleAt(ms, context) {
          samplingStart = performance.now();
          player!.sampleAt(ms, context);
          const elapsed = performance.now() - samplingStart;
          const current = Math.min(SCORE_FRAMES - 1, Math.round((ms * SCORE_FPS) / 1000));
          if (current === lastFrame) return;
          lastFrame = current;
          position.current = current;
          setValues(Object.fromEntries(plan.authored.map(({ id }) => [id, player!.get(id)])));
          setFrame(current);
          setSampleMs(elapsed);
        },
      });
      transport = new Transport({
        root: timeline,
        frameRate: SCORE_FPS,
        snap: true,
        loop: [0, (SCORE_FRAMES * 1000) / SCORE_FPS],
      });
      transport.onError = (reason) => {
        transport?.pause();
        setPlaying(false);
        setError(String(reason));
      };
      owner.current = transport;
      transport.seekFrame(position.current);
      return () => {
        owner.current = null;
        transport?.dispose();
        player?.dispose();
      };
    } catch (reason) {
      owner.current = null;
      transport?.dispose();
      player?.dispose();
      setError(String(reason));
    }
  }, [plan, runtime, selected]);
  const seek = (next: number) => {
    owner.current?.pause();
    setPlaying(false);
    owner.current?.seekFrame(Math.max(0, Math.min(SCORE_FRAMES - 1, next)));
  };
  const act = SCORE_ACTS.find((item) => frame >= item.startFrame && frame < item.endFrame)!;
  return (
    <section
      className="rust-score"
      data-testid="rust-score"
      data-backend={selected}
      data-frame={frame}
    >
      <div className="rust-stage-label">
        <span>01 / CHROMATIC ASSEMBLY</span>
        <span>{selected === 'wasm' ? 'RUST / WASM' : 'COMPILED JS'} · SVG HOST</span>
      </div>
      <ScoreScene values={values} />
      <div className="rust-score-readout">
        <span>
          <b>{act.label}</b> / {act.detail}
        </span>
        <code>{String(frame).padStart(3, '0')} / 719 F</code>
      </div>
      <div className="rust-controls">
        <button
          data-testid="rust-score-play"
          className="rust-primary"
          disabled={!!error}
          onClick={() => {
            owner.current?.toggle();
            setPlaying(owner.current?.state === 'playing');
          }}
        >
          {playing ? 'Pause sequence' : 'Play sequence'}
        </button>
        <button
          data-testid="rust-score-previous"
          aria-label="Previous score frame"
          onClick={() => seek(frame - 1)}
        >
          ← 1f
        </button>
        <button
          data-testid="rust-score-next"
          aria-label="Next score frame"
          onClick={() => seek(frame + 1)}
        >
          1f →
        </button>
        <button
          aria-pressed={reverse}
          onClick={() => {
            owner.current?.setRate(reverse ? 1 : -1);
            setReverse(!reverse);
          }}
        >
          Reverse {reverse ? 'on' : 'off'}
        </button>
        <label>
          Score engine
          <select
            aria-label="Score engine"
            value={selected}
            onChange={(event) => setBackend(event.target.value as 'js' | 'wasm')}
          >
            <option value="js">Compiled JS</option>
            <option value="wasm" disabled={!runtime}>
              Rust / Wasm
            </option>
          </select>
        </label>
        <span className="rust-timing">
          {sampleMs.toFixed(3)} ms sample / {SCORE_FPS} fps score
        </span>
      </div>
      <label className="rust-scrub">
        Exact-frame seek
        <input
          data-testid="rust-score-frame"
          type="range"
          min={0}
          max={SCORE_FRAMES - 1}
          value={frame}
          onChange={(event) => seek(Number(event.target.value))}
        />
      </label>
      <div className="rust-acts">
        {SCORE_ACTS.map((item, index) => (
          <button
            key={item.id}
            data-rust-act={index}
            aria-pressed={act.id === item.id}
            onClick={() => seek(item.startFrame + 60)}
          >
            <span>
              0{index + 1} / {item.startFrame}f
            </span>
            <b>{item.label}</b>
          </button>
        ))}
      </div>
      {error && (
        <p role="alert">The selected evaluator stopped: {error}. Select Compiled JS to continue.</p>
      )}
      <p className="rust-caption">
        {plan.authored.length} immutable layer tracks. Mask apertures, sliced logo reveals,
        interference ribbons and orbital geometry share one 12-second score. The sampled values come
        from the selected engine; React and browser SVG render the pixels. Timing excludes React
        commits and rasterization.
      </p>
    </section>
  );
}
