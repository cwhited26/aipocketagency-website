"use client";

import { useEffect, useId, useState } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type MascotState =
  | "idle"
  | "brain"
  | "documents"
  | "inbox"
  | "working"
  | "empty";

interface MascotProps {
  state?: MascotState;
  size?: number;
  className?: string;
}

// ─── Tendril geometry ─────────────────────────────────────────────────────────

type TendrilDef = { d: string; tipX: number; tipY: number };

const RESTING_TENDRILS: TendrilDef[] = [
  { d: "M 157 287 Q 117 326 78 366",    tipX: 78,  tipY: 366 }, // far-left
  { d: "M 173 290 Q 150 330 128 370",   tipX: 128, tipY: 370 }, // left
  { d: "M 190 293 Q 190 334 190 374",   tipX: 190, tipY: 374 }, // center
  { d: "M 207 290 Q 230 330 252 370",   tipX: 252, tipY: 370 }, // right
  { d: "M 223 287 Q 263 324 302 362",   tipX: 302, tipY: 362 }, // far-right
];

const WORKING_TENDRILS: TendrilDef[] = [
  { d: "M 157 287 Q 96 338 52 372",     tipX: 52,  tipY: 372 },
  { d: "M 173 290 Q 142 340 116 376",   tipX: 116, tipY: 376 },
  { d: "M 190 293 Q 186 338 183 377",   tipX: 183, tipY: 377 },
  { d: "M 207 290 Q 238 340 268 374",   tipX: 268, tipY: 374 },
  { d: "M 223 287 Q 288 336 348 364",   tipX: 348, tipY: 364 },
];

// State-specific overrides — index: which tendril changes, path + new tip
const BRAIN_OVERRIDE: [number, TendrilDef] = [
  2,
  { d: "M 190 293 Q 228 258 238 218", tipX: 238, tipY: 218 },
];
const DOCS_OVERRIDE: [number, TendrilDef] = [
  4,
  { d: "M 223 287 Q 298 310 334 298", tipX: 334, tipY: 298 },
];
const INBOX_OVERRIDE: [number, TendrilDef] = [
  3,
  { d: "M 207 290 Q 285 268 318 248", tipX: 318, tipY: 248 },
];

// ─── Mote positions ───────────────────────────────────────────────────────────

const MOTES = [
  { x: 148, y: 132 },
  { x: 234, y: 146 },
  { x: 120, y: 204 },
  { x: 258, y: 198 },
];

// ─── Brain orb ────────────────────────────────────────────────────────────────

function BrainOrb({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="22" fill="rgba(34,211,238,0.08)" />
      <circle
        cx={x}
        cy={y}
        r="14"
        fill="rgba(14,107,128,0.85)"
        stroke="#22d3ee"
        strokeWidth="1"
      />
      <circle cx={x} cy={y} r="5" fill="#22d3ee" opacity="0.9" />
      <circle cx={x - 5} cy={y - 5} r="2" fill="#d6fbff" opacity="0.7" />
    </g>
  );
}

// ─── File shape ───────────────────────────────────────────────────────────────

function FileShape({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path
        d={`M${x - 10} ${y - 14} L${x + 4} ${y - 14} L${x + 10} ${y - 8} L${x + 10} ${y + 14} L${x - 10} ${y + 14} Z`}
        fill="rgba(14,107,128,0.7)"
        stroke="#22d3ee"
        strokeWidth="0.9"
      />
      <path
        d={`M${x + 4} ${y - 14} L${x + 4} ${y - 8} L${x + 10} ${y - 8}`}
        fill="none"
        stroke="#22d3ee"
        strokeWidth="0.8"
      />
      <line x1={x - 6} y1={y - 2}  x2={x + 6} y2={y - 2}  stroke="#22d3ee" strokeWidth="0.7" opacity="0.55" />
      <line x1={x - 6} y1={y + 3}  x2={x + 4} y2={y + 3}  stroke="#22d3ee" strokeWidth="0.7" opacity="0.55" />
      <line x1={x - 6} y1={y + 8}  x2={x + 6} y2={y + 8}  stroke="#22d3ee" strokeWidth="0.7" opacity="0.55" />
    </g>
  );
}

