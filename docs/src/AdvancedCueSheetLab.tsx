import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@dhaakon/ui';
import {
  OfflineTransport,
  Transport,
  frameToMs,
  loadSheet,
  validateSheet,
  type CueSheet,
  type SheetItem,
} from '@dhaakon/motion';
import { useInView, useReducedMotion } from '@dhaakon/motion/react';
import {
  ADVANCED_CUE_FRAMES,
  CUE_FPS,
  CUE_VIDEO,
  advancedCueLayers,
  advancedCueSheetSource,
  cueActs,
  initialCueStates,
  type CueTarget,
} from './advancedCueSheet';
import { CueScene } from './cue-sheet/CueScene';
import { assertCueState, createCueRenderer, type CueRenderer } from './cue-sheet/renderer';
import { videoFrame, videoSyncReport } from './cue-sheet/videoSync';
import './cue-sheet/cue-sheet.css';

interface RenderAPI {
  frames: number;
  fps: number;
  source: string;
  seek: (frame: number) => void;
  png: (frame: number, width?: number) => Promise<string>;
  profile?: {
    frame: number;
    width: number;
    evaluateAndWriteMs: number;
    serializeMs: number;
    decodeMs: number;
    drawMs: number;
    pngMs: number;
    totalMs: number;
  };
}
declare global {
  interface Window {
    __dhaakonCueRender?: RenderAPI;
  }
}

// Adapter-specific limits, not a replacement for general cue-sheet validation.
function checkResources(source: string, sheet: CueSheet) {
  if (source.length > 350_000) throw new Error('Show source is limited to 350 kB.');
  let count = 0;
  const targets = new Set<string>();
  function visit(items: SheetItem[], depth: number) {
    if (depth > 8) throw new Error('Show nesting is limited to eight levels.');
    for (const item of items) {
      if (++count > 160) throw new Error('Show is limited to 160 items.');
      if ('repeat' in item && item.repeat)
        throw new Error('Use explicit keyframes for this finite comparison show.');
      if (item.type === 'timeline') visit((item as { items: SheetItem[] }).items, depth + 1);
      else {
        if (item.type !== 'track' && item.type !== 'tween')
          throw new Error('This SVG editor supports tracks, tweens, and nested timelines.');
        const target = String(item.target);
        if (!Object.hasOwn(initialCueStates, target))
          throw new Error(`Unknown SVG target "${target}".`);
        if (targets.has(target))
          throw new Error(`Target "${target}" must have exactly one writer.`);
        targets.add(target);
        if (item.type === 'track' && (item.keyframes as unknown[]).length > 200)
          throw new Error('Each track is limited to 200 keyframes.');
      }
    }
  }
  if (sheet.repeat) throw new Error('Use the transport loop instead of repeating the root sheet.');
  visit(sheet.items, 0);
  return targets;
}

