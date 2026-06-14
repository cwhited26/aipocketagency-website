"use client";

// NovaSpaceSystems: R3F cinematic spacecraft in orbit above a photorealistic planet.
// Replaces canvas circles. Matches motionsites "ROCKETS / ROCKET SCIENCE" bar.
// Palette: #000005 / #A0B0C8 / #C8B89A / warm planet tones

import { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";

const W = 1440;
const H = 900;

// ─── Earth-like planet ───────────────────────────────────────────────────────

function Planet() {
  const meshRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);

  const planetMat = useMemo(() => {
    const mat = new THREE.MeshPhongMaterial({
      color: new THREE.Color(0.15, 0.32, 0.58),
      specular: new THREE.Color(0.3, 0.4, 0.6),
      shininess: 40,
      emissive: new THREE.Color(0.02, 0.06, 0.12),
    });
    return mat;
  }, []);

  // Cloud layer
  const cloudMat = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: new THREE.Color(0.88, 0.9, 0.95),
        transparent: true,
        opacity: 0.28,
        emissive: new THREE.Color(0.05, 0.06, 0.08),
      }),
    [],
  );

  // Atmosphere glow
  const atmMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.18, 0.45, 0.85),
        transparent: true,
        opacity: 0.18,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  useFrame(({ clock }) => {
    if (meshRef.current) meshRef.current.rotation.y = clock.elapsedTime * 0.04;
    if (atmosphereRef.current) atmosphereRef.current.rotation.y = clock.elapsedTime * 0.018;
  });

  return (
    <group position={[1.5, -3.8, -8]}>
      {/* Core planet */}
      <mesh ref={meshRef} geometry={new THREE.SphereGeometry(7.5, 64, 48)}>
        <primitive object={planetMat} attach="material" />
      </mesh>
      {/* Cloud wisps */}
      <mesh ref={atmosphereRef} geometry={new THREE.SphereGeometry(7.55, 32, 24)}>
        <primitive object={cloudMat} attach="material" />
      </mesh>
      {/* Atmosphere rim */}
      <mesh geometry={new THREE.SphereGeometry(8.1, 32, 24)}>
        <primitive object={atmMat} attach="material" />
      </mesh>
    </group>
  );
}

// ─── Solar panel ─────────────────────────────────────────────────────────────

