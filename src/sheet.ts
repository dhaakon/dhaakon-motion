import { Tween, MotionValue, type TweenOptions } from './core';
import { Timeline, type TimelineOptions } from './timeline';
import { Track } from './track';
import type { CueEvent, CueOptions, TimelineItem } from './items';
import { resolveEasing, serializeEasing, type EasingFunction, type EasingInput } from './easing';
import { frameRate, parseTime, type FrameRateInput, type TimeInput } from './time';
import type { MotionValueShape } from './interpolate';
import { InertiaItem, SpringItem, type InertiaOptions, type PhysicsSpringOptions } from './physics';
import type { Direction } from './cycle';

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
  repeat?: number; repeatDelay?: TimeInput; direction?: Direction; easing?: EasingInput;
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
const authoredSheets = new WeakMap<Timeline, CueSheet>();

// Validation bounds recursion before either clone is made. Function easings are
// opaque host references, not serialized or invoked by snapshotting.
function cloneAuthored<T>(value: T, freeze = false): T {
  if (!value || typeof value !== 'object') return value;
  const copy = (Array.isArray(value) ? value.map((entry) => cloneAuthored(entry, freeze))
    : Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneAuthored(entry, freeze)]))) as T;
  return freeze ? Object.freeze(copy) : copy;
}

function resolveEasingWithBindings(input: EasingInput | undefined, easings?: Record<string, EasingFunction>): EasingFunction | undefined {
  if (input == null) return undefined;
  if (typeof input === 'string' && easings && Object.hasOwn(easings, input)) return easings[input];
  return resolveEasing(input);
}

