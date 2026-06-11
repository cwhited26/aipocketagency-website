// templates.ts — load + validate the landing page templates (PA-LPB-2). The three starter templates
// live as data under src/data/landing-page-templates; this module is the single read point and the
// validator that guarantees a template is well-formed before the generator or assembler touches it.
//
// Pure data + checks, no I/O — safe to import from server routes, the build orchestrator, and the
// client surface.

import { singleCtaTemplate } from "@/data/landing-page-templates/single-cta";
import { verticalPackTemplate } from "@/data/landing-page-templates/vertical-pack";
import { personalBrandTemplate } from "@/data/landing-page-templates/personal-brand";
import { isTemplateId, type LandingTemplate } from "./types";

/** The copy placeholder every component template must carry exactly once. */
export const COPY_PLACEHOLDER = "{{COPY_JSON}}";

const TEMPLATES: readonly LandingTemplate[] = [
  singleCtaTemplate,
  verticalPackTemplate,
  personalBrandTemplate,
];

const BY_ID = new Map<string, LandingTemplate>(TEMPLATES.map((t) => [t.id, t]));

/** All templates in display order (for the picker). */
export function listTemplates(): readonly LandingTemplate[] {
  return TEMPLATES;
}

/** Resolve a template by id, or null for an unknown id. */
export function getTemplate(id: string): LandingTemplate | null {
  if (!isTemplateId(id)) return null;
  return BY_ID.get(id) ?? null;
}

export type TemplateValidation = { ok: true } | { ok: false; reason: string };

/**
 * Validate a template's shape: at least one section, unique section keys, a copy prompt for every
 * section, and a component skeleton carrying the copy placeholder exactly once. Pure — unit-tested
 * across all three shipped templates so a malformed edit fails loudly instead of producing a broken
 * page at build time.
 */
export function validateTemplate(template: LandingTemplate): TemplateValidation {
  if (template.sections.length === 0) {
    return { ok: false, reason: `Template "${template.id}" has no sections.` };
  }
  const seen = new Set<string>();
  for (const section of template.sections) {
    if (!section.key.trim()) {
      return { ok: false, reason: `Template "${template.id}" has a section with an empty key.` };
    }
    if (seen.has(section.key)) {
      return { ok: false, reason: `Template "${template.id}" has a duplicate section key "${section.key}".` };
    }
    seen.add(section.key);
    if (!template.defaultCopyPrompts[section.key]?.trim()) {
      return {
        ok: false,
        reason: `Template "${template.id}" is missing a copy prompt for section "${section.key}".`,
      };
    }
  }
  const placeholders = template.componentTemplate.split(COPY_PLACEHOLDER).length - 1;
  if (placeholders !== 1) {
    return {
      ok: false,
      reason: `Template "${template.id}" must carry ${COPY_PLACEHOLDER} exactly once (found ${placeholders}).`,
    };
  }
  return { ok: true };
}

/** The stable section keys a template's generated copy must cover. */
export function sectionKeys(template: LandingTemplate): string[] {
  return template.sections.map((s) => s.key);
}
