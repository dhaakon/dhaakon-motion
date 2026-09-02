import { Tween, MotionValue, type TweenOptions } from './core';
import { Timeline, type TimelineOptions } from './timeline';
import { Track } from './track';
import type { CueEvent, CueOptions, TimelineItem } from './items';
import { resolveEasing, serializeEasing, type EasingFunction, type EasingInput } from './easing';
import { frameRate, parseTime, type FrameRateInput, type TimeInput } from './time';
import type { MotionValueShape } from './interpolate';
import { InertiaItem, SpringItem, type InertiaOptions, type PhysicsSpringOptions } from './physics';

export type SheetDirection = 'normal' | 'alternate';

export interface SheetMarker { name: string; at: TimeInput; color?: string; payload?: unknown; }
export interface SheetCue { name: string; at: TimeInput; payload?: unknown; once?: boolean; }
export interface SheetRegion { name: string; from: TimeInput; to: TimeInput; payload?: unknown; once?: boolean; }

export interface TweenSheetItem {
  type: 'tween'; name?: string; at?: TimeInput; target?: string;
  from: MotionValueShape; to: MotionValueShape;
  duration?: TimeInput; delay?: TimeInput; repeat?: number; repeatDelay?: TimeInput; yoyo?: boolean; easing?: EasingInput;
}
export interface TrackSheetItem {
  type: 'track'; name?: string; at?: TimeInput; target?: string;
  repeat?: number; repeatDelay?: TimeInput; direction?: SheetDirection; easing?: EasingInput;
  keyframes: Array<{ at: TimeInput; value: MotionValueShape; easing?: EasingInput }>;
}
export interface TimelineSheetItem {
  type: 'timeline'; name?: string; at?: TimeInput;
  frameRate?: FrameRateInput; repeat?: number; repeatDelay?: TimeInput; direction?: SheetDirection;
  markers?: SheetMarker[]; cues?: SheetCue[]; regions?: SheetRegion[];
  items: SheetItem[];
}
export interface SpringSheetItem {
  type: 'spring'; name?: string; at?: TimeInput; target?: string;
  from: MotionValueShape; to: MotionValueShape; velocity?: number | MotionValueShape;
  stiffness?: number; damping?: number; mass?: number; restDelta?: number; restSpeed?: number; bounce?: number; duration?: TimeInput;
}
export interface InertiaSheetItem {
  type: 'inertia'; name?: string; at?: TimeInput; target?: string;
  from: number; velocity: number; power?: number; timeConstant?: number; min?: number; max?: number; restDelta?: number;
}
export interface ExtensionSheetItem { type: string; name?: string; at?: TimeInput; [key: string]: unknown; }
export type SheetItem = TweenSheetItem | TrackSheetItem | TimelineSheetItem | SpringSheetItem | InertiaSheetItem | ExtensionSheetItem;

export interface CueSheet {
  $schema: 'dhaakon-motion/cue-sheet/1';
  name?: string;
  frameRate?: FrameRateInput;
  duration?: TimeInput;
  repeat?: number;
  repeatDelay?: TimeInput;
  direction?: SheetDirection;
  markers?: SheetMarker[];
  cues?: SheetCue[];
  regions?: SheetRegion[];
  items: SheetItem[];
}

export interface SheetBindings {
  /** Named write targets a `tween`/`track` item's `target` resolves against. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MotionValue<T> is invariant in T (both .get()
  // and .set() use it), so a heterogeneous bindings map genuinely can't be typed any tighter than `any` here.
  targets?: Record<string, MotionValue<any> | ((value: any) => void)>;
  /** Handlers for named cues; a cue without one still fires (and its payload still reaches a `signalOutput`/`midiOutput`). */
  cues?: Record<string, (e: CueEvent) => void>;
  /** Registered under their own name for the duration of this load, in addition to the global easing registry. */
  easings?: Record<string, EasingFunction>;
  /** Escape hatch for item types the core doesn't know natively (e.g. `'audio'`, built from `./audio`'s `AudioClip`). */
  createItem?: (item: SheetItem, ctx: { bindings: SheetBindings; strict: boolean }) => TimelineItem | undefined;
}

