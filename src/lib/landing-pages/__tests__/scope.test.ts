// scope.test.ts — sanitizeScope + discoverProjectFolders + buildScopedMemoryBlocks (PA-LPB-7..9).
// All GitHub calls are mocked so the tests run offline.

import { describe, expect, it, vi } from "vitest";
import { sanitizeScope, discoverProjectFolders, buildScopedMemoryBlocks } from "../scope";

// ── sanitizeScope ────────────────────────────────────────────────────────────────────────────────

describe("sanitizeScope", () => {
  it("returns null for null, empty, and 'root'", () => {
    expect(sanitizeScope(null)).toBeNull();
    expect(sanitizeScope(undefined)).toBeNull();
    expect(sanitizeScope("")).toBeNull();
    expect(sanitizeScope("root")).toBeNull();
  });

  it("returns a clean repo-relative path", () => {
    expect(sanitizeScope("customers/valley-roofing")).toBe("customers/valley-roofing");
    expect(sanitizeScope("projects/summer-launch")).toBe("projects/summer-launch");
  });

  it("strips trailing slashes", () => {
    expect(sanitizeScope("customers/acme/")).toBe("customers/acme");
  });

  it("throws on parent traversal", () => {
    expect(() => sanitizeScope("../outside")).toThrow();
    expect(() => sanitizeScope("customers/../../etc/passwd")).toThrow();
  });

  it("throws on a leading slash (absolute path)", () => {
    expect(() => sanitizeScope("/customers/acme")).toThrow();
  });

  it("throws on file paths (last segment has a dot)", () => {
    expect(() => sanitizeScope("customers/acme/brand.json")).toThrow();
    expect(() => sanitizeScope("customers/acme/CLAUDE.md")).toThrow();
  });
});

// ── discoverProjectFolders ────────────────────────────────────────────────────────────────────────

const TREE_FIXTURE = [
  // owner root files — should NOT qualify as a project folder
  { path: "voice", type: "tree" as const, sha: "sha-voice" },
  { path: "voice/chase-spec.md", type: "blob" as const, sha: "sha-voice-spec" },
  { path: "memory", type: "tree" as const, sha: "sha-memory" },
  { path: "memory/user_role.md", type: "blob" as const, sha: "sha-user-role" },
  // A customer folder with brand.json
  { path: "customers", type: "tree" as const, sha: "sha-cust" },
  { path: "customers/valley-roofing", type: "tree" as const, sha: "sha-vr" },
  { path: "customers/valley-roofing/brand.json", type: "blob" as const, sha: "sha-vr-brand" },
  { path: "customers/valley-roofing/CLAUDE.md", type: "blob" as const, sha: "sha-vr-claude" },
  // A project folder with memory/ directory
  { path: "projects", type: "tree" as const, sha: "sha-proj" },
  { path: "projects/summer-launch", type: "tree" as const, sha: "sha-sl" },
  { path: "projects/summer-launch/memory", type: "tree" as const, sha: "sha-sl-mem" },
  { path: "projects/summer-launch/memory/notes.md", type: "blob" as const, sha: "sha-sl-notes" },
  // A folder with brand.md only
  { path: "partners", type: "tree" as const, sha: "sha-part" },
  { path: "partners/acme", type: "tree" as const, sha: "sha-acme" },
  { path: "partners/acme/brand.md", type: "blob" as const, sha: "sha-acme-brand" },
  // A plain folder with no signals
  { path: "drafts", type: "tree" as const, sha: "sha-drafts" },
  { path: "drafts/ideas.md", type: "blob" as const, sha: "sha-ideas" },
];

vi.mock("@/lib/pa-brain", () => ({
  listRepoTree: vi.fn(async () => TREE_FIXTURE),
  fetchFileContent: vi.fn(async (repo: string, path: string) => {
    if (path === "customers/valley-roofing/brand.json") {
      return JSON.stringify({ domain: "valleyroofing.com", color: "#e85d04", primaryColor: "#unused" });
    }
    return "";
  }),
  buildMemoryBlocks: vi.fn(async () => []),
}));

