"use client";

// WeblexDarkHero: ONE massive asteroid filling ~60% of frame in perspective,
// slow tumble + glow corona, debris field of 18 small chunks.
// Palette: #030408 / #0D1B2A / #4A9FFF / #E8EDF2
// Pure canvas + rAF. No external dependencies.

import { useEffect, useRef } from "react";

const W = 1440;
const H = 900;
const TAU = Math.PI * 2;

interface Debris {
  x: number;
  y: number;
  r: number;
  verts: Array<[number, number]>;
  rot: number;
  rotSpd: number;
  alpha: number;
}

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function makeVerts(rng: () => number, n: number): Array<[number, number]> {
  return Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * TAU + (rng() - 0.5) * 0.6;
    const r = 0.68 + rng() * 0.38;
    return [angle, r] as [number, number];
  });
}

function drawRock(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  verts: Array<[number, number]>,
  rot: number,
  alpha: number,
  lit: boolean,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha;

  ctx.beginPath();
  verts.forEach(([a, fr], i) => {
    const px = Math.cos(a) * fr * radius;
    const py = Math.sin(a) * fr * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();

  if (lit) {
    // Hero asteroid: radial gradient with dramatic lit face
    const fill = ctx.createRadialGradient(-radius * 0.28, -radius * 0.22, 0, 0, 0, radius * 1.1);
    fill.addColorStop(0, "rgba(110,130,165,1)");
    fill.addColorStop(0.25, "rgba(72,88,115,1)");
    fill.addColorStop(0.6, "rgba(40,52,72,1)");
    fill.addColorStop(1, "rgba(15,20,32,1)");
    ctx.fillStyle = fill;
    ctx.fill();

    // Surface crack lines
    ctx.strokeStyle = "rgba(30,42,60,0.7)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Secondary cracks
    const crackSegs = 6;
    ctx.strokeStyle = "rgba(20,32,52,0.5)";
    ctx.lineWidth = 1;
    for (let i = 0; i < crackSegs; i++) {
      const a0 = (i / crackSegs) * TAU + 0.3;
      const frac = 0.35 + (i % 2) * 0.25;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a0) * radius * frac, Math.sin(a0) * radius * frac);
      ctx.lineTo(
        Math.cos(a0 + 0.8) * radius * (frac + 0.18),
        Math.sin(a0 + 0.8) * radius * (frac + 0.18),
      );
      ctx.stroke();
    }
  } else {
    // Debris chunks
    const fill = ctx.createRadialGradient(-radius * 0.2, -radius * 0.2, 0, 0, 0, radius);
    fill.addColorStop(0, "rgba(90,108,140,1)");
    fill.addColorStop(1, "rgba(25,35,55,1)");
    ctx.fillStyle = fill;
    ctx.fill();
  }

  ctx.restore();
}

