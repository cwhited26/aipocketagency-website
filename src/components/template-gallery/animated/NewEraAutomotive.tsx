"use client";

// NewEraAutomotive: R3F cinematic Porsche-style sports car with studio lighting.
// Replaces canvas bezier silhouette. Matches motionsites orange-car studio-lit bar.
// Palette: #050508 / #E87020 (orange) / #D4E0F5 (headlight) / #808090 (chrome)

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const W = 1440;
const H = 900;

// ─── Shared materials ────────────────────────────────────────────────────────

function useCarMaterials(bodyColor: THREE.Color) {
  const body = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: bodyColor,
        specular: new THREE.Color(1, 0.9, 0.8),
        shininess: 180,
        emissive: bodyColor.clone().multiplyScalar(0.06),
      }),
    [bodyColor],
  );

  const chrome = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: new THREE.Color(0.78, 0.8, 0.82),
        specular: new THREE.Color(1, 1, 1),
        shininess: 220,
      }),
    [],
  );

  const glass = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: new THREE.Color(0.08, 0.1, 0.14),
        specular: new THREE.Color(0.8, 0.85, 0.9),
        shininess: 200,
        transparent: true,
        opacity: 0.75,
      }),
    [],
  );

  const rubber = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: new THREE.Color(0.08, 0.08, 0.1),
        shininess: 10,
      }),
    [],
  );

  const rim = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: new THREE.Color(0.65, 0.66, 0.68),
        specular: new THREE.Color(1, 1, 1),
        shininess: 200,
      }),
    [],
  );

  const undercarriage = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: new THREE.Color(0.12, 0.12, 0.16),
        shininess: 20,
      }),
    [],
  );

  return { body, chrome, glass, rubber, rim, undercarriage };
}

// ─── Wheel ────────────────────────────────────────────────────────────────────

