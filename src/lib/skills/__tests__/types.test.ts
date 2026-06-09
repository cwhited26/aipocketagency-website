import { describe, it, expect } from "vitest";
import {
  skillReachableFromZone,
  skillSlugify,
  slugFromSkillPath,
  skillPath,
  skillVersionPath,
  skillTriggeredPath,
  maxSkillsLoadedPerRun,
  autoEvolveTrustThreshold,
} from "../types";

describe("skillSlugify", () => {
  it("kebab-cases and trims", () => {
    expect(skillSlugify("Draft Roof Supplement Quote")).toBe("draft-roof-supplement-quote");
    expect(skillSlugify("  Handle / Pricing!! ")).toBe("handle-pricing");
    expect(skillSlugify("!!!")).toBe("skill");
  });
});

describe("skill paths", () => {
  it("builds + reverses the SKILL.md path", () => {
    expect(skillPath("foo")).toBe("skills/foo/SKILL.md");
    expect(slugFromSkillPath("skills/foo/SKILL.md")).toBe("foo");
    expect(slugFromSkillPath("skills/foo/versions/v2.md")).toBeNull();
    expect(slugFromSkillPath("memory/foo.md")).toBeNull();
  });
  it("builds version + triggered paths deterministically", () => {
    expect(skillVersionPath("foo", 3)).toBe("skills/foo/versions/v3.md");
    expect(skillTriggeredPath("foo", "2026-06-09T12:00:00Z", "run-x/y")).toBe(
      "skills/foo/triggered/2026-06-09-run-x-y.md",
    );
  });
});

describe("skillReachableFromZone (ContainmentGuard, PA-SKILL-7)", () => {
  it("reaches only an exact zone match", () => {
    expect(skillReachableFromZone("project-shared", "project-shared")).toBe(true);
    expect(skillReachableFromZone("persona-vsm", "persona-vsm")).toBe(true);
  });
  it("blocks cross-zone use", () => {
    // A public-persona run can't reach the owner's shared/private Skills.
    expect(skillReachableFromZone("project-shared", "persona-public")).toBe(false);
    expect(skillReachableFromZone("user-private", "persona-vsm")).toBe(false);
    // A persona Skill is unreachable from an owner project-shared run.
    expect(skillReachableFromZone("persona-vsm", "project-shared")).toBe(false);
  });
  it("fails closed on empty zones", () => {
    expect(skillReachableFromZone("", "")).toBe(false);
  });
});

describe("tunables", () => {
  it("defaults the per-run load cap to 3 and clamps", () => {
    delete process.env.PA_SKILLS_MAX_LOADED_PER_RUN;
    expect(maxSkillsLoadedPerRun()).toBe(3);
    process.env.PA_SKILLS_MAX_LOADED_PER_RUN = "5";
    expect(maxSkillsLoadedPerRun()).toBe(5);
    process.env.PA_SKILLS_MAX_LOADED_PER_RUN = "999";
    expect(maxSkillsLoadedPerRun()).toBe(10);
    delete process.env.PA_SKILLS_MAX_LOADED_PER_RUN;
  });
  it("defaults the auto-evolve trust threshold to 3", () => {
    delete process.env.PA_SKILLS_AUTO_EVOLVE_TRUST_THRESHOLD;
    expect(autoEvolveTrustThreshold()).toBe(3);
  });
});
