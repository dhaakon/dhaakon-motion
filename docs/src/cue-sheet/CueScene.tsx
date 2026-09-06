import { memo, type Ref } from 'react';
import { DHAAKON_LOGO_PATH } from '../dhaakonLogo';
import { SHARDS } from './geometry';

const each = (count: number) => Array.from({ length: count }, (_, i) => i);
const colors = ['#a2bfff', '#ead9c3', '#eeb271', '#a9a1fa'];
export const CueScene = memo(function CueScene({
  id,
  sceneRef,
}: {
  id: string;
  sceneRef: Ref<SVGSVGElement>;
}) {
  const url = (name: string) => `url(#${id}-${name})`;
  const logo = `#${id}-logo`;
  return (
    <svg
      ref={sceneRef}
      viewBox="0 0 960 540"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Ink / Signal animated Dhaakon identity"
      style={{ fontFamily: 'monospace' }}
    >
      <title>Ink / Signal — five acts</title>
      <desc>
        An intricate SVG composition with construction lines, masked metallic lettering, morphing
        contours, forty-eight fragments, and staggered typography.
      </desc>
      <defs>
        <path id={`${id}-logo`} d={DHAAKON_LOGO_PATH} pathLength="1" />
        <linearGradient
          id={`${id}-metal`}
          data-node="metal"
          x1="-220"
          y1="0"
          x2="680"
          y2="300"
          gradientUnits="userSpaceOnUse"
          spreadMethod="reflect"
        >
          <stop stopColor="#7e8dae" />
          <stop offset=".2" stopColor="#eff3f5" />
          <stop offset=".38" stopColor="#a2b3d2" />
          <stop offset=".43" stopColor="#faf7eb" />
          <stop offset=".48" stopColor="#bfa991" />
          <stop offset=".66" stopColor="#e5c9a5" />
          <stop offset=".82" stopColor="#f7f2e5" />
          <stop offset="1" stopColor="#8d9fbc" />
        </linearGradient>
        <linearGradient id={`${id}-ribbon`}>
          <stop stopColor="#597ef4" />
          <stop offset=".48" stopColor="#c5b6ff" />
          <stop offset=".72" stopColor="#f3b283" />
          <stop offset="1" stopColor="#91a6dc" />
        </linearGradient>
        <linearGradient id={`${id}-sweep`}>
          <stop stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff8e0" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-bg`}>
          <stop stopColor="#151e30" />
          <stop offset=".7" stopColor="#0a101d" />
          <stop offset="1" stopColor="#040810" />
        </radialGradient>
        <radialGradient id={`${id}-vignette`}>
          <stop offset=".45" stopColor="#010409" stopOpacity="0" />
          <stop offset="1" stopColor="#010409" />
        </radialGradient>
        <pattern id={`${id}-grid`} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#789ac9" strokeOpacity=".35" strokeWidth=".6" />
          <circle r="1" fill="#c1d6f2" />
        </pattern>
        <clipPath id={`${id}-reveal`}>
          <rect
            data-node="reveal"
            data-testid="advanced-cue-reveal"
            x="-40"
            y="-10"
            width="0"
            height="290"
            transform="skewX(-12)"
          />
        </clipPath>
        <clipPath id={`${id}-logo-clip`}>
          <use href={logo} transform="translate(201 125)" />
        </clipPath>
        <clipPath id={`${id}-title-clip`}>
          <rect x="130" y="425" width="700" height="32" />
        </clipPath>
        {each(9).map((i) => (
          <clipPath id={`${id}-slice-${i}`} key={i}>
            <rect x="-10" y={i * 29.15} width="580" height="29.3" />
          </clipPath>
        ))}
        {each(7).map((i) => (
          <clipPath id={`${id}-glyph-${i}`} key={i}>
            <rect x={i * 79.68} y="-5" width="79.8" height="275" />
          </clipPath>
        ))}
        {SHARDS.map((shard, i) => (
          <clipPath id={`${id}-shard-${i}`} key={i}>
            <path d={shard.path} />
          </clipPath>
        ))}
        <filter
          id={`${id}-noise`}
          x="0"
          y="0"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            data-node="noise"
            type="fractalNoise"
            baseFrequency=".004 .007"
            numOctaves="2"
            seed="17"
            result="noise"
          />
          <feColorMatrix
            type="matrix"
            values=".35 0 0 0 .02  0 .4 0 0 .02  0 0 .8 0 .04  0 0 0 .6 0"
            result="color"
          />
          <feDisplacementMap data-node="field-displacement" in="color" in2="noise" scale="0" />
        </filter>
        <filter id={`${id}-warp`} x="-15%" y="-20%" width="130%" height="140%">
          <feTurbulence
            data-node="warp-noise"
            baseFrequency=".01"
            numOctaves="2"
            seed="31"
            result="noise"
          />
          <feDisplacementMap
            data-node="displacement"
            in="SourceGraphic"
            in2="noise"
            scale="0"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <filter id={`${id}-glow`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur data-node="trace-blur" stdDeviation="0" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${id}-echo`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur data-node="echo-blur" stdDeviation="0" />
        </filter>
      </defs>
      <rect width="960" height="540" fill={url('bg')} />
      <g data-control="scene" data-scale=".860" data-exposure="1.000">
        <g data-layer="field">
          <rect
            data-control="field"
            width="1080"
            height="660"
            x="-60"
            y="-60"
            filter={url('noise')}
            opacity="0"
          />
        </g>
        <g data-layer="grid">
          <g data-control="grid" opacity="0">
            <rect width="1200" height="800" x="-120" y="-130" fill={url('grid')} />
            <path
              d="M80 420H880M80 120H880M201 70V460M759 70V460M480 60V480"
              stroke="#a0bbdf"
              strokeOpacity=".4"
              strokeWidth=".7"
              strokeDasharray="4 8"
            />
          </g>
        </g>
        <g data-layer="stars">
          <g data-control="stars" opacity="0">
            {each(100).map((i) => (
              <path
                key={i}
                data-star={i}
                stroke={colors[i % 4]}
                strokeWidth={i % 9 === 0 ? 1.6 : 0.7}
              />
            ))}
          </g>
        </g>
        <g data-layer="ribbons">
          <g data-control="ribbons" opacity="0" fill="none" stroke={url('ribbon')}>
            {each(20).map((i) => (
              <path
                key={i}
                data-ribbon={i}
                strokeWidth={i % 5 === 0 ? 1.6 : 0.65}
                strokeOpacity={i % 5 === 0 ? 0.8 : 0.4}
              />
            ))}
          </g>
        </g>
        <g data-layer="contours">
          <g data-control="contours" opacity="0" fill="none" stroke={url('ribbon')}>
            {each(14).map((i) => (
              <path
                key={i}
                data-contour={i}
                strokeWidth={i % 4 === 0 ? 1.1 : 0.5}
                strokeOpacity={i % 4 === 0 ? 0.7 : 0.35}
              />
            ))}
          </g>
        </g>
        <g data-layer="orbit">
          <g data-control="orbit" opacity="0" fill="none" transform="translate(480 270)">
            <ellipse rx="330" ry="206" stroke="#a6bfff" strokeOpacity=".26" strokeWidth=".7" />
            <ellipse rx="315" ry="197" stroke="#d9c6ad" strokeOpacity=".5" strokeDasharray="1 9" />
            <circle
              r="210"
              stroke="#a6bfff"
              strokeOpacity=".32"
              strokeWidth=".6"
              strokeDasharray="75 25 4 25"
            />
            {each(72).map((i) => (
              <line
                key={i}
                x1="0"
                y1="-224"
                x2="0"
                y2={i % 6 === 0 ? -212 : -218}
                transform={`rotate(${i * 5})`}
                stroke={i % 6 === 0 ? '#efd6b1' : '#9cadd0'}
                strokeOpacity={i % 6 === 0 ? 0.75 : 0.35}
                strokeWidth=".7"
              />
            ))}
            {[0, 90, 180, 270].map((angle) => (
              <g key={angle} transform={`rotate(${angle}) translate(0 -210)`}>
                <circle r="4" stroke="#f6d4a6" />
                <circle r="1.2" fill="#fff3db" stroke="none" />
              </g>
            ))}
          </g>
        </g>
        <g data-layer="blueprint">
          <g data-control="blueprint" opacity="0" fill="none" stroke="#a2bfff" strokeWidth=".65">
            <path
              data-node="draft"
              pathLength="1"
              strokeDasharray="1"
              d="M175 112H785V407H175ZM190 100H770M190 94V106M770 94V106M165 125V390M159 125H171M159 390H171M201 425H759M201 419V431M759 419V431"
            />
            {each(7).map((i) => (
              <g key={i} transform={`translate(${201 + i * 79.68} 125)`}>
                <path d="M-7 0H7M0-7V7M-5 262H5M0 257V267" />
                <circle r="13" strokeOpacity=".4" />
                <path d="M0 0V262" strokeDasharray="2 6" strokeOpacity=".3" />
              </g>
            ))}
            <g stroke="none" fill="#a9bedc" fontSize="7" letterSpacing="2">
              <text x="437" y="93">
                557.75 UNITS
              </text>
              <text x="193" y="447">
                COMPOUND PATH / ORIGINAL ARTWORK
              </text>
              <text x="793" y="265" transform="rotate(90 793 265)">
                262.33
              </text>
            </g>
          </g>
        </g>
        <g data-layer="aperture">
          <g data-control="aperture" opacity="0">
            {each(12).map((i) => (
              <path
                data-blade={i}
                key={i}
                d="M0-130L85-205 195-175 75-105Z"
                fill="#172338"
                stroke="#a5b6d1"
                strokeWidth=".65"
              />
            ))}
          </g>
        </g>
        <g data-layer="pulse">
          <circle
            data-control="pulse"
            cx="480"
            cy="270"
            r="100"
            opacity="0"
            fill="none"
            stroke="#e7c697"
            strokeWidth="1.3"
          />
        </g>
        <g transform="translate(201 125)">
          <g data-layer="depth">
            <g data-control="depth" opacity="0">
              {each(12)
                .reverse()
                .map((i) => (
                  <use
                    key={i}
                    data-depth={i}
                    href={logo}
                    fill={i % 3 === 0 ? '#8592ad' : '#354158'}
                    stroke="#16223b"
                    strokeWidth=".5"
                  />
                ))}
            </g>
          </g>
          <g data-layer="echoes">
            <g data-control="echoes" opacity="0" filter={url('echo')}>
              <use data-node="echo-blue" href={logo} fill="#6984ed" />
              <use data-node="echo-gold" href={logo} fill="#eda873" />
            </g>
          </g>
          <g data-layer="ink">
            <g
              data-control="ink"
              data-testid="advanced-cue-ink"
              opacity="0"
              clipPath={url('reveal')}
            >
              <use href={logo} fill={url('metal')} stroke="#f2e7d4" strokeWidth=".45" />
            </g>
          </g>
          <g data-layer="glyphs">
            <g data-control="glyphs" opacity="0">
              {each(7).map((i) => (
                <g data-glyph={i} key={i}>
                  <use
                    href={logo}
                    clipPath={url(`glyph-${i}`)}
                    fill={url('metal')}
                    stroke="#d5e4fc"
                    strokeWidth=".6"
                  />
                </g>
              ))}
            </g>
          </g>
          <g data-layer="trace">
            <use
              data-control="trace"
              data-testid="advanced-cue-trace"
              href={logo}
              opacity="0"
              fill="none"
              stroke="#c7dcff"
              strokeWidth=".8"
              strokeDasharray="1"
              strokeDashoffset="1"
              filter={url('glow')}
            />
          </g>
          <g data-layer="warp">
            <use
              data-control="warp"
              data-testid="advanced-cue-warp"
              href={logo}
              opacity="0"
              fill="#b6b6ef"
              filter={url('warp')}
            />
          </g>
          <g data-layer="slices">
            <g data-control="slices" data-testid="advanced-cue-slices" opacity="0">
              {each(9).map((i) => (
                <g data-slice={i} key={i}>
                  <use href={logo} clipPath={url(`slice-${i}`)} fill={colors[i % 4]} />
                </g>
              ))}
            </g>
          </g>
          <g data-layer="shards">
            <g data-control="shards" opacity="0">
              {SHARDS.map((_, i) => (
                <g data-shard={i} key={i}>
                  <use
                    href={logo}
                    clipPath={url(`shard-${i}`)}
                    fill={url('metal')}
                    stroke={colors[i % 4]}
                    strokeWidth=".6"
                  />
                </g>
              ))}
            </g>
          </g>
        </g>
        <g data-layer="light">
          <g data-control="light" opacity="0" clipPath={url('logo-clip')}>
            <rect
              data-node="sweep"
              x="-100"
              width="100"
              height="540"
              fill={url('sweep')}
              transform="skewX(-15)"
            />
          </g>
        </g>
        <g data-layer="particles">
          <g data-control="particles" opacity="0">
            {each(80).map((i) => (
              <g data-particle={i} key={i}>
                <path
                  d={i % 4 === 0 ? 'M-3 0H3M0-3V3' : 'M-1 -1H1V1H-1Z'}
                  stroke={colors[i % 4]}
                  fill={colors[i % 4]}
                  strokeWidth=".5"
                />
              </g>
            ))}
          </g>
        </g>
      </g>
      <g data-layer="title">
        <g
          data-control="title"
          opacity="0"
          clipPath={url('title-clip')}
          fill="#ede8db"
          fontSize="12"
          textAnchor="middle"
        >
          {Array.from('EVERYTHING IN ITS OWN TIME.').map((char, i) => (
            <text data-character={i} key={i} x={480 + (i - 12.5) * 12} y="448">
              {char}
            </text>
          ))}
        </g>
      </g>
      <g data-layer="type">
        <g data-control="type" data-testid="advanced-cue-type" opacity="0" fill="#b4c5df">
          <text x="40" y="49" fontSize="9" letterSpacing="3">
            DHAAKON® / MOTION STUDIES
          </text>
          <text x="920" y="49" fontSize="8" textAnchor="end" letterSpacing="2">
            INK / SIGNAL — VOL. 02
          </text>
          <path d="M40 64H920M40 480H920" stroke="#829bbd" strokeOpacity=".3" strokeWidth=".6" />
          <text data-node="act-label" x="40" y="505" fontSize="9" letterSpacing="2">
            01 / CONSTRUCT
          </text>
          <text
            data-node="act-subtitle"
            x="480"
            y="505"
            fontSize="8"
            textAnchor="middle"
            fill="#9caac2"
          >
            Every signal begins with a line.
          </text>
          <text data-node="frame-label" x="920" y="505" fontSize="8" textAnchor="end">
            000 / 576
          </text>
        </g>
      </g>
      <rect
        data-node="vignette"
        width="960"
        height="540"
        fill={url('vignette')}
        opacity=".6"
        pointerEvents="none"
      />
      <rect
        data-node="border"
        x="18"
        y="18"
        width="924"
        height="504"
        fill="none"
        stroke="#a9bdd9"
        strokeOpacity=".2"
        strokeWidth=".6"
      />
      <path
        d="M18 37V18H37M923 18H942V37M18 503V522H37M923 522H942V503"
        stroke="#c9d8ed"
        strokeWidth="1"
        fill="none"
        opacity=".6"
      />
    </svg>
  );
});
