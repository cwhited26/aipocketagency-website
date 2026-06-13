// landing-pages/__tests__/brand-brain.test.ts — tests for the brand.json → brain write path.
// Covers: staging the approval card, detecting existing brand.json, reading it back, and the
// "replacingExisting" flag surfaced in the card preview. GitHub connector + pa-brain are mocked.

import { afterEach, describe, expect, it, vi } from "vitest";

// Mock stageConnectorAction so we never touch the real DB
vi.mock("@/lib/orchestrator/tool-use", () => ({
  stageConnectorAction: vi.fn(async () => undefined),
  scopeToken: (_connector: string, action: string) => `${_connector}:${action}`,
}));

// Mock fetchFileContent from pa-brain (real impl returns "" for missing files, never null)
vi.mock("@/lib/pa-brain", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/pa-brain")>();
  return { ...orig, fetchFileContent: vi.fn(async () => "") };
});

import { stageConnectorAction } from "@/lib/orchestrator/tool-use";
import { fetchFileContent } from "@/lib/pa-brain";
import {
  hasExistingBrandJson,
  readExistingBrandJson,
  stageBrandJsonWrite,
} from "../brand-brain";
import type { DesignSystem } from "@/lib/connectors/moonchild/types";

const SAMPLE_DS: DesignSystem = {
  id: "ds-001",
  name: "Valley Roofing",
  palette: [
    { name: "primary", hex: "#22d3ee", role: "primary" },
    { name: "bg", hex: "#0b1220", role: "background" },
  ],
  typography: {
    heading: { family: "Inter", weight: 700 },
    body: { family: "Inter", weight: 400 },
  },
  components: { button: "rounded px-4 py-2" },
};

const BASE_PARAMS = {
  ownerId: "user-1",
  brainRepo: "cwhited26/whited-brain",
  githubToken: "gh-tok",
  scope: "customers/valley-roofing",
  brand: {
    name: "Valley Roofing",
    ds: SAMPLE_DS,
    sourceUrl: "https://valleyroofing.com",
  },
  landingPageId: "page-abc",
  replacingExisting: false,
};

afterEach(() => {
  vi.clearAllMocks();
});

// ── hasExistingBrandJson ──────────────────────────────────────────────────────────────────────────

describe("hasExistingBrandJson", () => {
  it("returns false when fetchFileContent returns empty string (file not found)", async () => {
    vi.mocked(fetchFileContent).mockResolvedValueOnce("");
    const result = await hasExistingBrandJson("repo/brain", "tok", "customers/acme");
    expect(result).toBe(false);
  });

  it("returns true when fetchFileContent returns non-empty content", async () => {
    vi.mocked(fetchFileContent).mockResolvedValueOnce(JSON.stringify({ name: "Acme" }));
    const result = await hasExistingBrandJson("repo/brain", "tok", "customers/acme");
    expect(result).toBe(true);
  });

  it("returns false when fetchFileContent throws", async () => {
    vi.mocked(fetchFileContent).mockRejectedValueOnce(new Error("network"));
    const result = await hasExistingBrandJson("repo/brain", "tok", "customers/acme");
    expect(result).toBe(false);
  });
});

// ── readExistingBrandJson ─────────────────────────────────────────────────────────────────────────

describe("readExistingBrandJson", () => {
  it("returns null when the file does not exist (empty string)", async () => {
    vi.mocked(fetchFileContent).mockResolvedValueOnce("");
    const result = await readExistingBrandJson("repo/brain", "tok", "customers/acme");
    expect(result).toBeNull();
  });

  it("parses and returns valid brand.json content", async () => {
    const brand = { name: "Acme", palette: [{ name: "primary", hex: "#ff0000" }], generatedAt: "2026-06-13T00:00:00Z" };
    vi.mocked(fetchFileContent).mockResolvedValueOnce(JSON.stringify(brand));
    const result = await readExistingBrandJson("repo/brain", "tok", "customers/acme");
    expect(result?.name).toBe("Acme");
    expect(result?.palette?.[0]?.hex).toBe("#ff0000");
  });

  it("returns null on malformed JSON", async () => {
    vi.mocked(fetchFileContent).mockResolvedValueOnce("not json at all");
    const result = await readExistingBrandJson("repo/brain", "tok", "customers/acme");
    expect(result).toBeNull();
  });
});

// ── stageBrandJsonWrite ───────────────────────────────────────────────────────────────────────────

describe("stageBrandJsonWrite", () => {
  it("stages a push_files build_action_approval card for github_build", async () => {
    const result = await stageBrandJsonWrite(BASE_PARAMS);

    expect(result.ok).toBe(true);
    expect(vi.mocked(stageConnectorAction)).toHaveBeenCalledOnce();

    const call = vi.mocked(stageConnectorAction).mock.calls[0]?.[0];
    expect(call?.connector).toBe("github_build");
    expect(call?.action).toBe("push_files");
    expect(call?.kind).toBe("build_action_approval");
  });

  it("embeds the file path and brand.json content in the payload", async () => {
    await stageBrandJsonWrite(BASE_PARAMS);

    const call = vi.mocked(stageConnectorAction).mock.calls[0]?.[0];
    const files = call?.payload["files"] as { path: string; content: string }[];
    expect(files).toBeDefined();
    expect(files[0].path).toBe("customers/valley-roofing/brand.json");

    const parsed = JSON.parse(files[0].content) as Record<string, unknown>;
    expect(parsed.name).toBe("Valley Roofing");
    expect((parsed.palette as { hex: string }[])?.[0]?.hex).toBe("#22d3ee");
    expect(parsed.generatedFrom).toBe("https://valleyroofing.com");
  });

  it("includes ⚠️ replacement warning in the preview when replacingExisting is true", async () => {
    await stageBrandJsonWrite({ ...BASE_PARAMS, replacingExisting: true });

    const call = vi.mocked(stageConnectorAction).mock.calls[0]?.[0];
    expect(call?.preview).toContain("REPLACE");
    expect(call?.title).toContain("Replace");
  });

  it("does NOT include replacement warning when replacingExisting is false", async () => {
    await stageBrandJsonWrite(BASE_PARAMS);

    const call = vi.mocked(stageConnectorAction).mock.calls[0]?.[0];
    expect(call?.preview).not.toContain("REPLACE");
  });

  it("returns an error result when stageConnectorAction throws", async () => {
    vi.mocked(stageConnectorAction).mockRejectedValueOnce(new Error("DB error"));
    const result = await stageBrandJsonWrite(BASE_PARAMS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("DB error");
  });

  it("surfaces palette and typography summary in the card preview", async () => {
    await stageBrandJsonWrite(BASE_PARAMS);

    const call = vi.mocked(stageConnectorAction).mock.calls[0]?.[0];
    expect(call?.preview).toContain("#22d3ee");
    expect(call?.preview).toContain("Inter");
  });
});
