"use client";

// WeblexDarkHero: irregular rock-shaped particles fly toward the viewport in
// perspective projection — continuous loop. Web3 dark aesthetic.
// Palette: #030408 / #0D1B2A / #4A9FFF / #E8EDF2
// Pure canvas + rAF. No external dependencies.

import { useEffect, useRef } from "react";

const W = 1440;
const H = 900;
const CX = W / 2;
const CY = H / 2;
const N = 70;
const FOV = 520;
const Z_MIN = 120;
const Z_MAX = 2200;
const SPEED = 5.5;

interface Rock {
  x: number;
  y: number;
  z: number;
  baseR: number;
  verts: Array<[number, number]>;
  rot: number;
  rotSpd: number;
  shade: [number, number, number];
}

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return ((s >>> 0) / 0xffffffff);
  };
}

function spawnRock(rng: () => number, z?: number): Rock {
  const zv = z ?? rng() * (Z_MAX - Z_MIN) + Z_MIN;
  const n = Math.floor(rng() * 5) + 7;
  const verts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.4;
    const r = rng() * 0.55 + 0.55;
    verts.push([angle, r]);
  }
  const b = 0.38 + rng() * 0.5;
  const blue = rng();
  return {
    x: (rng() - 0.5) * W * 2.8 + CX,
    y: (rng() - 0.5) * H * 2.8 + CY,
    z: zv,
    baseR: rng() * 16 + 7,
    verts,
    rot: rng() * Math.PI * 2,
    rotSpd: (rng() - 0.5) * 0.018,
    shade: [
      Math.round(b * (72 + blue * 28)),
      Math.round(b * (80 + blue * 22)),
      Math.round(b * (108 + blue * 64)),
    ],
  };
}

