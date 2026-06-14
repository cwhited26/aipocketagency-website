"use client";

// AutomationMachines: interlocking gears + multi-segment robotic arm sequence.
// 3 gears rotate at accurate gear-ratio speeds. Arm cycles pick→extend→grip→retract.
// No Spline, no three.js — pure canvas rAF.
// Palette: #0A0A0A / #F5F5F0 / #F27D26 (brand orange) / #1F1F1F / #2A2A2A

import { useEffect, useRef } from "react";

const W = 1440;
const H = 900;

// Gear definitions
const GEARS = [
  { cx: 660, cy: 540, r: 130, teeth: 24, rot: 0,  speed:  1,   color: "#1F1F1F", bcolor: "#F27D26" },
  { cx: 905, cy: 480, r: 88,  teeth: 16, rot: 0,  speed: -1.5, color: "#1A1A1A", bcolor: "#F5F5F0" },
  { cx: 1040, cy: 360, r: 58,  teeth: 10, rot: 0,  speed:  2.28, color: "#1F1F1F", bcolor: "#F27D26" },
] as const;

// Arm segment positions (relative to base)
const ARM_BASE = { x: 280, y: 620 };
const ARM_CYCLE = 5.5; // seconds per full cycle

function drawGear(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  teeth: number, rot: number,
  bodyColor: string, boltColor: string,
) {
  const toothH   = r * 0.18;
  const toothW   = (Math.PI * 2 * r) / (teeth * 2.8);
  const innerR   = r - toothH * 0.6;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);

  // Gear body
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const baseAngle  = (i / teeth) * Math.PI * 2;
    const nextAngle  = ((i + 1) / teeth) * Math.PI * 2;
    const midAngle   = (baseAngle + nextAngle) / 2;
    const halfTooth  = toothW / r;

    ctx.arc(0, 0, innerR, baseAngle, midAngle - halfTooth);
    ctx.arc(0, 0, r + toothH * 0.6, midAngle - halfTooth * 0.5, midAngle + halfTooth * 0.5);
    ctx.arc(0, 0, innerR, midAngle + halfTooth, nextAngle);
  }
  ctx.closePath();
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.strokeStyle = "rgba(80,80,80,0.6)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Hub
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = "#0A0A0A";
  ctx.fill();
  ctx.strokeStyle = boltColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Spokes
  const spokeCount = 5;
  for (let i = 0; i < spokeCount; i++) {
    const a = (i / spokeCount) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.24, Math.sin(a) * r * 0.24);
    ctx.lineTo(Math.cos(a) * innerR * 0.8, Math.sin(a) * innerR * 0.8);
    ctx.strokeStyle = `rgba(80,80,80,0.7)`;
    ctx.lineWidth = r * 0.065;
    ctx.stroke();
  }

  // Bolt holes
  for (let i = 0; i < spokeCount; i++) {
    const a = (i / spokeCount) * Math.PI * 2;
    const bx = Math.cos(a) * innerR * 0.56;
    const by = Math.sin(a) * innerR * 0.56;
    ctx.beginPath();
    ctx.arc(bx, by, r * 0.055, 0, Math.PI * 2);
    ctx.fillStyle = "#0A0A0A";
    ctx.fill();
    ctx.strokeStyle = boltColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Center bolt
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2);
  ctx.fillStyle = boltColor;
  ctx.fill();

  ctx.restore();
}