function resolveTarget(key: string | undefined, bindings: SheetBindings, strict: boolean, path: string): ((value: MotionValueShape) => void) | undefined {
  if (key == null) return undefined;
  const target = bindings.targets && Object.hasOwn(bindings.targets, key) ? bindings.targets[key] : undefined;
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
      keyframes: track_.keyframes.map((k) => ({ at: k.at, value: k.value, easing: resolveEasingWithBindings(k.easing, bindings.easings) })),
      repeat: track_.repeat, repeatDelay: track_.repeatDelay,
      direction: track_.direction ?? 'normal',
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
export function loadSheet(sheet: CueSheet | string, bindings: SheetBindings = {}, options: { strict?: boolean; limits?: Partial<SheetLimits> } = {}): Timeline {
  if (typeof sheet === 'string' && sheet.length > (options.limits?.maxStringLength ?? DEFAULT_SHEET_LIMITS.maxStringLength)) throw new Error('loadSheet: input exceeds maxStringLength');
  const parsed: CueSheet = typeof sheet === 'string' ? JSON.parse(sheet) : sheet;
  const strict = options.strict ?? true;
  const validated = validateSheet(parsed, { limits: options.limits, easings: bindings.easings, allowExtensions: Boolean(bindings.createItem) || !strict });
  if (!validated.ok) {
    const message = validated.errors.map((e) => `${e.path}: ${e.message}`).join('\n');
    throw new Error(`loadSheet: invalid cue sheet:\n${message}`);
  }
  const snapshot = cloneAuthored(parsed, true);
  const timeline = buildTimeline(cloneAuthored(snapshot), bindings, strict, '$', undefined);
  authoredSheets.set(timeline, snapshot);
  return timeline;
}

/**
 * Loaded sheets default to a detached copy of their original authored snapshot,
 * including expressions/extensions. Runtime edits do not alter that snapshot.
 * `source: 'runtime'` explicitly serializes the live graph with resolved times;
 * opaque extension state and anonymous callbacks cannot be recovered that way.
 */
export function saveSheet(timeline: Timeline, options: { source?: 'authored' | 'runtime' } = {}): CueSheet {
  const authored = authoredSheets.get(timeline);
  if (options.source !== 'runtime' && authored) return cloneAuthored(authored);
  const metadata = timeline.serializationMetadata();
  return {
    $schema: 'dhaakon-motion/cue-sheet/1',
    ...(timeline.name ? { name: timeline.name } : {}),
    frameRate: timeline.frameRate,
    ...(timeline.options.repeat ? { repeat: timeline.options.repeat } : {}),
    ...(timeline.options.repeatDelay ? { repeatDelay: timeline.options.repeatDelay } : {}),
    ...(timeline.options.yoyo ? { direction: 'alternate' as const } : {}),
    ...(timeline.markers.length ? { markers: timeline.markers.map((m) => ({ name: m.name, at: m.time, ...(m.color ? { color: m.color } : {}), ...(m.payload !== undefined ? { payload: m.payload } : {}) })) } : {}),
    ...(metadata.cues.length ? { cues: metadata.cues } : {}),
    ...(metadata.regions.length ? { regions: metadata.regions } : {}),
    items: timeline.items.map(({ item, start }) => saveItem(item, start)),
  };
}

function saveItem(item: TimelineItem, at: number): SheetItem {
  const target = targetKeys.get(item);
  if (item instanceof Timeline) {
    const { $schema: _, ...nested } = saveSheet(item, { source: 'runtime' });
    return {
      ...nested, type: 'timeline', at,
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
      ...item.serializationOptions(),
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
export interface SheetLimits {
  maxDepth: number;
  maxNodes: number;
  maxItems: number;
  maxKeyframes: number;
  maxStringLength: number;
}
export const DEFAULT_SHEET_LIMITS: Readonly<SheetLimits> = Object.freeze({ maxDepth: 32, maxNodes: 200000, maxItems: 10000, maxKeyframes: 100000, maxStringLength: 1000000 });
export interface SheetValidationOptions {
  limits?: Partial<SheetLimits>;
  easings?: Record<string, EasingFunction>;
  /** Only structural/data limits can be checked for extensions. Their trusted factory validates semantics at load time. */
  allowExtensions?: boolean;
}

/** Bounded data validation, with inherited timebases and contextual easing names.
 * No callbacks, extension factories or getters are executed. This is not a sandbox
 * for trusted host functions or a guarantee that an extension can be constructed.
 */
export function validateSheet(input: unknown, options: SheetValidationOptions = {}): ValidationResult {
  const errors: ValidationError[] = [];
  const push = (path: string, message: string) => { if (errors.length < 50) errors.push({ path, message }); };
  const limits = { ...DEFAULT_SHEET_LIMITS, ...options.limits };
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) push(`$.limits.${name}`, 'must be a positive safe integer');
  }
  if (errors.length) return { ok: false, errors };
  const isRecord = (value: unknown): value is Record<string, any> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
  // Preflight prevents unbounded recursion, cycles, accessors and dangerous keys
  // before contextual validation or snapshot cloning accesses any user field.
  const ancestors = new Set<object>();
  let nodes = 0; let characters = 0;
  const preflight = (value: unknown, path: string, depth: number): void => {
    if (errors.length) return;
    if (++nodes > limits.maxNodes || depth > limits.maxDepth) { push(path, 'exceeds maxNodes or maxDepth'); return; }
    if (typeof value === 'string') { characters += value.length; if (characters > limits.maxStringLength) push(path, 'exceeds maxStringLength'); return; }
    if (typeof value === 'number') { if (!Number.isFinite(value) && !(/^\$(?:\.items\[\d+\])*\.repeat$/.test(path) && value === Infinity)) push(path, 'must be finite'); return; }
    if (typeof value === 'function') { if (!path.endsWith('.easing')) push(path, 'functions are only supported as host easings'); return; }
    if (typeof value === 'bigint' || typeof value === 'symbol') { push(path, 'must be JSON-compatible data'); return; }
    if (!value || typeof value !== 'object') return;
    if (ancestors.has(value)) { push(path, 'cyclic data is not supported'); return; }
    if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) { push(path, 'must be a plain data object'); return; }
    if (Array.isArray(value) && value.length > limits.maxNodes - nodes) { push(path, 'exceeds maxNodes'); return; }
    const keys = Reflect.ownKeys(value).filter((key) => !(Array.isArray(value) && key === 'length'));
    if (keys.length > limits.maxNodes - nodes) { push(path, 'exceeds maxNodes'); return; }
    ancestors.add(value);
    for (const key of keys) {
      if (typeof key !== 'string') { push(path, 'symbol keys are not supported'); break; }
      if (['__proto__', 'prototype', 'constructor'].includes(key)) { push(`${path}.${key}`, 'reserved property is not supported'); break; }
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!('value' in descriptor)) { push(`${path}.${key}`, 'accessors are not supported'); break; }
      if (!descriptor.enumerable) { push(`${path}.${key}`, 'non-enumerable fields are not supported'); break; }
      preflight(descriptor.value, Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`, depth + 1);
      if (errors.length) break;
    }
    ancestors.delete(value);
  };
  preflight(input, '$', 0);
  if (errors.length) return { ok: false, errors };
  if (!isRecord(input)) return { ok: false, errors: [{ path: '$', message: 'must be an object' }] };
  if (input.$schema !== 'dhaakon-motion/cue-sheet/1') push('$.$schema', 'must be "dhaakon-motion/cue-sheet/1"');
  const string = (value: unknown, path: string, required = false) => { if ((required || value !== undefined) && (typeof value !== 'string' || !value)) push(path, 'must be a non-empty string'); };
  const number = (value: unknown, path: string, minimum = -Infinity) => { if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) push(path, `must be a finite number >= ${minimum}`); };
  const valueShape = (value: unknown, path: string, optional = false): void => {
    if (value === undefined && optional) return;
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return;
    if (Array.isArray(value)) { value.forEach((entry, index) => valueShape(entry, `${path}[${index}]`)); return; }
    if (isRecord(value)) { Object.entries(value).forEach(([key, entry]) => valueShape(entry, `${path}.${key}`, true)); return; }
    push(path, 'must be a motion value (number, string, boolean, array or object)');
  };
  const easing = (value: unknown, path: string) => {
    if (value === undefined) return;
    if (!(typeof value === 'function' || (typeof value === 'string' && value.length) || Array.isArray(value))) { push(path, 'must be an easing name, function or descriptor'); return; }
    if (typeof value === 'string' && options.easings && Object.hasOwn(options.easings, value)) {
      if (typeof options.easings[value] !== 'function') push(path, 'bound easing must be a function');
      return;
    }
    try { resolveEasing(value as EasingInput); } catch (error) { push(path, (error as Error).message); }
  };
  const time = (value: unknown, path: string, rate: FrameRateInput): number => {
    try {
      if (typeof value !== 'number' && typeof value !== 'string') throw new Error('must be a time value');
      const resolved = parseTime(value, rate);
      if (!Number.isFinite(resolved) || resolved < 0) throw new Error('must be a finite non-negative time');
      return resolved;
    } catch (error) { push(path, (error as Error).message); return 0; }
  };
  let itemCount = 0; let keyCount = 0;
  const timeline = (sheet: Record<string, any>, path: string, inherited: FrameRateInput): void => {
    let rate = frameRate(inherited);
    if (sheet.frameRate !== undefined) {
      try {
        if (isRecord(sheet.frameRate) && sheet.frameRate.dropFrame !== undefined && typeof sheet.frameRate.dropFrame !== 'boolean') throw new Error('dropFrame must be boolean');
        const candidate = frameRate(sheet.frameRate);
        if (!Number.isFinite(candidate.fps) || candidate.fps <= 0 || !Number.isSafeInteger(candidate.num) || !Number.isSafeInteger(candidate.den) || candidate.num <= 0 || candidate.den <= 0) throw new Error('invalid frame rate');
        rate = candidate;
      } catch (error) { push(`${path}.frameRate`, (error as Error).message); }
    }
    common(sheet, path, rate, ['normal', 'alternate']);
    const labels = new Map<string, number>();
    const position = (value: unknown, at: string): number => {
      if (typeof value !== 'string') return time(value, at, rate);
      try { return timeLiteral(value, rate); } catch { /* symbolic position */ }
      const match = /^(.+?)(?:([+-]=)(.+))?$/.exec(value.trim());
      if (!match || (!['<', '>'].includes(match[1]) && !labels.has(match[1]))) { push(at, `unknown position or label "${value}"`); return 0; }
      const offset = match[3] ? time(match[3], at, rate) * (match[2] === '-=' ? -1 : 1) : 0;
      return Math.max(0, (labels.get(match[1]) ?? 0) + offset);
    };
    for (const field of ['markers', 'cues', 'regions'] as const) {
      if (sheet[field] === undefined) continue;
      if (!Array.isArray(sheet[field])) { push(`${path}.${field}`, 'must be an array'); continue; }
      sheet[field].forEach((entry: unknown, index: number) => {
        const at = `${path}.${field}[${index}]`;
        if (!isRecord(entry)) { push(at, 'must be an object'); return; }
        string(entry.name, `${at}.name`, true);
        if (entry.once !== undefined && typeof entry.once !== 'boolean') push(`${at}.once`, 'must be boolean');
        if (entry.color !== undefined) string(entry.color, `${at}.color`);
        if (field === 'regions') {
          const from = position(entry.from, `${at}.from`); const to = position(entry.to, `${at}.to`);
          if (to < from) push(at, 'region end must not precede its start');
        } else {
          const resolved = position(entry.at, `${at}.at`);
          if (field === 'markers' && typeof entry.name === 'string') labels.set(entry.name, resolved);
        }
      });
    }
    if (!Array.isArray(sheet.items)) { push(`${path}.items`, 'must be an array'); return; }
    for (let index = 0; index < sheet.items.length; index++) {
      const item = sheet.items[index]; const at = `${path}.items[${index}]`;
      if (++itemCount > limits.maxItems) { push(at, 'exceeds maxItems'); break; }
      if (!isRecord(item)) { push(at, 'must be an object'); continue; }
      string(item.type, `${at}.type`, true);
      if (item.at !== undefined) position(item.at, `${at}.at`);
      if (item.type === 'timeline') { timeline(item, at, rate); continue; }
      common(item, at, rate, ['normal', 'reverse', 'alternate', 'alternate-reverse']);
      if (item.type === 'tween' || item.type === 'spring') {
        valueShape(item.from, `${at}.from`); valueShape(item.to, `${at}.to`);
      } else if (item.type === 'track') {
        if (!Array.isArray(item.keyframes) || !item.keyframes.length) { push(`${at}.keyframes`, 'must be a non-empty array'); continue; }
        let previous = -Infinity;
        for (let k = 0; k < item.keyframes.length; k++) {
          const key = item.keyframes[k]; const keyPath = `${at}.keyframes[${k}]`;
          if (++keyCount > limits.maxKeyframes) { push(keyPath, 'exceeds maxKeyframes'); break; }
          if (!isRecord(key)) { push(keyPath, 'must be an object'); continue; }
          const resolved = time(key.at, `${keyPath}.at`, rate);
          if (resolved < previous) push(`${keyPath}.at`, 'keyframes must be in non-decreasing time order');
          previous = resolved; valueShape(key.value, `${keyPath}.value`); easing(key.easing, `${keyPath}.easing`);
        }
      } else if (item.type === 'inertia') {
        number(item.from, `${at}.from`); number(item.velocity, `${at}.velocity`);
      } else if (!options.allowExtensions) push(`${at}.type`, `unknown item type "${item.type}"; extensions require allowExtensions or a loadSheet factory`);
      for (const field of ['stiffness', 'mass', 'timeConstant', 'restDelta', 'restSpeed'] as const) if (item[field] !== undefined) {
        number(item[field], `${at}.${field}`, Number.MIN_VALUE);
      }
      for (const field of ['damping', 'power'] as const) if (item[field] !== undefined) number(item[field], `${at}.${field}`, 0);
      for (const field of ['min', 'max', 'bounce'] as const) if (item[field] !== undefined) number(item[field], `${at}.${field}`);
      if (typeof item.min === 'number' && typeof item.max === 'number' && item.min > item.max) push(at, 'min must not exceed max');
    }
  };
  function timeLiteral(value: unknown, rate: FrameRateInput): number {
    if (typeof value !== 'number' && typeof value !== 'string') throw new Error('not a time');
    const resolved = parseTime(value, rate);
    if (!Number.isFinite(resolved) || resolved < 0) throw new Error('invalid time');
    return resolved;
  }
  function common(value: Record<string, any>, path: string, rate: FrameRateInput, directions: string[]) {
    string(value.name, `${path}.name`); string(value.target, `${path}.target`);
    for (const field of ['duration', 'delay', 'repeatDelay'] as const) if (value[field] !== undefined) time(value[field], `${path}.${field}`, rate);
    if (value.repeat !== undefined && value.repeat !== Infinity && (!Number.isSafeInteger(value.repeat) || value.repeat < 0)) push(`${path}.repeat`, 'must be a non-negative integer or Infinity');
    if (value.direction !== undefined && !directions.includes(value.direction)) push(`${path}.direction`, 'unsupported direction');
    if (value.yoyo !== undefined && typeof value.yoyo !== 'boolean') push(`${path}.yoyo`, 'must be boolean');
    easing(value.easing, `${path}.easing`);
  }
  timeline(input, '$', 60);
  return errors.length ? { ok: false, errors } : { ok: true, sheet: input as CueSheet };
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
