// landing-pages/design-snapshot.ts — Converters from external DS shapes to DesignSystemSnapshot.
//
// DesignSystemSnapshot is the slim on-row cache (migration 080) — only the fields code-gen needs.
// Two sources feed it in PA-LPB-13:
//   Path A (Moonchild scene pull)  → DesignSystem  → moonchildDsToSnapshot()
//   Path B (URL cloner)            → DesignDna     → dnaToSnapshot()
//
// Neither converter calls any external service — they are pure data transforms.

import type { DesignSystem } from "@/lib/connectors/moonchild/types";
import type { DesignSystemSnapshot } from "@/lib/landing-pages/types";
import type { DesignDna } from "@/lib/url-extraction/types";

// ── Path A: Moonchild DesignSystem → DesignSystemSnapshot ───────────────────────────────────────

export function moonchildDsToSnapshot(
  ds: DesignSystem,
  importedFrom: string,
): DesignSystemSnapshot {
  return {
    id: ds.id,
    name: ds.name,
    importedFrom,
    palette: ds.palette?.map((p) => ({
      name: p.name,
      hex: p.hex,
      role: p.role,
    })),
    typography: ds.typography
      ? {
          heading: ds.typography.heading
            ? {
                family: ds.typography.heading.family,
                weight: ds.typography.heading.weight,
                size: ds.typography.heading.size,
              }
            : undefined,
          body: ds.typography.body
            ? {
                family: ds.typography.body.family,
                weight: ds.typography.body.weight,
                size: ds.typography.body.size,
              }
            : undefined,
        }
      : undefined,
    components: ds.components,
  };
}

// ── Path B: DesignDna → DesignSystemSnapshot ─────────────────────────────────────────────────────
// DesignDna stores palette roles in oklch (the engine's computed values). We convert them to the
// best available hex approximation for code-gen — oklch values are stored in the role map as-is
// since Tailwind/CSS supports oklch natively. The role name drives component theming.

export function dnaToSnapshot(dna: DesignDna, importedFrom: string): DesignSystemSnapshot {
  const palette: DesignSystemSnapshot["palette"] = [];

  // Named semantic roles first (background, foreground, primary, muted, border, …)
  for (const [role, entry] of Object.entries(dna.palette.roles)) {
    palette.push({ role, hex: entry.oklch, name: role });
  }
  // Extras (accent swatches, decorative colors)
  for (const extra of dna.palette.extras) {
    palette.push({ role: extra.usage, hex: extra.oklch, name: extra.name });
  }

  const displayFamily = dna.typography.families.find((f) => f.role === "display");
  const bodyFamily = dna.typography.families.find((f) => f.role === "body");
  const monoFamily = dna.typography.families.find((f) => f.role === "mono");

  // Dominant heading weight — pick the largest weight_used <= 700 (display) or fall back to 600.
  const displayWeight =
    dna.typography.weights_used.filter((w) => w >= 500).sort((a, b) => b - a)[0] ?? 600;
  const bodyWeight =
    dna.typography.weights_used.filter((w) => w < 500).sort((a, b) => b - a)[0] ?? 400;

  const typography: DesignSystemSnapshot["typography"] = {};
  if (displayFamily ?? bodyFamily) {
    typography.heading = {
      family: displayFamily?.family ?? bodyFamily?.family,
      weight: String(displayWeight),
    };
    typography.body = {
      family: bodyFamily?.family ?? displayFamily?.family,
      weight: String(bodyWeight),
    };
  }

  // Encode spacing rhythm + radius as pseudo-components so code-gen has them available.
  const components: Record<string, string> = {};
  if (dna.spacing.base_unit_px !== null) {
    components["spacing_base_px"] = String(dna.spacing.base_unit_px);
  }
  if (dna.radius.length > 0) {
    components["border_radius_default_px"] = String(dna.radius[0]?.px ?? 4);
  }
  if (monoFamily) {
    components["font_mono"] = monoFamily.family;
  }

  return {
    name: new URL(importedFrom).hostname,
    importedFrom,
    palette: palette.length > 0 ? palette : undefined,
    typography: Object.keys(typography).length > 0 ? typography : undefined,
    components: Object.keys(components).length > 0 ? components : undefined,
  };
}
