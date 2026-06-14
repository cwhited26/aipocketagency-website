"use client";

// SlamDunk: basketball silhouette animation — approach, jump, aerial hang,
// ball release, arc, rim impact + energy burst, crowd flash. Looping.
// Pure canvas + rAF. No external images.
// Palette: #0A0A0A (court dark) / #FF6B1A (ball orange) / #F5F0E8 (silhouette)

import { useEffect, useRef } from "react";

const W = 1440;
const H = 900;

// Animation phases (in seconds)
const PHASE = {
  approach: { start: 0,    end: 1.2 },
  jump:     { start: 1.2,  end: 2.0 },
  hang:     { start: 2.0,  end: 2.8 },
  arc:      { start: 2.2,  end: 3.1 },
  impact:   { start: 3.05, end: 3.4 },
  hold:     { start: 3.4,  end: 4.5 },
  total: 4.5,
};

// Key positions
const RIM_X = 1060;
const RIM_Y = 330;
const PLAYER_START_X = 200;
const PLAYER_JUMP_X = 820;

function ease(t: number): number { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
function clamp01(t: number): number { return Math.max(0, Math.min(1, t)); }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  jumpT: number, // 0 = standing, 1 = peak dunk
  scale: number,
  color: string,
) {
  const s = scale;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 5 * s;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const jt = ease(jumpT);

  // Torso lean + stretch on jump
  const torsoCY = -120 * s - jt * 20 * s;
  const headY   = torsoCY - 44 * s - jt * 10 * s;
  const legSpread = lerp(30, 60, jt) * s;
  const armUp    = lerp(30, 150, jt);   // right arm degrees (dunking arm)
  const armDown  = lerp(-40, -80, jt);  // left arm degrees

  // Head
  ctx.beginPath();
  ctx.arc(0, headY, 18 * s, 0, Math.PI * 2);
  ctx.fill();

  // Torso
  const torsoTop = headY + 18 * s;
  const torsoBot = torsoCY + 50 * s;
  ctx.beginPath();
  ctx.moveTo(-12 * s, torsoTop);
  ctx.lineTo(12 * s, torsoTop);
  ctx.lineTo(16 * s * (1 + jt * 0.3), torsoBot);
  ctx.lineTo(-10 * s * (1 + jt * 0.3), torsoBot);
  ctx.closePath();
  ctx.fill();

  // Legs
  const hipX = 0, hipY = torsoBot;
  // Right leg (forward on jump)
  const rFootX = legSpread * (jt > 0.3 ? lerp(1, 0.3, jt) : 1);
  const rFootY = lerp(100, 60, jt) * s;
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.bezierCurveTo(
    hipX + rFootX * 0.4, hipY + rFootY * 0.4,
    hipX + rFootX * 0.8, hipY + rFootY * 0.7,
    hipX + rFootX, hipY + rFootY,
  );
  ctx.stroke();

  // Left leg (back kick on jump)
  const lFootX = -legSpread * (jt > 0.3 ? lerp(1, 1.8, jt) : 1);
  const lFootY = lerp(100, -20, jt) * s;
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.bezierCurveTo(
    hipX + lFootX * 0.3, hipY + lFootY * 0.5,
    hipX + lFootX * 0.7, hipY + lFootY * 0.9,
    hipX + lFootX, hipY + lFootY,
  );
  ctx.stroke();

  // Right arm (dunking — extends up + forward)
  const rArmLen = 110 * s * (1 + jt * 0.25);
  const rArmAngleRad = (armUp - 90) * Math.PI / 180;
  ctx.beginPath();
  ctx.moveTo(8 * s, torsoTop + 16 * s);
  ctx.lineTo(
    8 * s + Math.cos(rArmAngleRad) * rArmLen,
    torsoTop + 16 * s + Math.sin(rArmAngleRad) * rArmLen,
  );
  ctx.stroke();

  // Left arm (balance)
  const lArmLen = 95 * s;
  const lArmAngleRad = (armDown - 90) * Math.PI / 180;
  ctx.beginPath();
  ctx.moveTo(-8 * s, torsoTop + 16 * s);
  ctx.lineTo(
    -8 * s + Math.cos(lArmAngleRad) * lArmLen,
    torsoTop + 16 * s + Math.sin(lArmAngleRad) * lArmLen,
  );
  ctx.stroke();

  ctx.restore();
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  bx: number, by: number,
  r: number,
  rotation: number,
) {
  ctx.save();
  ctx.translate(bx, by);

  // Drop shadow
  const shadowGrd = ctx.createRadialGradient(r * 0.1, r * 0.15, 0, r * 0.1, r * 0.15, r * 1.4);
  shadowGrd.addColorStop(0, "rgba(0,0,0,0.55)");
  shadowGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = shadowGrd;
  ctx.beginPath();
  ctx.arc(r * 0.1, r * 0.15, r * 1.4, 0, Math.PI * 2);
  ctx.fill();

  // Ball body — three-stop gradient for more depth
  const grd = ctx.createRadialGradient(-r * 0.38, -r * 0.32, r * 0.04, 0, 0, r * 1.05);
  grd.addColorStop(0, "#FFA050");
  grd.addColorStop(0.28, "#FF7220");
  grd.addColorStop(0.68, "#E04A00");
  grd.addColorStop(1, "#8B2200");
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = grd;
  ctx.fill();

  // Specular highlight
  const spec = ctx.createRadialGradient(-r * 0.35, -r * 0.32, 0, -r * 0.25, -r * 0.22, r * 0.45);
  spec.addColorStop(0, "rgba(255,220,180,0.55)");
  spec.addColorStop(1, "rgba(255,150,80,0)");
  ctx.fillStyle = spec;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Seam lines
  ctx.rotate(rotation);
  ctx.strokeStyle = "rgba(0,0,0,0.38)";
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI * 0.5, Math.PI * 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, Math.PI * 2);
  ctx.stroke();

  // Seam highlight
  ctx.strokeStyle = "rgba(255,180,100,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.98, -Math.PI * 0.6, Math.PI * 0.1);
  ctx.stroke();

  ctx.restore();
}

