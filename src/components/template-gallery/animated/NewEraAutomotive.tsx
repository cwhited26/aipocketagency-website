"use client";

// NewEraAutomotive: headlight sweep across a car silhouette reveal.
// Dark canvas. Car silhouette revealed by a sweeping cone of light.
// Palette: #050508 / #0E0F14 / #D4E0F5 (headlight blue-white) / #8090A0 (chrome)
// Pure canvas + rAF. No external images or three.js.

import { useEffect, useRef } from "react";

const W = 1440;
const H = 900;
const LOOP_MS = 5200;

export default function NewEraAutomotive({ isVisible }: { isVisible: boolean }) {
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

    const carCX = W * 0.5;
    const carCY = H * 0.72;
    const s = 1.85;

    function buildCarPath(): Path2D {
      const p = new Path2D();
      p.moveTo(carCX - 320 * s, carCY);
      p.lineTo(carCX - 340 * s, carCY - 8 * s);
      p.bezierCurveTo(carCX - 355 * s, carCY - 30 * s, carCX - 350 * s, carCY - 65 * s, carCX - 310 * s, carCY - 90 * s);
      p.bezierCurveTo(carCX - 250 * s, carCY - 110 * s, carCX - 170 * s, carCY - 125 * s, carCX - 120 * s, carCY - 140 * s);
      p.lineTo(carCX - 80 * s, carCY - 160 * s);
      p.bezierCurveTo(carCX - 50 * s, carCY - 195 * s, carCX - 10 * s, carCY - 210 * s, carCX + 50 * s, carCY - 210 * s);
      p.bezierCurveTo(carCX + 110 * s, carCY - 210 * s, carCX + 150 * s, carCY - 202 * s, carCX + 175 * s, carCY - 190 * s);
      p.bezierCurveTo(carCX + 200 * s, carCY - 175 * s, carCX + 215 * s, carCY - 158 * s, carCX + 225 * s, carCY - 145 * s);
      p.bezierCurveTo(carCX + 255 * s, carCY - 125 * s, carCX + 305 * s, carCY - 115 * s, carCX + 340 * s, carCY - 100 * s);
      p.bezierCurveTo(carCX + 365 * s, carCY - 85 * s, carCX + 360 * s, carCY - 30 * s, carCX + 355 * s, carCY - 5 * s);
      p.lineTo(carCX + 340 * s, carCY);
      p.bezierCurveTo(carCX + 310 * s, carCY + 2 * s, carCX + 285 * s, carCY + 5 * s, carCX + 260 * s, carCY);
      p.bezierCurveTo(carCX + 240 * s, carCY - 4 * s, carCX + 220 * s, carCY - 5 * s, carCX + 195 * s, carCY);
      p.lineTo(carCX - 110 * s, carCY);
      p.bezierCurveTo(carCX - 135 * s, carCY - 5 * s, carCX - 155 * s, carCY - 4 * s, carCX - 175 * s, carCY);
      p.bezierCurveTo(carCX - 200 * s, carCY + 5 * s, carCX - 220 * s, carCY + 4 * s, carCX - 245 * s, carCY);
      p.lineTo(carCX - 320 * s, carCY);
      p.closePath();
      return p;
    }

    const carPath = buildCarPath();
    const headlightX = carCX - 343 * s;
    const headlightY = carCY - 55 * s;
    const carLeft  = carCX - 360 * s;
    const carRight = carCX + 366 * s;
    const carSpan  = carRight - carLeft;

    function drawWheel(c: CanvasRenderingContext2D, wx: number, wy: number, sweepX: number, sweepW: number, alpha: number) {
      c.save();
      const wp = new Path2D();
      wp.arc(wx, wy, 44 * s, 0, Math.PI * 2);
      c.fillStyle = "#050508";
      c.fill(wp);
      // Rim spokes
      c.clip(wp);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const rimGrd = c.createLinearGradient(sweepX - sweepW, 0, sweepX + sweepW, 0);
        rimGrd.addColorStop(0, "rgba(80,100,130,0)");
        rimGrd.addColorStop(0.5, `rgba(140,160,190,${0.7 * alpha})`);
        rimGrd.addColorStop(1, "rgba(80,100,130,0)");
        c.strokeStyle = rimGrd;
        c.lineWidth = 3 * s;
        c.beginPath();
        c.moveTo(wx, wy);
        c.lineTo(wx + Math.cos(a) * 35 * s, wy + Math.sin(a) * 35 * s);
        c.stroke();
      }
      c.restore();
      c.strokeStyle = "rgba(20,25,35,0.9)";
      c.lineWidth = 2;
      c.stroke(new Path2D(`M ${wx + 44 * s} ${wy} A ${44 * s} ${44 * s} 0 1 0 ${wx - 44 * s} ${wy}`));
    }

    function drawScene(c: CanvasRenderingContext2D, sweepFrac: number, revealAlpha: number) {
      c.fillStyle = "#050508";
      c.fillRect(0, 0, W, H);

      // Ground fog
      const fog = c.createLinearGradient(0, carCY, 0, H);
      fog.addColorStop(0, "rgba(5,5,8,0)");
      fog.addColorStop(1, "#050508");
      c.fillStyle = fog;
      c.fillRect(0, carCY, W, H - carCY);

      // Headlight cone
      for (let cone = 0; cone < 2; cone++) {
        const hlY = headlightY + (cone === 0 ? -10 : 10);
        const conePath = new Path2D();
        conePath.moveTo(headlightX, hlY);
        conePath.lineTo(headlightX - 850, hlY - 200 - cone * 25);
        conePath.lineTo(headlightX - 850, hlY + 200 + cone * 25);
        conePath.closePath();
        const coneGrd = c.createLinearGradient(headlightX, hlY, headlightX - 850, hlY);
        coneGrd.addColorStop(0, `rgba(212,224,245,${0.16 * revealAlpha})`);
        coneGrd.addColorStop(0.4, `rgba(160,185,225,${0.05 * revealAlpha})`);
        coneGrd.addColorStop(1, "rgba(100,130,180,0)");
        c.save();
        c.fillStyle = coneGrd;
        c.fill(conePath);
        c.restore();
      }

      // Moving sweep light
      const sweepX = -400 + sweepFrac * (W + 800);
      const sweepW = 280;
      const sweepGrd = c.createLinearGradient(sweepX - sweepW, 0, sweepX + sweepW, 0);
      sweepGrd.addColorStop(0, "rgba(212,224,245,0)");
      sweepGrd.addColorStop(0.35, `rgba(212,224,245,${0.2 * revealAlpha})`);
      sweepGrd.addColorStop(0.5, `rgba(235,245,255,${0.3 * revealAlpha})`);
      sweepGrd.addColorStop(0.65, `rgba(212,224,245,${0.2 * revealAlpha})`);
      sweepGrd.addColorStop(1, "rgba(212,224,245,0)");
      c.fillStyle = sweepGrd;
      c.fillRect(0, 0, W, H);

      // Car dark base
      c.fillStyle = "#09090E";
      c.fill(carPath);

      // Car lit surface
      c.save();
      c.clip(carPath);

      // Base body sheen
      const bodyGrd = c.createLinearGradient(carCX - 360 * s, carCY - 215 * s, carCX - 360 * s, carCY);
      bodyGrd.addColorStop(0, "rgba(20,26,40,0.88)");
      bodyGrd.addColorStop(0.6, "rgba(12,16,26,0.88)");
      bodyGrd.addColorStop(1, "rgba(8,10,16,0.92)");
      c.fillStyle = bodyGrd;
      c.fillRect(carLeft, carCY - 215 * s, carSpan, 215 * s + 30);

      // Sweep highlight
      const carSweepGrd = c.createLinearGradient(sweepX - sweepW * 1.3, 0, sweepX + sweepW * 1.3, 0);
      carSweepGrd.addColorStop(0, "rgba(25,40,65,0)");
      carSweepGrd.addColorStop(0.3, `rgba(55,80,125,${0.6 * revealAlpha})`);
      carSweepGrd.addColorStop(0.5, `rgba(80,115,175,${0.8 * revealAlpha})`);
      carSweepGrd.addColorStop(0.7, `rgba(55,80,125,${0.6 * revealAlpha})`);
      carSweepGrd.addColorStop(1, "rgba(25,40,65,0)");
      c.fillStyle = carSweepGrd;
      c.fillRect(carLeft, carCY - 215 * s, carSpan, 215 * s + 30);

      // Chrome roofline trim
      const trimGrd = c.createLinearGradient(sweepX - sweepW, 0, sweepX + sweepW, 0);
      trimGrd.addColorStop(0, "rgba(128,144,160,0)");
      trimGrd.addColorStop(0.5, `rgba(210,225,245,${0.88 * revealAlpha})`);
      trimGrd.addColorStop(1, "rgba(128,144,160,0)");
      c.strokeStyle = trimGrd;
      c.lineWidth = 2;
      const trim = new Path2D();
      trim.moveTo(carCX - 80 * s, carCY - 160 * s);
      trim.bezierCurveTo(carCX - 50 * s, carCY - 195 * s, carCX - 10 * s, carCY - 210 * s, carCX + 50 * s, carCY - 210 * s);
      trim.bezierCurveTo(carCX + 110 * s, carCY - 210 * s, carCX + 150 * s, carCY - 202 * s, carCX + 175 * s, carCY - 190 * s);
      c.stroke(trim);

      c.restore();

      // Wheels
      drawWheel(c, carCX - 195 * s, carCY + 32 * s, sweepX, sweepW, revealAlpha);
      drawWheel(c, carCX + 238 * s, carCY + 32 * s, sweepX, sweepW, revealAlpha);

      // Headlight glow
      const hlGrd = c.createRadialGradient(headlightX, headlightY, 0, headlightX, headlightY, 24);
      hlGrd.addColorStop(0, `rgba(235,245,255,${0.95 * revealAlpha})`);
      hlGrd.addColorStop(0.4, `rgba(200,220,250,${0.65 * revealAlpha})`);
      hlGrd.addColorStop(1, "rgba(150,180,220,0)");
      c.beginPath();
      c.arc(headlightX, headlightY, 24, 0, Math.PI * 2);
      c.fillStyle = hlGrd;
      c.fill();

      // Tail light
      const tailX = carCX + 348 * s;
      const tailY = carCY - 60 * s;
      const tlGrd = c.createRadialGradient(tailX, tailY, 0, tailX, tailY, 20);
      tlGrd.addColorStop(0, `rgba(220,40,20,${revealAlpha})`);
      tlGrd.addColorStop(0.5, `rgba(180,20,10,${0.55 * revealAlpha})`);
      tlGrd.addColorStop(1, "rgba(120,10,5,0)");
      c.beginPath();
      c.arc(tailX, tailY, 20, 0, Math.PI * 2);
      c.fillStyle = tlGrd;
      c.fill();
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      drawScene(ctx, 0.5, 1);
      return;
    }

    function tick(now: number) {
      if (!cv || !ctx) return;
      if (startRef.current === null) startRef.current = now;
      const elapsed = (now - startRef.current) % LOOP_MS;
      const progress = elapsed / LOOP_MS;
      const sweepFrac = Math.min(progress / 0.7, 1);
      const revealAlpha = progress > 0.9 ? Math.max(0, 1 - (progress - 0.9) / 0.1) : sweepFrac;
      drawScene(ctx, sweepFrac, revealAlpha);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isVisible]);

  return (
    <div style={{ width: W, height: H, background: "#050508", position: "relative", overflow: "hidden", userSelect: "none", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ position: "absolute", inset: 0 }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: 52, left: 72 }}>
          <p style={{ margin: "0 0 10px", color: "rgba(212,224,245,0.3)", fontSize: 9, letterSpacing: "0.38em", textTransform: "uppercase" }}>New Era</p>
          <h2 style={{ margin: 0, color: "#D4E0F5", fontSize: 52, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em", textTransform: "uppercase" }}>Automotive</h2>
          <p style={{ margin: "12px 0 0", color: "rgba(212,224,245,0.4)", fontSize: 12, letterSpacing: "0.12em" }}>Precision. Form. Motion.</p>
        </div>
        <div style={{ position: "absolute", top: 52, right: 72, textAlign: "right" }}>
          <p style={{ margin: 0, color: "rgba(212,224,245,0.2)", fontSize: 8, letterSpacing: "0.32em", textTransform: "uppercase" }}>Model Year</p>
          <p style={{ margin: "4px 0 0", color: "rgba(212,224,245,0.45)", fontSize: 24, fontWeight: 800, letterSpacing: "0.04em" }}>2026</p>
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, borderTop: "1px solid rgba(212,224,245,0.07)", background: "rgba(5,5,8,0.88)", display: "flex", alignItems: "center", padding: "18px 72px", gap: 52 }}>
          {[["680 hp","Output"],["2.9 s","0–60 mph"],["210 mph","Top Speed"],["AWD","Drivetrain"]].map(([v,l]) => (
            <div key={l}>
              <p style={{ margin: 0, color: "rgba(212,224,245,0.28)", fontSize: 8, letterSpacing: "0.26em", textTransform: "uppercase" }}>{l}</p>
              <p style={{ margin: "4px 0 0", color: "#D4E0F5", fontSize: 18, fontWeight: 700 }}>{v}</p>
            </div>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: 14 }}>
            <span style={{ border: "1px solid rgba(212,224,245,0.2)", color: "rgba(212,224,245,0.65)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", padding: "10px 24px" }}>Configure</span>
            <span style={{ background: "#D4E0F5", color: "#050508", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, padding: "10px 24px" }}>Reserve Now</span>
          </div>
        </div>
      </div>
    </div>
  );
}
