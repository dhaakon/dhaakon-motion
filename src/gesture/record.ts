import { Track, frameRate, frameToMs, msToFrame, type FrameRateInput } from '@dhaakon/motion';
import type { ManualDriver } from '../testing';

export interface GestureSample { id: number; type: string; kind: 'down' | 'move' | 'up' | 'cancel'; x: number; y: number; t: number; pressure?: number }
export interface GestureRecording { $schema: 'dhaakon-motion/gesture/1'; frameRate?: FrameRateInput; element?: { width: number; height: number }; samples: GestureSample[] }

export function record(element: Element, options: { normalize?: boolean; frameRate?: FrameRateInput } = {}) {
  const samples: GestureSample[] = []; const rect = element.getBoundingClientRect(); let firstTime: number | undefined;
  const listeners = new Map<string, EventListener>();
  const add = (name: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel', kind: GestureSample['kind']) => {
    const listener = ((event: PointerEvent) => { firstTime ??= event.timeStamp; const width = Math.max(1, rect.width); const height = Math.max(1, rect.height); samples.push({ id: event.pointerId, type: event.pointerType || 'mouse', kind, x: options.normalize ? (event.clientX - rect.left) / width : event.clientX, y: options.normalize ? (event.clientY - rect.top) / height : event.clientY, t: event.timeStamp - firstTime, ...(event.pressure ? { pressure: event.pressure } : {}) }); }) as EventListener;
    listeners.set(name, listener); element.addEventListener(name, listener);
  };
  add('pointerdown', 'down'); add('pointermove', 'move'); add('pointerup', 'up'); add('pointercancel', 'cancel');
  return { stop(): GestureRecording { for (const [name, listener] of listeners) element.removeEventListener(name, listener); return { $schema: 'dhaakon-motion/gesture/1', ...(options.frameRate ? { frameRate: options.frameRate } : {}), element: { width: rect.width, height: rect.height }, samples: samples.slice() }; } };
}

function dispatchSample(sample: GestureSample, element: Element, recording: GestureRecording) {
  const rect = element.getBoundingClientRect(); const normalized = recording.element && sample.x >= 0 && sample.x <= 1 && sample.y >= 0 && sample.y <= 1;
  const x = normalized ? rect.left + sample.x * rect.width : sample.x; const y = normalized ? rect.top + sample.y * rect.height : sample.y;
  const event = new PointerEvent(`pointer${sample.kind === 'cancel' ? 'cancel' : sample.kind}`, { bubbles: true, cancelable: true, pointerId: sample.id, pointerType: sample.type, clientX: x, clientY: y, pressure: sample.pressure ?? 0, button: 0, buttons: sample.kind === 'up' || sample.kind === 'cancel' ? 0 : 1 });
  Object.defineProperty(event, 'timeStamp', { value: sample.t }); element.dispatchEvent(event);
}

export async function replay(recording: GestureRecording, element: Element, options: { driver?: ManualDriver; speed?: number; from?: number; to?: number } = {}) {
  const speed = Math.max(.0001, options.speed ?? 1); const from = options.from ?? -Infinity; const to = options.to ?? Infinity;
  const samples = recording.samples.filter((sample) => sample.t >= from && sample.t <= to); let previous = samples[0]?.t ?? 0;
  for (const sample of samples) {
    const delay = (sample.t - previous) / speed;
    if (options.driver) options.driver.advance(delay); else if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    dispatchSample(sample, element, recording); previous = sample.t;
  }
}

interface TrackPoint { x: number; y: number; t: number }
function distanceToSegment(point: TrackPoint, a: TrackPoint, b: TrackPoint) {
  const dx = b.x - a.x; const dy = b.y - a.y; if (dx === 0 && dy === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const u = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy))); return Math.hypot(point.x - (a.x + u * dx), point.y - (a.y + u * dy));
}
function rdp(points: TrackPoint[], tolerance: number): TrackPoint[] {
  if (points.length <= 2) return points; let max = 0; let index = 0;
  for (let i = 1; i < points.length - 1; i += 1) { const distance = distanceToSegment(points[i], points[0], points.at(-1)!); if (distance > max) { max = distance; index = i; } }
  if (max <= tolerance) return [points[0], points.at(-1)!]; const left = rdp(points.slice(0, index + 1), tolerance); const right = rdp(points.slice(index), tolerance); return [...left.slice(0, -1), ...right];
}

export function gestureToTrack(recording: GestureRecording, options: { pointerId?: number; frameRate: FrameRateInput; axis?: 'x' | 'y' | 'both'; simplify?: number }) {
  const pointerId = options.pointerId ?? recording.samples[0]?.id; const rate = frameRate(options.frameRate); const axis = options.axis ?? 'x';
  const raw = recording.samples.filter((sample) => sample.id === pointerId && sample.kind !== 'cancel').map(({ x, y, t }) => ({ x, y, t }));
  const simplified = rdp(raw, options.simplify ?? 0); const byFrame = new Map<number, TrackPoint>();
  for (const point of simplified) byFrame.set(msToFrame(point.t, rate), point);
  const keyframes = [...byFrame.entries()].sort(([a], [b]) => a - b).map(([frame, point]) => ({ at: frameToMs(frame, rate), value: axis === 'both' ? { x: point.x, y: point.y } : axis === 'x' ? point.x : point.y }));
  if (!keyframes.length) keyframes.push({ at: 0, value: axis === 'both' ? { x: 0, y: 0 } : 0 });
  return new Track<any>({ frameRate: rate, keyframes, apply: () => {} });
}
