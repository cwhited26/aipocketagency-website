import { describe, it, expect } from "vitest";
import {
  TEMPLATES,
  applyTemplate,
  getTemplate,
  isTemplateKey,
  listTemplates,
  templateCustomizeFields,
  PERSONA_NAME_TOKEN,
} from "../templates";
import { PERSONA_SECTION_KEYS } from "../spec";
import { isAppId } from "@/lib/apps/catalog";

describe("template catalog", () => {
  it("ships the 5 launch templates, the 7 role templates, and the GHL Operator", () => {
    const keys = listTemplates().map((t) => t.key).sort();
    expect(keys).toEqual(
      [
        "admin",
        "content",
        "email",
        "followup",
        "ghl-operator",
        "lead-research",
        "ops-cos",
        "sales",
        "vcsa",
        "vmd",
        "vom",
        "vr",
        "vsm",
      ].sort(),
    );
  });

  it("each template prefills all 12 spec sections", () => {
    for (const t of TEMPLATES) {
      for (const key of PERSONA_SECTION_KEYS) {
        expect(t.fields[key], `${t.key}.${key}`).toBeTruthy();
      }
    }
  });

  it("each template ships a starter prompt and only valid default App ids", () => {
    for (const t of TEMPLATES) {
      expect(t.starterPrompt, `${t.key}.starterPrompt`).toBeTruthy();
      for (const id of t.defaultApps) {
        expect(isAppId(id), `${t.key} → unknown app ${id}`).toBe(true);
      }
    }
  });

  it("each template flags 4-6 must-customize fields, all valid section keys", () => {
    for (const t of TEMPLATES) {
      expect(t.mustCustomize.length).toBeGreaterThanOrEqual(4);
      expect(t.mustCustomize.length).toBeLessThanOrEqual(6);
      for (const k of t.mustCustomize) {
        expect(PERSONA_SECTION_KEYS).toContain(k);
      }
    }
  });

  it("resolves templates by key", () => {
    expect(getTemplate("vsm")?.role).toBe("Virtual Sales Manager");
    expect(getTemplate("nope")).toBeNull();
    expect(isTemplateKey("vmd")).toBe(true);
    expect(isTemplateKey("xyz")).toBe(false);
  });
});

describe("templateCustomizeFields", () => {
  it("returns a starter + label/help per must-customize field", () => {
    const fields = templateCustomizeFields(getTemplate("vsm")!);
    expect(fields.length).toBe(getTemplate("vsm")!.mustCustomize.length);
    for (const f of fields) {
      expect(f.label).toBeTruthy();
      expect(f.starter).toBeTruthy();
    }
  });
});

describe("applyTemplate", () => {
  const template = getTemplate("vsm")!;

  it("substitutes the persona name token throughout", () => {
    const fields = applyTemplate({ template, personaName: "Coach Carter", customFields: {} });
    const all = Object.values(fields).join("\n");
    expect(all).not.toContain(PERSONA_NAME_TOKEN);
    expect(all).toContain("Coach Carter");
  });

  it("overlays owner custom answers over template defaults", () => {
    const fields = applyTemplate({
      template,
      personaName: "Sales Manager",
      customFields: { vision: "My custom vision." },
    });
    expect(fields.vision).toBe("My custom vision.");
    // Untouched sections keep the template default.
    expect(fields.principles).toBe(template.fields.principles);
  });

  it("falls back to the template default when an answer is blank", () => {
    const fields = applyTemplate({
      template,
      personaName: "Sales Manager",
      customFields: { vision: "   " },
    });
    expect(fields.vision).toBe(template.fields.vision);
  });

  it("returns every section key", () => {
    const fields = applyTemplate({ template, personaName: "X", customFields: {} });
    expect(Object.keys(fields).sort()).toEqual([...PERSONA_SECTION_KEYS].sort());
  });
});
