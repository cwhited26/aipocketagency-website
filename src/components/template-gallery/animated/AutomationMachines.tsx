"use client";

// AutomationMachines: interlocking gears with realistic ratio transmission + robotic arm assembly.
// Canvas + rAF. Palette: #0A0F1A (dark steel) / #1E2D40 / #F0A500 (amber) / #3A8EBA (steel blue)
// No three.js, no external dependencies.

import { useEffect, useRef } from "react";

const W = 1440;
const H = 900;
const TAU = Math.PI * 2;

interface Gear {
  x: number;
  y: number;
  r: number;
  teeth: number;
  angle: number;
  speed: number;
  color: string;
  hollow: number;
}

interface ArmJoint {
  x: number;
  y: number;
  length: number;
  angle: number;
  baseAngle: number;
  speed: number;
  phase: number;
}

function drawGear(
  ctx: CanvasRenderingContext2D,
  g: Gear,
  t: number
) {
  const a = g.angle + g.speed * t;
  const toothH = g.r * 0.18;
  const innerR = g.r - toothH;
  const toothW = (TAU / g.teeth) * 0.46;

  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(a);

  // Outer teeth
  ctx.beginPath();
  for (let i = 0; i < g.teeth; i++) {
    const base = (i / g.teeth) * TAU;
    const t0 = base - toothW / 2;
    const t1 = base + toothW / 2;
    ctx.arc(0, 0, innerR, base - (TAU / g.teeth) * 0.5, t0);
    ctx.lineTo(Math.cos(t0) * (innerR + toothH), Math.sin(t0) * (innerR + toothH));
    ctx.lineTo(Math.cos(t1) * (innerR + toothH), Math.sin(t1) * (innerR + toothH));
  }
  ctx.closePath();

  const grad = ctx.createRadialGradient(0, 0, g.hollow, 0, 0, innerR);
  grad.addColorStop(0, g.color + "bb");
  grad.addColorStop(0.6, g.color + "88");
  grad.addColorStop(1, g.color + "55");
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = g.color + "cc";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Spokes
  const spokes = 5;
  ctx.strokeStyle = g.color + "66";
  ctx.lineWidth = 2;
  for (let s = 0; s < spokes; s++) {
    const sa = (s / spokes) * TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(sa) * g.hollow * 1.6, Math.sin(sa) * g.hollow * 1.6);
    ctx.lineTo(Math.cos(sa) * (innerR * 0.82), Math.sin(sa) * (innerR * 0.82));
    ctx.stroke();
  }

  // Hub
  const hub = ctx.createRadialGradient(-g.hollow * 0.2, -g.hollow * 0.2, 0, 0, 0, g.hollow);
  hub.addColorStop(0, "#ffffff22");
  hub.addColorStop(1, g.color + "33");
  ctx.beginPath();
  ctx.arc(0, 0, g.hollow, 0, TAU);
  ctx.fillStyle = hub;
  ctx.fill();
  ctx.strokeStyle = g.color + "88";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}

function drawArm(ctx: CanvasRenderingContext2D, joints: ArmJoint[], t: number) {
  const positions: Array<[number, number]> = [];
  let cx = joints[0].x;
  let cy = joints[0].y;
  positions.push([cx, cy]);

  for (const joint of joints) {
    const a = joint.baseAngle + Math.sin(t * joint.speed + joint.phase) * 0.55;
    cx += Math.cos(a) * joint.length;
    cy += Math.sin(a) * joint.length;
    positions.push([cx, cy]);
  }

  // Arm segments
  for (let i = 0; i < positions.length - 1; i++) {
    const [ax, ay] = positions[i];
    const [bx, by] = positions[i + 1];
    const segW = 18 - i * 3;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineCap = "round";
    ctx.strokeStyle = i === 0 ? "#3A8EBA" : i === 1 ? "#2A6A8A" : "#F0A500";
    ctx.lineWidth = Math.max(6, segW);
    ctx.globalAlpha = 0.85;
    ctx.stroke();

    // Highlight edge
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Joint ball
    const jr = Math.max(5, segW * 0.55);
    const jglow = ctx.createRadialGradient(ax, ay, 0, ax, ay, jr * 2);
    jglow.addColorStop(0, "rgba(240,165,0,0.25)");
    jglow.addColorStop(1, "rgba(240,165,0,0)");
    ctx.beginPath();
    ctx.arc(ax, ay, jr * 2, 0, TAU);
    ctx.fillStyle = jglow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(ax, ay, jr, 0, TAU);
    const jball = ctx.createRadialGradient(ax - jr * 0.3, ay - jr * 0.3, 0, ax, ay, jr);
    jball.addColorStop(0, "#ffffff");
    jball.addColorStop(0.4, "#F0A500");
    jball.addColorStop(1, "#8A5800");
    ctx.fillStyle = jball;
    ctx.fill();
  }

  // End effector (gripper)
  const [ex, ey] = positions[positions.length - 1];
  const gt = Math.sin(t * 1.8) * 0.5 + 0.5;
  const opening = gt * 16;

  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.translate(ex, ey);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(dir * (6 + opening), 16);
    ctx.lineTo(dir * (6 + opening), 28);
    ctx.strokeStyle = "#F0A500";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.9;
    ctx.stroke();
    ctx.restore();
  }

  // Gripper glow
  const eglow = ctx.createRadialGradient(ex, ey, 0, ex, ey, 28);
  eglow.addColorStop(0, "rgba(240,165,0,0.3)");
  eglow.addColorStop(1, "rgba(240,165,0,0)");
  ctx.beginPath();
  ctx.arc(ex, ey, 28, 0, TAU);
  ctx.fillStyle = eglow;
  ctx.fill();
}

