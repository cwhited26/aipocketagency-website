import { describe, it, expect } from "vitest";
import {
  fileTypeForPath,
  isKeyFile,
  buildFolderGraphFromTree,
  type FolderTreeEntry,
} from "../graph-folders";
import type { RawFile } from "../graph";

describe("fileTypeForPath", () => {
  it("classifies by extension", () => {
    expect(fileTypeForPath("memory/x.md")).toBe("markdown");
    expect(fileTypeForPath("a/b.MDX")).toBe("markdown");
    expect(fileTypeForPath("config.json")).toBe("json");
    expect(fileTypeForPath("ci.yaml")).toBe("yaml");
    expect(fileTypeForPath("ci.yml")).toBe("yaml");
    expect(fileTypeForPath("notes.txt")).toBe("text");
    expect(fileTypeForPath("rows.csv")).toBe("data");
    expect(fileTypeForPath("deck.pdf")).toBe("pdf");
    expect(fileTypeForPath("logo.PNG")).toBe("image");
    expect(fileTypeForPath("bin.dat")).toBe("other");
  });
});

describe("isKeyFile", () => {
  it("flags the agent's standing files, voice spec, customers, and projects", () => {
    expect(isKeyFile("CLAUDE.md")).toBe(true);
    expect(isKeyFile("MEMORY.md")).toBe(true);
    expect(isKeyFile("voice/chase-spec.md")).toBe(true);
    expect(isKeyFile("memory/project_pa_brain_map.md")).toBe(true);
    expect(isKeyFile("APA/Decision_Log.md")).toBe(true);
    expect(isKeyFile("APA/Voice_of_Customer/notes.md")).toBe(true);
    expect(isKeyFile("memory/customer_alan.md")).toBe(true);
  });

  it("does not flag an ordinary note", () => {
    expect(isKeyFile("memory/random_thought.md")).toBe(false);
    expect(isKeyFile("notes/grocery.md")).toBe(false);
  });
});

describe("buildFolderGraphFromTree", () => {
  const entries: FolderTreeEntry[] = [
    { path: "CLAUDE.md", type: "blob" },
    { path: "memory", type: "tree" },
    { path: "memory/MEMORY.md", type: "blob" },
    { path: "memory/project_x.md", type: "blob" },
    { path: "voice", type: "tree" },
    { path: "voice/chase-spec.md", type: "blob" },
    { path: "assets", type: "tree" },
    { path: "assets/photo.png", type: "blob" },
    { path: ".git/config", type: "blob" },
    { path: "node_modules/pkg/index.js", type: "blob" },
  ];

  const files: RawFile[] = [
    {
      path: "memory/MEMORY.md",
      content: `---\nname: MEMORY index\ndescription: The index of everything\ncreated: 2026-06-08\n---\n\nLinks to [[project_x]].`,
    },
    {
      path: "memory/project_x.md",
      content: `---\nname: Project X\ndescription: A project\n---\n\nBody.`,
    },
    {
      path: "voice/chase-spec.md",
      content: `---\nname: Voice spec\n---\n\nHow Chase sounds.`,
    },
    { path: "CLAUDE.md", content: `# Instructions\n\nDo the thing.` },
  ];

  const g = buildFolderGraphFromTree(entries, files, { repoLabel: "whited-brain" });

  it("adds a synthetic root, folder nodes, and file nodes", () => {
    expect(g.nodes.find((n) => n.id === "(root)")?.kind).toBe("folder");
    expect(g.nodes.find((n) => n.id === "memory")?.kind).toBe("folder");
    expect(g.nodes.find((n) => n.id === "memory/MEMORY.md")?.kind).toBe("file");
  });

  it("skips .git and node_modules noise", () => {
    expect(g.nodes.find((n) => n.path?.startsWith(".git"))).toBeUndefined();
    expect(g.nodes.find((n) => n.path?.includes("node_modules"))).toBeUndefined();
  });

  it("skips binary asset files but keeps the assets folder for structure", () => {
    expect(g.nodes.find((n) => n.id === "assets/photo.png")).toBeUndefined();
    expect(g.nodes.find((n) => n.id === "assets")?.kind).toBe("folder");
  });

  it("flags key files and pulls excerpt + date from frontmatter", () => {
    const idx = g.nodes.find((n) => n.id === "memory/MEMORY.md");
    expect(idx?.isKey).toBe(true);
    expect(idx?.excerpt).toBe("The index of everything");
    expect(idx?.date).toBe("2026-06-08");
    const claude = g.nodes.find((n) => n.id === "CLAUDE.md");
    expect(claude?.isKey).toBe(true);
  });

  it("draws containment edges from parent folder (or root) to each child", () => {
    const has = (s: string, t: string) =>
      g.edges.some((e) => e.kind === "containment" && e.source === s && e.target === t);
    expect(has("(root)", "memory")).toBe(true);
    expect(has("(root)", "CLAUDE.md")).toBe(true);
    expect(has("memory", "memory/MEMORY.md")).toBe(true);
    expect(has("voice", "voice/chase-spec.md")).toBe(true);
  });

  it("draws a wikilink edge between markdown files", () => {
    expect(
      g.edges.some(
        (e) => e.kind === "wikilink" && e.source === "memory/MEMORY.md" && e.target === "memory/project_x.md",
      ),
    ).toBe(true);
  });

  it("reports the distinct top folders and file types for the filters", () => {
    expect(g.topFolders).toContain("memory");
    expect(g.topFolders).toContain("voice");
    expect(g.topFolders).toContain("(root)");
    expect(g.fileTypes).toContain("markdown");
  });

  it("counts only files (not folders or root) in fileCount", () => {
    expect(g.fileCount).toBe(4);
  });

  it("uses the humanized repo label on the root node", () => {
    expect(g.nodes.find((n) => n.id === "(root)")?.label).toBe("Whited brain");
  });
});
