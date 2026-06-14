"use client";

// AutomationMachines: R3F precision KUKA-style 6-axis robot arm in industrial studio.
// Replaces canvas line-segment arm. Palette: #0A0F1A / #F0A500 (amber) / #3A8EBA (steel blue)

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const W = 1440;
const H = 900;

// ─── Material helpers ────────────────────────────────────────────────────────

function steelMat(hex: number, roughness = 0.35, metalness = 0.85) {
  return new THREE.MeshPhongMaterial({
    color: new THREE.Color(hex),
    specular: new THREE.Color(0x667788),
    shininess: 80 * (1 - roughness),
    emissive: new THREE.Color(0x000000),
  });
}

// ─── Arm segment component ───────────────────────────────────────────────────

function ArmLink({
  length,
  width,
  color,
  children,
}: {
  length: number;
  width: number;
  color: number;
  children?: React.ReactNode;
}) {
  const mat = useMemo(() => steelMat(color), [color]);
  const geo = useMemo(() => new THREE.BoxGeometry(width, length, width * 0.75), [width, length]);
  const jointGeo = useMemo(() => new THREE.SphereGeometry(width * 0.56, 12, 8), [width]);
  const jointMat = useMemo(() => steelMat(0x334455, 0.2, 0.95), []);

  return (
    <group>
      <mesh geometry={geo} material={mat} position={[0, length / 2, 0]} />
      <mesh geometry={jointGeo} material={jointMat} position={[0, length, 0]} />
      <group position={[0, length, 0]}>{children}</group>
    </group>
  );
}

// ─── Robot arm ───────────────────────────────────────────────────────────────

function RobotArm() {
  const j1 = useRef<THREE.Group>(null);
  const j2 = useRef<THREE.Group>(null);
  const j3 = useRef<THREE.Group>(null);
  const j4 = useRef<THREE.Group>(null);
  const j5 = useRef<THREE.Group>(null);
  const gripperRef = useRef<THREE.Group>(null);

  const baseMat = useMemo(() => steelMat(0x1a2540, 0.5, 0.7), []);
  const baseGeo = useMemo(() => new THREE.CylinderGeometry(1.0, 1.2, 0.55, 16), []);
  const turretGeo = useMemo(() => new THREE.CylinderGeometry(0.65, 0.72, 0.8, 14), []);
  const turretMat = useMemo(() => steelMat(0x1e2e44, 0.4, 0.8), []);
  const gripFingerGeo = useMemo(() => new THREE.BoxGeometry(0.08, 0.38, 0.14), []);
  const gripMat = useMemo(() => steelMat(0xf0a500, 0.3, 0.6), []);
  const toolGeo = useMemo(() => new THREE.CylinderGeometry(0.05, 0.08, 0.55, 8), []);
  const toolMat = useMemo(() => steelMat(0x334455, 0.15, 0.95), []);
  const mountPlateGeo = useMemo(() => new THREE.BoxGeometry(0.22, 0.08, 0.22), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // J1: base rotation (slow yaw)
    if (j1.current) j1.current.rotation.y = Math.sin(t * 0.22) * 0.7;
    // J2: shoulder (main lift)
    if (j2.current) j2.current.rotation.z = -0.55 + Math.sin(t * 0.31 + 0.5) * 0.4;
    // J3: elbow
    if (j3.current) j3.current.rotation.z = 0.8 + Math.sin(t * 0.38 + 1.1) * 0.35;
    // J4: wrist roll
    if (j4.current) j4.current.rotation.x = t * 0.8;
    // J5: wrist pitch
    if (j5.current) j5.current.rotation.z = Math.sin(t * 0.55 + 2.2) * 0.4;
    // Gripper open/close
    if (gripperRef.current) {
      const openAmt = (Math.sin(t * 0.7) * 0.5 + 0.5) * 0.18;
      gripperRef.current.children.forEach((child, i) => {
        child.position.x = (i === 0 ? -1 : 1) * (0.12 + openAmt);
      });
    }
  });

  return (
    <group position={[0, -0.28, 0]}>
      {/* Floor mount */}
      <mesh geometry={baseGeo} material={baseMat} position={[0, 0.275, 0]} />

      {/* J1 — base yaw */}
      <group ref={j1} position={[0, 0.55, 0]}>
        <mesh geometry={turretGeo} material={turretMat} position={[0, 0.4, 0]} />

        {/* J2 — shoulder pitch */}
        <group ref={j2} position={[0, 0.8, 0]}>
          <ArmLink length={1.8} width={0.32} color={0x223355}>
            {/* J3 — elbow */}
            <group ref={j3}>
              <ArmLink length={1.4} width={0.26} color={0x1e2e44}>
                {/* J4 — forearm roll */}
                <group ref={j4}>
                  <ArmLink length={0.9} width={0.2} color={0x243344}>
                    {/* J5 — wrist pitch */}
                    <group ref={j5}>
                      {/* Tool mount plate */}
                      <mesh geometry={mountPlateGeo} material={turretMat} position={[0, 0.04, 0]} />
                      {/* Tool tip */}
                      <mesh geometry={toolGeo} material={toolMat} position={[0, 0.32, 0]} />
                      {/* Gripper fingers */}
                      <group ref={gripperRef} position={[0, 0.6, 0]}>
                        <mesh geometry={gripFingerGeo} material={gripMat} position={[-0.12, 0, 0]} />
                        <mesh geometry={gripFingerGeo} material={gripMat} position={[0.12, 0, 0]} />
                      </group>
                      {/* Gripper glow */}
                      <pointLight color="#F0A500" intensity={1.8} distance={2.2} decay={2} position={[0, 0.6, 0]} />
                    </group>
                  </ArmLink>
                </group>
              </ArmLink>
            </group>
          </ArmLink>
        </group>
      </group>
    </group>
  );
}

