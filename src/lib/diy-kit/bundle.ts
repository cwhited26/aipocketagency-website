// bundle.ts — assemble the AI Office DIY Setup Kit deliverable (PA-DIYKIT-2/3).
//
// The DIY Kit a buyer downloads is built from material that already lives in the repo: the DIY markdown
// docs, the three starter Persona templates, and the 25 Workflow Vault recipes. This module assembles
// them deterministically into (1) one combined markdown document, (2) a 25-prompt reference, and (3) an
// import-ready JSON bundle the owner can drop into Pocket Agent when they subscribe. Pure-ish: it reads
// the static content via the content loaders, no network. Used to stage the downloadable bundle and to
// unit-test that every piece is present.

import { WORKFLOW_RECIPES, starterSeedRecipes, VAULT_CATEGORY_LABELS } from "@/lib/workflow-vault/recipes";
import {
  DIY_KIT_DOCS,
  PERSONA_TEMPLATE_DOCS,
  loadDiyKitDoc,
  loadPersonaTemplateDoc,
} from "./content";

export type DiyKitImportBundle = {
  version: 1;
  source: "ai-office-diy-setup-kit";
  personas: Array<{ key: string; doc: string }>;
  workflows: Array<{
    slug: string;
    name: string;
    category: string;
    prompt_template: string;
    default_apps: string[];
  }>;
};

/** The combined markdown document — cover, checklist, mission control review, 7-day plan, persona templates. */
export function buildCombinedMarkdown(): string {
  const parts: string[] = [];
  for (const doc of DIY_KIT_DOCS) {
    parts.push(loadDiyKitDoc(doc).trim());
  }
  parts.push("# Persona Setup Templates");
  for (const doc of PERSONA_TEMPLATE_DOCS) {
    parts.push(loadPersonaTemplateDoc(doc).trim());
  }
  return parts.join("\n\n---\n\n") + "\n";
}

/** The 25-prompt reference — every Workflow Vault recipe grouped by category, with its prompt. */
export function buildPromptsReference(): string {
  const lines: string[] = ["# AI Workflow Vault — 25 Workflow Prompts", ""];
  for (const [category, label] of Object.entries(VAULT_CATEGORY_LABELS)) {
    const inCategory = WORKFLOW_RECIPES.filter((r) => r.category === category);
    if (inCategory.length === 0) continue;
    lines.push(`## ${label}`, "");
    for (const recipe of inCategory) {
      lines.push(`### ${recipe.name}`, "", recipe.description, "", "Prompt:", "", `> ${recipe.prompt_template}`, "");
    }
  }
  return lines.join("\n");
}

/** The import-ready JSON: the 3 starter Personas + the 5 starter workflows, for drop-in on signup. */
export function buildImportBundle(): DiyKitImportBundle {
  return {
    version: 1,
    source: "ai-office-diy-setup-kit",
    personas: PERSONA_TEMPLATE_DOCS.map((doc) => ({ key: doc, doc: loadPersonaTemplateDoc(doc).trim() })),
    workflows: starterSeedRecipes().map((r) => ({
      slug: r.slug,
      name: r.name,
      category: r.category,
      prompt_template: r.prompt_template,
      default_apps: r.default_apps,
    })),
  };
}

/** Everything the staged downloadable bundle contains — used by the build script and the tests. */
export function buildDiyKitBundle(): {
  combinedMarkdown: string;
  promptsReference: string;
  importBundle: DiyKitImportBundle;
} {
  return {
    combinedMarkdown: buildCombinedMarkdown(),
    promptsReference: buildPromptsReference(),
    importBundle: buildImportBundle(),
  };
}
