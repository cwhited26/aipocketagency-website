// templates.test.ts — every shipped template loads + validates, and the validator catches the four
// ways a template can be malformed (no sections, duplicate key, missing copy prompt, wrong placeholder
// count). Pure, no network.

import { describe, it, expect } from "vitest";
import {
  COPY_PLACEHOLDER,
  getTemplate,
  listTemplates,
  sectionKeys,
  validateTemplate,
} from "../templates";
import { TEMPLATE_IDS, type LandingTemplate } from "../types";

describe("landing page templates", () => {
  it("ships exactly the three starter templates, ids matching TEMPLATE_IDS", () => {
    const ids = listTemplates().map((t) => t.id).sort();
    expect(ids).toEqual([...TEMPLATE_IDS].sort());
    expect(new Set(ids).size).toBe(3);
  });

  it("every template validates", () => {
    for (const template of listTemplates()) {
      expect(validateTemplate(template)).toEqual({ ok: true });
    }
  });

  it("every section has a copy prompt and the skeleton carries the copy placeholder exactly once", () => {
    for (const template of listTemplates()) {
      expect(template.sections.length).toBeGreaterThan(0);
      for (const key of sectionKeys(template)) {
        expect(template.defaultCopyPrompts[key]?.trim()).toBeTruthy();
      }
      expect(template.componentTemplate.split(COPY_PLACEHOLDER).length - 1).toBe(1);
    }
  });

  it("getTemplate resolves known ids and rejects unknown", () => {
    expect(getTemplate("single-cta")?.label).toBe("Single call-to-action");
    expect(getTemplate("vertical-pack")?.id).toBe("vertical-pack");
    expect(getTemplate("personal-brand")?.id).toBe("personal-brand");
    expect(getTemplate("nope")).toBeNull();
  });

  it("validateTemplate rejects an empty section list", () => {
    const bad: LandingTemplate = {
      id: "single-cta",
      label: "x",
      description: "x",
      bestFor: "x",
      sections: [],
      defaultCopyPrompts: {},
      componentTemplate: COPY_PLACEHOLDER,
    };
    const v = validateTemplate(bad);
    expect(v.ok).toBe(false);
  });

  it("validateTemplate rejects a duplicate section key", () => {
    const bad: LandingTemplate = {
      id: "single-cta",
      label: "x",
      description: "x",
      bestFor: "x",
      sections: [
        { key: "hero", kind: "hero", label: "Hero", purpose: "p" },
        { key: "hero", kind: "cta", label: "Hero 2", purpose: "p" },
      ],
      defaultCopyPrompts: { hero: "write it" },
      componentTemplate: COPY_PLACEHOLDER,
    };
    expect(validateTemplate(bad).ok).toBe(false);
  });

  it("validateTemplate rejects a missing copy prompt", () => {
    const bad: LandingTemplate = {
      id: "single-cta",
      label: "x",
      description: "x",
      bestFor: "x",
      sections: [{ key: "hero", kind: "hero", label: "Hero", purpose: "p" }],
      defaultCopyPrompts: {},
      componentTemplate: COPY_PLACEHOLDER,
    };
    expect(validateTemplate(bad).ok).toBe(false);
  });

  it("validateTemplate rejects a skeleton without exactly one copy placeholder", () => {
    const bad: LandingTemplate = {
      id: "single-cta",
      label: "x",
      description: "x",
      bestFor: "x",
      sections: [{ key: "hero", kind: "hero", label: "Hero", purpose: "p" }],
      defaultCopyPrompts: { hero: "write it" },
      componentTemplate: "no placeholder here",
    };
    expect(validateTemplate(bad).ok).toBe(false);
  });
});
