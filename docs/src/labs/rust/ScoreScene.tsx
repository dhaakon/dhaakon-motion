import { useId } from 'react';
import { DHAAKON_LOGO_PATH } from '../../dhaakonLogo';
import { scoreValue } from './score';

const TAU = Math.PI * 2;
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const INK = '#0a100f';
const IVORY = '#f1f3db';
const LIME = '#d5ff5f';
const CYAN = '#78ebea';
const CORAL = '#ff956c';
const indices = (count: number) => Array.from({ length: count }, (_, index) => index);
const TICKS = indices(96);
const ORBITS = indices(9);
const PARTICLES = indices(64);
const RIBBONS = indices(16);
const SLICES = indices(12);
const GRID = indices(19);

function polar(radius: number, angle: number): [number, number] {
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

function arc(radius: number, start: number, end: number): string {
  const a = polar(radius, start);
  const b = polar(radius, end);
  return `M${a[0]},${a[1]}A${radius},${radius} 0 ${end - start > Math.PI ? 1 : 0} 1 ${b[0]},${b[1]}`;
}

/**
 * Stateless SVG host renderer. The caller supplies one materialized compiled
 * sample; no CSS animation, random seed, evaluator acquisition or clock here.
 */
export function ScoreScene({
  values,
  idPrefix,
}: {
  values: Record<string, unknown>;
  idPrefix?: string;
}) {
  const uniqueId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const prefix = `${idPrefix?.replace(/[^a-zA-Z0-9_-]/g, '') ?? 'score'}-${uniqueId}`;
  const id = (name: string) => `${prefix}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;
  const state = (name: string) => scoreValue(values, name);
  const n = (name: string, key: string) => Number(state(name)[key]);
  const color = (name: string, key: string) => String(state(name)[key]);
  const hot = color('spectrum', 'hot');
  const cold = color('spectrum', 'cold');
  const logoTransform = `translate(500 ${300 + n('logo', 'y')}) rotate(${n('logo', 'rotation')}) scale(${n('logo', 'scale')}) translate(-278.875 -131.165)`;
  const ringRadius = n('orbital', 'radius');
  const apertureRadius = n('aperture', 'radius');
  const gridBend = n('lattice', 'bend');
  const gridShift = n('lattice', 'shift');
  const spread = n('exploded', 'spread');
  const scanX = n('scan', 'x');

  return (
    <svg
      viewBox="0 0 1000 600"
      role="img"
      aria-labelledby={id('title')}
      aria-describedby={id('description')}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', width: '100%', height: 'auto', background: INK }}
      data-rust-score="scene"
    >
      <title id={id('title')}>Dhaakon — a five-act compiled motion score</title>
      <desc id={id('description')}>
        An intricate vector instrument: dimensional grids, orbital traces, masked lettering,
        chromatic layer separation and interference ribbons. The same authored tracks can be sampled
        by JavaScript or the Rust WebAssembly numeric evaluator; SVG rendering remains in the
        browser.
      </desc>
      <defs>
        <linearGradient id={id('material')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={IVORY} />
          <stop offset="0.42" stopColor={hot} />
          <stop offset="0.75" stopColor={cold} />
          <stop offset="1" stopColor={IVORY} />
        </linearGradient>
        <radialGradient id={id('halo')}>
          <stop stopColor={cold} stopOpacity="0.11" />
          <stop offset="0.55" stopColor={hot} stopOpacity="0.035" />
          <stop offset="1" stopColor={INK} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('scan')}>
          <stop stopColor={cold} stopOpacity="0" />
          <stop offset="0.92" stopColor={cold} stopOpacity="0.16" />
          <stop offset="1" stopColor={IVORY} stopOpacity="0.8" />
        </linearGradient>
        <pattern id={id('microgrid')} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke={IVORY} strokeWidth="0.45" opacity="0.14" />
          <circle cx="0" cy="0" r="0.85" fill={IVORY} opacity="0.35" />
        </pattern>
        <clipPath id={id('stage')}>
          <rect x="22" y="66" width="956" height="468" />
        </clipPath>
        <mask id={id('aperture')} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="600">
          <rect width="1000" height="600" fill="black" />
          <ellipse
            cx="500"
            cy="300"
            rx={apertureRadius}
            ry={apertureRadius * n('aperture', 'squash')}
            transform={`rotate(${n('aperture', 'rotation')} 500 300)`}
            fill="white"
          />
        </mask>
        <path id={id('logo')} d={DHAAKON_LOGO_PATH} pathLength="1" />
        {SLICES.map((slice) => (
          <clipPath key={slice} id={id(`slice-${slice}`)}>
            <rect x="-65" y={slice * 22} width="688" height="19" />
          </clipPath>
        ))}
      </defs>

      <rect width="1000" height="600" fill={INK} />
      <rect x="22" y="66" width="956" height="468" fill={url('microgrid')} opacity="0.42" />
      <ellipse
        cx="500"
        cy="300"
        rx="460"
        ry="300"
        fill={url('halo')}
        opacity={n('spectrum', 'opacity')}
      />

      <g clipPath={url('stage')}>
        <g
          opacity={n('field', 'opacity')}
          transform={`translate(500 300) rotate(${n('field', 'rotation')}) scale(${n('field', 'spacing')})`}
          fill="none"
          stroke={cold}
          strokeWidth="0.5"
        >
          {[-1, 1].map((side) => (
            <g key={side} transform={`scale(${side} 1)`}>
              {GRID.slice(0, 10).map((line) => (
                <path
                  key={line}
                  d={`M${160 + line * 22},-245L${270 + line * 27},0L${160 + line * 22},245`}
                />
              ))}
              {[96, 136, 176, 216].map((y) => (
                <path
                  key={y}
                  d={`M110,${y}L360,${y * 0.5}L480,${y * 0.35}M110,${-y}L360,${-y * 0.5}L480,${-y * 0.35}`}
                />
              ))}
            </g>
          ))}
        </g>

        <g opacity={n('lattice', 'opacity')} fill="none" stroke={cold} strokeWidth="0.55">
          {GRID.map((line) => {
            const x = 200 + line * 33;
            return (
              <path
                key={line}
                d={`M${x},100C${x + gridBend},195 ${x - gridBend},410 ${x + gridShift},500`}
                opacity={line % 3 === 0 ? 0.5 : 0.16}
              />
            );
          })}
          {GRID.slice(0, 12).map((line) => {
            const y = 125 + line * 32;
            return (
              <path
                key={line}
                d={`M165,${y}Q500,${y + Math.sin(line * 0.6) * gridBend}835,${y}`}
                opacity="0.24"
              />
            );
          })}
        </g>

        <g
          transform={`translate(500 300) rotate(${n('orbital', 'rotation')})`}
          opacity={n('orbital', 'opacity')}
        >
          <circle r={ringRadius} fill="none" stroke={IVORY} strokeWidth="0.5" opacity="0.25" />
          <circle
            r={ringRadius + 11}
            fill="none"
            stroke={cold}
            strokeWidth="0.6"
            strokeDasharray="1 10"
            opacity="0.6"
          />
          {TICKS.map((tick) => {
            const angle = (tick / TICKS.length) * TAU;
            const [x1, y1] = polar(ringRadius + 20, angle);
            const [x2, y2] = polar(ringRadius + (tick % 8 === 0 ? 31 : 24), angle);
            return (
              <path
                key={tick}
                d={`M${x1},${y1}L${x2},${y2}`}
                stroke={tick % 8 === 0 ? hot : IVORY}
                strokeWidth={tick % 8 === 0 ? 1.3 : 0.6}
                opacity={tick % 8 === 0 ? 1 : 0.35}
              />
            );
          })}
          {ORBITS.map((orbit) => (
            <path
              key={orbit}
              d={arc(
                ringRadius - 10 - orbit * 3.5,
                orbit * 0.68,
                orbit * 0.68 + (0.15 + n('orbital', 'arc') * 0.48),
              )}
              fill="none"
              stroke={orbit % 3 === 0 ? hot : cold}
              strokeWidth={orbit % 3 === 0 ? 2 : 0.7}
              opacity={1 - orbit * 0.075}
            />
          ))}
          {[0, 1, 2, 3].map((marker) => (
            <g key={marker} transform={`rotate(${marker * 90}) translate(${ringRadius + 42} 0)`}>
              <path d="M-4 0H4M0-4V4" stroke={hot} strokeWidth="1" />
              <text x="9" y="3" fill={IVORY} fontFamily={MONO} fontSize="7">
                {String(marker * 90).padStart(3, '0')}
              </text>
            </g>
          ))}
        </g>

        <g
          transform={`translate(500 300) rotate(${n('gyroscope', 'rotation')})`}
          fill="none"
          opacity={n('gyroscope', 'opacity')}
        >
          {[0, 60, 120].map((angle, index) => (
            <g key={angle} transform={`rotate(${angle})`}>
              <ellipse
                rx={252 + index * 8}
                ry={(252 + index * 8) * n('gyroscope', 'tilt')}
                stroke={index === 1 ? hot : cold}
                strokeWidth="0.65"
                opacity="0.6"
              />
              <circle
                cx={252 + index * 8}
                cy="0"
                r={index === 1 ? 3 : 2}
                fill={index === 1 ? hot : cold}
              />
            </g>
          ))}
        </g>

        <g opacity={n('particles', 'opacity')}>
          {PARTICLES.map((particle) => {
            const seed = ((particle * 79 + 37) % 101) / 101;
            const angle =
              (particle / PARTICLES.length) * TAU +
              n('particles', 'phase') * (particle % 2 ? 0.32 : -0.22);
            const radius =
              n('particles', 'radius') + (seed - 0.5) * 145 * n('particles', 'scatter');
            const [x, y] = polar(radius, angle);
            const [trailX, trailY] = polar(radius, angle - (0.025 + seed * 0.05));
            return (
              <g key={particle} opacity={0.25 + seed * 0.7}>
                <path
                  d={`M${500 + trailX},${300 + trailY * 0.68}L${500 + x},${300 + y * 0.68}`}
                  stroke={particle % 3 === 0 ? hot : cold}
                  strokeWidth="0.65"
                />
                <circle
                  cx={500 + x}
                  cy={300 + y * 0.68}
                  r={particle % 9 === 0 ? 2.4 : 1.05}
                  fill={particle % 3 === 0 ? hot : IVORY}
                />
              </g>
            );
          })}
        </g>

        <g
          opacity={n('exploded', 'opacity')}
          transform={`translate(500 300) skewX(${n('exploded', 'skew')})`}
          fill="none"
        >
          {[-2, -1, 0, 1, 2].map((layer) => (
            <g key={layer} transform={`translate(${layer * spread * 24} ${layer * spread * 35})`}>
              <path
                d="M-295-114L230-145L296 101L-229 145Z"
                stroke={layer % 2 ? cold : hot}
                strokeWidth="0.7"
                opacity="0.55"
              />
              <path
                d="M-295-114L296 101M230-145L-229 145"
                stroke={IVORY}
                strokeWidth="0.45"
                opacity="0.12"
              />
              <text x="-287" y="-98" fill={IVORY} fontFamily={MONO} fontSize="7" opacity="0.75">
                L{String(layer + 3).padStart(2, '0')} /{' '}
                {['CONTOUR', 'MASK', 'MATERIAL', 'CHROMA', 'TRACE'][layer + 2]}
              </text>
              {[
                [-295, -114],
                [230, -145],
                [296, 101],
                [-229, 145],
              ].map(([x, y], index) => (
                <rect
                  key={index}
                  x={x - 2}
                  y={y - 2}
                  width="4"
                  height="4"
                  fill={INK}
                  stroke={hot}
                  strokeWidth="0.65"
                />
              ))}
            </g>
          ))}
        </g>

        <g opacity={n('ribbons', 'opacity')} fill="none" strokeWidth="0.8">
          {RIBBONS.map((ribbon) => {
            const base = 300 + (ribbon - 7.5) * n('ribbons', 'separation');
            const phase = n('ribbons', 'phase') + ribbon * 0.16;
            const amplitude = n('ribbons', 'amplitude');
            const points = indices(33)
              .map((point) => {
                const x = 100 + point * 25;
                const envelope = Math.sin((point / 32) * Math.PI);
                const y = base + Math.sin(point * 0.29 + phase) * amplitude * envelope;
                return `${point === 0 ? 'M' : 'L'}${x},${y}`;
              })
              .join('');
            return (
              <path
                key={ribbon}
                d={points}
                stroke={ribbon % 4 === 0 ? IVORY : ribbon % 2 ? hot : cold}
                opacity={ribbon % 4 === 0 ? 0.7 : 0.35}
              />
            );
          })}
        </g>

        <g
          transform={logoTransform}
          opacity={n('logoShadow', 'opacity')}
          fill="none"
          stroke={cold}
          strokeWidth="0.65"
        >
          {[4, 3, 2, 1].map((depth) => (
            <use
              key={depth}
              href={`#${id('logo')}`}
              transform={`translate(${depth * n('logoShadow', 'depth') * 0.45} ${depth * n('logoShadow', 'depth') * 0.28})`}
              opacity={0.12 + (5 - depth) * 0.1}
            />
          ))}
        </g>
        <g transform={logoTransform} opacity={n('echoes', 'opacity')} fill="none" strokeWidth="0.9">
          {[-1, 1].map((side) => (
            <use
              key={side}
              href={`#${id('logo')}`}
              transform={`translate(${side * n('echoes', 'offset')} ${-side * n('echoes', 'offset') * 0.35}) scale(${n('echoes', 'scale')})`}
              stroke={side < 0 ? CORAL : CYAN}
            />
          ))}
        </g>

        <g mask={url('aperture')} opacity={n('logo', 'opacity')}>
          <use href={`#${id('logo')}`} transform={logoTransform} fill={url('material')} />
        </g>
        <g transform={logoTransform} opacity={n('logoStroke', 'opacity')}>
          <use
            href={`#${id('logo')}`}
            fill="none"
            stroke={IVORY}
            strokeWidth={color('logoStroke', 'width')}
            strokeDasharray={`${n('logoStroke', 'reveal')} 1`}
          />
        </g>
        <g transform={logoTransform} opacity={n('logoSlices', 'opacity')}>
          {SLICES.map((slice) => (
            <g key={slice} clipPath={url(`slice-${slice}`)}>
              <use
                href={`#${id('logo')}`}
                transform={`translate(${Math.sin(slice * 1.7 + n('logoSlices', 'phase')) * n('logoSlices', 'amount')} 0)`}
                fill={slice % 3 === 0 ? CORAL : slice % 3 === 1 ? CYAN : IVORY}
              />
            </g>
          ))}
        </g>

        <g opacity={n('shutters', 'opacity')} fill={INK}>
          <path d={`M170 165H830V${300 - n('shutters', 'open') * 135}H170Z`} />
          <path d={`M170 435H830V${300 + n('shutters', 'open') * 135}H170Z`} />
          <path
            d={`M170 ${300 - n('shutters', 'open') * 135}H830M170 ${300 + n('shutters', 'open') * 135}H830`}
            stroke={cold}
            strokeWidth="0.7"
          />
        </g>
        <g opacity={n('scan', 'opacity')}>
          <rect x={scanX - 70} y="130" width="70" height="335" fill={url('scan')} />
          <path
            d={`M${scanX} 105V480`}
            stroke={cold}
            strokeWidth={n('scan', 'width')}
            opacity="0.2"
          />
          <path d={`M${scanX} 105V480`} stroke={IVORY} strokeWidth="0.7" />
          <path
            d={`M${scanX - 4} 109L${scanX} 105L${scanX + 4} 109M${scanX - 4} 476L${scanX} 480L${scanX + 4} 476`}
            fill="none"
            stroke={hot}
          />
        </g>
        <circle
          cx="500"
          cy="300"
          r={n('flash', 'radius')}
          stroke={IVORY}
          strokeWidth="1.5"
          fill="none"
          opacity={n('flash', 'opacity')}
        />

        <g opacity={n('datum', 'opacity')} stroke={IVORY} fill="none" strokeWidth="0.65">
          {[-1, 1].map((side) => (
            <g key={side} transform={`translate(500 300) scale(${side} 1)`}>
              <path
                d={`M${-285 - n('datum', 'spread')},-148v-14h${155 * n('datum', 'length')}M${-285 - n('datum', 'spread')},148v14h${155 * n('datum', 'length')}`}
                opacity="0.55"
              />
              <path
                d={`M${-303 - n('datum', 'spread')},-118V118M${-307 - n('datum', 'spread')},-118h8M${-307 - n('datum', 'spread')},118h8`}
                opacity="0.25"
              />
              <path d="M-380 0h28M-366-14v28" stroke={hot} />
              <circle cx="-366" r="3" stroke={hot} />
            </g>
          ))}
        </g>
      </g>

      <g fontFamily={MONO} fill={IVORY}>
        <path d="M22 54H978M22 546H978" stroke={IVORY} strokeWidth="0.6" opacity="0.25" />
        <circle cx="30" cy="31" r="3" fill={LIME} />
        <text x="43" y="35" fontSize="11" letterSpacing="2.2">
          DHAAKON / MOTION SYSTEMS
        </text>
        <text x="970" y="35" textAnchor="end" fontSize="9" letterSpacing="1.3" opacity="0.65">
          EXPERIMENT 001 · VECTOR SCORE
        </text>
        <g
          opacity={n('annotation', 'opacity')}
          transform={`translate(0 ${n('annotation', 'offset')})`}
        >
          <text x="42" y="93" fontSize="8" letterSpacing="1.3">
            20 LAYERS / f64
          </text>
          <text x="958" y="93" textAnchor="end" fontSize="8" letterSpacing="1.3">
            IMMUTABLE / SEEKABLE
          </text>
          <path d="M42 100H127M872 100H958" stroke={hot} strokeWidth="0.7" />
          <text x="43" y="520" fontSize="7" letterSpacing="1.2" opacity="0.7">
            X 500.00 / Y 300.00
          </text>
          <text x="958" y="520" textAnchor="end" fontSize="7" letterSpacing="1.2" opacity="0.7">
            MATERIAL → HOST SVG
          </text>
          <g transform="translate(865 463)" opacity="0.85">
            <path d="M0 0H45M0-10V10M45-10V10" stroke={hot} strokeWidth="0.6" />
            <text x="22.5" y="-16" textAnchor="middle" fontSize="8">
              {String(Math.round(n('annotation', 'count'))).padStart(3, '0')}
            </text>
            <text x="22.5" y="24" textAnchor="middle" fontSize="6" letterSpacing="1">
              CUE INDEX
            </text>
          </g>
        </g>
        <text x="25" y="570" fontSize="9" letterSpacing="1.1" opacity="0.65">
          01—05 / CONSTRUCTION TO RESOLUTION
        </text>
        <text x="972" y="570" textAnchor="end" fontSize="9" letterSpacing="1.1" opacity="0.65">
          720 FRAMES · 60 FPS · 12 SEC
        </text>
      </g>
      <g transform="translate(500 564)" opacity={n('witness', 'opacity')}>
        <circle r="10" fill="none" stroke={IVORY} opacity="0.3" strokeWidth="0.7" />
        <path
          d="M-6 0H6M0-6V6"
          transform={`rotate(${n('witness', 'turn')})`}
          stroke={hot}
          strokeWidth="1.2"
        />
        <path
          d={`M-69 18H${-69 + n('witness', 'progress') * 138}`}
          stroke={hot}
          strokeWidth="1.5"
        />
      </g>
    </svg>
  );
}
