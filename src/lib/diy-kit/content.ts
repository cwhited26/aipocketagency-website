// content.ts — load the DIY Setup Kit markdown source (PA-DIYKIT-2).
//
// The DIY Kit is the info-product version of the Launch Kit: markdown docs in src/data/diy-kit/, the
// three starter Persona templates in src/data/persona-templates-md/, and the 25 Workflow Vault recipes
// (recipes.ts). Server-only fs reads; the files are traced into the bundle via outputFileTracingIncludes.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const DIY_DIR = join(process.cwd(), "src", "data", "diy-kit");
const PERSONA_DIR = join(process.cwd(), "src", "data", "persona-templates-md");

export const DIY_KIT_DOCS = [
  "00-cover",
  "01-business-brain-upload-checklist",
  "02-mission-control-review",
  "03-7-day-setup-plan",
] as const;
export type DiyKitDoc = (typeof DIY_KIT_DOCS)[number];

export const PERSONA_TEMPLATE_DOCS = [
  "admin-assistant",
  "sales-follow-up-agent",
  "content-creator",
] as const;
export type PersonaTemplateDoc = (typeof PERSONA_TEMPLATE_DOCS)[number];

export function loadDiyKitDoc(doc: DiyKitDoc): string {
  return readFileSync(join(DIY_DIR, `${doc}.md`), "utf8");
}

export function loadPersonaTemplateDoc(doc: PersonaTemplateDoc): string {
  return readFileSync(join(PERSONA_DIR, `${doc}.md`), "utf8");
}