// Easing
function easeInOut(t: number): number { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
function clamp01(t: number): number { return Math.max(0, Math.min(1, t)); }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

function drawRoboticArm(ctx: CanvasRenderingContext2D, phase: number) {
  // Phase 0-1 cycles: 0-0.2 extend, 0.2-0.4 grip, 0.4-0.6 retract, 0.6-1.0 hold/reposition
  const t = phase % 1;

  // Compute joint angles based on phase
  let shoulder = 0, elbow = 0, wrist = 0, gripOpen = 1;

  if (t < 0.2) {
    // Extend: arm reaches forward and down
    const p = easeInOut(clamp01(t / 0.2));
    shoulder = lerp(-0.3, -0.7, p);
    elbow    = lerp(-0.2, 0.5, p);
    wrist    = lerp(0.1, -0.2, p);
    gripOpen = 1;
  } else if (t < 0.35) {
    // Grip close
    const p = easeInOut(clamp01((t - 0.2) / 0.15));
    shoulder = -0.7;
    elbow    = 0.5;
    wrist    = -0.2;
    gripOpen = lerp(1, 0.1, p);
  } else if (t < 0.55) {
    // Retract with payload
    const p = easeInOut(clamp01((t - 0.35) / 0.2));
    shoulder = lerp(-0.7, -0.2, p);
    elbow    = lerp(0.5, -0.3, p);
    wrist    = lerp(-0.2, 0.3, p);
    gripOpen = 0.1;
  } else if (t < 0.7) {
    // Release
    const p = easeInOut(clamp01((t - 0.55) / 0.15));
    shoulder = -0.2;
    elbow    = -0.3;
    wrist    = 0.3;
    gripOpen = lerp(0.1, 1, p);
  } else {
    // Return to rest
    const p = easeInOut(clamp01((t - 0.7) / 0.3));
    shoulder = lerp(-0.2, -0.3, p);
    elbow    = lerp(-0.3, -0.2, p);
    wrist    = lerp(0.3, 0.1, p);
    gripOpen = 1;
  }

  const base = ARM_BASE;
  const seg1Len = 140, seg2Len = 110, seg3Len = 80;

  // Base mount
  ctx.save();
  ctx.translate(base.x, base.y);

  // Base plate
  ctx.beginPath();
  ctx.rect(-40, 0, 80, 18);
  ctx.fillStyle = "#1F1F1F";
  ctx.fill();
  ctx.strokeStyle = "#F27D26";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Base rotation column
  ctx.beginPath();
  ctx.rect(-12, -40, 24, 42);
  ctx.fillStyle = "#252525";
  ctx.fill();
  ctx.strokeStyle = "rgba(80,80,80,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Segment 1 (shoulder)
  ctx.rotate(shoulder);
  const j1x = 0, j1y = -40;
  ctx.beginPath();
  ctx.moveTo(j1x, j1y);
  ctx.lineTo(j1x, j1y - seg1Len);
  ctx.strokeStyle = "#F5F5F0";
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.strokeStyle = "#F27D26";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Elbow joint circle
  ctx.translate(j1x, j1y - seg1Len);
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fillStyle = "#1A1A1A";
  ctx.fill();
  ctx.strokeStyle = "#F27D26";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Segment 2 (elbow)
  ctx.rotate(elbow);
  const j2y = -seg2Len;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, j2y);
  ctx.strokeStyle = "#F5F5F0";
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.strokeStyle = "rgba(80,80,80,0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Wrist joint
  ctx.translate(0, j2y);
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fillStyle = "#1A1A1A";
  ctx.fill();
  ctx.strokeStyle = "#F5F5F0";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Segment 3 (wrist)
  ctx.rotate(wrist);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -seg3Len);
  ctx.strokeStyle = "#F5F5F0";
  ctx.lineWidth = 7;
  ctx.stroke();

  // End effector / gripper
  ctx.translate(0, -seg3Len);
  const gOpen = gripOpen * 24;

  // Left finger
  ctx.save();
  ctx.rotate(-0.15);
  ctx.beginPath();
  ctx.moveTo(-gOpen * 0.12, 0);
  ctx.lineTo(-gOpen * 0.3 - 2, -32);
  ctx.strokeStyle = "#F27D26";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();

  // Right finger
  ctx.save();
  ctx.rotate(0.15);
  ctx.beginPath();
  ctx.moveTo(gOpen * 0.12, 0);
  ctx.lineTo(gOpen * 0.3 + 2, -32);
  ctx.strokeStyle = "#F27D26";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();

  // Tool tip glow if gripping
  if (gripOpen < 0.4) {
    const glowR = 12 * (1 - gripOpen);
    const g = ctx.createRadialGradient(0, -16, 0, 0, -16, glowR * 3);
    g.addColorStop(0, `rgba(242,125,38,${(1 - gripOpen) * 0.5})`);
    g.addColorStop(1, "rgba(242,125,38,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-glowR * 3, -16 - glowR * 3, glowR * 6, glowR * 6);
  }

  ctx.restore();
}

