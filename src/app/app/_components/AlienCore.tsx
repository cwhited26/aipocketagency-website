"use client";

import { useEffect, useState } from "react";

type NodeDef = {
  id: string;
  label: string;
  x: number;
  y: number;
  connected: boolean;
  cx1: number;
  cy1: number;
  cx2: number;
  cy2: number;
  textAnchor: "start" | "middle" | "end";
  labelDx: number;
  labelDy: number;
  animDelay: string;
  animDuration: string;
};

const CX = 180;
const CY = 180;

export default function AlienCore({ brainRepo }: { brainRepo: string | null }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const hasBrain = Boolean(brainRepo);
  const brainLabel = brainRepo ? (brainRepo.split("/")[1] ?? "brain") : "Brain";

  const nodes: NodeDef[] = [
    {
      id: "brain",
      label: brainLabel,
      x: 180, y: 24,
      connected: hasBrain,
      cx1: 181, cy1: 130, cx2: 180, cy2: 72,
      textAnchor: "middle", labelDx: 0, labelDy: -10,
      animDelay: "0s", animDuration: "6s",
    },
    {
      id: "quotes",
      label: "Quotes",
      x: 318, y: 84,
      connected: true,
      cx1: 228, cy1: 164, cx2: 282, cy2: 114,
      textAnchor: "start", labelDx: 8, labelDy: 4,
      animDelay: "1.2s", animDuration: "7s",
    },
    {
      id: "followups",
      label: "Follow-ups",
      x: 314, y: 278,
      connected: false,
      cx1: 248, cy1: 196, cx2: 292, cy2: 244,
      textAnchor: "start", labelDx: 8, labelDy: 4,
      animDelay: "2.4s", animDuration: "8s",
    },
    {
      id: "inbox",
      label: "Inbox",
      x: 46, y: 278,
      connected: false,
      cx1: 112, cy1: 196, cx2: 68, cy2: 244,
      textAnchor: "end", labelDx: -8, labelDy: 4,
      animDelay: "1.8s", animDuration: "7.5s",
    },
    {
      id: "calendar",
      label: "Calendar",
      x: 42, y: 84,
      connected: false,
      cx1: 132, cy1: 164, cx2: 78, cy2: 114,
      textAnchor: "end", labelDx: -8, labelDy: 4,
      animDelay: "0.6s", animDuration: "6.5s",
    },
  ];

  return (
    <div
      className="relative select-none mx-auto"
      style={{ width: 360, height: 360 }}
    >
      {/* Ambient glow — single, very restrained */}
      <div
        className="absolute inset-[60px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(34,211,238,0.07) 0%, transparent 70%)",
          filter: "blur(24px)",
        }}
      />

      {/* Outer organic ring */}
      <div
        className="absolute"
        style={{
          inset: 80,
          animation: "alien-morph 18s ease-in-out infinite reverse",
          background: "transparent",
          border: "1px solid rgba(34,211,238,0.07)",
        }}
      />

      {/* Core blob */}
      <div
        className="absolute"
        style={{
          inset: 108,
          animation: "alien-morph 14s ease-in-out infinite",
          background:
            "radial-gradient(ellipse at 42% 40%, rgba(34,211,238,0.18) 0%, rgba(7,13,18,0.96) 64%)",
          border: "1px solid rgba(34,211,238,0.16)",
        }}
      />

      {/* Iris — absolute centered */}
      {mounted && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 30,
            height: 30,
            marginTop: -15,
            marginLeft: -15,
          }}
        >
          {/* Halo ring */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: "1px solid rgba(34,211,238,0.3)",
              animation: "halo-out 5s ease-out 1s infinite",
            }}
          />
          {/* Iris fill — this one animates */}
          <div
            className="absolute rounded-full"
            style={{
              inset: 4,
              background:
                "radial-gradient(circle, rgba(34,211,238,0.9) 0%, rgba(34,211,238,0.35) 55%, transparent 100%)",
              animation: "alien-breathe 6s ease-in-out infinite",
              transformOrigin: "center",
            }}
          />
          {/* Pupil */}
          <div
            className="absolute rounded-full"
            style={{ inset: 11, background: "#031820" }}
          />
        </div>
      )}

      {/* SVG: tentacles + nodes */}
      <svg
        className="absolute inset-0 pointer-events-none"
        viewBox="0 0 360 360"
        style={{ width: "100%", height: "100%" }}
      >
        {nodes.map((node) => {
          const pathD = `M ${CX} ${CY} C ${node.cx1} ${node.cy1} ${node.cx2} ${node.cy2} ${node.x} ${node.y}`;
          return (
            <g key={node.id}>
              {/* Tentacle */}
              <path
                d={pathD}
                stroke={
                  node.connected
                    ? "rgba(34,211,238,0.22)"
                    : "rgba(51,65,85,0.18)"
                }
                strokeWidth={node.connected ? 1 : 0.75}
                fill="none"
                strokeDasharray={node.connected ? "5 7" : "2 9"}
                style={
                  node.connected
                    ? {
                        animation: `tendril-pulse ${node.animDuration} ease-in-out ${node.animDelay} infinite`,
                      }
                    : {}
                }
              />

              {/* Node dot */}
              <circle
                cx={node.x}
                cy={node.y}
                r={node.connected ? 4 : 3}
                fill={
                  node.connected
                    ? "rgba(34,211,238,0.75)"
                    : "rgba(51,65,85,0.55)"
                }
                style={
                  node.connected
                    ? {
                        animation: `node-beacon ${node.animDuration} ease-in-out ${node.animDelay} infinite`,
                      }
                    : {}
                }
              />

              {/* Label */}
              <text
                x={node.x + node.labelDx}
                y={node.y + node.labelDy}
                textAnchor={node.textAnchor}
                dominantBaseline="middle"
                fill={
                  node.connected
                    ? "rgba(148,163,184,0.75)"
                    : "rgba(71,85,105,0.5)"
                }
                fontSize="9"
                fontFamily="ui-monospace, 'Cascadia Code', monospace"
                letterSpacing="0.06em"
              >
                {node.label}
              </text>
            </g>
          );
        })}

        {/* Center dot */}
        <circle cx={CX} cy={CY} r="2.5" fill="rgba(34,211,238,0.4)" />
      </svg>
    </div>
  );
}
