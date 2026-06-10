import { describe, it, expect } from "vitest";
import { buildDiyKitBundle } from "../bundle";
import { WORKFLOW_RECIPES } from "@/lib/workflow-vault/recipes";

describe("DIY Setup Kit bundle", () => {
  const bundle = buildDiyKitBundle();

  it("combines the markdown docs into one document", () => {
    expect(bundle.combinedMarkdown).toContain("AI Office DIY Setup Kit");
    expect(bundle.combinedMarkdown).toContain("Persona Setup Templates");
    expect(bundle.combinedMarkdown.length).toBeGreaterThan(500);
  });

  it("the prompts reference lists all 25 recipes by name", () => {
    for (const r of WORKFLOW_RECIPES) {
      expect(bundle.promptsReference, r.slug).toContain(r.name);
    }
  });

  it("the import bundle carries 3 personas + 5 starter workflows", () => {
    expect(bundle.importBundle.version).toBe(1);
    expect(bundle.importBundle.source).toBe("ai-office-diy-setup-kit");
    expect(bundle.importBundle.personas).toHaveLength(3);
    expect(bundle.importBundle.workflows).toHaveLength(5);
    for (const w of bundle.importBundle.workflows) {
      expect(w.prompt_template.length).toBeGreaterThan(0);
    }
  });
});