// ─── Work surface ────────────────────────────────────────────────────────────

function WorkCell() {
  const floorMat = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: new THREE.Color(0x0d1520),
        specular: new THREE.Color(0x223355),
        shininess: 40,
      }),
    [],
  );
  const floorGeo = useMemo(() => new THREE.PlaneGeometry(22, 22), []);

  const tableMat = useMemo(() => steelMat(0x1a2030, 0.6, 0.5), []);
  const tableTopGeo = useMemo(() => new THREE.BoxGeometry(3.2, 0.08, 2.2), []);
  const tableLegGeo = useMemo(() => new THREE.BoxGeometry(0.1, 0.9, 0.1), []);

  // Workpiece: small assembly parts on table
  const partGeo = useMemo(() => new THREE.BoxGeometry(0.22, 0.1, 0.22), []);
  const partMat = useMemo(() => steelMat(0x3a8eba, 0.2, 0.9), []);
  const partGlowRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (partGlowRef.current) {
      partGlowRef.current.intensity = 0.8 + Math.sin(clock.elapsedTime * 1.4) * 0.4;
    }
  });

  return (
    <>
      {/* Floor */}
      <mesh geometry={floorGeo} material={floorMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.28, 0]} />

      {/* Work table */}
      <group position={[2.4, -0.28, 0.2]}>
        <mesh geometry={tableTopGeo} material={tableMat} position={[0, 0.9, 0]} />
        {[[-1.4, 0, -0.95], [1.4, 0, -0.95], [-1.4, 0, 0.95], [1.4, 0, 0.95]].map(([x, y, z], i) => (
          <mesh key={i} geometry={tableLegGeo} material={tableMat} position={[x as number, y as number + 0.45, z as number]} />
        ))}
        {/* Parts on table */}
        {[[-0.6, 0, 0.3], [0, 0, -0.2], [0.6, 0, 0.2]].map(([x, y, z], i) => (
          <mesh key={i} geometry={partGeo} material={partMat} position={[x as number, y as number + 0.99, z as number]} />
        ))}
        <pointLight ref={partGlowRef} color="#3A8EBA" intensity={1.2} distance={3} decay={2} position={[0, 1.4, 0]} />
      </group>
    </>
  );
}

// ─── Scene ───────────────────────────────────────────────────────────────────

