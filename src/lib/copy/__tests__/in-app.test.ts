import { describe, it, expect } from "vitest";
import {
  IDEA_ENGINE_EMPTY_BODY,
  IDEA_ENGINE,
  BOTTLENECK_PICKER,
  NUDGES,
  SUCCESS,
  UPGRADE_PROMPTS,
  USAGE_PROMPTS,
  PROGRESS_COPY,
} from "@/lib/copy/in-app";

// The single source we assert against, byte-for-byte from Part 7L. If a refactor mangles a
// character, this fails loudly — Chase flagged this paragraph as ship-verbatim.
const IDEA_ENGINE_CANONICAL =
  "Drop an idea — a voice memo, a podcast you just listened to, a thought you had in the shower. Pocket Agent validates whether real people would buy it, plans the version that should actually ship, builds it for you, gets a sales page live, and lines up the first 25 prospects to email. By the time you finish your morning coffee, your idea is a real thing on the internet you can show people.\n\nOther tools hand you a blueprint and prompts. Idea Engine ends with a working website you can share.";

describe("in-app copy bank (Part 7)", () => {
  it("Idea Engine empty-state paragraph is byte-for-byte from source", () => {
    expect(IDEA_ENGINE_EMPTY_BODY).toBe(IDEA_ENGINE_CANONICAL);
    expect(IDEA_ENGINE.empty.body).toBe(IDEA_ENGINE_CANONICAL);
  });

  it("never references the legacy aipocketagency.com domain", () => {
    const haystack = JSON.stringify({
      IDEA_ENGINE,
      BOTTLENECK_PICKER,
      NUDGES,
      SUCCESS,
      UPGRADE_PROMPTS,
      USAGE_PROMPTS,
      PROGRESS_COPY,
    });
    expect(haystack).not.toContain("aipocketagency");
  });

  it("ships all seven bottleneck options (Part 7B)", () => {
    expect(BOTTLENECK_PICKER.options).toHaveLength(7);
    const keys = BOTTLENECK_PICKER.options.map((o) => o.key);
    expect(keys).toEqual([
      "admin",
      "follow_up",
      "content",
      "email",
      "lead_research",
      "operations",
      "ideas",
    ]);
  });

  it("covers all five progress-copy blocks (Part 7C)", () => {
    expect(Object.keys(PROGRESS_COPY).sort()).toEqual([
      "almost",
      "brain_ready",
      "complete",
      "personas_ready",
      "start",
    ]);
  });

  it("covers all six activation-state nudges (Part 7W)", () => {
    expect(Object.keys(NUDGES)).toHaveLength(6);
    expect(NUDGES.no_business_brain.headline).toBe("Start with your Business Brain.");
    expect(NUDGES.activation_complete.headline).toBe("3-3-3 activation complete.");
  });
});
