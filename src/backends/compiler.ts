import {
  Track,
  frameRate,
  parseTime,
  serializeEasing,
  resolveEasing,
  type Direction,
  type EasingInput,
  type Keyframe,
  type MotionValueShape,
  type RenderContext,
  type TimelineItem,
  type TrackOptions,
} from '@dhaakon/motion';
import {
  contentTime,
  createJsEvaluator,
  validateCurve,
  validateNumericPlan,
  type NumericCurve,
  type NumericEvaluator,
  type NumericPlan,
  type NumericTrack,
} from './numeric';
import { compileShape, snapshotValue, type ShapePlan } from './shape';
import type { WasmRuntime } from './wasm';

export interface CompiledTrackInput<T extends MotionValueShape = MotionValueShape> extends Omit<
  TrackOptions<T>,
  'apply' | 'target'
> {
  id: string;
}
export interface CompileDiagnostic {
  readonly id: string;
  readonly reason: string;
}
interface AuthoredTrack extends Omit<CompiledTrackInput, 'keyframes'> {
  keyframes: Keyframe<MotionValueShape>[];
}
interface PreparedTrack {
  authored: AuthoredTrack;
  sortedValues: readonly MotionValueShape[];
  shape?: ShapePlan;
  numeric: NumericTrack;
  offset: number;
}
export interface CompiledPlan {
  readonly version: 1;
  readonly portable: boolean;
  readonly diagnostics: readonly CompileDiagnostic[];
  readonly ir: NumericPlan;
  /** Detached authoring data, preserving frame literals and easing descriptors. */
  readonly authored: readonly CompiledTrackInput[];
  readonly totalDuration: number;
}
// Metadata cannot be forged by changing a public descriptor or importing a second backend copy.
const prepared = new WeakMap<CompiledPlan, readonly PreparedTrack[]>();

function curve(input?: EasingInput): NumericCurve {
  const resolved = resolveEasing(input);
  const description = serializeEasing(resolved);
  if (typeof description === 'string' && resolveEasing(description) !== resolved)
    throw new Error('Easing name does not identify the supplied function');
  if (description == null) throw new Error('Anonymous or replaced easing requires host execution');
  let result: NumericCurve;
  if (description == null) result = { kind: 'cubicBezier', args: [0.16, 1, 0.3, 1] };
  else if (typeof description === 'string')
    result =
      description === 'dhaakon'
        ? { kind: 'cubicBezier', args: [0.16, 1, 0.3, 1] }
        : { kind: description, args: [] };
  else if (Array.isArray(description)) {
    if (description[0] === 'spring') {
      const options = description[1] ?? {};
      result = {
        kind: 'spring',
        args: [options.stiffness ?? 170, options.damping ?? 26, options.mass ?? 1],
      };
    } else if (description[0] === 'steps') {
      const tuple = description as unknown as [string, number, string?];
      result = {
        kind: 'steps',
        args: [Math.max(1, Math.round(tuple[1])), tuple[2] === 'start' ? 1 : 0],
      };
    } else result = { kind: description[0], args: description.slice(1) as number[] };
  } else throw new Error('Custom easing functions require host execution');
  // serializeEasing can return undefined for an anonymous function: never mistake it for default easing.
  if (typeof input === 'function' && description == null)
    throw new Error('Anonymous easing requires host execution');
  validateCurve(result);
  return Object.freeze({ kind: result.kind, args: Object.freeze([...result.args]) });
}

function snapshotEasing(input?: EasingInput): EasingInput | undefined {
  if (!Array.isArray(input)) return input;
  if (input[0] === 'spring')
    return Object.freeze(['spring', Object.freeze({ ...input[1] })]) as unknown as EasingInput;
  return Object.freeze([...input]) as unknown as EasingInput;
}

