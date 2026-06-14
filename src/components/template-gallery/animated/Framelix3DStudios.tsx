"use client";

// Framelix3D Studios: bioluminescent dragonfly creatures — R3F cinematic 3D scene.
// Replaces CSS film-frame carousel. Matches motionsites "Cinematic Motion Studios" bar.
// Palette: #06010E (near-black) / #7B5CF0 (violet) / #B3A0FF (ice-violet) / #C8A96E (gold accent)

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";

const W = 1440;
const H = 900;

// ─── Dragonfly wing shape ────────────────────────────────────────────────────

function makeWingShape(flip: number, scale: number): THREE.Shape {
  const s = scale * flip;
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.bezierCurveTo(s * 0.3, 0.12 * scale, s * 1.6, 0.38 * scale, s * 2.8, 0.1 * scale);
  sh.bezierCurveTo(s * 3.5, -0.05 * scale, s * 3.3, -0.5 * scale, s * 2.2, -0.58 * scale);
  sh.bezierCurveTo(s * 1.2, -0.66 * scale, s * 0.5, -0.32 * scale, 0, 0);
  return sh;
}

function makeLowerWingShape(flip: number, scale: number): THREE.Shape {
  const s = scale * flip;
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.bezierCurveTo(s * 0.4, 0.22 * scale, s * 1.5, 0.5 * scale, s * 2.4, 0.18 * scale);
  sh.bezierCurveTo(s * 2.9, 0, s * 2.7, -0.52 * scale, s * 1.8, -0.62 * scale);
  sh.bezierCurveTo(s * 0.9, -0.72 * scale, s * 0.35, -0.38 * scale, 0, 0);
  return sh;
}

// ─── Dragonfly mesh ──────────────────────────────────────────────────────────

function Dragonfly({
  position = [0, 0, 0] as [number, number, number],
  scale = 1,
  opacity = 1,
  phaseOffset = 0,
}: {
  position?: [number, number, number];
  scale?: number;
  opacity?: number;
  phaseOffset?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  const wingMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.42, 0.28, 1.0),
        transparent: true,
        opacity: opacity * 0.6,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [opacity],
  );

  const wingGlowMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.7, 0.62, 1.0),
        transparent: true,
        opacity: opacity * 0.18,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [opacity],
  );

  const bodyMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.58, 0.46, 1.0),
        transparent: true,
        opacity: opacity * 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [opacity],
  );

  // Geometries
  const upperWingGeoL = useMemo(() => new THREE.ShapeGeometry(makeWingShape(-1, 1), 16), []);
  const upperWingGeoR = useMemo(() => new THREE.ShapeGeometry(makeWingShape(1, 1), 16), []);
  const lowerWingGeoL = useMemo(() => new THREE.ShapeGeometry(makeLowerWingShape(-1, 1), 16), []);
  const lowerWingGeoR = useMemo(() => new THREE.ShapeGeometry(makeLowerWingShape(1, 1), 16), []);

  const bodyGeo = useMemo(() => new THREE.CylinderGeometry(0.07, 0.035, 2.6, 8), []);
  const headGeo = useMemo(() => new THREE.SphereGeometry(0.12, 8, 6), []);
  const tailGeo = useMemo(() => new THREE.CylinderGeometry(0.035, 0.015, 0.9, 6), []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime + phaseOffset;
    groupRef.current.position.y = position[1] + Math.sin(t * 0.55) * 0.22;
    groupRef.current.rotation.y = Math.sin(t * 0.28) * 0.06;
    groupRef.current.rotation.z = Math.sin(t * 0.38) * 0.04;
  });

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* Body */}
      <mesh geometry={bodyGeo} material={bodyMat} rotation={[0, 0, 0]} />
      {/* Head */}
      <mesh geometry={headGeo} material={bodyMat} position={[0, 1.42, 0]} />
      {/* Tail segment */}
      <mesh geometry={tailGeo} material={bodyMat} position={[0, -1.72, 0]} />

      {/* Upper wings at thorax */}
      <group position={[0, 0.55, 0]} rotation={[0.18, 0, 0]}>
        <mesh geometry={upperWingGeoL} material={wingMat} rotation={[0, 0, 0.28]} />
        <mesh geometry={upperWingGeoR} material={wingMat} rotation={[0, 0, -0.28]} />
        {/* Glow halos */}
        <mesh geometry={upperWingGeoL} material={wingGlowMat} rotation={[0, 0, 0.28]} scale={1.18} />
        <mesh geometry={upperWingGeoR} material={wingGlowMat} rotation={[0, 0, -0.28]} scale={1.18} />
      </group>

      {/* Lower wings slightly below */}
      <group position={[0, 0.08, 0]} rotation={[0.22, 0, 0]}>
        <mesh geometry={lowerWingGeoL} material={wingMat} rotation={[0, 0, 0.22]} />
        <mesh geometry={lowerWingGeoR} material={wingMat} rotation={[0, 0, -0.22]} />
        <mesh geometry={lowerWingGeoL} material={wingGlowMat} rotation={[0, 0, 0.22]} scale={1.15} />
        <mesh geometry={lowerWingGeoR} material={wingGlowMat} rotation={[0, 0, -0.22]} scale={1.15} />
      </group>

      {/* Creature glow */}
      <pointLight color="#6B3FE0" intensity={opacity * 4} distance={8} decay={2} />
      <pointLight color="#A080FF" intensity={opacity * 1.5} distance={4} decay={2} />
    </group>
  );
}

