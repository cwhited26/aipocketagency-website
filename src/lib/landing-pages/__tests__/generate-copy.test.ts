// generate-copy.test.ts — the voice-aware copy generator threads the owner's brain memory into the
// prompt and returns one string per section, filling any section the model omitted with a labeled
// fallback (never a silent gap). The brain loader + Anthropic call are mocked — no network.

import { afterEach, describe, expect, it, vi } from "vitest";

// The copy generator now calls buildScopedMemoryBlocks from ./scope, which in turn calls
// buildMemoryBlocks from @/lib/pa-brain when scope is null. Mock the scope module directly
// so the test controls what memory blocks the generator sees.
vi.mock("@/lib/landing-pages/scope", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/landing-pages/scope")>();
  return {
    ...orig,
    buildScopedMemoryBlocks: vi.fn(async () => [
      { path: "voice/chase-spec.md", content: "Write short. Direct. No filler words." },
    ]),
  };
});

import { generateLandingCopy } from "../generate-copy";
import { getTemplate } from "../templates";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockAnthropic(text: string): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async () =>
    new Response(
      JSON.stringify({ content: [{ type: "text", text }], usage: { input_tokens: 10, output_tokens: 20 } }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("generateLandingCopy", () => {
  it("threads brain voice into the prompt and covers every section, filling omissions", async () => {
    const template = getTemplate("single-cta");
    expect(template).not.toBeNull();
    if (!template) return;

    // Model returns 3 of the 4 sections (omits "cta") to exercise the fallback.
    const fn = mockAnthropic(
      JSON.stringify({
        hero: "New roof, no surprises\nHonest quotes for homeowners near Knoxville.",
        problem: "The problem\nYou can't get a straight answer on price.",
        mechanism: "How it works\n- We inspect\n- We quote\n- We build",
      }),
    );

    const { copy, hasBrain } = await generateLandingCopy(
      { template, description: "A roofing landing page with a free inspection CTA." },
      "test-anthropic-key",
      "owner/brain",
      "gh-token",
    );

    // Every section key present.
    for (const s of template.sections) {
      expect(copy[s.key]).toBeTruthy();
    }
    // The model values came through.
    expect(copy.hero).toContain("New roof");
    expect(copy.mechanism).toContain("We inspect");
    // The omitted section degraded to a labeled fallback, not an empty string.
    expect(copy.cta).toContain("Call to action");
    expect(hasBrain).toBe(true);

    // The system prompt carried the brain voice + the owner's description (voice memory threading).
    const body = JSON.parse((fn.mock.calls[0]?.[1] as RequestInit).body as string) as {
      system: string;
    };
    expect(body.system).toContain("Write short. Direct. No filler words.");
    expect(body.system).toContain("free inspection CTA");
  });

  it("degrades to all-fallback copy when the model returns no JSON", async () => {
    const template = getTemplate("personal-brand");
    if (!template) return;
    mockAnthropic("sorry, I cannot do that");

    const { copy } = await generateLandingCopy(
      { template, description: "A coach page." },
      "test-anthropic-key",
      "owner/brain",
      "gh-token",
    );
    for (const s of template.sections) {
      expect(copy[s.key]).toContain(s.label);
    }
  });
});