/** Explicit immutable compilation, never a silent conversion of mutable live Tween/Timeline objects. */
export function compileTracks(
  inputs: readonly CompiledTrackInput[],
  options: { requirePortable?: boolean } = {},
): CompiledPlan {
  if (!Array.isArray(inputs) || inputs.length > 100_000)
    throw new Error('Compiled track count limit exceeded');
  const diagnostics: CompileDiagnostic[] = [];
  const entries: PreparedTrack[] = [];
  const ids = new Set<string>();
  const budget = { nodes: 4_000_000, characters: 16_000_000 };
  let offset = 0,
    totalDuration = 0,
    keyScalars = 0;
  for (const input of inputs) {
    if (
      !input ||
      typeof input.id !== 'string' ||
      !input.id.length ||
      new TextEncoder().encode(input.id).length > 256 ||
      ids.has(input.id)
    )
      throw new Error('Compiled tracks require unique bounded ids');
    ids.add(input.id);
    if (!Array.isArray(input.keyframes) || !input.keyframes.length || input.keyframes.length > 4096)
      throw new Error(`${input.id}: invalid keyframe count`);
    const rate = frameRate(
      input.frameRate ??
        (input.keyframes.some(
          (key: Keyframe<MotionValueShape>) => typeof key.at === 'string' && key.at.includes(';'),
        )
          ? '29.97df'
          : 60),
    );
    const repeat = input.repeat ?? 0;
    if (repeat !== Infinity && (!Number.isInteger(repeat) || repeat < 0 || repeat > 1e6))
      throw new Error(`${input.id}: invalid authored repeat`);
    const repeatDelay = parseTime(input.repeatDelay ?? 0, rate);
    const direction: Direction = input.direction ?? 'normal';
    const authored: AuthoredTrack = {
      ...input,
      frameRate:
        input.frameRate && typeof input.frameRate === 'object'
          ? Object.freeze({ ...input.frameRate })
          : input.frameRate,
      easing: snapshotEasing(input.easing),
      keyframes: input.keyframes.map((key: Keyframe<MotionValueShape>) =>
        Object.freeze({
          ...key,
          value: snapshotValue(key.value, 0, new Set(), budget),
          easing: snapshotEasing(key.easing),
        }),
      ),
    };
    const keys = authored.keyframes
      .map((key) => ({ ...key, time: parseTime(key.at, rate) }))
      .sort((a, b) => a.time - b.time);
    const numeric: NumericTrack = {
      id: input.id,
      times: Object.freeze(keys.map((key) => key.time)),
      values: [],
      easings: [],
      repeat: repeat === Infinity ? -1 : repeat,
      repeatDelay,
      direction,
    };
    // Timing is always validated, even when a value shape/easing is host-only.
    validateNumericPlan({
      version: 1,
      tracks: [
        {
          ...numeric,
          values: keys.map(() => [0]),
          easings: keys.slice(1).map(() => ({ kind: 'linear', args: [] })),
        },
      ],
    });
    let shape: ShapePlan | undefined;
    try {
      shape = compileShape(keys[0].value);
      numeric.values = Object.freeze(keys.map((key) => Object.freeze(shape!.flatten(key.value))));
      numeric.easings = Object.freeze(
        keys.slice(1).map((key) => curve(key.easing ?? input.easing)),
      );
      validateNumericPlan({ version: 1, tracks: [numeric] });
    } catch (error) {
      shape = undefined;
      // Invalid host inputs still throw rather than pretending capability fallback made them valid.
      resolveEasing(input.easing);
      keys.slice(1).forEach((key) => resolveEasing(key.easing ?? input.easing));
      diagnostics.push(Object.freeze({ id: input.id, reason: (error as Error).message }));
    }
    if (shape) {
      keyScalars += shape.width * keys.length;
      if (keyScalars > 4_000_000 || offset + shape.width > 1_000_000)
        throw new Error('Compiled channel resource limit exceeded');
    }
    entries.push({
      authored,
      sortedValues: keys.map((key) => key.value),
      shape,
      numeric: Object.freeze(numeric),
      offset,
    });
    if (shape) offset += shape.width;
    const duration = keys[keys.length - 1].time;
    totalDuration = Math.max(
      totalDuration,
      repeat === Infinity ? Infinity : duration * (repeat + 1) + repeatDelay * repeat,
    );
    Object.freeze(authored.keyframes);
    Object.freeze(authored);
  }
  if (options.requirePortable && diagnostics.length)
    throw new Error(
      `Portable compilation unavailable: ${diagnostics.map((item) => `${item.id}: ${item.reason}`).join('; ')}`,
    );
  const ir: NumericPlan = Object.freeze({
    version: 1,
    tracks: Object.freeze(entries.filter((entry) => entry.shape).map((entry) => entry.numeric)),
  });
  validateNumericPlan(ir);
  const plan: CompiledPlan = Object.freeze({
    version: 1,
    portable: diagnostics.length === 0,
    diagnostics: Object.freeze(diagnostics),
    ir,
    authored: Object.freeze(entries.map((entry) => entry.authored)),
    totalDuration,
  });
  prepared.set(plan, entries);
  return plan;
}