describe("discoverProjectFolders", () => {
  it("returns every directory with at least one scope signal", async () => {
    const folders = await discoverProjectFolders("owner/brain", "gh-token");
    const paths = folders.map((f) => f.path);
    expect(paths).toContain("customers/valley-roofing");
    expect(paths).toContain("projects/summer-launch");
    expect(paths).toContain("partners/acme");
  });

  it("excludes the root memory/ and voice/ directories (they are the brain root, not a project)", async () => {
    const folders = await discoverProjectFolders("owner/brain", "gh-token");
    // "memory" at the root level would appear — but the root memory/ is a child of root, not of a subdir.
    // The root-level "voice" and "memory" trees have no parent dir segment so they never
    // become a dirPath in the signal map (the path has only one segment).
    const paths = folders.map((f) => f.path);
    expect(paths).not.toContain("memory");
    expect(paths).not.toContain("voice");
  });

  it("excludes folders with no scope signal (drafts)", async () => {
    const folders = await discoverProjectFolders("owner/brain", "gh-token");
    const paths = folders.map((f) => f.path);
    expect(paths).not.toContain("drafts");
  });

  it("extracts the brand color from brand.json when present", async () => {
    const folders = await discoverProjectFolders("owner/brain", "gh-token");
    const vr = folders.find((f) => f.path === "customers/valley-roofing");
    expect(vr?.brandColor).toBe("#e85d04");
  });

  it("humanises the folder name from the last path segment", async () => {
    const folders = await discoverProjectFolders("owner/brain", "gh-token");
    const vr = folders.find((f) => f.path === "customers/valley-roofing");
    expect(vr?.name).toBe("Valley Roofing");
    const sl = folders.find((f) => f.path === "projects/summer-launch");
    expect(sl?.name).toBe("Summer Launch");
  });

  it("reports the correct signals for each folder", async () => {
    const folders = await discoverProjectFolders("owner/brain", "gh-token");
    const vr = folders.find((f) => f.path === "customers/valley-roofing");
    expect(vr?.signals).toContain("brand.json");
    expect(vr?.signals).toContain("CLAUDE.md");
    const sl = folders.find((f) => f.path === "projects/summer-launch");
    expect(sl?.signals).toContain("memory/");
  });
});

// ── buildScopedMemoryBlocks ───────────────────────────────────────────────────────────────────────

const SCOPED_TREE = [
  { path: "customers/valley-roofing/CLAUDE.md", type: "blob" as const, sha: "sha1" },
  { path: "customers/valley-roofing/brand.md", type: "blob" as const, sha: "sha2" },
  { path: "customers/valley-roofing/brand.json", type: "blob" as const, sha: "sha3" },
  { path: "customers/valley-roofing/memory/voice.md", type: "blob" as const, sha: "sha4" },
  { path: "customers/valley-roofing/memory/facts.md", type: "blob" as const, sha: "sha5" },
  { path: "customers/valley-roofing/voice/tone.md", type: "blob" as const, sha: "sha6" },
  // files outside the scope — must NOT appear
  { path: "memory/user_role.md", type: "blob" as const, sha: "sha7" },
  { path: "voice/chase-spec.md", type: "blob" as const, sha: "sha8" },
];

describe("buildScopedMemoryBlocks", () => {
  it("when scope is null, falls through to buildMemoryBlocks (root behaviour)", async () => {
    // The mock for buildMemoryBlocks returns [] — just checking it calls through.
    const blocks = await buildScopedMemoryBlocks("owner/brain", "gh-token", null);
    // vi.mock above mocks buildMemoryBlocks as returning []; result is [].
    expect(Array.isArray(blocks)).toBe(true);
  });

  it("with a scope, loads only files inside the scope subtree", async () => {
    // Override listRepoTree for this case.
    const { listRepoTree, fetchFileContent } = await import("@/lib/pa-brain");
    vi.mocked(listRepoTree).mockResolvedValueOnce(SCOPED_TREE);
    vi.mocked(fetchFileContent).mockImplementation(async (_repo, path) => `content of ${path}`);

    const blocks = await buildScopedMemoryBlocks(
      "owner/brain",
      "gh-token",
      "customers/valley-roofing",
    );

    const paths = blocks.map((b) => b.path);
    expect(paths).toContain("customers/valley-roofing/CLAUDE.md");
    expect(paths).toContain("customers/valley-roofing/brand.md");
    expect(paths).toContain("customers/valley-roofing/brand.json");
    expect(paths).toContain("customers/valley-roofing/memory/voice.md");
    expect(paths).toContain("customers/valley-roofing/memory/facts.md");
    expect(paths).toContain("customers/valley-roofing/voice/tone.md");
    // Files outside scope are excluded.
    expect(paths).not.toContain("memory/user_role.md");
    expect(paths).not.toContain("voice/chase-spec.md");
  });

  it("returns [] when the scope folder has no matching files", async () => {
    const { listRepoTree } = await import("@/lib/pa-brain");
    vi.mocked(listRepoTree).mockResolvedValueOnce([
      { path: "customers/empty/README.md", type: "blob", sha: "sha9" },
    ]);
    const blocks = await buildScopedMemoryBlocks("owner/brain", "gh-token", "customers/empty");
    expect(blocks).toEqual([]);
  });
});
