"use client";

// Equilibrium: pendulum physics + balance scale with damped harmonic motion.
// The scale tips in response to pendulum position; energy lines show tension.
// No external video — pure canvas physics simulation.
// Palette: #F4F1EC (warm cream) / #1A1814 (deep warm black) / #8FA89C (sage)
// Pure canvas + rAF. No external dependencies.

import { useEffect, useRef } from "react";

const W = 1440;
const H = 900;
const CX = W / 2;
const CY = 280;

// Pendulum physics constants
const PEND_LEN  = 220; // px from pivot to bob
const DAMPING   = 0.9985;
const GRAVITY   = 0.0004;
const START_ANG = 0.42; // radians

// Scale constants
const SCALE_ARM  = 180; // arm half-length
const SCALE_ROPE = 120; // rope length to pan
const SCALE_PAN  = 90;  // pan half-width

interface PendState {
  angle: number;
  velocity: number;
}

export default function Equilibrium({ isVisible }: { isVisible: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number | null>(null);
  const pendRef   = useRef<PendState>({ angle: START_ANG, velocity: 0 });
  const lastRef   = useRef<number | null>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    if (!isVisible) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastRef.current = null;
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      drawStaticFrame(ctx);
      return;
    }

    pendRef.current = { angle: START_ANG, velocity: 0 };
    let animId = 0;

    function tick(now: number) {
      if (!cv || !ctx) return;
      const dt = lastRef.current ? Math.min(now - lastRef.current, 32) : 16;
      lastRef.current = now;

      // Physics step (Euler)
      const { angle, velocity } = pendRef.current;
      const accel = -GRAVITY * Math.sin(angle);
      const newVel = velocity * DAMPING + accel * dt;
      let newAng = angle + newVel * dt;

      // If nearly stopped, restart with slight push
      if (Math.abs(newVel) < 0.0004 && Math.abs(newAng) < 0.04) {
        pendRef.current = { angle: -START_ANG, velocity: 0 };
      } else {
        pendRef.current = { angle: newAng, velocity: newVel };
      }

      drawFrame(ctx, pendRef.current.angle);

      animId = requestAnimationFrame(tick);
      rafRef.current = animId;
    }

    animId = requestAnimationFrame(tick);
    rafRef.current = animId;
    return () => cancelAnimationFrame(animId);
  }, [isVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  function drawStaticFrame(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#F4F1EC";
    ctx.fillRect(0, 0, W, H);
    drawFrame(ctx, START_ANG * 0.3);
  }

  function drawFrame(ctx: CanvasRenderingContext2D, angle: number) {
    // Background
    ctx.fillStyle = "#F4F1EC";
    ctx.fillRect(0, 0, W, H);

    // Subtle texture gradient
    const bgGrd = ctx.createRadialGradient(CX, CY, 0, CX, H * 0.6, 680);
    bgGrd.addColorStop(0, "rgba(240,237,228,0.8)");
    bgGrd.addColorStop(1, "rgba(215,210,200,0.4)");
    ctx.fillStyle = bgGrd;
    ctx.fillRect(0, 0, W, H);

    // === MAIN PENDULUM ===
    const bobX = CX + Math.sin(angle) * PEND_LEN;
    const bobY = CY + Math.cos(angle) * PEND_LEN;

    // Pivot point
    ctx.beginPath();
    ctx.arc(CX, CY, 10, 0, Math.PI * 2);
    ctx.fillStyle = "#1A1814";
    ctx.fill();

    // Pendulum rod
    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.lineTo(bobX, bobY);
    ctx.strokeStyle = "#1A1814";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Bob (weighted ball)
    const bobR = 26;
    const bobGrd = ctx.createRadialGradient(bobX - 8, bobY - 8, 0, bobX, bobY, bobR * 1.1);
    bobGrd.addColorStop(0, "#2E2A24");
    bobGrd.addColorStop(0.6, "#1A1814");
    bobGrd.addColorStop(1, "#0A0908");
    ctx.beginPath();
    ctx.arc(bobX, bobY, bobR, 0, Math.PI * 2);
    ctx.fillStyle = bobGrd;
    ctx.fill();
    // Bob highlight
    ctx.beginPath();
    ctx.arc(bobX - 9, bobY - 9, 7, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fill();

    // === BALANCE SCALE ===
    // Scale placed below and centered
    const scaleCY = CY + PEND_LEN + 160;
    const scaleCX = CX;

    // Scale responds to pendulum angle (scaled down for elegance)
    const tiltAngle = angle * 0.55;

    // Center post
    ctx.beginPath();
    ctx.moveTo(scaleCX, scaleCY + 20);
    ctx.lineTo(scaleCX, scaleCY - 30);
    ctx.strokeStyle = "#1A1814";
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Center knob
    ctx.beginPath();
    ctx.arc(scaleCX, scaleCY - 30, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#1A1814";
    ctx.fill();

    // Arm (tilts with tiltAngle)
    const armLX = scaleCX + Math.cos(Math.PI + tiltAngle) * SCALE_ARM;
    const armLY = scaleCY - 30 + Math.sin(Math.PI + tiltAngle) * SCALE_ARM;
    const armRX = scaleCX + Math.cos(tiltAngle) * SCALE_ARM;
    const armRY = scaleCY - 30 + Math.sin(tiltAngle) * SCALE_ARM;

    ctx.beginPath();
    ctx.moveTo(armLX, armLY);
    ctx.lineTo(armRX, armRY);
    ctx.strokeStyle = "#1A1814";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Left arm end knob
    ctx.beginPath(); ctx.arc(armLX, armLY, 5, 0, Math.PI * 2); ctx.fillStyle = "#1A1814"; ctx.fill();
    // Right arm end knob
    ctx.beginPath(); ctx.arc(armRX, armRY, 5, 0, Math.PI * 2); ctx.fill();

    // Left pan rope + pan
    const lRopeX = armLX, lRopeY = armLY + SCALE_ROPE;
    ctx.beginPath();
    ctx.moveTo(armLX, armLY);
    ctx.lineTo(lRopeX - SCALE_PAN * 0.35, lRopeY);
    ctx.moveTo(armLX, armLY);
    ctx.lineTo(lRopeX + SCALE_PAN * 0.35, lRopeY);
    ctx.strokeStyle = "#1A1814";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Left pan
    ctx.beginPath();
    ctx.ellipse(lRopeX, lRopeY + 3, SCALE_PAN, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(26,24,20,0.15)";
    ctx.fill();
    ctx.strokeStyle = "#1A1814";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Right pan rope + pan
    const rRopeX = armRX, rRopeY = armRY + SCALE_ROPE;
    ctx.beginPath();
    ctx.moveTo(armRX, armRY);
    ctx.lineTo(rRopeX - SCALE_PAN * 0.35, rRopeY);
    ctx.moveTo(armRX, armRY);
    ctx.lineTo(rRopeX + SCALE_PAN * 0.35, rRopeY);
    ctx.strokeStyle = "#1A1814";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Right pan
    ctx.beginPath();
    ctx.ellipse(rRopeX, rRopeY + 3, SCALE_PAN, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(26,24,20,0.15)";
    ctx.fill();
    ctx.strokeStyle = "#1A1814";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Symbolic weights on pans
    const lPanItems = angle > 0.05 ? 3 : angle < -0.05 ? 1 : 2;
    const rPanItems = angle < -0.05 ? 3 : angle > 0.05 ? 1 : 2;
    const drawWeights = (panX: number, panY: number, count: number) => {
      for (let i = 0; i < count; i++) {
        ctx.beginPath();
        ctx.arc(panX + (i - (count - 1) / 2) * 28, panY - 22 - i * 8, 9, 0, Math.PI * 2);
        ctx.fillStyle = "#3A3630";
        ctx.fill();
      }
    };
    drawWeights(lRopeX, lRopeY, lPanItems);
    drawWeights(rRopeX, rRopeY, rPanItems);

    // === TENSION LINES between pendulum bob and scale ===
    const tension = Math.abs(angle) * 2.2;
    if (tension > 0.05) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.25, tension * 0.25);
      ctx.strokeStyle = "#8FA89C";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]);
      // Bob to left arm end
      ctx.beginPath();
      ctx.moveTo(bobX, bobY);
      ctx.quadraticCurveTo(CX - 80, (bobY + armLY) / 2, armLX, armLY);
      ctx.stroke();
      // Bob to right arm end
      ctx.beginPath();
      ctx.moveTo(bobX, bobY);
      ctx.quadraticCurveTo(CX + 80, (bobY + armRY) / 2, armRX, armRY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // === BASE PLATFORM ===
    ctx.beginPath();
    ctx.rect(scaleCX - 100, scaleCY + 22, 200, 8);
    ctx.fillStyle = "#1A1814";
    ctx.fill();
    ctx.beginPath();
    ctx.rect(scaleCX - 70, scaleCY + 30, 140, 4);
    ctx.fillStyle = "rgba(26,24,20,0.4)";
    ctx.fill();

    // Floor shadow
    const shadowGrd = ctx.createLinearGradient(0, scaleCY + 36, 0, scaleCY + 100);
    shadowGrd.addColorStop(0, "rgba(26,24,20,0.08)");
    shadowGrd.addColorStop(1, "rgba(26,24,20,0)");
    ctx.fillStyle = shadowGrd;
    ctx.fillRect(scaleCX - 200, scaleCY + 36, 400, 64);

    // Decorative horizontal rule lines
    ctx.strokeStyle = "rgba(26,24,20,0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const ry = 120 + i * 180;
      ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(W, ry); ctx.stroke();
    }
  }

  return (
    <div
      style={{
        width: W, height: H,
        background: "#F4F1EC",
        position: "relative",
        overflow: "hidden",
        userSelect: "none",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <style>{`
        @keyframes eqb-logo { 0%,100%{opacity:0.9} 50%{opacity:0.6} }
      `}</style>

      <canvas ref={canvasRef} width={W} height={H} style={{ position: "absolute", inset: 0 }} />

      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {/* Header */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "28px 60px",
          borderBottom: "1px solid rgba(26,24,20,0.08)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Logo mark — infinity-ish */}
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 4 C5 4 5 18 11 11 C17 4 17 18 11 18" stroke="#1A1814" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
            </svg>
            <span style={{
              color: "#1A1814",
              fontSize: 14, fontWeight: 600, letterSpacing: "0.05em",
              animation: "eqb-logo 4s ease-in-out infinite",
            }}>
              Equilibrium
            </span>
          </div>
          <div style={{ display: "flex", gap: 36 }}>
            {["Home", "Wellness", "Routine", "Our Team"].map(t => (
              <span key={t} style={{
                color: "rgba(26,24,20,0.48)",
                fontSize: 11, letterSpacing: "0.12em",
              }}>{t}</span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{
              border: "1px solid rgba(26,24,20,0.2)",
              color: "rgba(26,24,20,0.7)",
              fontSize: 11, padding: "9px 20px",
              letterSpacing: "0.08em",
            }}>
              Log in
            </div>
            <div style={{
              background: "#1A1814", color: "#F4F1EC",
              fontSize: 11, padding: "9px 20px",
              letterSpacing: "0.08em",
            }}>
              Begin Now
            </div>
          </div>
        </div>

        {/* Left caption */}
        <div style={{
          position: "absolute", left: 60, top: "50%", transform: "translateY(-50%)",
        }}>
          <p style={{
            color: "rgba(26,24,20,0.36)",
            fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase",
            maxWidth: 120, lineHeight: 1.8,
            transform: "rotate(-90deg) translateX(-60px)",
            transformOrigin: "left center",
            whiteSpace: "nowrap",
          }}>
            Balance · Rest · Restore
          </p>
        </div>

        {/* Bottom CTA */}
        <div style={{
          position: "absolute", bottom: 56, left: 60, right: 60,
          display: "flex", justifyContent: "space-between", alignItems: "flex-end",
        }}>
          <div>
            <h1 style={{
              margin: 0,
              color: "#1A1814",
              fontSize: 64, fontWeight: 800,
              lineHeight: 1, letterSpacing: "-0.025em",
            }}>
              Find Your<br />
              <span style={{ color: "#8FA89C" }}>Balance.</span>
            </h1>
            <p style={{
              marginTop: 16, marginBottom: 0,
              color: "rgba(26,24,20,0.5)",
              fontSize: 14, lineHeight: 1.6, maxWidth: 340,
            }}>
              A daily wellness ritual built around the science of equilibrium — mind, body, and the space between.
            </p>
            <div style={{ marginTop: 24, display: "flex", gap: 14 }}>
              <div style={{
                background: "#1A1814", color: "#F4F1EC",
                fontSize: 11, fontWeight: 700, letterSpacing: "0.16em",
                textTransform: "uppercase", padding: "13px 28px",
              }}>
                Start Your Practice
              </div>
              <div style={{
                border: "1px solid rgba(26,24,20,0.2)",
                color: "rgba(26,24,20,0.65)",
                fontSize: 11, letterSpacing: "0.14em",
                textTransform: "uppercase", padding: "13px 24px",
              }}>
                Learn More
              </div>
            </div>
          </div>

          {/* Right — method badges */}
          <div style={{
            display: "flex", flexDirection: "column", gap: 12, textAlign: "right",
          }}>
            {[
              ["Breath", "4-7-8 Method"],
              ["Movement", "Somatic Flow"],
              ["Rest", "Sleep Protocol"],
            ].map(([cat, method]) => (
              <div key={cat}>
                <div style={{ color: "#8FA89C", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}>{cat}</div>
                <div style={{ color: "rgba(26,24,20,0.45)", fontSize: 10, letterSpacing: "0.08em" }}>{method}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