function SolarPanel({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
  const panelMat = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: new THREE.Color(0.08, 0.12, 0.45),
        specular: new THREE.Color(0.3, 0.4, 0.8),
        shininess: 80,
        emissive: new THREE.Color(0.01, 0.02, 0.06),
      }),
    [],
  );
  const frameMat = useMemo(
    () => new THREE.MeshPhongMaterial({ color: new THREE.Color(0.7, 0.72, 0.75), shininess: 120 }),
    [],
  );

  return (
    <group position={position} rotation={rotation}>
      {/* Panel surface */}
      <mesh geometry={new THREE.BoxGeometry(2.8, 0.04, 1.1)}>
        <primitive object={panelMat} attach="material" />
      </mesh>
      {/* Frame */}
      <mesh geometry={new THREE.BoxGeometry(2.82, 0.06, 0.06)} position={[0, 0, 0.52]}>
        <primitive object={frameMat} attach="material" />
      </mesh>
      <mesh geometry={new THREE.BoxGeometry(2.82, 0.06, 0.06)} position={[0, 0, -0.52]}>
        <primitive object={frameMat} attach="material" />
      </mesh>
      {/* Cell dividers */}
      {[-1.05, -0.35, 0.35, 1.05].map((x, i) => (
        <mesh key={i} geometry={new THREE.BoxGeometry(0.03, 0.05, 1.1)} position={[x, 0, 0]}>
          <primitive object={frameMat} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

// ─── Spacecraft ───────────────────────────────────────────────────────────────

function Spacecraft() {
  const groupRef = useRef<THREE.Group>(null);

  const capsuleMat = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: new THREE.Color(0.82, 0.84, 0.88),
        specular: new THREE.Color(0.6, 0.6, 0.65),
        shininess: 100,
        emissive: new THREE.Color(0.04, 0.04, 0.06),
      }),
    [],
  );

  const serviceMat = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: new THREE.Color(0.55, 0.58, 0.64),
        specular: new THREE.Color(0.4, 0.4, 0.45),
        shininess: 70,
      }),
    [],
  );

  const thrusterMat = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: new THREE.Color(0.65, 0.62, 0.55),
        emissive: new THREE.Color(0.04, 0.04, 0.02),
        shininess: 60,
      }),
    [],
  );

  // Connection boom geometry
  const boomGeo = useMemo(() => new THREE.CylinderGeometry(0.045, 0.045, 3.2, 8), []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    // Slow drift
    groupRef.current.rotation.y = t * 0.035;
    groupRef.current.position.y = Math.sin(t * 0.22) * 0.12;
  });

  return (
    <group ref={groupRef} position={[0, 0.5, 0]} rotation={[0.1, 0.3, 0.08]}>
      {/* === Crew capsule (top) === */}
      <group position={[0, 1.6, 0]}>
        {/* Capsule body */}
        <mesh geometry={new THREE.CylinderGeometry(0.55, 0.62, 1.4, 16)}>
          <primitive object={capsuleMat} attach="material" />
        </mesh>
        {/* Capsule nose cone */}
        <mesh geometry={new THREE.ConeGeometry(0.55, 0.6, 16)} position={[0, 1.0, 0]}>
          <primitive object={capsuleMat} attach="material" />
        </mesh>
        {/* Heat shield (bottom of capsule) */}
        <mesh geometry={new THREE.CylinderGeometry(0.65, 0.6, 0.15, 16)} position={[0, -0.77, 0]}>
          <primitive object={new THREE.MeshPhongMaterial({ color: 0x2a2218, shininess: 20 })} attach="material" />
        </mesh>
        {/* RCS thrusters around capsule */}
        {[0, 90, 180, 270].map((deg, i) => (
          <mesh
            key={i}
            geometry={new THREE.CylinderGeometry(0.045, 0.06, 0.2, 6)}
            position={[
              Math.sin((deg * Math.PI) / 180) * 0.62,
              -0.45,
              Math.cos((deg * Math.PI) / 180) * 0.62,
            ]}
            rotation={[Math.PI / 2, 0, (deg * Math.PI) / 180]}
          >
            <primitive object={thrusterMat} attach="material" />
          </mesh>
        ))}
      </group>

      {/* === Service module (middle) === */}
      <group position={[0, -0.2, 0]}>
        <mesh geometry={new THREE.CylinderGeometry(0.62, 0.62, 1.6, 16)}>
          <primitive object={serviceMat} attach="material" />
        </mesh>
        {/* Radiator panels */}
        <mesh geometry={new THREE.BoxGeometry(0.08, 1.5, 0.7)} position={[0.65, 0, 0.25]}>
          <primitive object={new THREE.MeshPhongMaterial({ color: 0xf0f0ee, shininess: 40 })} attach="material" />
        </mesh>
        <mesh geometry={new THREE.BoxGeometry(0.08, 1.5, 0.7)} position={[-0.65, 0, 0.25]}>
          <primitive object={new THREE.MeshPhongMaterial({ color: 0xf0f0ee, shininess: 40 })} attach="material" />
        </mesh>
      </group>

      {/* === Propulsion / adaptor (bottom) === */}
      <group position={[0, -1.7, 0]}>
        <mesh geometry={new THREE.CylinderGeometry(0.62, 0.72, 1.0, 16)}>
          <primitive object={serviceMat} attach="material" />
        </mesh>
        {/* Main engine nozzle */}
        <mesh geometry={new THREE.CylinderGeometry(0.28, 0.44, 0.5, 12)} position={[0, -0.75, 0]}>
          <primitive object={thrusterMat} attach="material" />
        </mesh>
        {/* Engine glow */}
        <pointLight color="#80C0FF" intensity={0.6} distance={3} position={[0, -1.2, 0]} />
      </group>

      {/* === Solar panel booms === */}
      {/* Left boom */}
      <mesh geometry={boomGeo} position={[-2.2, -0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <primitive object={new THREE.MeshPhongMaterial({ color: 0x888890, shininess: 80 })} attach="material" />
      </mesh>
      {/* Right boom */}
      <mesh geometry={boomGeo} position={[2.2, -0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <primitive object={new THREE.MeshPhongMaterial({ color: 0x888890, shininess: 80 })} attach="material" />
      </mesh>

      {/* === Solar panels === */}
      <SolarPanel position={[-3.8, -0.2, 0]} rotation={[0, 0, 0]} />
      <SolarPanel position={[3.8, -0.2, 0]} rotation={[0, 0, 0]} />
    </group>
  );
}

// ─── Scene ───────────────────────────────────────────────────────────────────

function Scene() {
  return (
    <>
      {/* Sun direction light — harsh space lighting */}
      <directionalLight
        color="#FFF8E8"
        intensity={3.5}
        position={[-12, 8, 6]}
        castShadow={false}
      />
      {/* Soft fill from Earth albedo */}
      <directionalLight color="#4080C0" intensity={0.5} position={[4, -5, 3]} />
      {/* Deep space ambient */}
      <ambientLight color="#08101A" intensity={1} />

      {/* Stars */}
      <Stars radius={100} depth={50} count={8000} factor={5} saturation={0.4} fade speed={0.3} />

      {/* Planet */}
      <Planet />

      {/* Spacecraft */}
      <Spacecraft />
    </>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function NovaSpaceSystems({ isVisible }: { isVisible: boolean }) {
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      style={{
        width: W,
        height: H,
        background: "#000005",
        position: "relative",
        overflow: "hidden",
        userSelect: "none",
        fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
      }}
    >
      {/* 3D Canvas */}
      <Canvas
        style={{ position: "absolute", inset: 0 }}
        camera={{ position: [0, 2, 12], fov: 44, near: 0.1, far: 300 }}
        gl={{ antialias: true, alpha: false }}
        frameloop={isVisible && !prefersReduced ? "always" : "demand"}
        dpr={[1, 1.5]}
      >
        <Scene />
      </Canvas>

      {/* ── UI Overlay ── */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {/* Navbar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 64,
            borderBottom: "1px solid rgba(160,176,200,0.2)",
            display: "flex",
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              paddingLeft: 40,
              gap: 0,
              borderRight: "1px solid rgba(160,176,200,0.18)",
            }}
          >
            {["Programs", "Systems", "Discover"].map((label, i) => (
              <div key={label} style={{ display: "flex", alignItems: "center" }}>
                {i > 0 && (
                  <div
                    style={{
                      width: 1,
                      height: 32,
                      background: "rgba(160,176,200,0.18)",
                      margin: "0 4px",
                    }}
                  />
                )}
                <span
                  style={{
                    color: "rgba(255,255,255,0.65)",
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    padding: "0 16px",
                  }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              borderRight: "1px solid rgba(160,176,200,0.18)",
            }}
          >
            <span
              style={{
                color: "#FFFFFF",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
              }}
            >
              NOVA
            </span>
            <div style={{ display: "flex", gap: 12, width: "80%" }}>
              <div style={{ flex: 1, height: 1, background: "rgba(160,176,200,0.2)" }} />
              <div style={{ flex: 1, height: 1, background: "rgba(160,176,200,0.2)" }} />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              paddingRight: 40,
              gap: 16,
            }}
          >
            <span
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Search
            </span>
            <div style={{ width: 1, height: 28, margin: "0 8px", background: "rgba(160,176,200,0.18)" }} />
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="4.5" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" />
              <line x1="9.5" y1="9.5" x2="14" y2="14" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" />
            </svg>
          </div>
        </div>

        {/* Hero text — bottom left */}
        <div style={{ position: "absolute", left: 48, bottom: 108 }}>
          <h1
            style={{
              margin: 0,
              color: "#FFFFFF",
              fontSize: 130,
              fontWeight: 900,
              lineHeight: 0.84,
              letterSpacing: "-0.03em",
              textTransform: "uppercase",
              textShadow: "0 2px 40px rgba(0,0,0,0.7)",
            }}
          >
            ROCKETS
          </h1>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
            <div style={{ maxWidth: 440, textAlign: "right" }}>
              <p style={{ color: "rgba(255,255,255,0.72)", fontSize: 14, lineHeight: 1.6, margin: "0 0 20px" }}>
                From precise orbital insertions to deep-space trajectories, NOVA&apos;s launch
                systems deliver unmatched performance and dependability.
              </p>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0,
                  background: "#FFFFFF",
                  color: "#000000",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                <span style={{ padding: "12px 20px" }}>View Our Fleet</span>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    background: "#000000",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 11L11 3M11 3H5M11 3V9" stroke="#FFFFFF" strokeWidth="1.5" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            borderTop: "1px solid rgba(160,176,200,0.15)",
            display: "flex",
            padding: "14px 48px",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(0,0,5,0.7)",
          }}
        >
          <span
            style={{
              color: "rgba(255,255,255,0.3)",
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}
          >
            Nova Space Systems
          </span>
          <span
            style={{
              color: "rgba(255,255,255,0.3)",
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}
          >
            Aerospace Engineering Division
          </span>
        </div>
      </div>
    </div>
  );
}