export function AdvancedCueSheetShowcase() {
  const renderOnly = new URLSearchParams(window.location.search).get('render') === '1';
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const reduced = useReducedMotion();
  const [visibilityRef, inView] = useInView<HTMLDivElement>({
    once: false,
    amount: 0.03,
    margin: '240px 0px',
  });
  const svgRef = useRef<SVGSVGElement>(null);
  const rendererRef = useRef<CueRenderer | null>(null);
  const transportRef = useRef<Transport | null>(null);
  const detachRef = useRef<(() => void) | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const decodedRef = useRef<number | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const frameRef = useRef<HTMLOutputElement>(null);
  const timecodeRef = useRef<HTMLOutputElement>(null);
  const phaseRef = useRef<HTMLOutputElement>(null);
  const decodedOutput = useRef<HTMLOutputElement>(null);
  const deltaOutput = useRef<HTMLOutputElement>(null);
  const lanesRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);
  const inspectorRef = useRef<HTMLPreElement>(null);
  const selectedRef = useRef<CueTarget>('ink');
  const visibility = useRef({ inView, reduced, hidden: document.hidden });
  visibility.current = { inView, reduced, hidden: document.hidden };
  const wantsPlay = useRef(!reduced && !renderOnly);
  const [source, setSource] = useState(advancedCueSheetSource);
  const [playing, setPlaying] = useState(false);
  const [report, setReport] = useState('VALIDATING CUE SHEET…');
  const [error, setError] = useState('');
  const [baseline, setBaseline] = useState(true);
  const [status, setStatus] = useState('LOADING');
  const [duration, setDuration] = useState(ADVANCED_CUE_FRAMES);
  const [markers, setMarkers] = useState<Array<{ name: string; time: number }>>([]);
  const [selected, setSelected] = useState<CueTarget>('ink');
  const [solo, setSolo] = useState<CueTarget | null>(null);
  const [muted, setMuted] = useState<CueTarget[]>([]);
  const [exploded, setExploded] = useState(false);
  const [layout, setLayout] = useState<'compare' | 'cinema'>('compare');

  const syncVideo = useCallback((force = false, decodedTime?: number) => {
    const video = videoRef.current;
    const transport = transportRef.current;
    if (!video || !transport) return;
    const expected = videoFrame((transport.time / 1000) % 24, CUE_FPS, ADVANCED_CUE_FRAMES);
    if (decodedTime !== undefined) {
      decodedRef.current = videoFrame(decodedTime, CUE_FPS, ADVANCED_CUE_FRAMES);
      setStatus(
        transport.state === 'playing' ? (transport.rate < 0 ? 'FRAME CHASE' : 'ROLLING') : 'HOLD',
      );
    }
    // currentTime may already be the requested seek destination. Only the
    // requestVideoFrameCallback branch may update decodedRef and its readout.
    if (video.readyState >= 1 && Number.isFinite(video.duration)) {
      const position = videoFrame(video.currentTime, CUE_FPS, ADVANCED_CUE_FRAMES);
      const exact = force || transport.state !== 'playing' || transport.rate < 0;
      if (!video.seeking && (exact ? position !== expected : Math.abs(position - expected) > 2)) {
        pendingSeekRef.current = expected;
        // Center of the frame avoids H.264 timestamp rounding selecting n-1.
        video.currentTime = (expected + 0.25) / CUE_FPS;
      }
      if (transport.state !== 'playing' || transport.rate < 0) video.pause();
    }
    if (decodedRef.current === pendingSeekRef.current) pendingSeekRef.current = null;
    const result = videoSyncReport(
      expected,
      decodedRef.current,
      video.seeking || pendingSeekRef.current !== null,
    );
    if (decodedOutput.current) decodedOutput.current.value = result.frame;
    if (deltaOutput.current) deltaOutput.current.value = result.delta;
  }, []);
  const matchVideo = useCallback(() => {
    const video = videoRef.current;
    const transport = transportRef.current;
    if (!video || !transport) return;
    syncVideo(true);
    if (transport.state === 'playing' && transport.rate > 0 && !visibility.current.hidden) {
      video.playbackRate = transport.rate;
      void video.play().catch(() => setStatus('PLAY BLOCKED'));
    } else video.pause();
  }, [syncVideo]);
  const dispose = useCallback(() => {
    detachRef.current?.();
    detachRef.current = null;
    transportRef.current?.dispose();
    transportRef.current = null;
    videoRef.current?.pause();
  }, []);

  const install = useCallback(
    (nextSource: string) => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      try {
        if (nextSource.length > 350_000) throw new Error('Show source is limited to 350 kB.');
        const parsed: unknown = JSON.parse(nextSource);
        const validation = validateSheet(parsed);
        if (!validation.ok)
          throw new Error(validation.errors.map((e) => `${e.path}: ${e.message}`).join('\n'));
        const names = checkResources(nextSource, validation.sheet);
        const probe = loadSheet(validation.sheet, {
          targets: Object.fromEntries(
            [...names].map((name) => [
              name,
              (value: unknown) => assertCueState(name as CueTarget, value),
            ]),
          ),
        });
        const frames = Math.round(probe.duration / frameToMs(1, probe.frameRate));
        if (Math.abs(frameToMs(1, probe.frameRate) - 1000 / 24) > 1e-8)
          throw new Error('This comparison is authored at 24 fps. Keep frameRate: 24.');
        if (!Number.isFinite(frames) || frames < 1 || frames > 1440)
          throw new Error('Show duration must be between 1 and 1440 frames.');
        for (let frame = 0; frame <= frames; frame++)
          probe.sampleAt(frameToMs(frame, probe.frameRate));
        const timeline = loadSheet(validation.sheet, { targets: renderer.targets });
        const transport = renderOnly
          ? new OfflineTransport({
              root: timeline,
              frameRate: 24,
              snap: true,
              duration: timeline.duration,
            })
          : new Transport({
              root: timeline,
              frameRate: 24,
              snap: true,
              duration: timeline.duration,
              loop: true,
            });
        dispose();
        renderer.reset();
        transportRef.current = transport;
        setDuration(frames);
        setMarkers([...timeline.markers]);
        setBaseline(nextSource === advancedCueSheetSource);
        setReport(`VALID / ${timeline.items.length} GROUPS / ${names.size} TARGETS / ${frames}F`);
        setError('');
        detachRef.current = transport.subscribe((info) => {
          const frame = Math.min(frames - 1, info.frame);
          renderer.frame(frame);
          if (frameRef.current) frameRef.current.value = String(frame).padStart(3, '0');
          if (timecodeRef.current) timecodeRef.current.value = info.timecode;
          if (phaseRef.current)
            phaseRef.current.value =
              [...timeline.markers].reverse().find((marker) => marker.time <= info.time)?.name ??
              'CONSTRUCT';
          if (scrubRef.current) {
            scrubRef.current.value = String(frame);
            scrubRef.current.setAttribute(
              'aria-valuetext',
              `Frame ${frame} of ${frames - 1}; ${info.timecode}`,
            );
          }
          lanesRef.current?.style.setProperty('--cue-progress', String(frame / frames));
          if (inspectorRef.current)
            inspectorRef.current.textContent = JSON.stringify(
              renderer.states[selectedRef.current],
              null,
              2,
            );
          syncVideo();
        });
        const hold = visibility.current.reduced;
        wantsPlay.current = !hold && !renderOnly;
        transport.seekFrame(hold ? Math.min(504, frames - 1) : 0);
        if (wantsPlay.current && visibility.current.inView && !visibility.current.hidden)
          transport.play();
        setPlaying(transport.state === 'playing');
        matchVideo();
      } catch (reason) {
        setError((reason as Error).message);
        setReport('INVALID / LAST GOOD TAKE PRESERVED');
      }
    },
    [dispose, matchVideo, renderOnly, syncVideo],
  );

  useEffect(() => {
    if (!svgRef.current) return;
    const renderer = createCueRenderer(svgRef.current);
    rendererRef.current = renderer;
    install(advancedCueSheetSource);
    if (!transportRef.current) return dispose;
    if (renderOnly) {
      const canvas = document.createElement('canvas');
      const api: RenderAPI = {
        frames: ADVANCED_CUE_FRAMES,
        fps: CUE_FPS,
        source: advancedCueSheetSource,
        seek(frame) {
          if (!Number.isInteger(frame) || frame < 0 || frame >= ADVANCED_CUE_FRAMES)
            throw new Error('Frame outside encoded range.');
          transportRef.current?.seekFrame(frame);
        },
        async png(frame, width = 1920) {
          if (![960, 1920, 3840].includes(width))
            throw new Error('Render width must be 960, 1920, or 3840.');
          const start = performance.now();
          api.seek(frame);
          const sampled = performance.now();
          const svg = svgRef.current!;
          const serialized = new XMLSerializer().serializeToString(svg);
          const serializedAt = performance.now();
          const image = new Image();
          image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
          await image.decode();
          const decoded = performance.now();
          canvas.width = width;
          canvas.height = (width * 9) / 16;
          canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
          const drawn = performance.now();
          const png = canvas.toDataURL('image/png').split(',')[1];
          const finished = performance.now();
          api.profile = {
            frame,
            width,
            evaluateAndWriteMs: sampled - start,
            serializeMs: serializedAt - sampled,
            decodeMs: decoded - serializedAt,
            drawMs: drawn - decoded,
            pngMs: finished - drawn,
            totalMs: finished - start,
          };
          return png;
        },
      };
      window.__dhaakonCueRender = api;
    }
    return () => {
      delete window.__dhaakonCueRender;
      dispose();
      rendererRef.current = null;
    };
  }, [dispose, install, renderOnly]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (typeof video.requestVideoFrameCallback !== 'function') {
      setStatus('DECODE TELEMETRY UNSUPPORTED');
      return;
    }
    let active = true;
    let handle = 0;
    const callback: VideoFrameRequestCallback = (_now, metadata) => {
      if (!active) return;
      syncVideo(false, metadata.mediaTime);
      handle = video.requestVideoFrameCallback(callback);
    };
    handle = video.requestVideoFrameCallback(callback);
    return () => {
      active = false;
      video.cancelVideoFrameCallback(handle);
      video.pause();
    };
  }, [syncVideo]);
  useEffect(() => {
    if (renderOnly) return;
    const reconcile = () => {
      visibility.current.hidden = document.hidden;
      const transport = transportRef.current;
      if (!transport) return;
      if (reduced) {
        wantsPlay.current = false;
        transport.pause().seekFrame(Math.min(504, duration - 1));
      } else if (inView && wantsPlay.current && !document.hidden) transport.play();
      else transport.pause();
      setPlaying(transport.state === 'playing');
      matchVideo();
    };
    reconcile();
    document.addEventListener('visibilitychange', reconcile);
    return () => document.removeEventListener('visibilitychange', reconcile);
  }, [duration, inView, matchVideo, reduced, renderOnly]);
  useEffect(() => {
    rendererRef.current?.inspect({ solo, muted, exploded });
  }, [solo, muted, exploded]);
  useEffect(() => {
    selectedRef.current = selected;
    if (inspectorRef.current)
      inspectorRef.current.textContent = JSON.stringify(
        rendererRef.current?.states[selected],
        null,
        2,
      );
  }, [selected]);

  function seek(frame: number) {
    wantsPlay.current = false;
    transportRef.current?.pause().seekFrame(Math.max(0, Math.min(duration - 1, frame)));
    setPlaying(false);
    matchVideo();
  }
  function toggle() {
    const t = transportRef.current;
    if (!t) return;
    wantsPlay.current = t.state !== 'playing';
    if (wantsPlay.current) t.play();
    else t.pause();
    setPlaying(t.state === 'playing');
    matchVideo();
  }
  if (renderOnly)
    return (
      <div className="cue-render-only">
        <CueScene id={id} sceneRef={svgRef} />
      </div>
    );
  const altered = !baseline || solo !== null || muted.length > 0 || exploded;
  return (
    <article
      id="json-svg-cue-sheet"
      className={`svg-cue-example cue-v2 ${layout === 'cinema' ? 'cue-cinema' : ''}`}
    >
      <header>
        <div>
          <span>[ MOTION STUDY 002 / FIVE ACTS ]</span>
          <h3>
            Ink / Signal<span className="cue-edition">DIRECTOR’S CUT</span>
          </h3>
          <p>
            From a single line to a fractured identity. Twenty-four seconds, 23 renderer targets,
            one editable JSON score. Original SVG artwork; analytic geometry; no baked animation in
            the live pane.
          </p>
        </div>
        <div className="svg-cue-badges">
          <span>576 FRAMES</span>
          <span>24 FPS</span>
          <span>1080P MASTER</span>
        </div>
      </header>
      <div className="svg-cue-lab">
        <nav className="cue-acts" aria-label="Composition acts">
          {cueActs.map((act, i) => (
            <button type="button" key={act.name} onClick={() => seek(act.from)}>
              <small>
                0{i + 1} / {(act.from / 24).toFixed(1)}s
              </small>
              <b>{act.name}</b>
              <span>{act.subtitle}</span>
            </button>
          ))}
        </nav>
        <div className="cue-view-controls">
          <span>ONE SCORE / TWO RENDER PATHS</span>
          <button
            type="button"
            onClick={() => setLayout(layout === 'compare' ? 'cinema' : 'compare')}
          >
            {layout === 'compare' ? 'Cinema view ↗' : 'Side-by-side view ↙'}
          </button>
        </div>
        <div
          className="svg-cue-compare"
          ref={visibilityRef}
          role="group"
          aria-label="Live tween and offline render comparison"
        >
          <section className="svg-cue-render-pane">
            <header className="svg-cue-render-head">
              <span>
                <i /> LIVE TWEEN
              </span>
              <b>{altered ? 'INSPECTION / CUSTOM LIVE' : 'JSON → SVG / 24 FPS'}</b>
            </header>
            <div className="svg-cue-stage" data-testid="advanced-cue-stage">
              <CueScene id={id} sceneRef={svgRef} />
            </div>
          </section>
          <section className="svg-cue-render-pane">
            <header className="svg-cue-render-head">
              <span>
                <i /> OFFLINE MP4
              </span>
              <small className="svg-cue-render-status" role="status">
                {status}
              </small>
              <a href={CUE_VIDEO} download>
                DOWNLOAD 1080P ↗
              </a>
            </header>
            <div className="svg-cue-offline-stage">
              <video
                ref={videoRef}
                src={CUE_VIDEO}
                muted
                playsInline
                preload="auto"
                aria-label="Offline-rendered Ink / Signal MP4"
                onLoadedMetadata={() => {
                  setStatus('READY');
                  matchVideo();
                }}
                onTimeUpdate={() => syncVideo()}
                onSeeked={() => syncVideo(true)}
                onPlaying={() => setStatus('ROLLING')}
                onPause={() => setStatus('HOLD')}
                onError={() => setStatus('UNAVAILABLE')}
                onEnded={() => matchVideo()}
              />
              <div className="svg-cue-offline-meta">
                <span>H.264 · 576 FRAMES</span>
                <span>
                  DECODED{' '}
                  <output ref={decodedOutput} aria-label="Offline MP4 frame">
                    —
                  </output>
                </span>
                <span>
                  Δ{' '}
                  <output ref={deltaOutput} aria-label="Frame sync delta">
                    WAIT
                  </output>
                </span>
              </div>
            </div>
          </section>
        </div>
        <p className="svg-cue-compare-note">
          <span>{altered ? 'CUSTOM LIVE / OFFLINE BASELINE' : 'DECODED-FRAME TELEMETRY'}</span>{' '}
          {altered
            ? 'Solo, mute, exploded view, and JSON edits affect only the live pane. Restore the composition to compare with the original MP4.'
            : 'Both renders are authored at 24 fps. Live SVG rasterizes at pane size; the MP4 was captured at 1080p. The counter reports presented video frames; WAIT / SEEK is not sync confirmation. Rasterization and lossy H.264 can differ.'}
        </p>
        <div className="svg-cue-transport">
          <div>
            <span>MASTER TIMECODE</span>
            <output ref={timecodeRef}>00:00:00:00</output>
          </div>
          <div>
            <span>LIVE FRAME</span>
            <output ref={frameRef}>000</output>
          </div>
          <div>
            <span>PHASE</span>
            <output ref={phaseRef}>CONSTRUCT</output>
          </div>
          <div>
            <span>OFFLINE MASTER</span>
            <output>
              1920 × 1080<small>24 SECONDS / SILENT</small>
            </output>
          </div>
        </div>
        <div className="cue-primary-controls">
          <Button variant="accent" size="sm" onClick={toggle}>
            {playing ? 'Pause' : 'Play'} both
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => seek((transportRef.current?.frame ?? 0) - 1)}
          >
            −1f
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => seek((transportRef.current?.frame ?? 0) + 1)}
          >
            +1f
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const t = transportRef.current;
              if (!t) return;
              t.reverse().play();
              wantsPlay.current = true;
              setPlaying(true);
              matchVideo();
            }}
          >
            Reverse
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const t = transportRef.current;
              if (!t) return;
              if (t.rate < 0) t.reverse();
              seek(0);
              toggle();
            }}
          >
            Restart
          </Button>
          <label className="cue-main-scrub">
            <span>SCRUB / {duration} FRAMES</span>
            <input
              ref={scrubRef}
              type="range"
              min="0"
              max={duration - 1}
              step="1"
              defaultValue="0"
              aria-label="Scrub Ink / Signal cue sheet"
              onInput={(event) => seek(Number(event.currentTarget.value))}
            />
          </label>
        </div>
        <div className="cue-marker-buttons" role="group" aria-label="Cue sheet markers">
          {markers.map((marker) => (
            <button
              type="button"
              key={marker.name}
              aria-label={`Seek to ${marker.name}`}
              onClick={() => seek(Math.round((marker.time / 1000) * 24))}
            >
              {marker.name}
              <small>{Math.round((marker.time / 1000) * 24)}f</small>
            </button>
          ))}
        </div>
        <div className="cue-breakdown-head">
          <div>
            <span>THE ANATOMY OF A FRAME</span>
            <h4>Every layer has a job.</h4>
          </div>
          <div>
            <button type="button" aria-pressed={exploded} onClick={() => setExploded(!exploded)}>
              Exploded view
            </button>
            <button
              type="button"
              onClick={() => {
                setSolo(null);
                setMuted([]);
                setExploded(false);
              }}
            >
              Restore layers
            </button>
          </div>
        </div>
        <div className="svg-cue-workbench">
          <div className="svg-cue-sequencer">
            <div className="cue-lane-ruler">
              <span>23 TARGETS / SELECT TO INSPECT</span>
              <span>0s — 24s</span>
            </div>
            <div className="svg-cue-lanes cue-layers" ref={lanesRef}>
              <i className="svg-cue-playhead" />
              {advancedCueLayers.map((layer) => (
                <div key={layer.target} className={selected === layer.target ? 'is-selected' : ''}>
                  <span>
                    <button
                      type="button"
                      onClick={() => setSelected(layer.target)}
                      aria-label={`Inspect ${layer.target}`}
                    >
                      <b>{layer.label}</b>
                      <small>{layer.effect}</small>
                    </button>
                    <button
                      type="button"
                      className="cue-lane-toggle"
                      aria-label={`Solo ${layer.target}`}
                      aria-pressed={solo === layer.target}
                      onClick={() => setSolo(solo === layer.target ? null : layer.target)}
                    >
                      S
                    </button>
                    <button
                      type="button"
                      className="cue-lane-toggle"
                      aria-label={`Mute ${layer.target}`}
                      aria-pressed={muted.includes(layer.target)}
                      onClick={() =>
                        setMuted(
                          muted.includes(layer.target)
                            ? muted.filter((t) => t !== layer.target)
                            : [...muted, layer.target],
                        )
                      }
                    >
                      M
                    </button>
                  </span>
                  <button
                    type="button"
                    className="cue-keyframes"
                    aria-label={`Seek to ${layer.target} entrance`}
                    onClick={() => seek(layer.from)}
                  >
                    <i
                      style={{
                        left: `${(layer.from / 576) * 100}%`,
                        width: `${((layer.to - layer.from) / 576) * 100}%`,
                        background: layer.color,
                      }}
                    />
                    {layer.keyframes.map((frame) => (
                      <em
                        key={frame}
                        style={{ left: `${(frame / 576) * 100}%`, borderColor: layer.color }}
                      />
                    ))}
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="svg-cue-source">
            <div>
              <span>LIVE TARGET / {selected.toUpperCase()}</span>
              <b>{advancedCueLayers.find((layer) => layer.target === selected)?.effect}</b>
            </div>
            <pre
              className="cue-state-inspector"
              ref={inspectorRef}
              aria-label="Selected target values"
            />
            <p className="cue-inspector-note">
              S isolates a pass. M mutes it. Camera and finish are global modifiers. Geometry is
              derived from these sampled controls, not a second clock.
            </p>
            <details open>
              <summary>
                EDIT THE JSON SCORE <span>{report}</span>
              </summary>
              <label htmlFor={`${id}-source`}>Editable source</label>
              <textarea
                id={`${id}-source`}
                value={source}
                onChange={(event) => setSource(event.target.value)}
                spellCheck={false}
              />
              {error && <pre role="alert">{error}</pre>}
              <div className="svg-cue-controls">
                <Button variant="accent" size="sm" onClick={() => install(source)}>
                  Validate + load
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSource(advancedCueSheetSource);
                    install(advancedCueSheetSource);
                  }}
                >
                  Reset JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void navigator.clipboard?.writeText(source)}
                >
                  Copy
                </Button>
              </div>
            </details>
          </div>
        </div>
        <footer className="cue-render-recipe">
          <span>OFFLINE RECIPE</span>
          <code>npm run docs:render-cue</code>
          <p>
            A fresh, nonplaying OfflineTransport samples frames 0–575. The same SVG adapter
            rasterizes each frame at 1080p; GStreamer encodes the PNG sequence. No real-time screen
            recording. No claim of lossless MP4 pixel identity.
          </p>
        </footer>
      </div>
    </article>
  );
}
