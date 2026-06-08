"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Viewbox: 300×300, center: (150, 150)
// Nodes sit on a radius of ~105px from center — well inside the viewbox
// so labels don't clip even on a 320px wide mobile screen.
const CX = 150;
const CY = 150;

type NodeDef = {
  id: string;
  label: string;
  href: string;
  x: number;
  y: number;
  connected: boolean;
  cx1: number; cy1: number;
  cx2: number; cy2: number;
  textAnchor: "start" | "middle" | "end";
  labelDx: number;
  labelDy: number;
  animDelay: string;
  animDuration: string;
};

export default function AlienCore({ brainRepo }: { brainRepo: string | null }) {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);

  const hasBrain = Boolean(brainRepo);
  // Keep label short to avoid clipping on narrow screens
  const brainLabel = brainRepo
    ? (brainRepo.split("/")[1] ?? "brain").slice(0, 14)
    : "Brain";

  // Nodes placed at radius ~105px from center (150,150).
  // Clock positions: Brain=12, Quotes=2, Followups=4:30, Inbox=7:30, Calendar=10
  const nodes: NodeDef[] = [
    {
      id: "brain",
      label: brainLabel,
      href: "/app/onboarding",
      x: 150, y: 45,
      connected: hasBrain,
      cx1: 151, cy1: 115, cx2: 151, cy2: 75,
      textAnchor: "middle", labelDx: 0, labelDy: -10,
      animDelay: "0s", animDuration: "6s",
    },
    {
      // ~60° clockwise from top
      id: "quotes",
      label: "Quotes",
      href: "/app/apps/quote",
      x: 241, y: 97,
      connected: true,
      cx1: 195, cy1: 140, cx2: 225, cy2: 113,
      textAnchor: "start", labelDx: 7, labelDy: 4,
      animDelay: "1.2s", animDuration: "7s",
    },
    {
      // ~135° clockwise from top
      id: "followups",
      label: "Follow-ups",
      href: "/app/apps/followups",
      x: 224, y: 224,
      connected: false,
      cx1: 200, cy1: 180, cx2: 215, cy2: 208,
      textAnchor: "start", labelDx: 7, labelDy: 4,
      animDelay: "2.4s", animDuration: "8s",
    },
    {
      // ~225° clockwise from top
      id: "inbox",
      label: "Mission",
      href: "/app/mission-control",
      x: 76, y: 224,
      connected: false,
      cx1: 100, cy1: 180, cx2: 85, cy2: 208,
      textAnchor: "end", labelDx: -7, labelDy: 4,
      animDelay: "1.8s", animDuration: "7.5s",
    },
    {
      // ~300° clockwise from top (10 o'clock)
      id: "calendar",
      label: "Cal",
      href: "/app/apps/calendar",
      x: 59, y: 97,
      connected: false,
      cx1: 105, cy1: 140, cx2: 75, cy2: 113,
      textAnchor: "end", labelDx: -7, labelDy: 4,
      animDelay: "0.6s", animDuration: "6.5s",
    },
  ];

  return (
    // w-full + max-w → scales down on narrow screens, never wider than 300px
    <div className="w-full max-w-[300px] mx-auto" style={{ aspectRatio: "1" }}>
      {/* All rendering is inside one SVG so it scales perfectly at any width */}
      <svg
        viewBox="0 0 300 300"
        className="w-full h-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="coreGrad" cx="42%" cy="40%" r="55%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.22" />
            <stop offset="65%" stopColor="#070d12" stopOpacity="0.97" />
          </radialGradient>
          <radialGradient id="outerGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#070d12" stopOpacity="0" />
          </radialGradient>
          <filter id="irisGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ambient glow — very faint */}
        <circle cx={CX} cy={CY} r="115" fill="url(#outerGrad)" />

        {/* Outer organic ring — animates via CSS */}
        <ellipse
          cx={CX} cy={CY} rx="88" ry="88"
          fill="none"
          stroke="rgba(34,211,238,0.07)"
          strokeWidth="1"
          style={{ animation: "alien-morph 18s ease-in-out infinite reverse" }}
        />

        {/* Core blob — the main animated shape */}
        <ellipse
          cx={CX} cy={CY} rx="62" ry="62"
          fill="url(#coreGrad)"
          stroke="rgba(34,211,238,0.22)"
          strokeWidth="1"
          style={{ animation: "alien-morph 14s ease-in-out infinite" }}
        />

        {/* Iris — only after mount to avoid hydration mismatch */}
        {mounted && (
          <g filter="url(#irisGlow)">
            {/* Halo ring */}
            <circle
              cx={CX} cy={CY} r="16"
              fill="none"
              stroke="rgba(34,211,238,0.35)"
              strokeWidth="0.75"
              style={{ animation: "halo-out 5s ease-out 1s infinite" }}
            />
            {/* Iris fill */}
            <circle
              cx={CX} cy={CY} r="10"
              fill="rgba(34,211,238,0.0)"
              style={{ animation: "alien-breathe 6s ease-in-out infinite", transformOrigin: `${CX}px ${CY}px` }}
            >
              <animate
                attributeName="r"
                values="9;11;9"
                dur="6s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="fill"
                values="rgba(34,211,238,0.75);rgba(34,211,238,0.95);rgba(34,211,238,0.75)"
                dur="6s"
                repeatCount="indefinite"
              />
            </circle>
            {/* Pupil */}
            <circle cx={CX} cy={CY} r="4.5" fill="#031820" />
          </g>
        )}

        {/* Tentacles + nodes */}
        {nodes.map((node) => {
          const pathD = `M ${CX} ${CY} C ${node.cx1} ${node.cy1} ${node.cx2} ${node.cy2} ${node.x} ${node.y}`;
          return (
            <g key={node.id}>
              {/* Tentacle */}
              <path
                d={pathD}
                stroke={node.connected ? "rgba(34,211,238,0.28)" : "rgba(71,85,105,0.22)"}
                strokeWidth={node.connected ? 1 : 0.75}
                fill="none"
                strokeDasharray={node.connected ? "5 7" : "2 9"}
                style={
                  node.connected
                    ? { animation: `tendril-pulse ${node.animDuration} ease-in-out ${node.animDelay} infinite` }
                    : {}
                }
              />

              {/* Clickable node group — navigate to the work surface */}
              <g
                onClick={() => router.push(node.href)}
                style={{ cursor: "pointer" }}
                role="link"
                aria-label={`Go to ${node.label}`}
              >
                {/* Invisible hit target */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={14}
                  fill="transparent"
                />

                {/* Node dot */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.connected ? 4 : 3}
                  fill={node.connected ? "rgba(34,211,238,0.85)" : "rgba(71,85,105,0.5)"}
                  style={
                    node.connected
                      ? { animation: `node-beacon ${node.animDuration} ease-in-out ${node.animDelay} infinite` }
                      : {}
                  }
                />

                {/* Label */}
                <text
                  x={node.x + node.labelDx}
                  y={node.y + node.labelDy}
                  textAnchor={node.textAnchor}
                  dominantBaseline="middle"
                  fill={node.connected ? "rgba(203,213,225,0.85)" : "rgba(100,116,139,0.65)"}
                  fontSize="9"
                  fontFamily="ui-monospace, 'Cascadia Code', monospace"
                  letterSpacing="0.04em"
                >
                  {node.label}
                </text>
              </g>
            </g>
          );
        })}

        {/* Center anchor dot */}
        <circle cx={CX} cy={CY} r="2" fill="rgba(34,211,238,0.5)" />
      </svg>
    </div>
  );
}
