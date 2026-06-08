"use client";

import { useEffect, useId, useRef, useState } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type MascotState =
  // Reactive moods — driven by the chat/agent loop in real time.
  | "idle"
  | "listening"
  | "thinking"
  | "tool_calling"
  | "responding"
  | "done"
  // Destination / app states — used by surfaces that show the creature "holding"
  // a brain / file / envelope, or in an active-work or dormant pose.
  | "brain"
  | "documents"
  | "inbox"
  | "working"
  | "empty";

interface MascotProps {
  state?: MascotState;
  size?: number;
  className?: string;
  noTendrils?: boolean;
}

// ─── Mood map ─────────────────────────────────────────────────────────────────
// One place that translates a state into the creature's physiology: how fast it
// breathes, how bright its glow runs, how often the eye darts, and whether it is
// flaring a tool pulse or speaking outward. Tuned for "alive, not noisy."

type Mood = {
  breathDur: number;     // seconds per breath cycle
  breathScale: number;   // peak scale of the breath
  glowMul: number;       // halo / eye-glow intensity multiplier
  glowDur: number;       // seconds per glow cycle
  dartMin: number;       // ms — fastest saccade interval
  dartMax: number;       // ms — slowest saccade interval
  speaking: boolean;     // emit outward "speaking" rings
  toolFlash: boolean;    // flare a bright tool-call ring + tendrils
  tendrilOpacity: number;// resting opacity of the cyan tendril veins
  float: boolean;        // gentle vertical float (off while focused/active)
};

