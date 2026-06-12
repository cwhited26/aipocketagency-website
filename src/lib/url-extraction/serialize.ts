// serialize.ts — render a DesignDna record as the SPEC §8.1 YAML frontmatter block. Hand-rolled
// for exactly this shape (the repo carries no YAML dependency); flow-style inline maps match the
// SPEC's own example so records read the same whether a worker or a desktop lane wrote them.

import type { DesignDna, SourceMeta } from "./types";

const BARE = /^[a-zA-Z0-9_-]+$/;

/** Quote a YAML scalar unless it's a safe bare word or number. */
export function yamlScalar(value: string | number | boolean | null): string {
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (BARE.test(value)) return value;
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function flowMap(pairs: Array<[string, string | number | boolean | null]>): string {
  return `{ ${pairs.map(([k, v]) => `${k}: ${yamlScalar(v)}`).join(", ")} }`;
}

function numberList(values: number[]): string {
  return `[${values.join(", ")}]`;
}

/**
 * The `design_dna:` block — the single parse contract every consumer reads (PA-DNA-1), emitted
 * with a two-space base indent so it nests under a top-level frontmatter key.
 */
export function serializeDesignDna(dna: DesignDna): string {
  const out: string[] = [];
  out.push("design_dna:");
  out.push(`  interaction_model: ${dna.interaction_model}`);

  out.push("  palette:");
  out.push("    roles:");
  for (const [name, role] of Object.entries(dna.palette.roles)) {
    out.push(`      ${name}: ${flowMap([["oklch", role.oklch], ["source", role.source]])}`);
  }
  if (dna.palette.extras.length > 0) {
    out.push("    extras:");
    for (const extra of dna.palette.extras) {
      out.push(`      - ${flowMap([["name", extra.name], ["oklch", extra.oklch], ["usage", extra.usage]])}`);
    }
  }
  out.push(`    mode: ${dna.palette.mode}`);

  out.push("  typography:");
  out.push("    families:");
  for (const family of dna.typography.families) {
    out.push(
      `      - { role: ${family.role}, family: ${yamlScalar(family.family)}, fallbacks: [${family.fallbacks
        .map((f) => yamlScalar(f))
        .join(", ")}], source: ${family.source} }`,
    );
  }
  out.push(`    weights_used: ${numberList(dna.typography.weights_used)}`);
  out.push("    scale:");
  for (const step of dna.typography.scale) {
    out.push(`      - ${flowMap([["px", step.px], ["line_height", step.line_height], ["usage", step.usage]])}`);
  }
  if (dna.typography.letter_spacing.length > 0) {
    out.push("    letter_spacing:");
    for (const ls of dna.typography.letter_spacing) {
      out.push(`      - ${flowMap([["value", ls.value], ["usage", ls.usage]])}`);
    }
  }

  out.push("  spacing:");
  out.push(`    base_unit_px: ${dna.spacing.base_unit_px === null ? "null" : dna.spacing.base_unit_px}`);
  out.push(`    multipliers_used: ${numberList(dna.spacing.multipliers_used)}`);
  out.push(`    notes: ${yamlScalar(dna.spacing.notes)}`);

  if (dna.radius.length > 0) {
    out.push("  radius:");
    for (const r of dna.radius) {
      out.push(`    - ${flowMap([["px", r.px], ["usage", r.usage]])}`);
    }
  }

  if (dna.shadows.length > 0) {
    out.push("  shadows:");
    for (const s of dna.shadows) {
      out.push(`    - ${flowMap([["value", s.value], ["usage", s.usage]])}`);
    }
  }

  out.push("  layout:");
  for (const section of dna.layout) {
    const pairs: Array<[string, string]> = [["section", section.section], ["archetype", section.archetype]];
    if (section.notes) pairs.push(["notes", section.notes]);
    out.push(`    - ${flowMap(pairs)}`);
  }

  if (dna.behaviors.length > 0) {
    out.push("  behaviors:");
    for (const b of dna.behaviors) {
      out.push(`    - name: ${yamlScalar(b.name)}`);
      out.push(`      trigger_type: ${b.trigger_type}`);
      out.push(`      trigger: ${yamlScalar(b.trigger)}`);
      out.push(`      from: ${yamlScalar(b.from)}`);
      out.push(`      to: ${yamlScalar(b.to)}`);
      out.push(`      transition: ${yamlScalar(b.transition)}`);
      out.push(`      mechanism: ${b.mechanism}`);
    }
  }

  out.push("  coverage:");
  out.push(`    complete: ${dna.coverage.complete}`);
  if (dna.coverage.missed.length > 0) {
    out.push("    missed:");
    for (const m of dna.coverage.missed) {
      out.push(`      - ${yamlScalar(m)}`);
    }
  }
  out.push(`    bot_wall: ${dna.coverage.bot_wall}`);
  out.push(`    notes: ${yamlScalar(dna.coverage.notes)}`);

  return out.join("\n");
}

/** The source provenance block (SPEC §8.2), top-level in any wrapper. */
export function serializeSourceMeta(source: SourceMeta): string {
  const out: string[] = [];
  out.push("source:");
  out.push(`  url: ${yamlScalar(source.url)}`);
  out.push(`  final_url: ${yamlScalar(source.final_url)}`);
  out.push(`  title: ${yamlScalar(source.title)}`);
  out.push(`  captured_at: ${source.captured_at}`);
  out.push(`  viewports: ${numberList(source.viewports)}`);
  out.push(`  extractor: ${yamlScalar(source.extractor)}`);
  out.push(`  capture_method: ${source.capture_method}`);
  if (source.screenshots.length > 0) {
    out.push("  screenshots:");
    for (const ref of source.screenshots) {
      out.push(`    - ${yamlScalar(ref)}`);
    }
  }
  return out.join("\n");
}
