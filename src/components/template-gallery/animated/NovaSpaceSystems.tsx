"use client";

// NovaSpaceSystems: stars, planetary orbits, and planet silhouettes in motion.
// Canvas-based space scene — no external assets, no videos.
// Palette: #000000 / #FFFFFF / #A0B0C8 (gray) / #C8B89A (warm planet)
// Pure canvas + rAF. No external dependencies.

import { useEffect, useRef } from "react";

const W = 1440;
const H = 900;

interface Star {
  x: number;
  y: number;
  r: number;
  a: number;
  twinklePhase: number;
  twinkleSpeed: number;
}

interface Planet {
  orbitCX: number;
  orbitCY: number;
  orbitA: number;   // semi-major
  orbitB: number;   // semi-minor
  orbitAngle: number;
  speed: number;
  radius: number;
  color: string;
  hasRing: boolean;
  ringColor: string;
  hasMoon: boolean;
  moonDist: number;
  moonAngle: number;
  moonSpeed: number;
  moonR: number;
}

function seededRng(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return ((s >>> 0) / 0x100000000); };
}

export default function NovaSpaceSystems({ isVisible }: { isVisible: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number | null>(null);
  const starsRef  = useRef<Star[]>([]);
  const planetsRef = useRef<Planet[]>([]);
  const tRef      = useRef(0);

  useEffect(() => {
    const rng = seededRng(0xdeadbeef);
    starsRef.current = Array.from({ length: 380 }, () => ({
      x: rng() * W,
      y: rng() * H,
      r: rng() * 1.4 + 0.3,
      a: rng() * 0.6 + 0.25,
      twinklePhase: rng() * Math.PI * 2,
      twinkleSpeed: rng() * 0.012 + 0.003,
    }));

    planetsRef.current = [
      {
        orbitCX: 680, orbitCY: 540, orbitA: 280, orbitB: 95,
        orbitAngle: 0.3, speed: 0.0008,
        radius: 22, color: "#B8C8A0", hasRing: false, ringColor: "",
        hasMoon: true, moonDist: 42, moonAngle: 1.2, moonSpeed: 0.003, moonR: 5,
      },
      {
        orbitCX: 740, orbitCY: 480, orbitA: 480, orbitB: 155,
        orbitAngle: 1.8, speed: 0.00045,
        radius: 38, color: "#C8B89A", hasRing: true, ringColor: "rgba(200,184,154,0.3)",
        hasMoon: false, moonDist: 0, moonAngle: 0, moonSpeed: 0, moonR: 0,
      },
      {
        orbitCX: 800, orbitCY: 450, orbitA: 620, orbitB: 195,
        orbitAngle: 0.9, speed: 0.00025,
        radius: 16, color: "#9AB0C0", hasRing: false, ringColor: "",
        hasMoon: true, moonDist: 28, moonAngle: 0.4, moonSpeed: 0.005, moonR: 4,
      },
    ];
  }, []);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    if (!isVisible) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Static first-frame render
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, W, H);
      for (const s of starsRef.current) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.a})`;
        ctx.fill();
      }
      return;
    }

    let animId = 0;

    function drawSun(t: number) {
      if (!ctx) return;
      const sx = 820, sy = 460;
      // Corona pulse
      const pulse = 1 + Math.sin(t * 1.1) * 0.06;
      const coronaGrd = ctx.createRadialGradient(sx, sy, 0, sx, sy, 180 * pulse);
      coronaGrd.addColorStop(0, "rgba(255,255,220,0.16)");
      coronaGrd.addColorStop(0.4, "rgba(255,200,80,0.05)");
      coronaGrd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = coronaGrd;
      ctx.fillRect(0, 0, W, H);

      const sunGrd = ctx.createRadialGradient(sx - 14, sy - 14, 0, sx, sy, 58 * pulse);
      sunGrd.addColorStop(0, "#FFFAE0");
      sunGrd.addColorStop(0.45, "#FFD060");
      sunGrd.addColorStop(1, "#FF8800");
      ctx.beginPath();
      ctx.arc(sx, sy, 58 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = sunGrd;
      ctx.fill();
    }

    function drawOrbitPath(p: Planet) {
      if (!ctx) return;
      ctx.save();
      ctx.strokeStyle = "rgba(160,176,200,0.12)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.ellipse(p.orbitCX, p.orbitCY, p.orbitA, p.orbitB, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    function getPlanetPos(p: Planet): [number, number] {
      return [
        p.orbitCX + Math.cos(p.orbitAngle) * p.orbitA,
        p.orbitCY + Math.sin(p.orbitAngle) * p.orbitB,
      ];
    }

    function drawPlanet(p: Planet, t: number) {
      if (!ctx) return;
      const [px, py] = getPlanetPos(p);

      // Ring (behind)
      if (p.hasRing) {
        ctx.save();
        ctx.strokeStyle = p.ringColor;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.ellipse(px, py, p.radius * 2.4, p.radius * 0.55, Math.PI * 0.18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Planet body
      const grd = ctx.createRadialGradient(px - p.radius * 0.35, py - p.radius * 0.35, 0, px, py, p.radius * 1.05);
      grd.addColorStop(0, lightenHex(p.color, 60));
      grd.addColorStop(0.6, p.color);
      grd.addColorStop(1, darkenHex(p.color, 60));
      ctx.beginPath();
      ctx.arc(px, py, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // Moon
      if (p.hasMoon) {
        const mx = px + Math.cos(p.moonAngle) * p.moonDist;
        const my = py + Math.sin(p.moonAngle) * p.moonDist;
        ctx.beginPath();
        ctx.arc(mx, my, p.moonR, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(200,212,224,0.9)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    function lightenHex(hex: string, amt: number): string {
      const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amt);
      const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amt);
      const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amt);
      return `rgb(${r},${g},${b})`;
    }

    function darkenHex(hex: string, amt: number): string {
      const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amt);
      const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amt);
      const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amt);
      return `rgb(${r},${g},${b})`;
    }

    function tick(now: number) {
      if (!cv || !ctx) return;
      const t = now * 0.001;
      tRef.current = t;

      // Space background — with subtle nebula
      ctx.fillStyle = "#000005";
      ctx.fillRect(0, 0, W, H);

      // Nebula glow (left)
      const nebL = ctx.createRadialGradient(200, 600, 0, 200, 600, 500);
      nebL.addColorStop(0, "rgba(40,30,80,0.22)");
      nebL.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = nebL;
      ctx.fillRect(0, 0, W, H);

      // Nebula glow (right)
      const nebR = ctx.createRadialGradient(1280, 200, 0, 1280, 200, 400);
      nebR.addColorStop(0, "rgba(20,50,80,0.18)");
      nebR.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = nebR;
      ctx.fillRect(0, 0, W, H);

      // Stars with twinkle
      for (const s of starsRef.current) {
        const twinkle = s.a * (0.7 + 0.3 * Math.sin(t * s.twinkleSpeed * 6.28 * 4 + s.twinklePhase));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${twinkle})`;
        ctx.fill();
      }

      // Draw orbit paths (dashed ellipses) behind planets
      for (const p of planetsRef.current) drawOrbitPath(p);

      drawSun(t);

      // Sort planets by Y so closer ones draw on top
      const sorted = [...planetsRef.current].sort((a, b) => getPlanetPos(a)[1] - getPlanetPos(b)[1]);

      for (const p of sorted) {
        drawPlanet(p, t);
        // Advance
        p.orbitAngle += p.speed;
        if (p.hasMoon) p.moonAngle += p.moonSpeed;
      }

      animId = requestAnimationFrame(tick);
      rafRef.current = animId;
    }

    animId = requestAnimationFrame(tick);
    rafRef.current = animId;
    return () => cancelAnimationFrame(animId);
  }, [isVisible]);

  return (
    <div
      style={{
        width: W, height: H,
        background: "#000005",
        position: "relative",
        overflow: "hidden",
        userSelect: "none",
        fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
      }}
    >
      <canvas ref={canvasRef} width={W} height={H} style={{ position: "absolute", inset: 0 }} />

      {/* UI overlay */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {/* Navbar */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          height: 64,
          borderBottom: "1px solid rgba(160,176,200,0.2)",
          display: "flex", alignItems: "stretch",
        }}>
          {/* Left links */}
          <div style={{
            display: "flex", alignItems: "center",
            paddingLeft: 40, gap: 0,
            borderRight: "1px solid rgba(160,176,200,0.18)",
          }}>
            {["Programs", "Systems", "Discover"].map((label, i) => (
              <div key={label} style={{ display: "flex", alignItems: "center" }}>
                {i > 0 && <div style={{ width: 1, height: 32, background: "rgba(160,176,200,0.18)", margin: "0 4px" }} />}
                <span style={{
                  color: "rgba(255,255,255,0.65)",
                  fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
                  padding: "0 16px",
                }}>{label}</span>
              </div>
            ))}
          </div>
          {/* Logo center */}
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 4,
            borderRight: "1px solid rgba(160,176,200,0.18)",
          }}>
            <span style={{
              color: "#FFFFFF",
              fontSize: 22, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase",
            }}>NOVA</span>
            <div style={{ display: "flex", gap: 12, width: "80%" }}>
              <div style={{ flex: 1, height: 1, background: "rgba(160,176,200,0.2)" }} />
              <div style={{ flex: 1, height: 1, background: "rgba(160,176,200,0.2)" }} />
            </div>
          </div>
          {/* Right */}
          <div style={{
            display: "flex", alignItems: "center",
            paddingRight: 40, gap: 16,
          }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}>Search</span>
            <div style={{ width: 1, height: 28, margin: "0 8px", background: "rgba(160,176,200,0.18)" }} />
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="4.5" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2"/>
              <line x1="9.5" y1="9.5" x2="14" y2="14" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2"/>
            </svg>
            <div style={{ width: 1, height: 28, margin: "0 8px", background: "rgba(160,176,200,0.18)" }} />
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
              <line x1="0" y1="2" x2="18" y2="2" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4"/>
              <line x1="0" y1="7" x2="18" y2="7" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4"/>
              <line x1="0" y1="12" x2="18" y2="12" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4"/>
            </svg>
          </div>
        </div>

        {/* Hero text — bottom left */}
        <div style={{ position: "absolute", left: 48, bottom: 120 }}>
          <h1 style={{
            margin: 0, color: "#FFFFFF",
            fontSize: 140,
            fontWeight: 900,
            lineHeight: 0.84,
            letterSpacing: "-0.03em",
            textTransform: "uppercase",
          }}>
            ROCKETS
          </h1>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
            <div style={{ maxWidth: 440, textAlign: "right" }}>
              <p style={{
                color: "rgba(255,255,255,0.72)",
                fontSize: 14, lineHeight: 1.6, margin: "0 0 20px",
              }}>
                From precise orbital insertions to deep-space trajectories, NOVA&apos;s launch systems deliver unmatched performance and dependability.
              </p>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 0,
                background: "#FFFFFF", color: "#000000",
                fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
                textTransform: "uppercase", cursor: "pointer",
              }}>
                <span style={{ padding: "12px 20px" }}>View Our Fleet</span>
                <div style={{
                  width: 40, height: 40,
                  background: "#000000",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 11L11 3M11 3H5M11 3V9" stroke="#FFFFFF" strokeWidth="1.5"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom section label */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          borderTop: "1px solid rgba(160,176,200,0.15)",
          display: "flex", padding: "14px 48px",
          justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" }}>Nova Space Systems</span>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" }}>Aerospace Engineering Division</span>
        </div>
      </div>
    </div>
  );
}
