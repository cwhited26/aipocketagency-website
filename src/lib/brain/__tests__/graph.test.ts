import { describe, it, expect } from "vitest";
import {
  parseFrontmatter,
  detectPeople,
  buildGraphFromFiles,
  computeAreaCounts,
  computeGaps,
  type RawFile,
} from "../graph";

describe("parseFrontmatter", () => {
  it("reads a top-level type and list fields", () => {
    const fm = parseFrontmatter(
      `---\nname: Plain English\ndescription: A rule\ntype: feedback\ncreated: 2026-06-08\ndepends_on: []\nsuperseded_by: []\n---\n\n# Body`,
    );
    expect(fm.type).toBe("feedback");
    expect(fm.name).toBe("Plain English");
    expect(fm.description).toBe("A rule");
    expect(fm.date).toBe("2026-06-08");
    expect(fm.superseded).toBe(false);
  });

  it("reads a type nested under metadata:", () => {
    const fm = parseFrontmatter(
      `---\nname: project_x\ndescription: d\nmetadata:\n  type: project\n---\n\nbody`,
    );
    expect(fm.type).toBe("project");
  });

  it("parses inline and block list fields", () => {
    const inline = parseFrontmatter(
      `---\ntype: project\ndepends_on: [a-memory, b-memory]\nsuperseded_by: [newer]\n---\n`,
    );
    expect(inline.dependsOn).toEqual(["a-memory", "b-memory"]);
    expect(inline.supersededBy).toEqual(["newer"]);
    expect(inline.superseded).toBe(true);

    const block = parseFrontmatter(
      `---\ntype: project\ndepends_on:\n  - one\n  - two\n---\n`,
    );
    expect(block.dependsOn).toEqual(["one", "two"]);
  });

  it("returns an empty frontmatter when there is none", () => {
    expect(parseFrontmatter("# Just a heading\n\ntext").type).toBe("unknown");
  });
});

describe("detectPeople", () => {
  it("finds names recurring across entries, ignoring tools and section words", () => {
    const files: RawFile[] = [
      { path: "memory/a.md", content: "---\ntype: project\n---\nAlan Stoll asked about Slack. June update." },
      { path: "memory/b.md", content: "---\ntype: project\n---\nFollowed up with Alan Stoll on Gmail." },
      { path: "memory/c.md", content: "---\ntype: feedback\n---\nNo names here, just Stripe." },
    ];
    const people = detectPeople(files, "Chase");
    const names = people.map((p) => p.name);
    expect(names).toContain("Alan Stoll");
    expect(names).not.toContain("Slack");
    expect(names).not.toContain("Gmail");
    expect(names).not.toContain("June");
  });

  it("does not surface a one-off single-token capital", () => {
    const files: RawFile[] = [
      { path: "memory/a.md", content: "---\ntype: project\n---\nSomething happened once." },
    ];
    expect(detectPeople(files, null)).toHaveLength(0);
  });

  it("folds a surname mention into the full-name node", () => {
    const files: RawFile[] = [
      { path: "memory/a.md", content: "---\ntype: project\n---\nMet with Patrick Jones today." },
      { path: "memory/b.md", content: "---\ntype: project\n---\nFollowed up with Patrick Jones." },
      { path: "memory/c.md", content: "---\ntype: project\n---\nCalled Jones again; Jones replied fast." },
    ];
    const people = detectPeople(files, null);
    expect(people.map((p) => p.name)).toContain("Patrick Jones");
    expect(people.map((p) => p.name)).not.toContain("Jones");
  });
});

describe("buildGraphFromFiles", () => {
  const files: RawFile[] = [
    {
      path: "memory/feedback_voice.md",
      content:
        "---\nname: Voice rule\ntype: feedback\ncreated: 2026-06-01\ndepends_on: []\nsuperseded_by: []\n---\nKeep it plain. See [[project_launch]].",
    },
    {
      path: "memory/project_launch.md",
      content:
        "---\nname: Launch\ntype: project\ncreated: 2026-06-02\n---\nLaunch plan with Alan Stoll over Slack and Gmail.",
    },
    {
      path: "memory/project_followup.md",
      content:
        "---\nname: Follow up\ntype: project\ncreated: 2026-06-03\n---\nFollow up with Alan Stoll. Superseded.\n",
    },
    {
      path: "memory/reference_competitor_acme.md",
      content:
        "---\nname: Acme teardown\ntype: reference\n---\nAcme is a competitor charging a lot.",
    },
    { path: "voice/influences/hormozi/sample.md", content: "Offer stacking sample." },
    { path: "voice/influences/hormozi/_AWAITING.md", content: "todo" },
  ];

  it("creates memory, voice, customer, tool, and competitive nodes", () => {
    const g = buildGraphFromFiles(files, { ownerName: "Chase" });
    const types = new Set(g.nodes.map((n) => n.type));
    expect(types.has("memory")).toBe(true);
    expect(types.has("voice")).toBe(true);
    expect(types.has("customer")).toBe(true);
    expect(types.has("tool")).toBe(true);
    expect(types.has("competitive")).toBe(true);

    // one voice node for the hormozi dir (not one per sample)
    expect(g.nodes.filter((n) => n.type === "voice")).toHaveLength(1);
  });

  it("builds a wikilink reference edge", () => {
    const g = buildGraphFromFiles(files);
    const ref = g.edges.find(
      (e) => e.kind === "reference" && e.source === "memory/feedback_voice.md",
    );
    expect(ref?.target).toBe("memory/project_launch.md");
  });

  it("links two entries to the same shared customer hub", () => {
    const g = buildGraphFromFiles(files, { ownerName: "Chase" });
    const stoll = g.nodes.find((n) => n.type === "customer" && n.label === "Alan Stoll");
    expect(stoll).toBeDefined();
    const mentions = g.edges.filter(
      (e) => e.kind === "mentions-person" && e.target === stoll!.id,
    );
    expect(mentions.length).toBeGreaterThanOrEqual(2);
  });

  it("tags competitive entries with the competitive area", () => {
    const g = buildGraphFromFiles(files);
    const acme = g.nodes.find((n) => n.label === "Acme teardown");
    expect(acme?.area).toBe("competitive");
    expect(acme?.type).toBe("competitive");
  });

  it("accumulates node degree from edges", () => {
    const g = buildGraphFromFiles(files, { ownerName: "Chase" });
    const launch = g.nodes.find((n) => n.id === "memory/project_launch.md");
    expect(launch!.degree).toBeGreaterThan(0);
  });
});