function drawRim(ctx: CanvasRenderingContext2D, flash: number) {
  // Backboard
  ctx.fillStyle = "rgba(245,240,232,0.12)";
  ctx.fillRect(RIM_X + 20, RIM_Y - 100, 8, 180);

  // Rim
  ctx.save();
  ctx.strokeStyle = flash > 0
    ? `rgba(255,${Math.floor(200 + flash * 55)},${Math.floor(flash * 60)},${0.8 + flash * 0.2})`
    : "rgba(220,80,20,0.9)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(RIM_X, RIM_Y, 55, 14, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Net hint
  ctx.strokeStyle = `rgba(245,240,232,${0.25 + flash * 0.3})`;
  ctx.lineWidth = 1.5;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(RIM_X + i * 16, RIM_Y + 14);
    ctx.lineTo(RIM_X + i * 12, RIM_Y + 70);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEnergyBurst(ctx: CanvasRenderingContext2D, intensity: number) {
  if (intensity <= 0) return;
  const n = 18;
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const len = (60 + Math.abs(Math.sin(i * 2.3 + 1.7)) * 80) * intensity;
    const alpha = intensity * 0.9;
    ctx.save();
    ctx.translate(RIM_X, RIM_Y);
    ctx.rotate(angle);
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, `rgba(255,180,40,${alpha})`);
    g.addColorStop(1, `rgba(255,100,0,0)`);
    ctx.strokeStyle = g;
    ctx.lineWidth = 2.5 * intensity;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len, 0);
    ctx.stroke();
    ctx.restore();
  }

  // Flash ring
  const ringGrd = ctx.createRadialGradient(RIM_X, RIM_Y, 0, RIM_X, RIM_Y, 130 * intensity);
  ringGrd.addColorStop(0, `rgba(255,200,80,${intensity * 0.35})`);
  ringGrd.addColorStop(0.5, `rgba(255,120,0,${intensity * 0.15})`);
  ringGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = ringGrd;
  ctx.fillRect(0, 0, W, H);
}

function drawCourt(ctx: CanvasRenderingContext2D) {
  // Floor line
  const y = 720;
  ctx.strokeStyle = "rgba(245,240,232,0.15)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(W, y);
  ctx.stroke();

  // Three-point arc hint
  ctx.strokeStyle = "rgba(245,240,232,0.07)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(RIM_X, y, 540, Math.PI, Math.PI * 2);
  ctx.stroke();

  // Lane lines
  ctx.strokeStyle = "rgba(245,240,232,0.06)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(RIM_X - 120, y - 320, 240, 320);
}