function Wheel({
  position,
  rubberMat,
  rimMat,
}: {
  position: [number, number, number];
  rubberMat: THREE.Material;
  rimMat: THREE.Material;
}) {
  const wheelRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (wheelRef.current) {
      // Rolling rotation: car moves ~0 so just decorative spin
      wheelRef.current.rotation.x = clock.elapsedTime * 0.8;
    }
  });

  return (
    <group position={position} rotation={[0, 0, Math.PI / 2]}>
      {/* Tyre */}
      <mesh geometry={new THREE.TorusGeometry(0.42, 0.16, 16, 36)}>
        <primitive object={rubberMat} attach="material" />
      </mesh>
      {/* Rim disc */}
      <mesh geometry={new THREE.CylinderGeometry(0.38, 0.38, 0.08, 24)} position={[0, 0, 0]}>
        <primitive object={rimMat} attach="material" />
      </mesh>
      <group ref={wheelRef}>
        {/* 5 spokes */}
        {[0, 72, 144, 216, 288].map((deg, i) => (
          <mesh
            key={i}
            geometry={new THREE.BoxGeometry(0.07, 0.62, 0.05)}
            position={[0, 0, 0.01]}
            rotation={[0, 0, (deg * Math.PI) / 180]}
          >
            <primitive object={rimMat} attach="material" />
          </mesh>
        ))}
        {/* Center hub */}
        <mesh geometry={new THREE.CylinderGeometry(0.075, 0.075, 0.12, 10)}>
          <primitive object={rimMat} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

// ─── Car body ────────────────────────────────────────────────────────────────

function Car() {
  const groupRef = useRef<THREE.Group>(null);
  const orange = useMemo(() => new THREE.Color(0.9, 0.42, 0.06), []);
  const { body, chrome, glass, rubber, rim, undercarriage } = useCarMaterials(orange);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    // Slow cinematic Y-rotate
    groupRef.current.rotation.y = -0.25 + Math.sin(t * 0.18) * 0.12;
    groupRef.current.position.y = Math.sin(t * 0.35) * 0.025;
  });

  return (
    <group ref={groupRef} position={[0, -0.18, 0]}>
      {/* ── Lower body / sill ── */}
      <mesh geometry={new THREE.BoxGeometry(4.5, 0.28, 1.82)}>
        <primitive object={body} attach="material" />
      </mesh>

      {/* ── Front bumper / spoiler ── */}
      <mesh geometry={new THREE.BoxGeometry(0.18, 0.22, 1.72)} position={[2.24, -0.04, 0]}>
        <primitive object={body} attach="material" />
      </mesh>

      {/* ── Front hood (tapered) ── */}
      <mesh
        geometry={new THREE.BoxGeometry(1.6, 0.16, 1.78)}
        position={[1.45, 0.28, 0]}
        rotation={[0.1, 0, 0]}
      >
        <primitive object={body} attach="material" />
      </mesh>

      {/* ── Roof / greenhouse ── */}
      <group position={[-0.3, 0.54, 0]}>
        {/* Windshield frame */}
        <mesh geometry={new THREE.BoxGeometry(0.06, 0.62, 1.6)} position={[0.9, 0.08, 0]}>
          <primitive object={chrome} attach="material" />
        </mesh>
        {/* Roof panel */}
        <mesh geometry={new THREE.BoxGeometry(1.5, 0.1, 1.65)}>
          <primitive object={body} attach="material" />
        </mesh>
        {/* Rear screen frame */}
        <mesh geometry={new THREE.BoxGeometry(0.06, 0.5, 1.6)} position={[-0.75, 0.06, 0]}>
          <primitive object={chrome} attach="material" />
        </mesh>
        {/* Windshield glass */}
        <mesh geometry={new THREE.BoxGeometry(0.05, 0.6, 1.55)} position={[0.88, 0.08, 0]}>
          <primitive object={glass} attach="material" />
        </mesh>
        {/* Rear glass */}
        <mesh geometry={new THREE.BoxGeometry(0.05, 0.48, 1.55)} position={[-0.73, 0.06, 0]}>
          <primitive object={glass} attach="material" />
        </mesh>
        {/* Side windows */}
        <mesh geometry={new THREE.BoxGeometry(1.55, 0.4, 0.04)} position={[0.1, 0.05, 0.81]}>
          <primitive object={glass} attach="material" />
        </mesh>
        <mesh geometry={new THREE.BoxGeometry(1.55, 0.4, 0.04)} position={[0.1, 0.05, -0.81]}>
          <primitive object={glass} attach="material" />
        </mesh>
      </group>

      {/* ── Rear deck / spoiler ── */}
      <mesh geometry={new THREE.BoxGeometry(1.2, 0.24, 1.86)} position={[-1.55, 0.28, 0]}>
        <primitive object={body} attach="material" />
      </mesh>
      {/* Rear wing */}
      <mesh geometry={new THREE.BoxGeometry(0.72, 0.06, 2.1)} position={[-1.85, 0.62, 0]}>
        <primitive object={chrome} attach="material" />
      </mesh>
      {/* Rear wing pillars */}
      <mesh geometry={new THREE.BoxGeometry(0.06, 0.34, 0.06)} position={[-1.85, 0.46, 0.85]}>
        <primitive object={chrome} attach="material" />
      </mesh>
      <mesh geometry={new THREE.BoxGeometry(0.06, 0.34, 0.06)} position={[-1.85, 0.46, -0.85]}>
        <primitive object={chrome} attach="material" />
      </mesh>

      {/* ── Rear bumper ── */}
      <mesh geometry={new THREE.BoxGeometry(0.22, 0.22, 1.78)} position={[-2.26, -0.04, 0]}>
        <primitive object={undercarriage} attach="material" />
      </mesh>

      {/* ── Side skirts ── */}
      <mesh geometry={new THREE.BoxGeometry(3.6, 0.12, 0.08)} position={[0, -0.08, 0.94]}>
        <primitive object={body} attach="material" />
      </mesh>
      <mesh geometry={new THREE.BoxGeometry(3.6, 0.12, 0.08)} position={[0, -0.08, -0.94]}>
        <primitive object={body} attach="material" />
      </mesh>

      {/* ── Door lines (chrome trim) ── */}
      <mesh geometry={new THREE.BoxGeometry(1.8, 0.02, 0.06)} position={[0.0, 0.18, 0.92]}>
        <primitive object={chrome} attach="material" />
      </mesh>
      <mesh geometry={new THREE.BoxGeometry(1.8, 0.02, 0.06)} position={[0.0, 0.18, -0.92]}>
        <primitive object={chrome} attach="material" />
      </mesh>

      {/* ── Headlights ── */}
      <group position={[2.1, 0.08, 0.65]}>
        <mesh geometry={new THREE.BoxGeometry(0.1, 0.12, 0.35)}>
          <meshBasicMaterial color="#EAF2FF" />
        </mesh>
        <pointLight color="#CCDCFF" intensity={2.5} distance={4} />
      </group>
      <group position={[2.1, 0.08, -0.65]}>
        <mesh geometry={new THREE.BoxGeometry(0.1, 0.12, 0.35)}>
          <meshBasicMaterial color="#EAF2FF" />
        </mesh>
        <pointLight color="#CCDCFF" intensity={2.5} distance={4} />
      </group>

      {/* ── Tail lights ── */}
      <group position={[-2.15, 0.06, 0.6]}>
        <mesh geometry={new THREE.BoxGeometry(0.08, 0.1, 0.32)}>
          <meshBasicMaterial color="#FF2200" />
        </mesh>
        <pointLight color="#FF2200" intensity={0.8} distance={2.5} />
      </group>
      <group position={[-2.15, 0.06, -0.6]}>
        <mesh geometry={new THREE.BoxGeometry(0.08, 0.1, 0.32)}>
          <meshBasicMaterial color="#FF2200" />
        </mesh>
        <pointLight color="#FF2200" intensity={0.8} distance={2.5} />
      </group>

      {/* ── Wheels ── */}
      <Wheel position={[1.35, -0.35, 1.02]} rubberMat={rubber} rimMat={rim} />
      <Wheel position={[1.35, -0.35, -1.02]} rubberMat={rubber} rimMat={rim} />
      <Wheel position={[-1.25, -0.35, 1.02]} rubberMat={rubber} rimMat={rim} />
      <Wheel position={[-1.25, -0.35, -1.02]} rubberMat={rubber} rimMat={rim} />
    </group>
  );
}

