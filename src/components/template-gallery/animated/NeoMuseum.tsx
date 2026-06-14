"use client";

// NeoMuseum: high-design typography motion + gallery card slides.
// Giant masked type reveals behind sliding exhibit cards.
// Palette: #F8F5EE (cream) / #111111 (deep) / #2A2A2A / accent #8B7355 (warm umber)
// Pure CSS keyframes + React state. No canvas.

import { useEffect, useState, useRef } from "react";

const W = 1440;
const H = 900;

const CHAPTERS = [
  { name: "Age of Dinosaurs",          sub: "Late Cretaceous · 66M Years",     accent: "#4A3728" },
  { name: "Fossils of Ancient Life",   sub: "Cambrian Explosion · 541M Years", accent: "#2A3A4A" },
  { name: "Reptiles of the Mesozoic",  sub: "Triassic Era · 252M Years",       accent: "#3A4A2A" },
  { name: "Marine Fossil Gallery",     sub: "Devonian Period · 419M Years",     accent: "#2A4A4A" },
  { name: "Prehistoric Giants",        sub: "Pleistocene · 2.6M Years",        accent: "#4A3A2A" },
];

const CYCLE_MS = 3200;

export default function NeoMuseum({ isVisible }: { isVisible: boolean }) {
  const [idx, setIdx] = useState(2);
  const [entering, setEntering] = useState<number | null>(null);
  const [exiting, setExiting] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [prefersReduced, setPrefersReduced] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setPrefersReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (!isVisible || prefersReduced) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setIdx((prev) => {
        const next = (prev + 1) % CHAPTERS.length;
        setExiting(prev);
        setEntering(next);
        setTimeout(() => { setExiting(null); setEntering(null); }, 700);
        setTick((t) => t + 1);
        return next;
      });
    }, CYCLE_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isVisible, prefersReduced]);

  const chapter = CHAPTERS[idx];

  return (
    <div
      style={{
        width: W, height: H,
        background: "#F8F5EE",
        position: "relative",
        overflow: "hidden",
        userSelect: "none",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <style>{`
        @keyframes neo-mega-in {
          from { opacity:0; transform: translateY(48px) skewY(1.5deg); }
          to   { opacity:1; transform: translateY(0)   skewY(0deg); }
        }
        @keyframes neo-card-enter {
          from { transform: translateY(60px) scale(0.97); opacity:0; }
          to   { transform: translateY(0)  scale(1);    opacity:1; }
        }
        @keyframes neo-card-exit {
          from { transform: translateY(0) scale(1);    opacity:1; }
          to   { transform: translateY(-60px) scale(0.97); opacity:0; }
        }
        @keyframes neo-sub-reveal {
          from { opacity:0; transform:translateX(-20px); }
          to   { opacity:1; transform:translateX(0); }
        }
        @keyframes neo-progress {
          from { width:0%; }
          to   { width:100%; }
        }
        @keyframes neo-ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes neo-dot-pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%     { opacity:0.5; transform:scale(0.7); }
        }
      `}</style>

      {/* Top Navigation */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        padding: "22px 48px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid rgba(17,17,17,0.1)",
        background: "#F8F5EE",
        zIndex: 10,
      }}>
        {/* NHM Logo SVG */}
        <svg viewBox="0 0 280 36" width="280" height="36" fill="#111111">
          <text x="0" y="28" fontFamily="'Inter',system-ui,sans-serif" fontSize="28" fontWeight="900" letterSpacing="-0.02em">NHM</text>
        </svg>
        <div style={{ display: "flex", gap: 36, alignItems: "center" }}>
          {["Visit", "Exhibitions", "Learn", "Membership"].map(t => (
            <span key={t} style={{
              color: "rgba(17,17,17,0.52)", fontSize: 11,
              letterSpacing: "0.14em", textTransform: "uppercase",
            }}>{t}</span>
          ))}
          <div style={{
            background: "#111111", color: "#F8F5EE",
            fontSize: 10, fontWeight: 700, letterSpacing: "0.18em",
            textTransform: "uppercase", padding: "10px 22px",
          }}>
            Book Tickets
          </div>
        </div>
      </div>

      {/* MEGA typography background */}
      <div style={{
        position: "absolute",
        bottom: -24,
        left: -16,
        right: -16,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 1,
      }}>
        <div
          key={`mega-${idx}`}
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontWeight: 900,
            fontSize: "19vw",
            lineHeight: 0.78,
            letterSpacing: "-0.04em",
            color: "transparent",
            WebkitTextStroke: "1.5px rgba(17,17,17,0.08)",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            animation: prefersReduced ? "none" : "neo-mega-in 0.7s cubic-bezier(0.16,1,0.3,1) both",
          }}
        >
          {chapter.name.split(" ").join("\n")}
        </div>
      </div>

      {/* Main gallery area */}
      <div style={{
        position: "absolute",
        top: 80, left: 0, right: 0, bottom: 0,
        display: "flex",
        zIndex: 2,
      }}>
        {/* Left info panel */}
        <div style={{
          width: 400,
          padding: "56px 48px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div>
            {/* Chapter counter */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12, marginBottom: 28,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "#111111",
                animation: "neo-dot-pulse 3.2s ease-in-out infinite",
              }} />
              <span style={{
                color: "rgba(17,17,17,0.42)",
                fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase",
                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              }}>
                {String(idx + 1).padStart(2, "0")} / {String(CHAPTERS.length).padStart(2, "0")}
              </span>
            </div>

            {/* Chapter name */}
            <div
              key={`name-${idx}`}
              style={{
                animation: prefersReduced ? "none" : "neo-mega-in 0.6s cubic-bezier(0.16,1,0.3,1) both",
              }}
            >
              <h2 style={{
                margin: 0,
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: 38, fontWeight: 700,
                lineHeight: 1.15, letterSpacing: "-0.02em",
                color: "#111111",
              }}>
                {chapter.name}
              </h2>
            </div>

            {/* Sub */}
            <div
              key={`sub-${idx}`}
              style={{
                marginTop: 14,
                color: "rgba(17,17,17,0.48)",
                fontSize: 12, letterSpacing: "0.14em",
                textTransform: "uppercase",
                animation: prefersReduced ? "none" : "neo-sub-reveal 0.7s 0.15s cubic-bezier(0.16,1,0.3,1) both",
              }}
            >
              {chapter.sub}
            </div>

            {/* Description */}
            <p style={{
              marginTop: 22, marginBottom: 0,
              color: "rgba(17,17,17,0.56)",
              fontSize: 13, lineHeight: 1.7,
            }}>
              Explore the evidence of life across geological time. Each specimen reveals a chapter of Earth&apos;s deep history — preserved across millions of years.
            </p>
          </div>

          {/* CTA area */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{
              background: "#111111", color: "#F8F5EE",
              fontSize: 11, fontWeight: 700, letterSpacing: "0.16em",
              textTransform: "uppercase", padding: "14px 28px",
              display: "inline-flex", alignItems: "center", gap: 12,
            }}>
              Explore Exhibition
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 10L10 2M10 2H4M10 2V8" stroke="#F8F5EE" strokeWidth="1.3"/>
              </svg>
            </div>
            {/* Progress bar */}
            <div style={{ height: 2, background: "rgba(17,17,17,0.1)", position: "relative", overflow: "hidden" }}>
              <div
                key={`prog-${tick}`}
                style={{
                  position: "absolute", left: 0, top: 0, height: "100%",
                  background: "#111111",
                  animation: prefersReduced ? "none" : `neo-progress ${CYCLE_MS}ms linear forwards`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Gallery cards */}
        <div style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Background card (prev or next) */}
          <div style={{
            position: "absolute",
            right: 48, top: 40,
            width: 440, height: 580,
            background: CHAPTERS[(idx + 1) % CHAPTERS.length].accent,
            opacity: 0.4,
            filter: "blur(1px)",
            transform: "translate(48px, 32px) scale(0.95)",
          }} />

          {/* Active card */}
          <div
            key={`card-${idx}`}
            style={{
              position: "absolute",
              right: 96, top: 24,
              width: 480, height: 600,
              background: chapter.accent,
              animation: prefersReduced ? "none" : "neo-card-enter 0.65s cubic-bezier(0.16,1,0.3,1) both",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              padding: "0",
              overflow: "hidden",
              boxShadow: "0 32px 80px rgba(17,17,17,0.22)",
            }}
          >
            {/* Content area fill */}
            <div style={{
              flex: 1,
              background: `linear-gradient(135deg, ${chapter.accent} 0%, rgba(0,0,0,0.55) 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              {/* Specimen silhouette — abstract circular forms */}
              <svg width="220" height="220" viewBox="0 0 220 220" fill="none" opacity="0.2">
                <circle cx="110" cy="110" r="90" stroke="rgba(248,245,238,0.7)" strokeWidth="1"/>
                <circle cx="110" cy="110" r="60" stroke="rgba(248,245,238,0.5)" strokeWidth="1"/>
                <ellipse cx="110" cy="110" rx="90" ry="45" stroke="rgba(248,245,238,0.3)" strokeWidth="1"/>
                <line x1="20" y1="110" x2="200" y2="110" stroke="rgba(248,245,238,0.4)" strokeWidth="0.5"/>
                <line x1="110" y1="20" x2="110" y2="200" stroke="rgba(248,245,238,0.4)" strokeWidth="0.5"/>
                {[0, 45, 90, 135].map((a) => (
                  <line
                    key={a}
                    x1={110 + Math.cos(a * Math.PI / 180) * 90}
                    y1={110 + Math.sin(a * Math.PI / 180) * 90}
                    x2={110 - Math.cos(a * Math.PI / 180) * 90}
                    y2={110 - Math.sin(a * Math.PI / 180) * 90}
                    stroke="rgba(248,245,238,0.15)"
                    strokeWidth="0.5"
                  />
                ))}
              </svg>
            </div>

            {/* Card bottom info */}
            <div style={{
              padding: "20px 28px",
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(8px)",
            }}>
              <div style={{
                color: "rgba(248,245,238,0.5)",
                fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase",
                marginBottom: 6,
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                NHM Collection · {chapter.sub.split("·")[1]?.trim()}
              </div>
              <div style={{
                color: "#F8F5EE",
                fontSize: 18, fontWeight: 600, lineHeight: 1.2,
              }}>
                {chapter.name}
              </div>
            </div>
          </div>

          {/* Dot navigation */}
          <div style={{
            position: "absolute", right: 24, top: "50%",
            transform: "translateY(-50%)",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            {CHAPTERS.map((_, i) => (
              <div key={i} style={{
                width: i === idx ? 24 : 6,
                height: 6,
                background: i === idx ? "#111111" : "rgba(17,17,17,0.2)",
                transition: "width 0.3s ease, background 0.3s ease",
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* Ticker tape at bottom */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: 36,
        background: "#111111",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        zIndex: 10,
      }}>
        <div style={{
          display: "flex",
          animation: prefersReduced ? "none" : "neo-ticker 24s linear infinite",
          whiteSpace: "nowrap",
        }}>
          {[...Array(2)].flatMap(() =>
            CHAPTERS.map((c, i) => (
              <span key={i} style={{
                color: "rgba(248,245,238,0.45)",
                fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase",
                marginRight: 48,
              }}>
                {c.name} · {c.sub} ·
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