export default function SlamDunk({ isVisible }: { isVisible: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number | null>(null);
  const startRef  = useRef<number | null>(null);

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
      drawCourt(ctx);
      drawRim(ctx, 0);
      drawPlayer(ctx, PLAYER_JUMP_X, 640, 0.9, 1, "rgba(245,240,232,0.92)");
      drawBall(ctx, RIM_X - 60, RIM_Y - 30, 24, 0);
      return;
    }

    let animId = 0;

    function tick(now: number) {
      if (!cv || !ctx) return;
      if (startRef.current === null) startRef.current = now;
      const elapsed = (now - startRef.current) * 0.001;
      const loopT = elapsed % PHASE.total;

      ctx.fillStyle = "#0A0A0A";
      ctx.fillRect(0, 0, W, H);

      // Background gradient
      const bgGrd = ctx.createRadialGradient(RIM_X, RIM_Y, 0, RIM_X, 400, 700);
      bgGrd.addColorStop(0, "rgba(40,20,10,0.6)");
      bgGrd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bgGrd;
      ctx.fillRect(0, 0, W, H);

      drawCourt(ctx);

      // Crowd blur at top
      const crowdGrd = ctx.createLinearGradient(0, 0, 0, 300);
      crowdGrd.addColorStop(0, "rgba(20,15,10,0.6)");
      crowdGrd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = crowdGrd;
      ctx.fillRect(0, 0, W, 300);

      // Compute player position
      let playerX = PLAYER_START_X;
      let playerY = 680;
      let jumpT = 0;
      let ballX = playerX + 80;
      let ballY = playerY - 160;
      let ballR = 22;
      let ballRot = 0;
      let impactFlash = 0;
      let showBall = true;

      if (loopT < PHASE.approach.end) {
        // Approach: player runs from left
        const t = clamp01(loopT / PHASE.approach.end);
        playerX = lerp(PLAYER_START_X, PLAYER_JUMP_X, ease(t));
        playerY = 680;
        jumpT = 0;
        // Dribble
        const dribble = Math.sin(loopT * 14) * 0.5 + 0.5;
        ballY = playerY - 100 - dribble * 60;
        ballX = playerX + 60;
        ballRot = loopT * 8;
      } else if (loopT < PHASE.hang.end) {
        // Jump phase
        const t = clamp01((loopT - PHASE.jump.start) / (PHASE.hang.end - PHASE.jump.start));
        playerX = PLAYER_JUMP_X + lerp(0, 120, ease(t));
        // Jump arc
        const jumpArc = Math.sin(t * Math.PI);
        playerY = lerp(680, 680 - 180, jumpArc);
        jumpT = t;
        ballX = playerX + 30 + t * 120;
        ballY = playerY - 110 + (1 - jumpArc) * 20;
        ballRot = t * 12;
      } else if (loopT < PHASE.arc.end) {
        // Ball arc toward rim — player frozen at peak
        playerX = PLAYER_JUMP_X + 150;
        playerY = 680 - 130;
        jumpT = 1;
        const arcT = clamp01((loopT - PHASE.arc.start) / (PHASE.arc.end - PHASE.arc.start));
        // Quadratic bezier arc
        const bx0 = playerX + 60, by0 = playerY - 110;
        const bx1 = RIM_X - 80,   by1 = RIM_Y - 180;
        const bx2 = RIM_X,         by2 = RIM_Y;
        const mt = ease(arcT);
        ballX = (1 - mt) * (1 - mt) * bx0 + 2 * (1 - mt) * mt * bx1 + mt * mt * bx2;
        ballY = (1 - mt) * (1 - mt) * by0 + 2 * (1 - mt) * mt * by1 + mt * mt * by2;
        ballRot = arcT * 20;
      } else if (loopT < PHASE.impact.end) {
        // Impact
        playerX = PLAYER_JUMP_X + 160;
        playerY = 680 - 80;
        jumpT = 0.7;
        const impT = clamp01((loopT - PHASE.impact.start) / (PHASE.impact.end - PHASE.impact.start));
        impactFlash = Math.sin(impT * Math.PI);
        ballX = RIM_X;
        ballY = RIM_Y;
        if (impT > 0.5) showBall = false;
      } else {
        // Hold/reset
        playerX = PLAYER_JUMP_X + 160;
        playerY = lerp(680 - 60, 680, clamp01((loopT - PHASE.hold.start) / 0.6));
        jumpT = Math.max(0, lerp(0.5, 0, clamp01((loopT - PHASE.hold.start) / 0.6)));
        showBall = false;
      }

      // Spotlight on impact
      if (impactFlash > 0) {
        const rimSpot = ctx.createRadialGradient(RIM_X, RIM_Y, 0, RIM_X, RIM_Y, 300);
        rimSpot.addColorStop(0, `rgba(255,160,40,${impactFlash * 0.2})`);
        rimSpot.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rimSpot;
        ctx.fillRect(0, 0, W, H);
      }

      // Spotlight on player
      const spotGrd = ctx.createRadialGradient(playerX, playerY - 60, 0, playerX, playerY - 60, 420);
      spotGrd.addColorStop(0, "rgba(255,255,255,0.055)");
      spotGrd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = spotGrd;
      ctx.fillRect(0, 0, W, H);

      // Player shadow
      const shadowAlpha = Math.max(0, 0.5 - (680 - playerY) / 400);
      ctx.save();
      ctx.translate(playerX, 720);
      ctx.scale(1, 0.18);
      ctx.beginPath();
      ctx.arc(0, 0, 60, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
      ctx.fill();
      ctx.restore();

      // Draw rim (behind player)
      drawRim(ctx, impactFlash);
      drawEnergyBurst(ctx, impactFlash);

      // Ball shadow on floor
      if (showBall && ballY > 500) {
        ctx.save();
        ctx.translate(ballX, 720);
        ctx.scale(1, 0.15);
        ctx.beginPath();
        ctx.arc(0, 0, ballR * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fill();
        ctx.restore();
      }

      // Player silhouette
      ctx.globalAlpha = 0.95;
      drawPlayer(ctx, playerX, playerY, jumpT, 1, "rgba(245,240,232,0.95)");
      ctx.globalAlpha = 1;

      // Ball
      if (showBall) drawBall(ctx, ballX, ballY, ballR, ballRot);

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
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <style>{`
        @keyframes sdk-logo-flash { 0%,100%{opacity:1} 50%{opacity:0.7} }
      `}</style>

      <canvas ref={canvasRef} width={W} height={H} style={{ position: "absolute", inset: 0 }} />

      {/* Branding overlay */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{
          position: "absolute", top: 44, left: 60,
        }}>
          <div style={{ color: "rgba(245,240,232,0.5)", fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", marginBottom: 4 }}>
            Est. 1996
          </div>
          <div style={{
            color: "#F5F0E8",
            fontSize: 28, fontWeight: 900, letterSpacing: "-0.01em", textTransform: "uppercase",
            animation: "sdk-logo-flash 3s ease-in-out infinite",
          }}>
            SLAM DUNK
          </div>
          <div style={{ color: "rgba(255,107,26,0.8)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", marginTop: 2 }}>
            Athletic Performance
          </div>
        </div>

        <div style={{ position: "absolute", top: 44, right: 60, textAlign: "right" }}>
          {["Training", "Community", "Gear", "Events"].map(t => (
            <span key={t} style={{
              color: "rgba(245,240,232,0.42)", fontSize: 11,
              letterSpacing: "0.14em", textTransform: "uppercase",
              marginLeft: 28,
            }}>{t}</span>
          ))}
        </div>

        {/* Score board style overlay */}
        <div style={{
          position: "absolute", top: 44, left: "50%", transform: "translateX(-50%)",
          background: "rgba(10,10,10,0.7)",
          border: "1px solid rgba(245,240,232,0.14)",
          padding: "8px 24px",
          textAlign: "center",
        }}>
          <div style={{ color: "rgba(255,107,26,0.9)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" }}>Q4 04:22</div>
        </div>

        {/* Bottom CTA */}
        <div style={{
          position: "absolute", bottom: 44, left: 60,
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div style={{
            color: "#F5F0E8", fontSize: 64, fontWeight: 900,
            letterSpacing: "-0.03em", textTransform: "uppercase", lineHeight: 1,
          }}>
            Own<br />
            <span style={{ color: "#FF6B1A" }}>The Court.</span>
          </div>
          <div style={{
            background: "#FF6B1A", color: "#0A0A0A",
            fontSize: 11, fontWeight: 800, letterSpacing: "0.18em",
            textTransform: "uppercase", padding: "14px 32px",
            display: "inline-block",
          }}>
            Shop Now
          </div>
        </div>
      </div>
    </div>
  );
}
