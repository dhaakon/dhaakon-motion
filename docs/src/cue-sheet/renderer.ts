import { cueActs, initialCueStates, type CueState, type CueTarget } from '../advancedCueSheet';
import { clamp, contourPath, ribbonPath, seed, SHARDS } from './geometry';

export function assertCueState(target: CueTarget, value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`Target "${target}" needs numeric controls.`);
  for (const key of Object.keys(initialCueStates[target])) {
    const number = (value as CueState)[key];
    if (typeof number !== 'number' || !Number.isFinite(number))
      throw new Error(`Target "${target}" needs a finite numeric "${key}" value at every frame.`);
    if (Math.abs(number) > 10000)
      throw new Error(`Target "${target}" exceeds the renderer's safe control range.`);
    if ((key === 'opacity' || key === 'reveal') && (number < 0 || number > 1.001))
      throw new Error(`Target "${target}" ${key} must stay between 0 and 1.`);
  }
}

/** Cached DOM writers. Neither live playback nor export uses React state per frame. */
export function createCueRenderer(svg: SVGSVGElement) {
  const nodes = new Map<string, Element[]>();
  const all = (selector: string) => {
    if (!nodes.has(selector)) nodes.set(selector, Array.from(svg.querySelectorAll(selector)));
    return nodes.get(selector)!;
  };
  const attr = (selector: string, key: string, value: unknown) =>
    all(selector).forEach((node) => node.setAttribute(key, String(value)));
  const node = (name: string, key: string, value: unknown) =>
    attr(`[data-node="${name}"]`, key, value);
  const states: Partial<Record<CueTarget, CueState>> = {};
  const rendered = new Map<CueTarget, string>();
  let lastFrame = -1;
  const muted = new Set<CueTarget>();
  let solo: CueTarget | null = null;
  let exploded = false;
  function write(target: CueTarget, state: CueState) {
    states[target] = { ...state };
    const s =
      (target === 'scene' || target === 'finish') &&
      (muted.has(target) || (solo && solo !== target))
        ? (initialCueStates[target] as CueState)
        : state;
    // The scheduler may tick at 60/120 Hz while the show is snapped to 24 fps.
    // Skip identical writes, including costly path/filter invalidations.
    const signature = Object.keys(initialCueStates[target])
      .map((key) => s[key])
      .join('|');
    if (rendered.get(target) === signature) return;
    rendered.set(target, signature);
    const selector = `[data-control="${target}"]`;
    const set = (key: string, value: unknown) => attr(selector, key, value);
    if ('opacity' in s) set('opacity', clamp(s.opacity));
    // Invisible expensive paths do not need geometry updates; the next visible
    // sample is fully analytic and reconstructs them without accumulated state.
    if (s.opacity === 0 && ['ribbons', 'contours', 'shards', 'stars', 'particles'].includes(target))
      return;
    switch (target) {
      case 'field':
        node(
          'noise',
          'baseFrequency',
          `${Math.max(0.001, s.frequency)} ${Math.max(0.001, s.frequency * 1.7)}`,
        );
        node('field-displacement', 'scale', s.displacement);
        set('transform', `translate(${s.drift * 0.2} 0)`);
        break;
      case 'grid':
        set(
          'transform',
          `translate(480 ${270 + s.y}) rotate(${s.rotate}) scale(${s.scale}) translate(-480 -270)`,
        );
        break;
      case 'scene':
        set(
          'transform',
          `translate(${480 + s.x} ${270 + s.y}) rotate(${s.rotate}) scale(${s.scale}) translate(-480 -270)`,
        );
        set('data-scale', s.scale.toFixed(3));
        break;
      case 'finish':
        node('vignette', 'opacity', s.vignette);
        node('border', 'stroke-opacity', s.border);
        attr('[data-control="scene"]', 'style', `filter:brightness(${s.exposure})`);
        attr('[data-control="scene"]', 'data-exposure', s.exposure.toFixed(3));
        break;
      case 'orbit':
        set('transform', `translate(480 270) rotate(${s.rotate}) scale(${s.scale})`);
        set('stroke-dashoffset', s.dash * 160);
        break;
      case 'trace':
        set('stroke-dashoffset', s.dash);
        set('stroke-width', 0.65 + s.glow);
        node('trace-blur', 'stdDeviation', Math.max(0, s.glow * 2));
        break;
      case 'ink':
        set('transform', `translate(279 ${131 + s.y}) scale(${s.scale}) translate(-279 -131)`);
        node('reveal', 'width', clamp(s.reveal) * 650);
        node('metal', 'gradientTransform', `translate(${s.gradient} 0)`);
        break;
      case 'echoes':
        node('echo-blue', 'transform', `translate(${-s.spread} 0) scale(${s.scale})`);
        node('echo-gold', 'transform', `translate(${s.spread} 0) scale(${s.scale})`);
        node('echo-blur', 'stdDeviation', Math.max(0, s.blur));
        break;
      case 'warp':
        set('transform', `translate(${s.x} 0)`);
        node('warp-noise', 'baseFrequency', Math.max(0.001, s.frequency));
        node('displacement', 'scale', s.amount);
        break;
      case 'light':
        node('sweep', 'x', s.x);
        node('sweep', 'width', Math.max(0, s.width));
        node('sweep', 'fill-opacity', 0.8 + s.energy * 0.2);
        break;
      case 'pulse':
        set('r', Math.max(0, s.radius * 150));
        break;
      case 'blueprint':
        node('draft', 'stroke-dashoffset', 1 - clamp(s.draw));
        set('transform', `translate(480 270) scale(${1 + s.spread * 0.15}) translate(-480 -270)`);
        break;
      case 'ribbons':
        all('[data-ribbon]').forEach((n, i) =>
          n.setAttribute('d', ribbonPath(i, s.phase, s.amplitude, s.twist)),
        );
        break;
      case 'contours':
        all('[data-contour]').forEach((n, i) =>
          n.setAttribute('d', contourPath(i, s.morph, s.rotate, s.spread)),
        );
        break;
      case 'aperture':
        all('[data-blade]').forEach((n, i) =>
          n.setAttribute(
            'transform',
            `translate(480 270) rotate(${i * 30 + s.rotate}) translate(0 ${-s.open * 170}) rotate(${s.open * 45})`,
          ),
        );
        break;
      case 'slices':
        all('[data-slice]').forEach((n, i) =>
          n.setAttribute(
            'transform',
            `translate(${(i % 2 ? 1 : -1) * (20 + i * 5) * s.spread} ${(i - 4) * s.lift * 6}) skewX(${(i % 2 ? 1 : -1) * s.shear})`,
          ),
        );
        break;
      case 'shards':
        all('[data-shard]').forEach((n, i) => {
          const p = SHARDS[i];
          const scale = 1 + s.depth * (seed(i * 9187) - 0.5);
          n.setAttribute(
            'transform',
            `translate(${p.x + (p.x - 279) * s.explode * 0.8} ${p.y + (p.y - 131) * s.explode * 1.5}) rotate(${s.rotate * p.sign * (0.4 + seed(i * 8761))}) scale(${scale}) translate(${-p.x} ${-p.y})`,
          );
        });
        break;
      case 'glyphs':
        all('[data-glyph]').forEach((n, i) => {
          const progress = clamp(s.reveal * 1.6 - i * 0.1);
          n.setAttribute('opacity', String(progress));
          n.setAttribute(
            'transform',
            `translate(${(i - 3) * s.spread * 30} ${(1 - progress) * 60}) rotate(${s.tilt * (1 - progress)} ${i * 79.68 + 40} 262)`,
          );
        });
        break;
      case 'depth':
        all('[data-depth]').forEach((n) => {
          const i = Number(n.getAttribute('data-depth'));
          n.setAttribute(
            'transform',
            `translate(${Math.cos(s.angle) * s.distance * i} ${Math.sin(s.angle) * s.distance * i})`,
          );
        });
        break;
      case 'particles':
        all('[data-particle]').forEach((n, i) => {
          const a = i * 2.399 + (s.rotate * Math.PI) / 180;
          const r = (25 + seed(i * 7127) * 130) * s.spread;
          n.setAttribute(
            'transform',
            `translate(${480 + Math.cos(a) * r * 1.8} ${270 + Math.sin(a) * r}) rotate(${i * 27 + s.rotate}) scale(${Math.max(0.1, s.scale)})`,
          );
        });
        break;
      case 'stars':
        all('[data-star]').forEach((n, i) => {
          const a = seed(i * 8191) * Math.PI * 2;
          const r = 45 + ((seed(i * 12289) * 500 + s.travel * (25 + (i % 9) * 9)) % 520);
          const x = 480 + Math.cos(a) * r;
          const y = 270 + Math.sin(a) * r * 0.65;
          n.setAttribute(
            'd',
            `M${x} ${y}l${Math.cos(a) * s.stretch * 2} ${Math.sin(a) * s.stretch}`,
          );
        });
        break;
      case 'type':
        set('transform', `translate(${s.x} ${s.y})`);
        set('letter-spacing', s.tracking);
        set('opacity', clamp(s.opacity) * clamp(s.reveal));
        break;
      case 'title':
        all('[data-character]').forEach((n, i) => {
          const progress = clamp(s.reveal * 1.7 - i * 0.025);
          n.setAttribute(
            'transform',
            `translate(${(i - 12.5) * (s.tracking - 4)} ${(1 - progress) * 40 + s.y}) rotate(${(1 - progress) * 12})`,
          );
          n.setAttribute('opacity', String(progress));
        });
        break;
    }
  }
  const targets = Object.fromEntries(
    (Object.keys(initialCueStates) as CueTarget[]).map((target) => [
      target,
      (s: CueState) => write(target, s),
    ]),
  );
  function inspect(options: { muted?: CueTarget[]; solo?: CueTarget | null; exploded?: boolean }) {
    muted.clear();
    options.muted?.forEach((target) => muted.add(target));
    solo = options.solo ?? null;
    exploded = options.exploded ?? false;
    all('[data-layer]').forEach((element, i) => {
      const target = element.getAttribute('data-layer') as CueTarget;
      element.setAttribute(
        'display',
        muted.has(target) || (solo && !['scene', 'finish'].includes(solo) && target !== solo)
          ? 'none'
          : 'inline',
      );
      element.setAttribute(
        'transform',
        exploded ? `translate(${((i % 3) - 1) * 34} ${(i - 10) * 7})` : 'translate(0 0)',
      );
    });
    for (const target of ['scene', 'finish'] as const)
      if (states[target]) write(target, states[target]!);
  }
  function frame(frame: number) {
    if (frame === lastFrame) return;
    lastFrame = frame;
    const index = Math.max(
      0,
      cueActs.findLastIndex((act) => act.from <= frame),
    );
    const act = cueActs[index];
    all('[data-node="act-label"]').forEach((n) => (n.textContent = `0${index + 1} / ${act.name}`));
    all('[data-node="act-subtitle"]').forEach((n) => (n.textContent = act.subtitle));
    all('[data-node="frame-label"]').forEach(
      (n) => (n.textContent = `${String(frame).padStart(3, '0')} / 576`),
    );
    svg.setAttribute('data-frame', String(frame));
  }
  function reset() {
    for (const target of Object.keys(initialCueStates) as CueTarget[])
      write(target, initialCueStates[target]);
  }
  reset();
  return { targets, states, inspect, frame, reset };
}
export type CueRenderer = ReturnType<typeof createCueRenderer>;
