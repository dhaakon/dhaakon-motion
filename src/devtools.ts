import type { Transport, FrameInfo } from './transport';
import type { InspectNode } from './timeline';
import { saveSheet } from './sheet';

export interface MountInspectorOptions {
  container?: HTMLElement;
  collapsed?: boolean;
  theme?: 'ink' | 'paper';
  /** Draw active pointer trails, their velocity vectors, and the winning gesture arena. */
  gestures?: boolean;
}

const STYLE = `
.dhk-inspector{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;font:12px/1.4 "IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--dhk-bg,#101010);color:var(--dhk-text,#f0eee8);border-top:1px solid var(--dhk-rule,#333);max-height:42vh;display:flex;flex-direction:column;box-sizing:border-box}
.dhk-inspector *{box-sizing:border-box}
.dhk-inspector.dhk-inspector--paper{background:var(--dhk-bg,#f0eee8);color:var(--dhk-text,#101010);border-top-color:var(--dhk-rule,#d9d5ca)}
.dhk-inspector button{font:inherit;background:transparent;color:inherit;border:1px solid currentColor;padding:2px 8px;cursor:pointer;border-radius:0}
.dhk-inspector button:hover{background:rgba(128,128,128,.2)}
.dhk-inspector input[type=range]{flex:1;accent-color:#ff5a1f}
.dhk-bar{display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid rgba(128,128,128,.3)}
.dhk-time{min-width:11ch;text-align:right;font-variant-numeric:tabular-nums}
.dhk-lanes{overflow:auto;padding:4px 10px 8px}
.dhk-lane{display:grid;grid-template-columns:14ch 1fr;gap:8px;align-items:center;padding:2px 0}
.dhk-lane-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.85}
.dhk-lane-track{position:relative;height:10px;background:rgba(128,128,128,.18)}
.dhk-lane-bar{position:absolute;top:0;bottom:0;background:#2d62ff}
.dhk-lane-marks{position:relative;height:8px;margin:2px 0 6px}
.dhk-mark{position:absolute;top:0;width:1px;height:8px;background:#d9ff43}
.dhk-cue{position:absolute;top:0;width:1px;height:8px;background:#ff5a1f}
.dhk-cue.dhk-cue--fired{background:#ff5a1f;box-shadow:0 0 4px 1px #ff5a1f}
.dhk-gesture-overlay{position:fixed;inset:0;z-index:2147482999;pointer-events:none;overflow:visible}
.dhk-gesture-overlay path{fill:none;stroke:#d9ff43;stroke-width:2;vector-effect:non-scaling-stroke}
.dhk-gesture-overlay line{stroke:#ff5a1f;stroke-width:2;vector-effect:non-scaling-stroke}
.dhk-gesture-overlay circle{fill:#d9ff43;stroke:#101010;stroke-width:2;vector-effect:non-scaling-stroke}
.dhk-gesture-state{position:fixed;right:12px;bottom:calc(42vh + 12px);z-index:2147483000;padding:6px 9px;background:#101010;color:#d9ff43;border:1px solid #d9ff43;font:10px/1.2 ui-monospace,monospace;pointer-events:none}
`;

/** `CSS.escape` isn't available in every test/SSR environment; this covers the identifier-safe subset a cue name needs. */
function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  for (const child of children) node.append(child);
  return node;
}