function moodFor(state: MascotState): Mood {
  switch (state) {
    case "listening":
      // Leaning in — a touch larger, half-tone brighter, attentive eye.
      return { breathDur: 4.0, breathScale: 1.032, glowMul: 1.18, glowDur: 3.6, dartMin: 3500, dartMax: 7000, speaking: false, toolFlash: false, tendrilOpacity: 0.5, float: true };
    case "thinking":
    case "working":
      // Processing — quicker pulse, brighter, eye darts fast. Grounded (no float).
      return { breathDur: 2.4, breathScale: 1.022, glowMul: 1.32, glowDur: 2.3, dartMin: 1800, dartMax: 4200, speaking: false, toolFlash: false, tendrilOpacity: 0.55, float: false };
    case "tool_calling":
      // A connector is firing — brightest flare + tendril surge.
      return { breathDur: 2.0, breathScale: 1.02, glowMul: 1.5, glowDur: 1.8, dartMin: 1400, dartMax: 3000, speaking: false, toolFlash: true, tendrilOpacity: 0.85, float: false };
    case "responding":
      // Speaking — energy flows outward from the core.
      return { breathDur: 2.8, breathScale: 1.026, glowMul: 1.34, glowDur: 2.6, dartMin: 2600, dartMax: 5200, speaking: true, toolFlash: false, tendrilOpacity: 0.62, float: true };
    case "done":
      // Brief celebratory brightening before settling back to idle.
      return { breathDur: 3.4, breathScale: 1.03, glowMul: 1.42, glowDur: 1.6, dartMin: 4000, dartMax: 8000, speaking: false, toolFlash: false, tendrilOpacity: 0.6, float: true };
    case "empty":
      // Dormant — no breath, dim, slow.
      return { breathDur: 0, breathScale: 1, glowMul: 0.2, glowDur: 6, dartMin: 9000, dartMax: 16000, speaking: false, toolFlash: false, tendrilOpacity: 0.2, float: false };
    case "idle":
    case "brain":
    case "documents":
    case "inbox":
    default:
      return { breathDur: 5.2, breathScale: 1.024, glowMul: 1.0, glowDur: 4.8, dartMin: 6000, dartMax: 12000, speaking: false, toolFlash: false, tendrilOpacity: 0.45, float: true };
  }
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

// ─── Particle drift field ─────────────────────────────────────────────────────
// Fixed configs (no random at render → SSR-safe, no hydration mismatch). Drift
// direction baked into 3 keyframes; per-particle duration + delay desync them.

const PARTICLES: {
  x: number; y: number; r: number; o: number;
  k: "a" | "b" | "c"; dur: number; delay: number;
}[] = [
  { x: 150, y: 120, r: 1.6, o: 0.5,  k: "a", dur: 11,   delay: 0 },
  { x: 236, y: 138, r: 1.3, o: 0.42, k: "b", dur: 13.5, delay: 1.6 },
  { x: 112, y: 198, r: 1.7, o: 0.46, k: "c", dur: 10,   delay: 0.8 },
  { x: 262, y: 196, r: 1.4, o: 0.4,  k: "a", dur: 14,   delay: 2.4 },
  { x: 190, y: 104, r: 1.2, o: 0.36, k: "b", dur: 12.5, delay: 3.1 },
  { x: 132, y: 252, r: 1.5, o: 0.44, k: "c", dur: 9.5,  delay: 1.1 },
  { x: 254, y: 244, r: 1.3, o: 0.38, k: "a", dur: 12,   delay: 2.0 },
  { x: 96,  y: 150, r: 1.4, o: 0.4,  k: "b", dur: 15,   delay: 0.4 },
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
  noTendrils = false,
}: MascotProps) {
  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const [tilt, setTilt] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [tapped, setTapped] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rawId = useId();
  // useId can produce colons which are invalid in CSS url(#id) references
  const uid = rawId.replace(/:/g, "-").replace(/^-/, "");

  const mood = moodFor(state);

  useEffect(() => {
    setMounted(true);
    const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hoverMq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setReducedMotion(motionMq.matches);
    setIsDesktop(hoverMq.matches);
    const onMotion = () => setReducedMotion(motionMq.matches);
    const onHover = () => setIsDesktop(hoverMq.matches);
    motionMq.addEventListener("change", onMotion);
    hoverMq.addEventListener("change", onHover);
    return () => {
      motionMq.removeEventListener("change", onMotion);
      hoverMq.removeEventListener("change", onHover);
    };
  }, []);

  const animate = mounted && !reducedMotion;

  // Eye focal point — track the cursor on desktop, random saccades on touch.
  useEffect(() => {
    if (!animate || state === "empty") {
      setEyeOffset({ x: 0, y: 0 });
      return;
    }
    if (isDesktop) {
      const onMove = (e: PointerEvent) => {
        const el = rootRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height * 0.42;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const reach = Math.min(1, dist / 260);
        setEyeOffset({ x: (dx / dist) * 5 * reach, y: (dy / dist) * 4 * reach });
      };
      window.addEventListener("pointermove", onMove);
      return () => window.removeEventListener("pointermove", onMove);
    }
    // Touch: saccade to a random nearby point (occasionally back to center).
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const recenter = Math.random() < 0.35;
      setEyeOffset(
        recenter
          ? { x: 0, y: 0 }
          : { x: (Math.random() * 2 - 1) * 4, y: (Math.random() * 2 - 1) * 3 },
      );
      timer = setTimeout(tick, mood.dartMin + Math.random() * (mood.dartMax - mood.dartMin));
    };
    timer = setTimeout(tick, 1200);
    return () => clearTimeout(timer);
  }, [animate, isDesktop, state, mood.dartMin, mood.dartMax]);

  // Random micro-tilt — a small head-like nod every 8–15s, then settle.
  useEffect(() => {
    if (!animate || state === "empty") {
      setTilt(0);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setTilt((Math.random() * 2 - 1) * 2.4);
      timer = setTimeout(() => {
        setTilt(0);
        timer = setTimeout(tick, 1500 + Math.random() * 2000);
      }, 1400);
    };
    timer = setTimeout(tick, 8000 + Math.random() * 7000);
    return () => clearTimeout(timer);
  }, [animate, state]);

  useEffect(() => () => {
    if (tapTimer.current) clearTimeout(tapTimer.current);
  }, []);

  function handlePointerDown() {
    if (!animate) return;
    setTapped(true);
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setTapped(false), 320);
  }

  // State-derived visual config
  const bodyOpacity = state === "empty" ? 0.22 : 1;
  const slitRx = state === "working" || state === "thinking" ? 1.6 : 3.4;
  const eyeAlpha = state === "empty" ? 0.35 : 1;
  const auraAlpha = state === "empty" ? 0.2 : 1;
  const showTendrils = !noTendrils && state !== "empty";
  const showMotes = state !== "empty";
  const glow = mood.glowMul;

  const floatAnim =
    animate && mood.float ? "mascot-float 7s ease-in-out infinite" : "none";

  const eyeGlowAnim = animate
    ? `mascot-eye-pulse ${mood.glowDur}s ease-in-out infinite`
    : "none";

  // Breath: minimal under reduced motion (stays "alive"), off when dormant.
  const breathAnim =
    state === "empty"
      ? "none"
      : animate
      ? `mascot-breathe ${mood.breathDur}s ease-in-out infinite`
      : "mascot-breathe-min 9s ease-in-out infinite";

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
  const halo2Id = `${uid}halo2`;
  const eyeGlowId = `${uid}eyeglow`;
  const filterId = `${uid}eyeblur`;

  // Outer transform: micro-tilt + cursor-lean + hover/tap scale. Composes with
  // the inner breath group (CSS scale), so neither clobbers the other.
  const leanX = hovered ? eyeOffset.x * 0.9 : 0;
  const leanY = hovered ? eyeOffset.y * 0.9 : 0;
  const poseScale = (hovered ? 1.03 : 1) * (tapped ? 1.06 : 1);
  const outerTransform = `translate(${leanX.toFixed(2)}px, ${leanY.toFixed(2)}px) rotate(${tilt.toFixed(2)}deg) scale(${poseScale})`;

  return (
    <div
      className={`mascot-root${className ? ` ${className}` : ""}`}
      style={{ width: size, height, flexShrink: 0, animation: floatAnim }}
      ref={rootRef}
      onPointerEnter={() => isDesktop && animate && setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={handlePointerDown}
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
            <stop offset="0%" stopColor="#0c3a44" stopOpacity={Math.min(1, 0.6 * auraAlpha * glow)} />
            <stop offset="55%" stopColor="#08161c" stopOpacity={Math.min(1, 0.35 * auraAlpha * glow)} />
            <stop offset="100%" stopColor="#06080b" stopOpacity="0" />
          </radialGradient>

          <radialGradient id={halo2Id} cx="50%" cy="44%" r="62%">
            <stop offset="0%" stopColor="#0e7490" stopOpacity={Math.min(1, 0.22 * auraAlpha * glow)} />
            <stop offset="60%" stopColor="#0c3a44" stopOpacity={Math.min(1, 0.12 * auraAlpha * glow)} />
            <stop offset="100%" stopColor="#06080b" stopOpacity="0" />
          </radialGradient>

          <radialGradient id={eyeGlowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity={Math.min(1, 0.6 * eyeAlpha * glow)} />
            <stop offset="55%" stopColor="#0e7490" stopOpacity={Math.min(1, 0.2 * eyeAlpha * glow)} />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>

          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Soft glow that breathes — two halo layers offset in phase for depth */}
        <circle
          cx="190" cy="180" r="172"
          fill={`url(#${halo2Id})`}
          className="mascot-lively"
          style={
            animate
              ? { transformBox: "fill-box", transformOrigin: "center", animation: "mascot-halo-breathe 6.4s ease-in-out -2.6s infinite" }
              : undefined
          }
        />
        <circle
          cx="190" cy="172" r="150"
          fill={`url(#${auraId})`}
          className="mascot-lively"
          style={
            animate
              ? { transformBox: "fill-box", transformOrigin: "center", animation: `mascot-halo-breathe ${mood.glowDur + 0.6}s ease-in-out infinite` }
              : undefined
          }
        />

        {/* Outer pose layer — micro-tilt + cursor-lean + hover/tap */}
        <g
          style={{
            transformBox: "fill-box",
            transformOrigin: "50% 64%",
            transform: outerTransform,
            transition: "transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {/* Inner breath layer — gentle scale pulse */}
          <g
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              animation: breathAnim,
              ["--breath-scale" as string]: mood.breathScale,
            }}
          >
            {/* Body + shoulder highlight */}
            <g opacity={bodyOpacity}>
              <path
                d="M190 78 C152 78 132 116 132 172 C132 232 152 276 190 290 C228 276 248 232 248 172 C248 116 228 78 190 78 Z"
                fill="#0b1322"
                stroke="#1d3151"
                strokeWidth="0.8"
              />
              <ellipse cx="170" cy="122" rx="19" ry="33" fill="#16263e" opacity="0.45" />
            </g>

            {/* Tendrils */}
            {showTendrils &&
              mounted &&
              [0, 1, 2, 3, 4].map((i) => {
                const t = getTendril(i);
                const delay = `${i * 0.75}s`;
                const dur = `${(mood.toolFlash ? 2.4 : 5.3) + i * 0.62}s`;
                const tipBright = mood.toolFlash;
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
                      strokeWidth={tipBright ? 1.8 : 1.2}
                      fill="none"
                      strokeLinecap="round"
                      opacity={mood.tendrilOpacity}
                      className="mascot-lively"
                      style={animate ? { animation: `tendril-pulse ${dur} ease-in-out ${delay} infinite` } : undefined}
                    />
                    {/* Tip glow */}
                    <circle cx={t.tipX} cy={t.tipY} r={tipBright ? 9 : 7} fill="#22d3ee" opacity={tipBright ? 0.32 : 0.18} />
                    {/* Tip dot */}
                    <circle cx={t.tipX} cy={t.tipY} r={tipBright ? 3.6 : 3} fill="#5eead4" />
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

            {/* Speaking rings — energy flowing outward from the core */}
            {animate && mood.speaking &&
              [0, 1, 2].map((i) => (
                <circle
                  key={`spk-${i}`}
                  cx="190" cy="162" r="26"
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="1.4"
                  className="mascot-lively"
                  style={{
                    transformBox: "fill-box",
                    transformOrigin: "center",
                    animation: `mascot-speak 1.8s ease-out ${i * 0.5}s infinite`,
                    ["--speak-op" as string]: 0.5,
                  }}
                />
              ))}

            {/* Tool-call flare — a single bright ring when a connector fires */}
            {animate && mood.toolFlash && (
              <circle
                cx="190" cy="172" r="40"
                fill="none"
                stroke="#5eead4"
                strokeWidth="1.8"
                className="mascot-lively"
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  animation: "mascot-speak 1.2s ease-out infinite",
                  ["--speak-op" as string]: 0.7,
                }}
              />
            )}

            {/* Eye — deferred to mount to avoid hydration mismatch */}
            {mounted && (
              <g filter={`url(#${filterId})`}>
                {/* Ambient glow */}
                <circle
                  cx="190" cy="162" r="46"
                  fill={`url(#${eyeGlowId})`}
                  className="mascot-lively"
                  style={{ animation: eyeGlowAnim }}
                />
                {/* Eyeball — shifts toward the focal point (cursor / saccade) */}
                <g
                  style={{
                    transform: `translate(${eyeOffset.x.toFixed(2)}px, ${eyeOffset.y.toFixed(2)}px)`,
                    transition: "transform 0.45s ease-out",
                  }}
                >
                  {/* Socket */}
                  <ellipse cx="190" cy="162" rx="32" ry="29" fill="#04141c" />
                  {/* Iris base */}
                  <circle cx="190" cy="162" r="21" fill="#0a3d49" />
                  {/* Iris ring */}
                  <circle cx="190" cy="162" r="21" fill="none" stroke="#22d3ee" strokeWidth="1.6" />
                  {/* Inner iris */}
                  <circle cx="190" cy="162" r="14" fill="#0e6b80" />
                  {/* Vertical slit */}
                  <ellipse cx="190" cy="162" rx={slitRx} ry="15" fill="#02080c" />
                  {/* Slit rim */}
                  <ellipse cx="190" cy="162" rx={slitRx} ry="15" fill="none" stroke="#5eead4" strokeWidth="0.8" opacity="0.7" />
                  {/* Specular */}
                  <circle cx="183" cy="153" r="2.4" fill="#d6fbff" opacity="0.85" />
                </g>
              </g>
            )}
          </g>
        </g>

        {/* Floating particle field — subtle ambient drift, outside the breath/tilt */}
        {mounted &&
          showMotes &&
          PARTICLES.map((p, i) => (
            <g
              key={i}
              className="mascot-lively"
              style={
                animate
                  ? {
                      transformBox: "fill-box",
                      transformOrigin: "center",
                      animation: `mascot-drift-${p.k} ${p.dur}s ease-in-out ${p.delay}s infinite`,
                    }
                  : undefined
              }
            >
              <circle cx={p.x} cy={p.y} r={p.r * 3.2} fill="#22d3ee" opacity={p.o * 0.28} />
              <circle cx={p.x} cy={p.y} r={p.r} fill="#5eead4" opacity={p.o} />
            </g>
          ))}
      </svg>
    </div>
  );
}