export default function WeblexDarkHero({ isVisible }: { isVisible: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef<{
    asteroidVerts: Array<[number, number]>;
    debris: Debris[];
    rot: number;
  } | null>(null);

  useEffect(() => {
    const rng = seededRand(0xd3adb33f);
    const asteroidVerts = makeVerts(rng, 18);
    const debris: Debris[] = Array.from({ length: 18 }, () => ({
      x: rng() * W,
      y: rng() * H,
      r: 6 + rng() * 22,
      verts: makeVerts(rng, 7 + Math.floor(rng() * 4)),
      rot: rng() * TAU,
      rotSpd: (rng() - 0.5) * 0.012,
      alpha: 0.25 + rng() * 0.55,
    }));
    stateRef.current = { asteroidVerts, debris, rot: 0 };
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

    const st = stateRef.current;
    if (!st) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ctx.fillStyle = "#030408";
      ctx.fillRect(0, 0, W, H);
      drawRock(ctx, W * 0.64, H * 0.46, 300, st.asteroidVerts, 0.15, 1, true);
      return;
    }

    let animId = 0;
    let lastTs = 0;

    function tick(ts: number) {
      if (!ctx || !st) return;
      const dt = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;

      // Background
      ctx.fillStyle = "#030408";
      ctx.fillRect(0, 0, W, H);

      // Deep-space star field (static dots, drawn every frame from seed)
      const starRng = seededRand(0xabcdef12);
      ctx.fillStyle = "rgba(180,200,240,0.55)";
      for (let i = 0; i < 280; i++) {
        const sx = starRng() * W;
        const sy = starRng() * H;
        const sr = starRng() * 1.2;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, TAU);
        ctx.fill();
      }

      // Faint grid
      ctx.strokeStyle = "rgba(74,159,255,0.03)";
      ctx.lineWidth = 1;
      for (let gx = 0; gx <= W; gx += 90) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
      }
      for (let gy = 0; gy <= H; gy += 90) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }

      // Asteroid corona glow
      const ax = W * 0.62, ay = H * 0.44;
      const corona = ctx.createRadialGradient(ax, ay, 200, ax, ay, 560);
      corona.addColorStop(0, "rgba(40,80,160,0.14)");
      corona.addColorStop(0.5, "rgba(20,50,120,0.06)");
      corona.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = corona;
      ctx.fillRect(0, 0, W, H);

      // Debris field (behind asteroid)
      for (const d of st.debris) {
        drawRock(ctx, d.x, d.y, d.r, d.verts, d.rot, d.alpha, false);
        d.rot += d.rotSpd;
      }

      // Hero asteroid: slow tumble, large
      st.rot += dt * 0.04;
      drawRock(ctx, ax, ay, 310, st.asteroidVerts, st.rot, 1, true);

      // Edge highlight on lit side
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(st.rot);
      ctx.beginPath();
      st.asteroidVerts.forEach(([a, fr], i) => {
        const px = Math.cos(a) * fr * 310;
        const py = Math.sin(a) * fr * 310;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.strokeStyle = "rgba(130,160,220,0.22)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

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
        width: W,
        height: H,
        background: "#030408",
        position: "relative",
        overflow: "hidden",
        userSelect: "none",
        fontFamily: "'Space Mono', 'Courier New', monospace",
      }}
    >
      <style>{`
        @keyframes wbx-pulse { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes wbx-scan  { 0%{transform:translateY(-100%)} 100%{transform:translateY(900px)} }
      `}</style>

      <canvas ref={canvasRef} width={W} height={H} style={{ position: "absolute", inset: 0 }} />

      {/* Scan line */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: 1,
          background:
            "linear-gradient(to right, transparent 0%, rgba(74,159,255,0.35) 30%, rgba(74,159,255,0.6) 50%, rgba(74,159,255,0.35) 70%, transparent 100%)",
          animation: "wbx-scan 6s linear infinite",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {/* Top bar */}
        <div
          style={{
            position: "absolute",
            top: 44,
            left: 64,
            right: 64,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 28,
                height: 28,
                background: "linear-gradient(135deg, #4A9FFF 0%, #1A4DB8 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <polygon points="7,1 13,4 13,10 7,13 1,10 1,4" stroke="#E8EDF2" strokeWidth="1.2" fill="none" />
                <polygon points="7,4 10,5.5 10,8.5 7,10 4,8.5 4,5.5" fill="#E8EDF2" />
              </svg>
            </div>
            <span
              style={{
                color: "#E8EDF2",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
              }}
            >
              WEBLEX
            </span>
          </div>
          <div style={{ display: "flex", gap: 36 }}>
            {["Protocol", "Network", "Build", "Docs"].map((t) => (
              <span
                key={t}
                style={{
                  color: "rgba(232,237,242,0.45)",
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                {t}
              </span>
            ))}
          </div>
          <div
            style={{
              border: "1px solid rgba(74,159,255,0.6)",
              color: "#4A9FFF",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              padding: "8px 20px",
            }}
          >
            Launch App
          </div>
        </div>

        {/* Main content */}
        <div style={{ position: "absolute", bottom: 148, left: 64, right: 64 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: "rgba(74,159,255,0.75)",
              marginBottom: 20,
              animation: "wbx-pulse 3s ease-in-out infinite",
            }}
          >
            ◆ Next-Generation Decentralized Infrastructure
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 102,
              fontWeight: 800,
              color: "#E8EDF2",
              lineHeight: 0.88,
              letterSpacing: "-0.025em",
              textTransform: "uppercase",
            }}
          >
            Build On
            <br />
            <span style={{ color: "#4A9FFF" }}>Nothing</span>
            <br />
            But Truth.
          </h1>
          <div style={{ marginTop: 36, display: "flex", gap: 14, alignItems: "center" }}>
            <div
              style={{
                background: "#4A9FFF",
                color: "#030408",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                padding: "14px 32px",
              }}
            >
              Start Building
            </div>
            <div
              style={{
                border: "1px solid rgba(232,237,242,0.2)",
                color: "rgba(232,237,242,0.6)",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                padding: "14px 28px",
              }}
            >
              Read Docs
            </div>
          </div>
        </div>

        {/* Bottom stats bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            borderTop: "1px solid rgba(74,159,255,0.1)",
            background: "rgba(3,4,8,0.8)",
            display: "flex",
            alignItems: "center",
            padding: "18px 64px",
            gap: 60,
          }}
        >
          {[
            ["$2.4B", "Total Value Locked"],
            ["99.97%", "Network Uptime"],
            ["1.2M+", "Active Wallets"],
            ["<0.001s", "Finality"],
          ].map(([v, l]) => (
            <div key={l} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ color: "#4A9FFF", fontSize: 20, fontWeight: 700 }}>{v}</span>
              <span
                style={{
                  color: "rgba(232,237,242,0.35)",
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                }}
              >
                {l}
              </span>
            </div>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#4A9FFF",
                animation: "wbx-pulse 2s ease-in-out infinite",
              }}
            />
            <span
              style={{
                color: "rgba(74,159,255,0.8)",
                fontSize: 10,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}
            >
              Mainnet Live
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
