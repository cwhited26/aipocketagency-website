"use client";

// Framelix3DStudios: cinematic camera-dolly perspective + 3D CSS card rotation.
// Film frames cycle through with depth-of-field blur on outer frames.
// No canvas — pure CSS 3D transforms + keyframe animations.
// Palette: #0C0C0C / #F5F2ED / #C8A96E (gold) / #8B6F3E (warm)

import { useEffect, useState, useRef } from "react";

const W = 1440;
const H = 900;

const SCENES = [
  { label: "Desert Dunes", ratio: "2.39:1", num: "01", color: "#3D2B1A" },
  { label: "Urban Night", ratio: "1.85:1", num: "02", color: "#141824" },
  { label: "Alpine Peak", ratio: "2.39:1", num: "03", color: "#1A2218" },
  { label: "Ocean Horizon", ratio: "2.35:1", num: "04", color: "#0F1A24" },
  { label: "Neon Metropolis", ratio: "1.85:1", num: "05", color: "#180F24" },
];

const CYCLE_MS = 2400;

export default function Framelix3DStudios({ isVisible }: { isVisible: boolean }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [prevIdx, setPrevIdx]     = useState<number | null>(null);
  const [tick, setTick]           = useState(0);
  const intervalRef               = useRef<ReturnType<typeof setInterval> | null>(null);
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    setPrefersReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (!isVisible || prefersReduced) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setActiveIdx((prev) => {
        setPrevIdx(prev);
        return (prev + 1) % SCENES.length;
      });
      setTick((t) => t + 1);
    }, CYCLE_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isVisible, prefersReduced]);

  const active = SCENES[activeIdx];
  const dollyPhase = (tick % 3) * 0.33;

  return (
    <div
      style={{
        width: W, height: H,
        background: "#0C0C0C",
        position: "relative",
        overflow: "hidden",
        userSelect: "none",
        fontFamily: "'Inter', system-ui, sans-serif",
        perspective: "1800px",
      }}
    >
      <style>{`
        @keyframes frx-rotate3d {
          0%   { transform: rotateY(-8deg) rotateX(2deg) scale(1.04); }
          50%  { transform: rotateY(8deg)  rotateX(-2deg) scale(1.0); }
          100% { transform: rotateY(-8deg) rotateX(2deg) scale(1.04); }
        }
        @keyframes frx-dolly {
          0%   { transform: translateZ(0px) translateX(0px); }
          33%  { transform: translateZ(-60px) translateX(-20px); }
          66%  { transform: translateZ(-30px) translateX(20px); }
          100% { transform: translateZ(0px) translateX(0px); }
        }
        @keyframes frx-slide-in {
          from { transform: translateX(60px) translateZ(-120px) rotateY(15deg); opacity: 0; }
          to   { transform: translateX(0px) translateZ(0px) rotateY(0deg); opacity: 1; }
        }
        @keyframes frx-slide-out {
          from { transform: translateX(0px) translateZ(0px) rotateY(0deg); opacity: 1; }
          to   { transform: translateX(-60px) translateZ(-120px) rotateY(-15deg); opacity: 0; }
        }
        @keyframes frx-grain {
          0%,100% { opacity: 0.025; }
          25%  { opacity: 0.04; }
          50%  { opacity: 0.02; }
          75%  { opacity: 0.05; }
        }
        @keyframes frx-cursor {
          0%   { transform: translate(-50%,-50%) scale(1); opacity: 1; }
          50%  { transform: translate(-50%,-50%) scale(1.3); opacity: 0.7; }
          100% { transform: translate(-50%,-50%) scale(1); opacity: 1; }
        }
        @keyframes frx-filmstrip {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-${SCENES.length * 240}px); }
        }
        @keyframes frx-counter {
          0%   { opacity: 1; transform: translateY(0); }
          45%  { opacity: 0; transform: translateY(-12px); }
          55%  { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Deep bg with film grain */}
      <div style={{ position: "absolute", inset: 0, background: "#0C0C0C" }} />

      {/* Grain texture */}
      <div aria-hidden style={{
        position: "absolute", inset: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: "200px 200px",
        opacity: 0.04,
        animation: "frx-grain 0.08s steps(1) infinite",
        pointerEvents: "none",
      }} />

      {/* 3D scene container with camera dolly */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: isVisible && !prefersReduced ? "frx-dolly 8s ease-in-out infinite" : "none",
          transformStyle: "preserve-3d",
        }}
      >
        {/* Main featured frame */}
        <div
          key={`frame-${activeIdx}`}
          style={{
            width: 920,
            height: 490,
            position: "relative",
            transformStyle: "preserve-3d",
            animation: isVisible && !prefersReduced ? "frx-slide-in 0.55s cubic-bezier(0.25,1,0.5,1) both, frx-rotate3d 12s ease-in-out infinite 0.55s" : "none",
          }}
        >
          {/* Main film frame */}
          <div style={{
            width: "100%", height: "100%",
            background: active.color,
            border: "2px solid rgba(200,169,110,0.22)",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Letterbox bars */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 52, background: "#0C0C0C", zIndex: 2 }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 52, background: "#0C0C0C", zIndex: 2 }} />

            {/* Scene color fill with atmospheric depth */}
            <div style={{
              position: "absolute",
              inset: 52,
              background: `linear-gradient(135deg, ${active.color} 0%, rgba(0,0,0,0.4) 100%)`,
            }} />

            {/* Center DOF blur rings */}
            <div style={{
              position: "absolute",
              inset: 52,
              background: "radial-gradient(ellipse at 45% 52%, transparent 20%, rgba(0,0,0,0.55) 80%)",
            }} />

            {/* Scene name in center */}
            <div style={{
              position: "absolute",
              inset: 52,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 8,
              zIndex: 3,
            }}>
              <div style={{
                color: "rgba(245,242,237,0.18)",
                fontSize: 13, letterSpacing: "0.32em", textTransform: "uppercase",
              }}>
                {active.ratio}
              </div>
              <div style={{
                color: "rgba(245,242,237,0.55)",
                fontSize: 22, fontWeight: 300, letterSpacing: "0.08em",
              }}>
                {active.label}
              </div>
            </div>

            {/* Frame number top-left */}
            <div style={{
              position: "absolute", top: 16, left: 18, zIndex: 4,
              color: "rgba(200,169,110,0.7)",
              fontSize: 10, letterSpacing: "0.26em", textTransform: "uppercase",
              fontFamily: "'Courier New', monospace",
            }}>
              FRAMELIX STUDIOS • SCENE {active.num}
            </div>

            {/* Aspect ratio top-right */}
            <div style={{
              position: "absolute", top: 16, right: 18, zIndex: 4,
              color: "rgba(245,242,237,0.3)",
              fontSize: 10, letterSpacing: "0.2em",
              fontFamily: "'Courier New', monospace",
            }}>
              {active.ratio}
            </div>

            {/* Timecode bottom */}
            <div style={{
              position: "absolute", bottom: 18, left: 18, zIndex: 4,
              color: "rgba(200,169,110,0.5)",
              fontSize: 10, letterSpacing: "0.14em",
              fontFamily: "'Courier New', monospace",
            }}>
              00:{String(activeIdx * 24 + 12).padStart(2, "0")}:{String((tick * 18) % 60).padStart(2, "0")}:14
            </div>
          </div>

          {/* Frame border reticle corners */}
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dy], i) => (
            <div key={i} style={{
              position: "absolute",
              width: 20, height: 20,
              top: dy === -1 ? -1 : undefined,
              bottom: dy === 1 ? -1 : undefined,
              left: dx === -1 ? -1 : undefined,
              right: dx === 1 ? -1 : undefined,
              borderTop: dy === -1 ? "2px solid rgba(200,169,110,0.65)" : undefined,
              borderBottom: dy === 1 ? "2px solid rgba(200,169,110,0.65)" : undefined,
              borderLeft: dx === -1 ? "2px solid rgba(200,169,110,0.65)" : undefined,
              borderRight: dx === 1 ? "2px solid rgba(200,169,110,0.65)" : undefined,
            }} />
          ))}
        </div>
      </div>

      {/* Side frames (blurred, 3D depth) */}
      {SCENES.map((scene, i) => {
        if (i === activeIdx) return null;
        const dist = ((i - activeIdx + SCENES.length) % SCENES.length);
        const side = dist === 1 ? 1 : dist === SCENES.length - 1 ? -1 : null;
        if (!side) return null;
        return (
          <div key={i} style={{
            position: "absolute",
            left: side === -1 ? 60 : undefined,
            right: side === 1 ? 60 : undefined,
            top: "50%",
            transform: `translateY(-50%) translateZ(-400px) rotateY(${side * -28}deg)`,
            width: 340,
            height: 185,
            background: scene.color,
            border: "1px solid rgba(200,169,110,0.1)",
            filter: "blur(2px) brightness(0.55)",
            overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 20, background: "#0C0C0C" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 20, background: "#0C0C0C" }} />
            <div style={{
              position: "absolute", inset: 20,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(245,242,237,0.3)", fontSize: 11, letterSpacing: "0.12em",
            }}>
              {scene.label}
            </div>
          </div>
        );
      })}

      {/* UI Overlay */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {/* Top bar */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "28px 56px",
        }}>
          <div>
            <div style={{
              color: "#F5F2ED",
              fontSize: 20, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
            }}>
              FRAMELIX
            </div>
            <div style={{
              color: "rgba(200,169,110,0.75)",
              fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase", marginTop: 2,
            }}>
              3D Studios
            </div>
          </div>
          <div style={{ display: "flex", gap: 36 }}>
            {["Work", "Services", "About", "Contact"].map(t => (
              <span key={t} style={{
                color: "rgba(245,242,237,0.45)",
                fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
              }}>{t}</span>
            ))}
          </div>
          <div style={{
            border: "1px solid rgba(200,169,110,0.5)",
            color: "#C8A96E",
            fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
            padding: "9px 22px",
          }}>
            Get a Quote
          </div>
        </div>

        {/* Left vertical label */}
        <div style={{
          position: "absolute", left: 28, top: "50%",
          transform: "translateY(-50%) rotate(-90deg)",
          color: "rgba(245,242,237,0.2)",
          fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}>
          Award-Winning Cinematography
        </div>

        {/* Bottom content */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "28px 56px",
          display: "flex", justifyContent: "space-between", alignItems: "flex-end",
          borderTop: "1px solid rgba(245,242,237,0.07)",
          background: "linear-gradient(to top, rgba(12,12,12,0.85), transparent)",
        }}>
          <div>
            <h1 style={{
              margin: 0, color: "#F5F2ED",
              fontSize: 56, fontWeight: 800,
              letterSpacing: "-0.02em", lineHeight: 1,
              textTransform: "uppercase",
            }}>
              We Create<br />
              <span style={{ color: "#C8A96E" }}>Cinema.</span>
            </h1>
          </div>

          {/* Scene counter */}
          <div style={{ textAlign: "right" }}>
            <div style={{
              color: "#C8A96E",
              fontSize: 56, fontWeight: 900,
              lineHeight: 1, letterSpacing: "-0.02em",
              animation: "frx-counter 2.4s ease-in-out infinite",
            }}>
              0{activeIdx + 1}
            </div>
            <div style={{
              color: "rgba(245,242,237,0.3)",
              fontSize: 11, letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}>
              / 0{SCENES.length}
            </div>
          </div>
        </div>

        {/* Filmstrip ticker */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 4,
          background: "rgba(200,169,110,0.15)",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${((activeIdx + 1) / SCENES.length) * 100}%`,
            background: "rgba(200,169,110,0.7)",
            transition: "width 0.4s ease",
          }} />
        </div>
      </div>
    </div>
  );
}