// ─── Envelope shape ───────────────────────────────────────────────────────────

function EnvelopeShape({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect
        x={x - 14}
        y={y - 10}
        width="28"
        height="20"
        rx="2"
        fill="rgba(14,107,128,0.7)"
        stroke="#22d3ee"
        strokeWidth="0.9"
      />
      <path
        d={`M${x - 14} ${y - 10} L${x} ${y + 1} L${x + 14} ${y - 10}`}
        fill="none"
        stroke="#22d3ee"
        strokeWidth="0.9"
      />
    </g>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Mascot({
  state = "idle",
  size = 220,
  className = "",
}: MascotProps) {
  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const rawId = useId();
  // useId can produce colons which are invalid in CSS url(#id) references
  const uid = rawId.replace(/:/g, "-").replace(/^-/, "");

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const animate = mounted && !reducedMotion;

  // State-derived visual config
  const bodyOpacity = state === "empty" ? 0.22 : 1;
  const slitRx = state === "working" ? 1.6 : 3.4;
  const eyeAlpha = state === "empty" ? 0.35 : 1;
  const auraAlpha = state === "empty" ? 0.2 : 1;
  const showTendrils = state !== "empty";
  const showMotes = state !== "empty";

  // Float: idle/brain/documents/inbox — not for working (active) or empty (dormant)
  const floatAnim =
    animate && state !== "working" && state !== "empty"
      ? "mascot-float 7s ease-in-out infinite"
      : "none";

  const eyeGlowAnim = animate
    ? `mascot-eye-pulse ${state === "working" ? "2.4" : "4.2"}s ease-in-out infinite`
    : "none";

  // Choose tendril set
  const base = state === "working" ? WORKING_TENDRILS : RESTING_TENDRILS;
  const [overrideIdx, overrideTendril] =
    state === "brain"
      ? BRAIN_OVERRIDE
      : state === "documents"
      ? DOCS_OVERRIDE
      : state === "inbox"
      ? INBOX_OVERRIDE
      : [-1, null];

  function getTendril(i: number): TendrilDef {
    if (overrideIdx === i && overrideTendril) return overrideTendril;
    return base[i];
  }

  const height = Math.round((size * 400) / 380);
  const auraId = `${uid}aura`;
  const eyeGlowId = `${uid}eyeglow`;
  const filterId = `${uid}eyeblur`;

  return (
    <div
      className={`mascot-root${className ? ` ${className}` : ""}`}
      style={{ width: size, height, flexShrink: 0, animation: floatAnim }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 380 400"
        width={size}
        height={height}
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <radialGradient id={auraId} cx="50%" cy="42%" r="58%">
            <stop
              offset="0%"
              stopColor="#0c3a44"
              stopOpacity={0.6 * auraAlpha}
            />
            <stop
              offset="55%"
              stopColor="#08161c"
              stopOpacity={0.35 * auraAlpha}
            />
            <stop offset="100%" stopColor="#06080b" stopOpacity="0" />
          </radialGradient>

          <radialGradient id={eyeGlowId} cx="50%" cy="50%" r="50%">
            <stop
              offset="0%"
              stopColor="#22d3ee"
              stopOpacity={0.6 * eyeAlpha}
            />
            <stop
              offset="55%"
              stopColor="#0e7490"
              stopOpacity={0.2 * eyeAlpha}
            />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>

          <filter
            id={filterId}
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="2.8"
              result="blur"
            />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ambient aura */}
        <circle cx="190" cy="172" r="150" fill={`url(#${auraId})`} />

        {/* Body + shoulder highlight */}
        <g opacity={bodyOpacity}>
          <path
            d="M190 78 C152 78 132 116 132 172 C132 232 152 276 190 290 C228 276 248 232 248 172 C248 116 228 78 190 78 Z"
            fill="#0b1322"
            stroke="#1d3151"
            strokeWidth="0.8"
          />
          <ellipse
            cx="170"
            cy="122"
            rx="19"
            ry="33"
            fill="#16263e"
            opacity="0.45"
          />
        </g>

        {/* Tendrils */}
        {showTendrils &&
          mounted &&
          [0, 1, 2, 3, 4].map((i) => {
            const t = getTendril(i);
            const delay = `${i * 0.75}s`;
            const dur = `${5.3 + i * 0.62}s`;
            return (
              <g key={i}>
                {/* Body stroke */}
                <path
                  d={t.d}
                  stroke="#16314a"
                  strokeWidth="5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Cyan vein */}
                <path
                  d={t.d}
                  stroke="#22d3ee"
                  strokeWidth="1.2"
                  fill="none"
                  strokeLinecap="round"
                  opacity="0.45"
                  style={
                    animate
                      ? {
                          animation: `tendril-pulse ${dur} ease-in-out ${delay} infinite`,
                        }
                      : {}
                  }
                />
                {/* Tip glow */}
                <circle
                  cx={t.tipX}
                  cy={t.tipY}
                  r="7"
                  fill="#22d3ee"
                  opacity="0.18"
                />
                {/* Tip dot */}
                <circle cx={t.tipX} cy={t.tipY} r="3" fill="#5eead4" />
              </g>
            );
          })}

        {/* State-specific held objects (only after mount) */}
        {mounted && state === "brain" && overrideTendril && (
          <BrainOrb x={overrideTendril.tipX} y={overrideTendril.tipY} />
        )}
        {mounted && state === "documents" && overrideTendril && (
          <FileShape x={overrideTendril.tipX} y={overrideTendril.tipY} />
        )}
        {mounted && state === "inbox" && overrideTendril && (
          <EnvelopeShape x={overrideTendril.tipX} y={overrideTendril.tipY} />
        )}

        {/* Eye — deferred to mount to avoid hydration mismatch */}
        {mounted && (
          <g filter={`url(#${filterId})`}>
            {/* Ambient glow */}
            <circle
              cx="190"
              cy="162"
              r="46"
              fill={`url(#${eyeGlowId})`}
              style={{ animation: eyeGlowAnim }}
            />
            {/* Socket */}
            <ellipse cx="190" cy="162" rx="32" ry="29" fill="#04141c" />
            {/* Iris base */}
            <circle cx="190" cy="162" r="21" fill="#0a3d49" />
            {/* Iris ring */}
            <circle
              cx="190"
              cy="162"
              r="21"
              fill="none"
              stroke="#22d3ee"
              strokeWidth="1.6"
            />
            {/* Inner iris */}
            <circle cx="190" cy="162" r="14" fill="#0e6b80" />
            {/* Vertical slit */}
            <ellipse
              cx="190"
              cy="162"
              rx={slitRx}
              ry="15"
              fill="#02080c"
            />
            {/* Slit rim */}
            <ellipse
              cx="190"
              cy="162"
              rx={slitRx}
              ry="15"
              fill="none"
              stroke="#5eead4"
              strokeWidth="0.8"
              opacity="0.7"
            />
            {/* Specular */}
            <circle
              cx="183"
              cy="153"
              r="2.4"
              fill="#d6fbff"
              opacity="0.85"
            />
          </g>
        )}

        {/* Floating motes */}
        {mounted &&
          showMotes &&
          MOTES.map((m, i) => (
            <g key={i}>
              <circle cx={m.x} cy={m.y} r="6" fill="#22d3ee" opacity="0.14" />
              <circle cx={m.x} cy={m.y} r="2" fill="#5eead4" />
            </g>
          ))}
      </svg>
    </div>
  );
}