// ─── Scene ───────────────────────────────────────────────────────────────────

function Scene() {
  return (
    <>
      <ambientLight color="#0D0520" intensity={1.5} />

      {/* Cosmic fog lights */}
      <pointLight color="#3B18A8" intensity={3} distance={30} position={[0, 6, 4]} />
      <pointLight color="#5030B0" intensity={1.8} distance={20} position={[-10, -4, 2]} />
      <pointLight color="#7040C0" intensity={1.2} distance={18} position={[10, 3, -2]} />

      {/* Stars */}
      <Stars radius={90} depth={60} count={5000} factor={4} saturation={0.8} fade speed={0.4} />

      {/* Center dragonfly — hero */}
      <Dragonfly position={[0, 0.2, 0]} scale={1.55} opacity={1} phaseOffset={0} />

      {/* Left flank */}
      <Dragonfly position={[-6.8, 1.2, -4]} scale={0.72} opacity={0.52} phaseOffset={1.4} />

      {/* Right flank */}
      <Dragonfly position={[6.2, -0.6, -4.5]} scale={0.62} opacity={0.42} phaseOffset={2.9} />
    </>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function Framelix3DStudios({ isVisible }: { isVisible: boolean }) {
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      style={{
        width: W,
        height: H,
        background: "#06010E",
        position: "relative",
        overflow: "hidden",
        userSelect: "none",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* 3D Canvas */}
      <Canvas
        style={{ position: "absolute", inset: 0 }}
        camera={{ position: [0, 2.5, 9], fov: 48, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: false }}
        frameloop={isVisible && !prefersReduced ? "always" : "demand"}
        dpr={[1, 1.5]}
      >
        <Scene />
      </Canvas>

      {/* Gradient vignette overlay */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(6,1,14,0.72) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── UI Overlay ── */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {/* Nav */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "28px 56px",
          }}
        >
          <div>
            <div
              style={{
                color: "#F5F2ED",
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              FRAMELIX
            </div>
            <div
              style={{
                color: "rgba(179,160,255,0.75)",
                fontSize: 9,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                marginTop: 2,
              }}
            >
              3D Studios
            </div>
          </div>
          <div style={{ display: "flex", gap: 36 }}>
            {["Reels", "Services", "Projects", "Pipeline", "Careers", "Get In Touch"].map((t) => (
              <span
                key={t}
                style={{
                  color: "rgba(245,242,237,0.42)",
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Center hero text — bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "0 56px 48px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            background: "linear-gradient(to top, rgba(6,1,14,0.88) 0%, transparent 100%)",
          }}
        >
          <div>
            <div
              style={{
                color: "rgba(179,160,255,0.6)",
                fontSize: 10,
                letterSpacing: "0.32em",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              Award-Winning Visual Production
            </div>
            <h1
              style={{
                margin: 0,
                color: "#F5F2ED",
                fontSize: 64,
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: "-0.02em",
                textTransform: "uppercase",
              }}
            >
              Cinematic
              <br />
              <span style={{ color: "#B3A0FF" }}>Motion</span> Studios
            </h1>
            <div style={{ marginTop: 28, display: "flex", gap: 14, alignItems: "center" }}>
              <div
                style={{
                  border: "1px solid rgba(179,160,255,0.6)",
                  color: "#B3A0FF",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  padding: "12px 28px",
                }}
              >
                Explore Reel
              </div>
              <span
                style={{
                  color: "rgba(245,242,237,0.28)",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                }}
              >
                Ready in 24–48 hours
              </span>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            {[
              ["Film Production", "Cinematic VFX"],
              ["3D Animation", "Motion Design"],
              ["Color Grading", "Post Production"],
            ].map(([cat, sub]) => (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div
                  style={{
                    color: "rgba(179,160,255,0.7)",
                    fontSize: 10,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  {cat}
                </div>
                <div
                  style={{
                    color: "rgba(245,242,237,0.32)",
                    fontSize: 9,
                    letterSpacing: "0.08em",
                  }}
                >
                  {sub}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