/** A dependency-free, plain-DOM transport bar + timeline lanes overlay. Attach it while developing; it never ships as part of a production bundle unless you import it. */
export function mountInspector(transport: Transport, options: MountInspectorOptions = {}): { unmount(): void } {
  const container = options.container ?? document.body;
  const root = el('div', { class: `dhk-inspector${options.theme === 'paper' ? ' dhk-inspector--paper' : ''}` });
  const styleTag = el('style', {}, STYLE);
  root.append(styleTag);

  const playButton = el('button', { type: 'button' }, '▶');
  const stopButton = el('button', { type: 'button' }, '■');
  const stepBackButton = el('button', { type: 'button' }, '⏮');
  const stepFwdButton = el('button', { type: 'button' }, '⏭');
  const rateLabel = el('span', {}, '1×');
  const rateDownButton = el('button', { type: 'button' }, '−');
  const rateUpButton = el('button', { type: 'button' }, '+');
  const loopButton = el('button', { type: 'button' }, 'loop');
  const copyButton = el('button', { type: 'button' }, 'copy sheet');
  const timeLabel = el('span', { class: 'dhk-time' }, '00:00:00:00');
  const scrubber = el('input', { type: 'range', min: '0', max: '1000', value: '0' });
  const bar = el('div', { class: 'dhk-bar' },
    playButton, stopButton, stepBackButton, stepFwdButton,
    rateDownButton, rateLabel, rateUpButton, loopButton,
    scrubber, timeLabel, copyButton);

  const lanes = el('div', { class: 'dhk-lanes' });
  root.append(bar, lanes);
  container.append(root);

  const gestureDisposers: Array<() => void> = [];
  if (options.gestures) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'dhk-gesture-overlay');
    const state = el('div', { class: 'dhk-gesture-state' }, 'ARENA · IDLE');
    container.append(svg, state);
    const trails = new Map<number, Array<{ x: number; y: number; t: number }>>();
    const redraw = (event: PointerEvent) => {
      const points = trails.get(event.pointerId) ?? []; points.push({ x: event.clientX, y: event.clientY, t: event.timeStamp }); if (points.length > 20) points.shift(); trails.set(event.pointerId, points);
      svg.replaceChildren();
      for (const history of trails.values()) {
        if (!history.length) continue; const last = history.at(-1)!; const first = history.find((point) => last.t - point.t <= 80) ?? history[0]; const dt = Math.max(1, last.t - first.t); const vx = (last.x - first.x) / dt; const vy = (last.y - first.y) / dt;
        const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', history.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' '));
        const vector = document.createElementNS(svg.namespaceURI, 'line'); vector.setAttribute('x1', String(last.x)); vector.setAttribute('y1', String(last.y)); vector.setAttribute('x2', String(last.x + vx * 90)); vector.setAttribute('y2', String(last.y + vy * 90));
        const point = document.createElementNS(svg.namespaceURI, 'circle'); point.setAttribute('cx', String(last.x)); point.setAttribute('cy', String(last.y)); point.setAttribute('r', '5'); svg.append(path, vector, point);
      }
    };
    const finish = (event: PointerEvent) => { redraw(event); setTimeout(() => { trails.delete(event.pointerId); if (!trails.size) svg.replaceChildren(); }, 300); };
    const arena = (event: Event) => { const detail = (event as CustomEvent<{ kind: string; priority: number }>).detail; state.textContent = `ARENA · ${detail.kind.toUpperCase()} · P${detail.priority}`; };
    document.addEventListener('pointerdown', redraw as EventListener, true); document.addEventListener('pointermove', redraw as EventListener, true); document.addEventListener('pointerup', finish as EventListener, true); document.addEventListener('pointercancel', finish as EventListener, true); document.addEventListener('dhaakon-motion:arena', arena);
    gestureDisposers.push(() => { document.removeEventListener('pointerdown', redraw as EventListener, true); document.removeEventListener('pointermove', redraw as EventListener, true); document.removeEventListener('pointerup', finish as EventListener, true); document.removeEventListener('pointercancel', finish as EventListener, true); document.removeEventListener('dhaakon-motion:arena', arena); svg.remove(); state.remove(); });
  }

  let looping = false;
  let collapsed = options.collapsed ?? false;
  lanes.hidden = collapsed;

  const setRate = (rate: number) => { transport.setRate(rate); rateLabel.textContent = `${rate}×`; };
  playButton.addEventListener('click', () => transport.toggle());
  stopButton.addEventListener('click', () => transport.stop());
  stepBackButton.addEventListener('click', () => transport.step(-1));
  stepFwdButton.addEventListener('click', () => transport.step(1));
  rateDownButton.addEventListener('click', () => setRate(Math.max(-8, transport.rate - (transport.rate > 0 ? 0.5 : -0.5))));
  rateUpButton.addEventListener('click', () => setRate(Math.min(8, transport.rate + (transport.rate >= 0 ? 0.5 : -0.5))));
  loopButton.addEventListener('click', () => {
    looping = !looping;
    transport.setLoop(looping);
    loopButton.style.opacity = looping ? '1' : '.5';
  });
  copyButton.addEventListener('click', () => {
    let text: string;
    try { text = JSON.stringify(saveSheet(transport.root), null, 2); } catch (err) { text = `/* could not serialize: ${(err as Error).message} */`; }
    navigator.clipboard?.writeText?.(text).catch(() => {});
  });
  let scrubbing = false;
  scrubber.addEventListener('pointerdown', () => { scrubbing = true; });
  scrubber.addEventListener('pointerup', () => { scrubbing = false; });
  scrubber.addEventListener('input', () => {
    const duration = Number.isFinite(transport.duration) ? transport.duration : 0;
    transport.seek((Number(scrubber.value) / 1000) * duration);
  });

  const onKeydown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
    const step = event.shiftKey ? 10 : 1;
    if (event.key === ' ') { event.preventDefault(); transport.toggle(); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); transport.step(step); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); transport.step(-step); }
    else if (event.key === 'Home') { event.preventDefault(); transport.seek(0); }
    else if (event.key === 'End' && Number.isFinite(transport.duration)) { event.preventDefault(); transport.seek(transport.duration); }
    else if (event.key === 'l' || event.key === 'L') loopButton.click();
  };
  document.addEventListener('keydown', onKeydown);

  const laneNodes = new Map<string, { track: HTMLElement; bar: HTMLElement; marks: HTMLElement }>();
  function renderLanes(node: InspectNode, depth: number, into: HTMLElement, total: number) {
    const row = el('div', { class: 'dhk-lane' });
    const name = el('span', { class: 'dhk-lane-name' }, `${'  '.repeat(depth)}${node.name ?? node.kind}`);
    const trackWrap = el('div', {});
    const track = el('div', { class: 'dhk-lane-track' });
    const barEl = el('div', { class: 'dhk-lane-bar' });
    track.append(barEl);
    const marks = el('div', { class: 'dhk-lane-marks' });
    trackWrap.append(track, marks);
    row.append(name, trackWrap);
    into.append(row);
    laneNodes.set(`${depth}:${node.name ?? node.kind}:${node.start}`, { track, bar: barEl, marks });

    const span = Math.max(1, total);
    barEl.style.left = `${(node.start / span) * 100}%`;
    barEl.style.width = `${Math.max(0.5, ((node.end - node.start) / span) * 100)}%`;
    for (const marker of node.markers) marks.append(el('div', { class: 'dhk-mark', style: `left:${(marker.time / span) * 100}%` }));
    for (const cue of node.cues) marks.append(el('div', { class: `dhk-cue`, 'data-cue': cue.name, style: `left:${(cue.time / span) * 100}%` }));

    for (const child of node.children) renderLanes(child, depth + 1, into, total);
  }
  function rebuildLanes() {
    lanes.replaceChildren();
    laneNodes.clear();
    const inspected = transport.root.inspect();
    const total = (Number.isFinite(inspected.totalDuration) ? inspected.totalDuration : inspected.duration) || 1;
    if (inspected.markers.length || inspected.cues.length) {
      const row = el('div', { class: 'dhk-lane' });
      row.append(el('span', { class: 'dhk-lane-name' }, 'timeline'));
      const marks = el('div', { class: 'dhk-lane-marks' });
      for (const marker of inspected.markers) marks.append(el('div', { class: 'dhk-mark', style: `left:${(marker.time / total) * 100}%` }));
      for (const cue of inspected.cues) marks.append(el('div', { class: 'dhk-cue', 'data-cue': cue.name, style: `left:${(cue.time / total) * 100}%` }));
      row.append(marks);
      lanes.append(row);
    }
    for (const child of inspected.children) renderLanes(child, 0, lanes, total);
  }
  rebuildLanes();

  const flashTimers = new Map<Element, ReturnType<typeof setTimeout>>();
  function updateFrom(info: FrameInfo) {
    timeLabel.textContent = info.timecode;
    const duration = Number.isFinite(transport.duration) ? transport.duration : 0;
    if (!scrubbing) scrubber.value = String(duration ? Math.round((info.time / duration) * 1000) : 0);
    playButton.textContent = transport.state === 'playing' ? '⏸' : '▶';
    for (const cue of info.cues ?? []) {
      lanes.querySelectorAll(`[data-cue="${cssEscape(cue.name)}"]`).forEach((node) => {
        node.classList.add('dhk-cue--fired');
        const existing = flashTimers.get(node); if (existing) clearTimeout(existing);
        flashTimers.set(node, setTimeout(() => node.classList.remove('dhk-cue--fired'), 220));
      });
    }
  }
  updateFrom({ time: transport.time, frame: transport.frame, timecode: transport.timecode, delta: 0, rate: transport.rate, direction: 1, frameRate: transport.frameRate });

  let rebuildQueued = false;
  const unsubscribeTick = transport.subscribe((info) => {
    updateFrom(info);
    if (!rebuildQueued) {
      rebuildQueued = true;
      queueMicrotask(() => { rebuildQueued = false; rebuildLanes(); });
    }
  });
  const detachStateOutput = transport.attach({
    name: 'devtools',
    onStateChange: () => { playButton.textContent = transport.state === 'playing' ? '⏸' : '▶'; },
  });

  return {
    unmount() {
      unsubscribeTick();
      detachStateOutput();
      document.removeEventListener('keydown', onKeydown);
      for (const timer of flashTimers.values()) clearTimeout(timer);
      gestureDisposers.forEach((dispose) => dispose());
      root.remove();
    },
  };
}