function Scene() {
  return (
    <>
      <ambientLight color="#08101A" intensity={2} />
      {/* Key light — warm amber overhead */}
      <directionalLight color="#F0C060" intensity={3.5} position={[4, 8, 3]} castShadow={false} />
      {/* Fill — cool blue side */}
      <directionalLight color="#3A8EBA" intensity={1.2} position={[-6, 3, -2]} />
      {/* Rim from behind */}
      <directionalLight color="#8AADE0" intensity={0.8} position={[0, 4, -8]} />
      {/* Floor bounce */}
      <pointLight color="#1A2840" intensity={2} distance={12} decay={2} position={[0, -0.2, 0]} />

      <WorkCell />
      <RobotArm />
    </>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function AutomationMachines({ isVisible }: { isVisible: boolean }) {
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      style={{
        width: W,
        height: H,
        background: "#0A0F1A",
        position: "relative",
        overflow: "hidden",
        userSelect: "none",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <style>{`
        @keyframes am-pulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
        @keyframes am-scan { 0%{transform:translateY(-100%)} 100%{transform:translateY(900px)} }
      `}</style>

      <Canvas
        style={{ position: "absolute", inset: 0 }}
        camera={{ position: [-4.5, 3.5, 6], fov: 42, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: false }}
        frameloop={isVisible && !prefersReduced ? "always" : "demand"}
        dpr={[1, 1.5]}
      >
        <Scene />
      </Canvas>

      {/* Vignette */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 35%, rgba(10,15,26,0.65) 100%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {/* Top nav */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            padding: "28px 56px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid rgba(58,142,186,0.1)",
            background: "rgba(10,15,26,0.6)",
          }}
        >
          <div>
            <div
              style={{
                color: "#F0F4F8",
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}
            >
              AUTOMATION
            </div>
            <div
              style={{
                color: "rgba(240,165,0,0.7)",
                fontSize: 9,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                marginTop: 2,
              }}
            >
              Machines · Industrial Series
            </div>
          </div>
          <div style={{ display: "flex", gap: 36 }}>
            {["Systems", "Robotics", "Control", "Deploy"].map((t) => (
              <span
                key={t}
                style={{
                  color: "rgba(240,244,248,0.38)",
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
              border: "1px solid rgba(240,165,0,0.5)",
              color: "#F0A500",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              padding: "9px 22px",
            }}
          >
            Configure
          </div>
        </div>

        {/* Left hero text */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 56,
            transform: "translateY(-50%)",
          }}
        >
          <div
            style={{
              color: "rgba(240,165,0,0.65)",
              fontSize: 10,
              letterSpacing: "0.38em",
              textTransform: "uppercase",
              marginBottom: 14,
              animation: "am-pulse 3.2s ease-in-out infinite",
            }}
          >
            ◆ Autonomous Assembly Systems
          </div>
          <h1
            style={{
              margin: 0,
              color: "#F0F4F8",
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 0.9,
              letterSpacing: "-0.025em",
              textTransform: "uppercase",
            }}
          >
            Built By
            <br />
            <span style={{ color: "#F0A500" }}>Machines.</span>
          </h1>
          <div
            style={{
              marginTop: 28,
              color: "rgba(240,244,248,0.45)",
              fontSize: 13,
              lineHeight: 1.65,
              maxWidth: 300,
            }}
          >
            Industrial robotics + precision gear drives powering the next generation of autonomous
            manufacturing.
          </div>
          <div style={{ marginTop: 28, display: "flex", gap: 14 }}>
            <div
              style={{
                background: "#F0A500",
                color: "#0A0F1A",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                padding: "13px 28px",
              }}
            >
              Explore Systems
            </div>
            <div
              style={{
                border: "1px solid rgba(240,244,248,0.18)",
                color: "rgba(240,244,248,0.55)",
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                padding: "13px 24px",
              }}
            >
              View Specs
            </div>
          </div>
        </div>

        {/* Bottom status bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            borderTop: "1px solid rgba(58,142,186,0.1)",
            background: "rgba(10,15,26,0.8)",
            display: "flex",
            alignItems: "center",
            padding: "16px 56px",
            gap: 52,
          }}
        >
          {[
            ["6 Axes", "Robotic DOF"],
            ["0.02mm", "Tolerance"],
            ["99.8%", "Uptime SLA"],
            ["1.4k/h", "Throughput"],
          ].map(([v, l]) => (
            <div key={l} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ color: "#F0A500", fontSize: 18, fontWeight: 700 }}>{v}</span>
              <span
                style={{
                  color: "rgba(240,244,248,0.3)",
                  fontSize: 9,
                  letterSpacing: "0.2em",
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
                background: "#F0A500",
                animation: "am-pulse 2s ease-in-out infinite",
              }}
            />
            <span
              style={{
                color: "rgba(240,165,0,0.75)",
                fontSize: 10,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}
            >
              Line Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