export interface CompiledPlayerOptions {
  backend?: 'js' | 'wasm' | 'auto';
  runtime?: WasmRuntime;
  bindings?: Readonly<Record<string, (value: MotionValueShape, context?: RenderContext) => void>>;
}
export interface CompiledPlayer extends TimelineItem {
  readonly diagnostics: {
    readonly engine: 'js' | 'wasm' | 'js-host';
    readonly reasons: readonly CompileDiagnostic[];
  };
  /** Synchronous sampling, copying results out of Wasm before any host callback. */
  sampleAt(ms: number, context?: RenderContext): void;
  get(id: string): MotionValueShape | undefined;
  /** Terminal for this explicitly owned compiled player; legacy Transport.dispose stays reusable. */
  dispose(): void;
}

export function createCompiledPlayer(
  plan: CompiledPlan,
  options: CompiledPlayerOptions = {},
): CompiledPlayer {
  const entries = prepared.get(plan);
  if (!entries)
    throw new Error('Expected a plan from this compiled entry; compile authored inputs again');
  if (options.backend === 'wasm' && (!options.runtime || !plan.portable))
    throw new Error('Wasm requested but runtime is not ready or plan needs host execution');
  const wasm =
    plan.portable && options.runtime && (options.backend === 'wasm' || options.backend === 'auto');
  const evaluator: NumericEvaluator | undefined = plan.portable
    ? wasm
      ? options.runtime!.createEvaluator(plan.ir)
      : createJsEvaluator(plan.ir)
    : undefined;
  const reasons: CompileDiagnostic[] = [...plan.diagnostics];
  if (options.backend === 'auto' && !options.runtime)
    reasons.push({ id: '*', reason: 'Wasm runtime not supplied; JS selected at creation' });
  const values = new Map<string, MotionValueShape>();
  const bindings = entries.map((entry) =>
    Object.hasOwn(options.bindings ?? {}, entry.authored.id)
      ? options.bindings![entry.authored.id]
      : undefined,
  );
  const host = evaluator
    ? []
    : entries.map(
        (entry, i) =>
          new Track({
            ...entry.authored,
            apply(value, ctx) {
              if (disposed) return;
              values.set(entry.authored.id, value);
              bindings[i]?.(value, ctx);
            },
          }),
      );
  let disposed = false,
    sampling = false;
  return {
    kind: 'compiled',
    totalDuration: plan.totalDuration,
    diagnostics: Object.freeze({
      engine: evaluator?.backend ?? 'js-host',
      reasons: Object.freeze(reasons),
    }),
    sampleAt(ms, context) {
      if (disposed) throw new Error('Compiled player is disposed');
      if (sampling)
        throw new Error(
          'Reentrant compiled sampling is not supported; use the compatibility Timeline path',
        );
      if (!Number.isFinite(ms) || Math.abs(ms) > 1e15)
        throw new Error('Compiled sample time must be finite and within ±1e15ms');
      sampling = true;
      try {
        if (!evaluator) {
          for (const track of host) {
            if (disposed) break;
            track.sampleAt(ms, context);
          }
          return;
        }
        const numeric = evaluator.sample(ms);
        // Materialize every result before callbacks: callback-triggered Wasm growth cannot detach it.
        for (const entry of entries) {
          const time = contentTime(entry.numeric, ms);
          const sorted = entry.numeric.times;
          // Raw endpoint spelling (e.g. '#fff' / '01px') is part of Track compatibility.
          const endpoint =
            time <= sorted[0] ? 0 : time >= sorted[sorted.length - 1] ? sorted.length - 1 : -1;
          const value =
            endpoint < 0
              ? entry.shape!.materialize(numeric, entry.offset)
              : entry.sortedValues[endpoint];
          values.set(entry.authored.id, value);
        }
        for (let i = 0; i < entries.length && !disposed; i++)
          bindings[i]?.(values.get(entries[i].authored.id)!, context);
      } finally {
        sampling = false;
      }
    },
    get(id) {
      return values.get(id);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        evaluator?.dispose();
      } finally {
        values.clear();
      }
    },
  };
}
