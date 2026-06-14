"use client";

// AnimatedPreview — scales the internal 1440×900 animated component to fit its container.
// Uses ResizeObserver + IntersectionObserver so animations only run when visible.

import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";

import WeblexDarkHero from "./animated/WeblexDarkHero";
import NovaSpaceSystems from "./animated/NovaSpaceSystems";
import SlamDunk from "./animated/SlamDunk";
import Framelix3DStudios from "./animated/Framelix3DStudios";
import NeoMuseum from "./animated/NeoMuseum";
import NewEraAutomotive from "./animated/NewEraAutomotive";
import Equilibrium from "./animated/Equilibrium";
import AutomationMachines from "./animated/AutomationMachines";

const COMPONENTS: Record<string, ComponentType<{ isVisible: boolean }>> = {
  "weblex-dark-hero":       WeblexDarkHero,
  "nova-space-systems":     NovaSpaceSystems,
  "slam-dunk":              SlamDunk,
  "framelix-3d-studios":    Framelix3DStudios,
  "neo-museum":             NeoMuseum,
  "new-era-automotive":     NewEraAutomotive,
  "equilibrium":            Equilibrium,
  "automation-machines":    AutomationMachines,
};

const W = 1440;
const H = 900;

export default function AnimatedPreview({ slug }: { slug: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.clientWidth;
      setScale(w / W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        setIsVisible(entries[0]?.isIntersecting ?? false);
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Component = COMPONENTS[slug];
  if (!Component) return null;

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        aspectRatio: `${W} / ${H}`,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: W,
          height: H,
          transformOrigin: "top left",
          transform: `scale(${scale})`,
        }}
      >
        <Component isVisible={isVisible} />
      </div>
    </div>
  );
}