export default function WeblexDarkHero({ isVisible }: { isVisible: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number | null>(null);
  const rocksRef  = useRef<Rock[]>([]);

  useEffect(() => {
    const rng = seededRand(0xd3adb33f);
    rocksRef.current = Array.from({ length: N }, () => spawnRock(rng));
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
      ctx.fillStyle = "#030408";
      ctx.fillRect(0, 0, W, H);
      const rng2 = seededRand(0xd3adb33f);
      for (let i = 0; i < 18; i++) {
        const r = spawnRock(rng2);
        const sc = FOV / r.z;
        const sx = (r.x - CX) * sc + CX;
        const sy = (r.y - CY) * sc + CY;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(r.rot);
        ctx.beginPath();
        r.verts.forEach(([a, fr], i2) => {
          const px = Math.cos(a) * fr * r.baseR * sc * 3;
          const py = Math.sin(a) * fr * r.baseR * sc * 3;
          if (i2 === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.fillStyle = `rgb(${r.shade[0]},${r.shade[1]},${r.shade[2]})`;
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.restore();
      }
      return;
    }

    let animId = 0;

    function drawGrid() {
      if (!ctx) return;
      ctx.strokeStyle = "rgba(74,159,255,0.045)";
      ctx.lineWidth = 1;
      const gs = 90;
      for (let gx = 0; gx <= W; gx += gs) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
      }
      for (let gy = 0; gy <= H; gy += gs) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }
    }

    const rng2 = seededRand(0xd3adb33f);
    function tick() {
      if (!cv || !ctx) return;

      ctx.fillStyle = "#030408";
      ctx.fillRect(0, 0, W, H);

      drawGrid();

      const gr = ctx.createRadialGradient(CX, CY + 80, 0, CX, CY + 80, 500);
      gr.addColorStop(0, "rgba(20,60,160,0.14)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);

      const sorted = [...rocksRef.current].sort((a, b) => b.z - a.z);

      for (const rock of sorted) {
        const sc = FOV / rock.z;
        const sx = (rock.x - CX) * sc + CX;
        const sy = (rock.y - CY) * sc + CY;
        const size = rock.baseR * sc * 3;

        if (sx < -250 || sx > W + 250 || sy < -250 || sy > H + 250 || size < 0.4) {
          rock.z -= SPEED;
          if (rock.z < Z_MIN) {
            const fresh = spawnRock(rng2, Z_MAX);
            Object.assign(rock, fresh);
          }
          continue;
        }

        const depthAlpha = Math.min(1, (Z_MAX - rock.z) / (Z_MAX - Z_MIN * 3));

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(rock.rot);
        ctx.globalAlpha = Math.max(0, depthAlpha);

        ctx.beginPath();
        rock.verts.forEach(([a, fr], i2) => {
          const px = Math.cos(a) * fr * size;
          const py = Math.sin(a) * fr * size;
          if (i2 === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.closePath();

        // Lit face
        const fill = ctx.createRadialGradient(-size * 0.3, -size * 0.3, 0, 0, 0, size * 1.2);
        fill.addColorStop(0, `rgba(${rock.shade[0] + 55},${rock.shade[1] + 50},${rock.shade[2] + 70},1)`);
        fill.addColorStop(1, `rgba(${rock.shade[0]},${rock.shade[1]},${rock.shade[2]},1)`);
        ctx.fillStyle = fill;
        ctx.fill();

        ctx.strokeStyle = `rgba(${rock.shade[0] + 80},${rock.shade[1] + 70},${rock.shade[2] + 90},0.55)`;
        ctx.lineWidth = 0.6;
        ctx.stroke();
        ctx.restore();

        rock.z -= SPEED;
        rock.rot += rock.rotSpd;

        if (rock.z < Z_MIN) {
          const fresh = spawnRock(rng2, Z_MAX);
          Object.assign(rock, fresh);
        }
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
      <div aria-hidden style={{
        position: "absolute", left: 0, right: 0, height: 1,
        background: "linear-gradient(to right, transparent 0%, rgba(74,159,255,0.35) 30%, rgba(74,159,255,0.6) 50%, rgba(74,159,255,0.35) 70%, transparent 100%)",
        animation: "wbx-scan 6s linear infinite",
        pointerEvents: "none",
      }} />

      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {/* Top bar */}
        <div style={{
          position: "absolute", top: 44, left: 64, right: 64,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 0,
              background: "linear-gradient(135deg, #4A9FFF 0%, #1A4DB8 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <polygon points="7,1 13,4 13,10 7,13 1,10 1,4" stroke="#E8EDF2" strokeWidth="1.2" fill="none"/>
                <polygon points="7,4 10,5.5 10,8.5 7,10 4,8.5 4,5.5" fill="#E8EDF2"/>
              </svg>
            </div>
            <span style={{ color: "#E8EDF2", fontSize: 13, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase" }}>WEBLEX</span>
          </div>
          <div style={{ display: "flex", gap: 36 }}>
            {["Protocol", "Network", "Build", "Docs"].map(t => (
              <span key={t} style={{ color: "rgba(232,237,242,0.45)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}>{t}</span>
            ))}
          </div>
          <div style={{
            border: "1px solid rgba(74,159,255,0.6)",
            color: "#4A9FFF",
            fontSize: 11, fontWeight: 600, letterSpacing: "0.14em",
            textTransform: "uppercase", padding: "8px 20px",
          }}>
            Launch App
          </div>
        </div>

        {/* Main content */}
        <div style={{ position: "absolute", bottom: 148, left: 64, right: 64 }}>
          <div style={{
            fontSize: 11, letterSpacing: "0.32em", textTransform: "uppercase",
            color: "rgba(74,159,255,0.75)", marginBottom: 20,
            animation: "wbx-pulse 3s ease-in-out infinite",
          }}>
            ◆ Next-Generation Decentralized Infrastructure
          </div>
          <h1 style={{
            margin: 0,
            fontSize: 102,
            fontWeight: 800,
            color: "#E8EDF2",
            lineHeight: 0.88,
            letterSpacing: "-0.025em",
            textTransform: "uppercase",
          }}>
            Build On<br />
            <span style={{ color: "#4A9FFF" }}>Nothing</span><br />
            But Truth.
          </h1>
          <div style={{ marginTop: 36, display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{
              background: "#4A9FFF", color: "#030408",
              fontSize: 11, fontWeight: 800, letterSpacing: "0.18em",
              textTransform: "uppercase", padding: "14px 32px",
            }}>
              Start Building
            </div>
            <div style={{
              border: "1px solid rgba(232,237,242,0.2)",
              color: "rgba(232,237,242,0.6)",
              fontSize: 11, fontWeight: 600, letterSpacing: "0.14em",
              textTransform: "uppercase", padding: "14px 28px",
            }}>
              Read Docs
            </div>
          </div>
        </div>

        {/* Bottom stats bar */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          borderTop: "1px solid rgba(74,159,255,0.1)",
          background: "rgba(3,4,8,0.8)",
          display: "flex", alignItems: "center",
          padding: "18px 64px",
          gap: 60,
        }}>
          {[["$2.4B", "Total Value Locked"], ["99.97%", "Network Uptime"], ["1.2M+", "Active Wallets"], ["<0.001s", "Finality"]].map(([v, l]) => (
            <div key={l} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ color: "#4A9FFF", fontSize: 20, fontWeight: 700 }}>{v}</span>
              <span style={{ color: "rgba(232,237,242,0.35)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase" }}>{l}</span>
            </div>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#4A9FFF", animation: "wbx-pulse 2s ease-in-out infinite" }} />
            <span style={{ color: "rgba(74,159,255,0.8)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase" }}>Mainnet Live</span>
          </div>
        </div>
      </div>
    </div>
  );
}