const targetKeys = new WeakMap<TimelineItem, string>();

function resolveEasingWithBindings(input: EasingInput | undefined, easings?: Record<string, EasingFunction>): EasingFunction | undefined {
  if (input == null) return undefined;
  if (typeof input === 'string' && easings?.[input]) return easings[input];
  return resolveEasing(input);
}

function resolveTarget(key: string | undefined, bindings: SheetBindings, strict: boolean, path: string): ((value: MotionValueShape) => void) | undefined {
  if (key == null) return undefined;
  const target = bindings.targets?.[key];
  if (target == null) {
    const message = `${path}: unknown target "${key}"`;
    if (strict) throw new Error(message);
    console.warn(`loadSheet: ${message}; skipping the write.`);
    return undefined;
  }
  return target instanceof MotionValue ? (value) => target.set(value) : target;
}

// SheetItem's ExtensionSheetItem member carries an index signature, so a plain `item.type === 'tween'`
// check narrows the union less than you'd expect from a normal discriminated union (TS can't rule out
// an ExtensionSheetItem whose `type` string happens to read "tween"); the casts below are runtime-safe
// since the check itself is exact.
function buildItem(item: SheetItem, bindings: SheetBindings, strict: boolean, path: string, rate: FrameRateInput | undefined): TimelineItem | undefined {
  if (item.type === 'tween') {
    const tween_ = item as TweenSheetItem;
    const write = resolveTarget(tween_.target, bindings, strict, path);
    const tween = new Tween<MotionValueShape>({
      name: tween_.name,
      from: tween_.from, to: tween_.to,
      duration: tween_.duration,
      delay: tween_.delay,
      repeat: tween_.repeat, repeatDelay: tween_.repeatDelay,
      frameRate: rate,
      yoyo: tween_.yoyo,
      easing: resolveEasingWithBindings(tween_.easing, bindings.easings),
      onUpdate: write ? (value) => write(value) : undefined,
    });
    if (tween_.target) targetKeys.set(tween, tween_.target);
    return tween;
  }
  if (item.type === 'track') {
    const track_ = item as TrackSheetItem;
    const write = resolveTarget(track_.target, bindings, strict, path);
    const track = new Track<MotionValueShape>({
      name: track_.name,
      frameRate: rate,
      keyframes: track_.keyframes.map((k) => ({ at: k.at, value: k.value, easing: k.easing })),
      repeat: track_.repeat, repeatDelay: track_.repeatDelay,
      direction: track_.direction === 'alternate' ? 'alternate' : 'normal',
      easing: resolveEasingWithBindings(track_.easing, bindings.easings),
      apply: write ?? (() => {}),
    });
    if (track_.target) targetKeys.set(track, track_.target);
    return track;
  }
  if (item.type === 'timeline') {
    return buildTimeline(item as TimelineSheetItem, bindings, strict, path, rate);
  }
  if (item.type === 'spring') {
    const spring_ = item as SpringSheetItem; const write = resolveTarget(spring_.target, bindings, strict, path);
    const spring = new SpringItem({ ...spring_, frameRate: rate, onUpdate: write ? (value) => write(value) : undefined });
    if (spring_.target) targetKeys.set(spring, spring_.target); return spring;
  }
  if (item.type === 'inertia') {
    const inertia_ = item as InertiaSheetItem; const write = resolveTarget(inertia_.target, bindings, strict, path);
    const inertia = new InertiaItem({ ...inertia_, onUpdate: write ? (value) => write(value) : undefined });
    if (inertia_.target) targetKeys.set(inertia, inertia_.target); return inertia;
  }
  const built = bindings.createItem?.(item, { bindings, strict });
  if (built) return built;
  const message = `${path}: unknown item type "${item.type}"`;
  if (strict) throw new Error(message);
  console.warn(`loadSheet: ${message}; skipping it. Pass bindings.createItem to handle it.`);
  return undefined;
}