describe("computeAreaCounts", () => {
  it("partitions nodes into the eight areas in order", () => {
    const g = buildGraphFromFiles([
      { path: "memory/feedback_a.md", content: "---\ntype: feedback\n---\nx" },
      { path: "memory/project_b.md", content: "---\ntype: project\n---\ny" },
    ]);
    const areas = computeAreaCounts(g.nodes);
    expect(areas.map((a) => a.area)).toEqual([
      "voice",
      "customers",
      "tools",
      "decisions",
      "specs",
      "standing-rules",
      "business",
      "competitive",
    ]);
    const total = areas.reduce((s, a) => s + a.count, 0);
    expect(total).toBe(g.nodes.length);
  });
});

describe("computeGaps", () => {
  it("flags missing voice, customers, and testimonials on a thin brain", () => {
    const files: RawFile[] = [
      { path: "memory/project_a.md", content: "---\ntype: project\n---\nsomething" },
    ];
    const g = buildGraphFromFiles(files);
    const areas = g.gaps.map((x) => x.area);
    expect(areas).toContain("Voice");
    expect(areas).toContain("Customers");
    expect(areas).toContain("Testimonials");
  });

  it("does not flag testimonials when the corpus mentions one", () => {
    const files: RawFile[] = [
      {
        path: "memory/user_about.md",
        content:
          "---\ntype: user\n---\nWe sell roofs. A customer left a glowing testimonial about the work. Pricing is $5000.",
      },
    ];
    const gaps = computeGaps(buildGraphFromFiles(files).nodes, files);
    expect(gaps.map((x) => x.area)).not.toContain("Testimonials");
    expect(gaps.map((x) => x.area)).not.toContain("Pricing");
  });
});

describe("deep entries in the galaxy", () => {
  const deepFiles: RawFile[] = [
    { path: "memory/project_a.md", content: "---\ntype: project\n---\nsomething" },
    {
      path: "BOS/BOS_Decision_Log.md",
      content: [
        "# BOS Decision Log",
        "",
        "## Decision 12 — 2026-04-04 — Seed Data Enrichment",
        "Body of twelve.",
        "",
        "**Decision #206** — 2026-06-11 — **BOS Sites productized**",
        "Decision: three tiers.",
      ].join("\n"),
    },
    {
      path: "APA/Products/Pocket_Agent_Skills_SPEC_v1.md",
      content: "# Pocket Agent — Skills SPEC v1\n\nSkills are accumulated techniques.",
    },
    {
      path: "BOS/HanesEnvironmental/Open_Questions.md",
      content: [
        "# Open Questions",
        "",
        "## HE-Q-1 — Native or embedded?",
        "",
        "**Blocks:** §8 of the spec.",
      ].join("\n"),
    },
  ];

  it("turns each decision into a node hanging off its log-file hub", () => {
    const g = buildGraphFromFiles(deepFiles);
    const decisionNodes = g.nodes.filter((n) => n.type === "decision");
    // 1 hub + 2 decisions
    expect(decisionNodes).toHaveLength(3);
    const hub = g.nodes.find((n) => n.id === "BOS/BOS_Decision_Log.md");
    expect(hub).toBeDefined();
    expect(hub!.summary).toContain("2 decisions");
    const entry = g.nodes.find((n) => n.id.includes("#decision-206"));
    expect(entry).toBeDefined();
    expect(entry!.area).toBe("decisions");
    expect(entry!.path).toBe("BOS/BOS_Decision_Log.md");
    expect(
      g.edges.some((e) => e.source === "BOS/BOS_Decision_Log.md" && e.target === entry!.id),
    ).toBe(true);
  });

  it("counts decisions and specs in the area strip", () => {
    const g = buildGraphFromFiles(deepFiles);
    const byArea = new Map(g.areas.map((a) => [a.area, a.count]));
    // 2 decisions + 1 hub + the project memory entry
    expect(byArea.get("decisions")).toBe(4);
    expect(byArea.get("specs")).toBe(1);
    const spec = g.nodes.find((n) => n.type === "spec");
    expect(spec!.label).toContain("Skills SPEC");
  });

  it("surfaces open questions in the gaps panel, not as nodes", () => {
    const g = buildGraphFromFiles(deepFiles);
    expect(g.nodes.some((n) => n.id.includes("Open_Questions"))).toBe(false);
    const gap = g.gaps.find((x) => x.area === "Open questions");
    expect(gap).toBeDefined();
    expect(gap!.message).toContain("1 open question");
  });
});