function drawArmBase(ctx: CanvasRenderingContext2D) {
  // Base track / rail
  ctx.save();
  ctx.beginPath();
  ctx.rect(ARM_BASE.x - 100, ARM_BASE.y + 18, 200, 6);
  ctx.fillStyle = "#252525";
  ctx.fill();
  ctx.strokeStyle = "#F27D26";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

export default function AutomationMachines({ isVisible }: { isVisible: boolean }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef<number | null>(null);
  const startRef   = useRef<number | null>(null);
  const gearRots   = useRef([0, 0, 0]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    if (!isVisible) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      startRef.current = null;
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ctx.fillStyle = "#0A0A0A";
      ctx.fillRect(0, 0, W, H);
      gearRots.current = [0, 0.4, -0.9];
      GEARS.forEach((g, i) => drawGear(ctx, g.cx, g.cy, g.r, g.teeth, gearRots.current[i], g.color, g.bcolor));
      drawArmBase(ctx);
      drawRoboticArm(ctx, 0.1);
      return;
    }

    let animId = 0;

    function tick(now: number) {
      if (!cv || !ctx) return;
      if (startRef.current === null) startRef.current = now;
      const elapsed = (now - startRef.current) * 0.001;
      const baseSpeed = 0.55;

      ctx.fillStyle = "#0A0A0A";
      ctx.fillRect(0, 0, W, H);

      // Circuit board background grid
      ctx.strokeStyle = "rgba(242,125,38,0.035)";
      ctx.lineWidth = 1;
      const gs = 60;
      for (let x = 0; x < W; x += gs) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += gs) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // Subtle orange vignette glow at gear center
      const vg = ctx.createRadialGradient(820, 500, 0, 820, 500, 600);
      vg.addColorStop(0, "rgba(242,125,38,0.06)");
      vg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      // Update gear rotations (gear-ratio accurate)
      GEARS.forEach((g, i) => {
        gearRots.current[i] = elapsed * baseSpeed * g.speed;
      });

      // Draw gears
      GEARS.forEach((g, i) => {
        drawGear(ctx, g.cx, g.cy, g.r, g.teeth, gearRots.current[i], g.color, g.bcolor);
      });

      // Arm
      drawArmBase(ctx);
      const armPhase = (elapsed % ARM_CYCLE) / ARM_CYCLE;
      drawRoboticArm(ctx, armPhase);

      // Data readouts
      const readouts = [
        { label: "GEAR RPM", val: (baseSpeed * 60 / (Math.PI * 2) * GEARS[0].speed).toFixed(1) + " RPM" },
        { label: "TORQUE", val: "14.2 Nm" },
        { label: "ARM CYCLE", val: `${(armPhase * 100).toFixed(0)}%` },
        { label: "STATUS", val: "ACTIVE" },
      ];

      ctx.font = "11px 'Courier New', monospace";
      readouts.forEach((r, i) => {
        const rx = 48, ry = 650 + i * 36;
        ctx.fillStyle = "rgba(242,125,38,0.5)";
        ctx.fillText(r.label, rx, ry);
        ctx.fillStyle = "#F5F5F0";
        ctx.fillText(r.val, rx + 110, ry);
      });

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
        background: "#0A0A0A",
        position: "relative",
        overflow: "hidden",
        userSelect: "none",
        fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
      }}
    >
      <style>{`
        @keyframes am-blink { 0%,100%{opacity:1} 49%{opacity:1} 50%,94%{opacity:0} 95%,100%{opacity:1} }
        @keyframes am-scan  { 0%{transform:translateY(-100%)} 100%{transform:translateY(900px)} }
      `}</style>

      <canvas ref={canvasRef} width={W} height={H} style={{ position: "absolute", inset: 0 }} />

      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {/* Scanline effect */}
        <div aria-hidden style={{
          position: "absolute", left: 0, right: 0, height: 2,
          background: "rgba(242,125,38,0.08)",
          animation: "am-scan 3s linear infinite",
        }} />

        {/* Top UI bar */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "22px 48px",
          borderBottom: "1px solid rgba(242,125,38,0.12)",
          background: "rgba(10,10,10,0.85)",
        }}>
          <div>
            <div style={{
              color: "#F5F5F0",
              fontSize: 16, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase",
            }}>
              AUTOMATION<span style={{ color: "#F27D26" }}>.</span>MACHINES
            </div>
            <div style={{ color: "rgba(242,125,38,0.55)", fontSize: 9, letterSpacing: "0.26em", textTransform: "uppercase", marginTop: 2 }}>
              Industrial Robotics Platform
            </div>
          </div>
          <div style={{ display: "flex", gap: 36 }}>
            {["Systems", "Robotics", "AI Control", "Deploy"].map(t => (
              <span key={t} style={{ color: "rgba(245,245,240,0.38)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}>{t}</span>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%", background: "#F27D26",
              animation: "am-blink 2.5s ease-in-out infinite",
            }} />
            <span style={{ color: "#F27D26", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase" }}>Live</span>
          </div>
        </div>

        {/* Main hero copy — top right */}
        <div style={{ position: "absolute", top: 100, right: 48, textAlign: "right", maxWidth: 360 }}>
          <h1 style={{
            margin: 0,
            color: "#F5F5F0",
            fontSize: 58, fontWeight: 800,
            letterSpacing: "-0.025em", lineHeight: 0.9,
            textTransform: "uppercase",
          }}>
            Machines<br />
            That<br />
            <span style={{ color: "#F27D26" }}>Think.</span>
          </h1>
          <p style={{
            marginTop: 20, color: "rgba(245,245,240,0.45)",
            fontSize: 13, lineHeight: 1.65,
          }}>
            Industrial automation at scale. Precision robotics engineered for the factory floor of tomorrow.
          </p>
          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <div style={{
              background: "#F27D26", color: "#0A0A0A",
              fontSize: 10, fontWeight: 800, letterSpacing: "0.2em",
              textTransform: "uppercase", padding: "13px 28px",
            }}>
              Request Demo
            </div>
          </div>
        </div>

        {/* Tech specs strip */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          borderTop: "1px solid rgba(242,125,38,0.12)",
          background: "rgba(10,10,10,0.9)",
          display: "flex", gap: 0,
          fontFamily: "'Courier New', monospace",
        }}>
          {[
            ["CYCLE TIME", "0.8s"],
            ["PRECISION", "±0.01mm"],
            ["PAYLOAD", "200kg"],
            ["EFFICIENCY", "99.7%"],
            ["UPTIME", "24/7"],
          ].map(([l, v], i) => (
            <div key={l} style={{
              flex: 1, padding: "16px 20px",
              borderLeft: i > 0 ? "1px solid rgba(242,125,38,0.12)" : "none",
            }}>
              <div style={{ color: "rgba(242,125,38,0.55)", fontSize: 8, letterSpacing: "0.24em", textTransform: "uppercase" }}>{l}</div>
              <div style={{ color: "#F5F5F0", fontSize: 16, fontWeight: 700, marginTop: 3 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