function applyMarkersCuesRegions(timeline: Timeline, sheet: Pick<CueSheet, 'markers' | 'cues' | 'regions'>, bindings: SheetBindings) {
  for (const marker of sheet.markers ?? []) timeline.marker(marker.name, marker.at, { color: marker.color, payload: marker.payload });
  for (const cue of sheet.cues ?? []) {
    const handler = bindings.cues?.[cue.name] ?? (() => {});
    const options: CueOptions = { payload: cue.payload, once: cue.once };
    timeline.cue(cue.name, cue.at, handler, options);
  }
  for (const region of sheet.regions ?? []) {
    timeline.region(region.name, region.from, region.to, {
      payload: region.payload, once: region.once,
      onEnter: bindings.cues?.[`${region.name}:enter`], onExit: bindings.cues?.[`${region.name}:exit`],
    });
  }
}

function buildTimeline(
  sheet: Pick<CueSheet, 'name' | 'frameRate' | 'repeat' | 'repeatDelay' | 'direction' | 'markers' | 'cues' | 'regions' | 'items'>,
  bindings: SheetBindings, strict: boolean, path: string, inheritedRate: FrameRateInput | undefined,
): Timeline {
  const rate = sheet.frameRate ?? inheritedRate;
  const options: TimelineOptions = {
    name: sheet.name,
    frameRate: rate,
    repeat: sheet.repeat,
    repeatDelay: sheet.repeatDelay,
    yoyo: sheet.direction === 'alternate',
  };
  const timeline = new Timeline(options);
  applyMarkersCuesRegions(timeline, sheet, bindings);
  sheet.items.forEach((item, index) => {
    const item_ = item as { at?: TimeInput };
    const built = buildItem(item, bindings, strict, `${path}.items[${index}]`, rate);
    if (built) timeline.add(built, item_.at);
  });
  return timeline;
}

/** Build a live `Timeline` (with a nested `Timeline`/`Tween`/`Track` for every item) from a `CueSheet`. */
export function loadSheet(sheet: CueSheet | string, bindings: SheetBindings = {}, options: { strict?: boolean } = {}): Timeline {
  const parsed: CueSheet = typeof sheet === 'string' ? JSON.parse(sheet) : sheet;
  const strict = options.strict ?? true;
  const validated = validateSheet(parsed);
  if (!validated.ok) {
    const message = validated.errors.map((e) => `${e.path}: ${e.message}`).join('\n');
    throw new Error(`loadSheet: invalid cue sheet:\n${message}`);
  }
  return buildTimeline(parsed, bindings, strict, '$', undefined);
}

/** `loadSheet`'s inverse: read a `Timeline` back into a `CueSheet`. Positions are saved as milliseconds; target bindings round-trip if the timeline was itself built with `loadSheet`. */
export function saveSheet(timeline: Timeline): CueSheet {
  return {
    $schema: 'dhaakon-motion/cue-sheet/1',
    ...(timeline.name ? { name: timeline.name } : {}),
    frameRate: timeline.frameRate,
    ...(timeline.options.repeat ? { repeat: timeline.options.repeat } : {}),
    ...(timeline.options.repeatDelay ? { repeatDelay: timeline.options.repeatDelay } : {}),
    ...(timeline.options.yoyo ? { direction: 'alternate' as const } : {}),
    ...(timeline.markers.length ? { markers: timeline.markers.map((m) => ({ name: m.name, at: m.time, ...(m.color ? { color: m.color } : {}), ...(m.payload !== undefined ? { payload: m.payload } : {}) })) } : {}),
    ...(timeline.cues.length ? { cues: timeline.cues.map((c) => ({ name: c.name, at: c.time })) } : {}),
    items: timeline.items.map(({ item, start }) => saveItem(item, start)),
  };
}