// ─── Studio floor ─────────────────────────────────────────────────────────────

function StudioFloor() {
  const mat = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: new THREE.Color(0.06, 0.05, 0.07),
        specular: new THREE.Color(0.4, 0.35, 0.3),
        shininess: 120,
      }),
    [],
  );
  return (
    <mesh geometry={new THREE.PlaneGeometry(40, 40)} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.63, 0]}>
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

// ─── Scene ───────────────────────────────────────────────────────────────────

function Scene() {
  return (
    <>
      {/* Key light — warm orange from upper-right */}
      <directionalLight color="#FF9040" intensity={4.5} position={[8, 7, 3]} />
      {/* Fill — cool blue-white from left */}
      <directionalLight color="#A0C0E0" intensity={1.4} position={[-7, 4, -2]} />
      {/* Rim / backlight — strong warm from behind-right */}
      <directionalLight color="#FFB060" intensity={2.8} position={[3, 3, -8]} />
      {/* Top overhead */}
      <directionalLight color="#FFF0E0" intensity={1.0} position={[0, 10, 0]} />
      {/* Ambient */}
      <ambientLight color="#1A0C08" intensity={1.5} />

      {/* Studio floor */}
      <StudioFloor />

      {/* Car */}
      <Car />

      {/* Floor reflection highlight strip */}
      <pointLight color="#E07820" intensity={1.2} distance={8} position={[0, -0.6, 0]} />
    </>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function NewEraAutomotive({ isVisible }: { isVisible: boolean }) {
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      style={{
        width: W,
        height: H,
        background: "#050508",
        position: "relative",
        overflow: "hidden",
        userSelect: "none",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* 3D Canvas */}
      <Canvas
        style={{ position: "absolute", inset: 0 }}
        camera={{ position: [5.5, 1.8, 8], fov: 38, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: false }}
        frameloop={isVisible && !prefersReduced ? "always" : "demand"}
        dpr={[1, 1.5]}
      >
        <Scene />
      </Canvas>

      {/* Gradient vignette — bottom and sides */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to top, rgba(5,5,8,0.85) 0%, transparent 45%), linear-gradient(to right, rgba(5,5,8,0.55) 0%, transparent 30%, transparent 70%, rgba(5,5,8,0.55) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── UI Overlay ── */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {/* Top branding */}
        <div style={{ position: "absolute", top: 52, left: 72 }}>
          <p
            style={{
              margin: "0 0 10px",
              color: "rgba(212,224,245,0.3)",
              fontSize: 9,
              letterSpacing: "0.38em",
              textTransform: "uppercase",
            }}
          >
            New Era
          </p>
          <h2
            style={{
              margin: 0,
              color: "#D4E0F5",
              fontSize: 52,
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
            }}
          >
            Automotive
          </h2>
          <p
            style={{
              margin: "12px 0 0",
              color: "rgba(212,224,245,0.4)",
              fontSize: 12,
              letterSpacing: "0.12em",
            }}
          >
            Precision. Form. Motion.
          </p>
        </div>
        <div style={{ position: "absolute", top: 52, right: 72, textAlign: "right" }}>
          <p
            style={{
              margin: 0,
              color: "rgba(212,224,245,0.2)",
              fontSize: 8,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
            }}
          >
            Model Year
          </p>
          <p
            style={{
              margin: "4px 0 0",
              color: "rgba(212,224,245,0.45)",
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: "0.04em",
            }}
          >
            2026
          </p>
        </div>

        {/* Bottom stats */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            borderTop: "1px solid rgba(212,224,245,0.07)",
            background: "rgba(5,5,8,0.88)",
            display: "flex",
            alignItems: "center",
            padding: "18px 72px",
            gap: 52,
          }}
        >
          {[
            ["680 hp", "Output"],
            ["2.9 s", "0–60 mph"],
            ["210 mph", "Top Speed"],
            ["AWD", "Drivetrain"],
          ].map(([v, l]) => (
            <div key={l}>
              <p
                style={{
                  margin: 0,
                  color: "rgba(212,224,245,0.28)",
                  fontSize: 8,
                  letterSpacing: "0.26em",
                  textTransform: "uppercase",
                }}
              >
                {l}
              </p>
              <p style={{ margin: "4px 0 0", color: "#D4E0F5", fontSize: 18, fontWeight: 700 }}>{v}</p>
            </div>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: 14 }}>
            <span
              style={{
                border: "1px solid rgba(212,224,245,0.2)",
                color: "rgba(212,224,245,0.65)",
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                padding: "10px 24px",
              }}
            >
              Configure
            </span>
            <span
              style={{
                background: "#D4E0F5",
                color: "#050508",
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                fontWeight: 700,
                padding: "10px 24px",
              }}
            >
              Reserve Now
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