export default function AutomationMachines({ isVisible }: { isVisible: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number | null>(null);

  const GEARS: Gear[] = [
    { x: 560, y: 520, r: 110, teeth: 36, angle: 0,           speed:  0.18, color: "#3A8EBA", hollow: 32 },
    { x: 780, y: 470, r:  72, teeth: 24, angle: Math.PI / 4, speed: -0.275, color: "#F0A500", hollow: 22 },
    { x: 930, y: 530, r:  52, teeth: 17, angle: 0,           speed:  0.38, color: "#3A8EBA", hollow: 16 },
    { x: 430, y: 620, r:  65, teeth: 21, angle: 0,           speed: -0.31, color: "#4AAAD0", hollow: 20 },
    { x: 650, y: 655, r:  42, teeth: 14, angle: 0,           speed:  0.48, color: "#F0A500", hollow: 13 },
    { x: 310, y: 500, r:  85, teeth: 28, angle: 0,           speed:  0.24, color: "#2A6890", hollow: 26 },
  ];

  const ARM_JOINTS: ArmJoint[] = [
    { x: 900, y: 180, length: 130, angle: 0, baseAngle: Math.PI / 2 + 0.2,  speed: 0.38, phase: 0 },
    { x: 0,   y: 0,  length: 110, angle: 0, baseAngle: Math.PI / 2 - 0.15, speed: 0.55, phase: 1.1 },
    { x: 0,   y: 0,  length:  80, angle: 0, baseAngle: Math.PI / 2 + 0.3,  speed: 0.72, phase: 2.2 },
  ];

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
      ctx.fillStyle = "#0A0F1A";
      ctx.fillRect(0, 0, W, H);
      for (const g of GEARS) drawGear(ctx, g, 0);
      return;
    }

    let startTime = 0;
    let animId = 0;

    function tick(ts: number) {
      if (!ctx) return;
      if (!startTime) startTime = ts;
      const t = (ts - startTime) / 1000;

      ctx.fillStyle = "rgba(10,15,26,0.32)";
      ctx.fillRect(0, 0, W, H);

      // Grid / floor lines
      ctx.strokeStyle = "rgba(58,142,186,0.05)";
      ctx.lineWidth = 1;
      for (let gx = 0; gx <= W; gx += 72) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
      }
      for (let gy = 0; gy <= H; gy += 72) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }

      // Floor glow
      const floor = ctx.createLinearGradient(0, H - 120, 0, H);
      floor.addColorStop(0, "rgba(58,142,186,0.04)");
      floor.addColorStop(1, "rgba(10,15,26,0.8)");
      ctx.fillStyle = floor;
      ctx.fillRect(0, H - 120, W, 120);

      // Gear connection lines
      const pairs = [[0,1],[1,2],[0,3],[3,4],[0,5]];
      for (const [a, b] of pairs) {
        const ga = GEARS[a], gb = GEARS[b];
        ctx.beginPath();
        ctx.moveTo(ga.x, ga.y);
        ctx.lineTo(gb.x, gb.y);
        ctx.strokeStyle = "rgba(240,165,0,0.08)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      for (const g of GEARS) drawGear(ctx, g, t);
      drawArm(ctx, ARM_JOINTS, t);

      // Assembly tray
      ctx.fillStyle = "rgba(30,45,64,0.6)";
      ctx.strokeStyle = "rgba(58,142,186,0.3)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(1020, 300, 320, 180);
      ctx.fill();
      ctx.stroke();

      // Items on tray
      for (let i = 0; i < 3; i++) {
        const ix = 1060 + i * 90;
        const iy = 390;
        const assembled = Math.sin(t * 0.6 - i * 0.8) > 0;
        ctx.beginPath();
        ctx.arc(ix, iy, 18, 0, TAU);
        ctx.fillStyle = assembled ? "rgba(240,165,0,0.7)" : "rgba(58,142,186,0.3)";
        ctx.fill();
        ctx.strokeStyle = assembled ? "#F0A500" : "#3A8EBA";
        ctx.lineWidth = 1.5;
        ctx.stroke();
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
        background: "#0A0F1A",
        position: "relative",
        overflow: "hidden",
        userSelect: "none",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <style>{`
        @keyframes am-pulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
        @keyframes am-blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        @keyframes am-scan { 0%{transform:translateY(-100%)} 100%{transform:translateY(900px)} }
      `}</style>

      <canvas ref={canvasRef} width={W} height={H} style={{ position: "absolute", inset: 0 }} />

      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {/* Top nav */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          padding: "28px 56px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          borderBottom: "1px solid rgba(58,142,186,0.1)",
          background: "rgba(10,15,26,0.6)",
        }}>
          <div>
            <div style={{
              color: "#F0F4F8", fontSize: 17, fontWeight: 700,
              letterSpacing: "0.2em", textTransform: "uppercase",
            }}>
              AUTOMATION
            </div>
            <div style={{
              color: "rgba(240,165,0,0.7)",
              fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase", marginTop: 2,
            }}>
              Machines · Industrial Series
            </div>
          </div>
          <div style={{ display: "flex", gap: 36 }}>
            {["Systems", "Robotics", "Control", "Deploy"].map(t => (
              <span key={t} style={{
                color: "rgba(240,244,248,0.38)",
                fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
              }}>{t}</span>
            ))}
          </div>
          <div style={{
            border: "1px solid rgba(240,165,0,0.5)",
            color: "#F0A500",
            fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
            padding: "9px 22px",
          }}>
            Configure
          </div>
        </div>

        {/* Left hero text */}
        <div style={{
          position: "absolute",
          top: "50%", left: 56,
          transform: "translateY(-50%)",
        }}>
          <div style={{
            color: "rgba(240,165,0,0.65)",
            fontSize: 10, letterSpacing: "0.38em", textTransform: "uppercase",
            marginBottom: 14,
            animation: "am-pulse 3.2s ease-in-out infinite",
          }}>
            ◆ Autonomous Assembly Systems
          </div>
          <h1 style={{
            margin: 0, color: "#F0F4F8",
            fontSize: 76, fontWeight: 800,
            lineHeight: 0.9, letterSpacing: "-0.025em",
            textTransform: "uppercase",
          }}>
            Built By<br />
            <span style={{ color: "#F0A500" }}>Machines.</span>
          </h1>
          <div style={{
            marginTop: 28,
            color: "rgba(240,244,248,0.45)",
            fontSize: 13, lineHeight: 1.65, maxWidth: 300,
          }}>
            Industrial robotics + precision gear drives powering the next generation of autonomous manufacturing.
          </div>
          <div style={{ marginTop: 28, display: "flex", gap: 14 }}>
            <div style={{
              background: "#F0A500", color: "#0A0F1A",
              fontSize: 11, fontWeight: 800, letterSpacing: "0.16em",
              textTransform: "uppercase", padding: "13px 28px",
            }}>
              Explore Systems
            </div>
            <div style={{
              border: "1px solid rgba(240,244,248,0.18)",
              color: "rgba(240,244,248,0.55)",
              fontSize: 11, letterSpacing: "0.14em",
              textTransform: "uppercase", padding: "13px 24px",
            }}>
              View Specs
            </div>
          </div>
        </div>

        {/* Bottom status bar */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          borderTop: "1px solid rgba(58,142,186,0.1)",
          background: "rgba(10,15,26,0.8)",
          display: "flex", alignItems: "center",
          padding: "16px 56px", gap: 52,
        }}>
          {[
            ["6 Axes", "Robotic DOF"],
            ["0.02mm", "Tolerance"],
            ["99.8%", "Uptime SLA"],
            ["1.4k/h", "Throughput"],
          ].map(([v, l]) => (
            <div key={l} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ color: "#F0A500", fontSize: 18, fontWeight: 700 }}>{v}</span>
              <span style={{ color: "rgba(240,244,248,0.3)", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase" }}>{l}</span>
            </div>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#F0A500", animation: "am-pulse 2s ease-in-out infinite" }} />
            <span style={{ color: "rgba(240,165,0,0.75)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase" }}>Line Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