function saveItem(item: TimelineItem, at: number): SheetItem {
  const target = targetKeys.get(item);
  if (item instanceof Timeline) {
    return {
      type: 'timeline', ...(item.name ? { name: item.name } : {}), at,
      frameRate: item.frameRate,
      ...(item.options.repeat ? { repeat: item.options.repeat } : {}),
      ...(item.options.yoyo ? { direction: 'alternate' as const } : {}),
      ...(item.markers.length ? { markers: item.markers.map((m) => ({ name: m.name, at: m.time })) } : {}),
      ...(item.cues.length ? { cues: item.cues.map((c) => ({ name: c.name, at: c.time })) } : {}),
      items: item.items.map((entry) => saveItem(entry.item, entry.start)),
    };
  }
  if (item instanceof Tween) {
    return {
      type: 'tween', ...(item.name ? { name: item.name } : {}), at,
      ...(target ? { target } : {}),
      from: item.from, to: item.toValue, duration: item.duration,
      ...(item.delay ? { delay: item.delay } : {}),
      ...(item.repeat ? { repeat: item.repeat } : {}),
      ...(item.repeatDelay ? { repeatDelay: item.repeatDelay } : {}),
      ...(item.direction === 'alternate' ? { yoyo: true } : {}),
      ...(serializeEasing(item.easing) !== undefined ? { easing: serializeEasing(item.easing) } : {}),
    };
  }
  if (item instanceof Track) {
    return {
      type: 'track', ...(item.name ? { name: item.name } : {}), at,
      ...(target ? { target } : {}),
      keyframes: item.keyframes.map((k) => ({ at: k.at, value: k.value })),
    };
  }
  if (item instanceof SpringItem) {
    const options = item.options as PhysicsSpringOptions<MotionValueShape>;
    return { type: 'spring', ...(item.name ? { name: item.name } : {}), at, ...(target ? { target } : {}), from: item.from, to: item.to, velocity: item.initialVelocity, ...(options.stiffness != null ? { stiffness: options.stiffness } : {}), ...(options.damping != null ? { damping: options.damping } : {}), ...(options.mass != null ? { mass: options.mass } : {}), ...(options.restDelta != null ? { restDelta: options.restDelta } : {}), ...(options.restSpeed != null ? { restSpeed: options.restSpeed } : {}), ...(options.bounce != null ? { bounce: options.bounce } : {}), ...(options.duration != null ? { duration: options.duration } : {}) };
  }
  if (item instanceof InertiaItem) {
    const options = item.options as InertiaOptions<number>;
    return { type: 'inertia', ...(item.name ? { name: item.name } : {}), at, ...(target ? { target } : {}), from: item.from as number, velocity: item.initialVelocity as number, ...(options.power != null ? { power: options.power } : {}), ...(options.timeConstant != null ? { timeConstant: options.timeConstant } : {}), ...(options.min != null ? { min: options.min } : {}), ...(options.max != null ? { max: options.max } : {}), ...(options.restDelta != null ? { restDelta: options.restDelta } : {}) };
  }
  return { type: item.kind, ...(item.name ? { name: item.name } : {}), at };
}

export interface ValidationError { path: string; message: string; }
export type ValidationResult = { ok: true; sheet: CueSheet } | { ok: false; errors: ValidationError[] };

/** Hand-rolled structural validation: shape, frame rate legality, resolvable easings, and keyframe ordering (where checkable without a frame-rate context). */
export function validateSheet(input: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const push = (path: string, message: string) => errors.push({ path, message });

  if (typeof input !== 'object' || input === null) { push('$', 'must be an object'); return { ok: false, errors }; }
  const sheet = input as Partial<CueSheet>;
  if (sheet.$schema !== 'dhaakon-motion/cue-sheet/1') push('$.$schema', 'must be "dhaakon-motion/cue-sheet/1"');
  if (sheet.frameRate != null) {
    try { frameRate(sheet.frameRate); } catch (err) { push('$.frameRate', (err as Error).message); }
  }
  if (!Array.isArray(sheet.items)) push('$.items', 'must be an array');
  else sheet.items.forEach((item, index) => validateItem(item, `$.items[${index}]`, push));
  for (const label of ['markers', 'cues'] as const) {
    const list = sheet[label];
    if (list != null && !Array.isArray(list)) push(`$.${label}`, 'must be an array');
  }

  return errors.length ? { ok: false, errors } : { ok: true, sheet: sheet as CueSheet };
}

function validateEasing(value: unknown, path: string, push: (p: string, m: string) => void) {
  if (value == null) return;
  try { resolveEasing(value as EasingInput); } catch (err) { push(path, (err as Error).message); }
}

function validateItem(item: unknown, path: string, push: (p: string, m: string) => void) {
  if (typeof item !== 'object' || item === null) { push(path, 'must be an object'); return; }
  const value = item as Record<string, unknown>;
  if (typeof value.type !== 'string') { push(`${path}.type`, 'is required'); return; }
  if (value.type === 'tween') {
    if (value.from === undefined) push(`${path}.from`, 'is required');
    if (value.to === undefined) push(`${path}.to`, 'is required');
    validateEasing(value.easing, `${path}.easing`, push);
  } else if (value.type === 'track') {
    if (!Array.isArray(value.keyframes) || value.keyframes.length === 0) push(`${path}.keyframes`, 'must be a non-empty array');
    else {
      let lastNumeric: number | undefined;
      (value.keyframes as unknown[]).forEach((keyframe, index) => {
        if (typeof keyframe !== 'object' || keyframe === null) { push(`${path}.keyframes[${index}]`, 'must be an object'); return; }
        const kf = keyframe as Record<string, unknown>;
        if (kf.at === undefined) push(`${path}.keyframes[${index}].at`, 'is required');
        if (kf.value === undefined) push(`${path}.keyframes[${index}].value`, 'is required');
        validateEasing(kf.easing, `${path}.keyframes[${index}].easing`, push);
        if (typeof kf.at === 'number') {
          if (lastNumeric != null && kf.at < lastNumeric) push(`${path}.keyframes[${index}].at`, 'keyframes must be in non-decreasing time order');
          lastNumeric = kf.at;
        }
      });
    }
    validateEasing(value.easing, `${path}.easing`, push);
  } else if (value.type === 'timeline') {
    if (value.frameRate != null) { try { frameRate(value.frameRate as FrameRateInput); } catch (err) { push(`${path}.frameRate`, (err as Error).message); } }
    if (!Array.isArray(value.items)) push(`${path}.items`, 'must be an array');
    else (value.items as unknown[]).forEach((child, index) => validateItem(child, `${path}.items[${index}]`, push));
  } else if (value.type === 'spring') {
    if (value.from === undefined) push(`${path}.from`, 'is required');
    if (value.to === undefined) push(`${path}.to`, 'is required');
  } else if (value.type === 'inertia') {
    if (typeof value.from !== 'number') push(`${path}.from`, 'must be a number');
    if (typeof value.velocity !== 'number') push(`${path}.velocity`, 'must be a number');
  }
}

// ---- scene states -----------------------------------------------------------

export type SceneState = Record<string, MotionValueShape>;
export interface SceneFile { $schema: 'dhaakon-motion/scene/1'; states: Record<string, SceneState>; }

type TargetMap = SheetBindings['targets'];
function writerFor(target: MotionValue<MotionValueShape> | ((value: MotionValueShape) => void)): (value: MotionValueShape) => void {
  return target instanceof MotionValue ? (value) => target.set(value) : target;
}

/** Read the current value of every `MotionValue` target (a plain setter has nothing to read back, so it's skipped). */
export function captureScene(targets: TargetMap): SceneState {
  const state: SceneState = {};
  for (const [key, target] of Object.entries(targets ?? {})) if (target instanceof MotionValue) state[key] = target.get();
  return state;
}

export interface ApplySceneOptions {
  transition?: Omit<TweenOptions<MotionValueShape>, 'from' | 'to' | 'onUpdate'> & { stagger?: number | ((id: string, index: number) => number) };
}

/** Write a captured (or hand-authored) scene onto its targets: immediately, or (with `transition`) as a playing `Timeline` of one `Tween` per target. */
export function applyScene(state: SceneState, targets: TargetMap, options: ApplySceneOptions = {}): Timeline | void {
  const entries = Object.entries(state).filter(([key]) => targets?.[key] != null);
  if (!options.transition) {
    for (const [key, value] of entries) writerFor(targets![key])(value);
    return;
  }
  const { stagger, ...transitionOptions } = options.transition;
  const timeline = new Timeline();
  entries.forEach(([key, value], index) => {
    const target = targets![key];
    const from = target instanceof MotionValue ? target.get() : value;
    const staggerDelay = typeof stagger === 'function' ? stagger(key, index) : (stagger ?? 0) * index;
    timeline.add(new Tween<MotionValueShape>({
      ...transitionOptions, from, to: value,
      onUpdate: (value) => writerFor(target)(value),
    }), staggerDelay);
  });
  timeline.play();
  return timeline;
}

export interface SceneTransitionOptions {
  duration?: TimeInput; easing?: EasingInput; delay?: TimeInput;
  stagger?: number | ((id: string, index: number) => number);
}

/** A `Timeline` (not auto-played) of one `Tween` per key present in `from` or `to`, ready to attach to a transport or `.play()`. */
export function sceneTransition(from: SceneState, to: SceneState, targets: TargetMap, options: SceneTransitionOptions = {}): Timeline {
  const timeline = new Timeline();
  const keys = [...new Set([...Object.keys(from), ...Object.keys(to)])];
  keys.forEach((key, index) => {
    const target = targets?.[key];
    if (!target) return;
    const staggerDelay = typeof options.stagger === 'function' ? options.stagger(key, index) : (options.stagger ?? 0) * index;
    timeline.add(new Tween<MotionValueShape>({
      from: from[key] ?? to[key], to: to[key] ?? from[key],
      duration: options.duration,
      delay: options.delay,
      easing: options.easing != null ? resolveEasing(options.easing) : undefined,
      onUpdate: (value) => writerFor(target)(value),
    }), staggerDelay);
  });
  return timeline;
}

export interface SceneSheetOptions { hold?: TimeInput; transition?: TimeInput; easing?: EasingInput; }

/** Turn a named sequence of scene states into a `CueSheet`: one `track` item per key (a keyframe per state it appears in) plus a marker at each state's start. */
export function sceneSheet(states: Record<string, SceneState>, order: string[], options: SceneSheetOptions = {}): CueSheet {
  const holdMs = options.hold != null ? parseTime(options.hold) : 1000;
  const transitionMs = options.transition != null ? parseTime(options.transition) : 500;
  const stepMs = holdMs + transitionMs;

  const keys = new Set<string>();
  for (const name of order) for (const key of Object.keys(states[name] ?? {})) keys.add(key);

  const items: SheetItem[] = [];
  for (const key of keys) {
    const keyframes: TrackSheetItem['keyframes'] = [];
    order.forEach((name, index) => {
      const state = states[name];
      if (state && key in state) keyframes.push({ at: index * stepMs, value: state[key], easing: options.easing });
    });
    if (keyframes.length) items.push({ type: 'track', target: key, keyframes });
  }

  const markers: SheetMarker[] = order.map((name, index) => ({ name, at: index * stepMs }));
  return { $schema: 'dhaakon-motion/cue-sheet/1', markers, items };
}
