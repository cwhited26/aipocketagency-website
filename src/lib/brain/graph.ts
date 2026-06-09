// Brain Map graph extraction.
//
// Walks the owner's brain repo and turns it into a graph the owner can read:
// what PA has learned about their business, how the pieces connect, and — the
// part operators actually feel — what's missing. Pure functions operate on a
// flat list of { path, content } files so they're trivially testable; the
// fetch-driven entry point (buildBrainGraph) layers the GitHub reads on top via
// the existing pa-brain helpers (direct REST, no SDK).

import { listRepoTree, fetchFileContent } from "@/lib/pa-brain";

// ── Public types ───────────────────────────────────────────────────────────────

// Structural kind of a node — what the thing IS.
export type BrainNodeType = "memory" | "voice" | "customer" | "tool" | "competitive";

// Memory frontmatter type, present only on memory nodes.
export type MemoryKind = "user" | "feedback" | "project" | "reference" | "unknown";

// Knowledge area — what the thing is ABOUT. Drives the color legend and the
// top-of-page count strip. Every node carries exactly one area so the strip is a
// clean partition (no double counting).
export type KnowledgeArea =
  | "voice"
  | "customers"
  | "tools"
  | "decisions"
  | "standing-rules"
  | "business"
  | "competitive";

export type BrainEdgeKind =
  | "reference" // an explicit [[wikilink]] between memory entries
  | "depends" // a depends_on frontmatter link
  | "supersede" // a superseded_by frontmatter link (temporal chain)
  | "mentions-person" // a memory names a customer/person
  | "uses-tool"; // a memory references a tool/connector

export type BrainNode = {
  id: string; // stable id — file path for docs, "voice:/person:/tool:" prefix for synthetic
  label: string; // human display name
  type: BrainNodeType;
  area: KnowledgeArea;
  memoryKind?: MemoryKind; // only on type === "memory"
  path?: string; // brain-repo path, for "Open in Documents" deep links
  date: string | null; // created || last_reviewed
  superseded: boolean; // has a non-empty superseded_by
  summary: string; // frontmatter description, else first paragraph
  refs: string[]; // outgoing reference target ids (for the inspection panel)
  degree: number; // total connected edges, for force-layout sizing
};

export type BrainEdge = {
  source: string;
  target: string;
  kind: BrainEdgeKind;
};

export type AreaCount = {
  area: KnowledgeArea;
  label: string;
  count: number;
};

export type Gap = {
  area: string;
  message: string;
};

export type BrainGraph = {
  nodes: BrainNode[];
  edges: BrainEdge[];
  areas: AreaCount[];
  gaps: Gap[];
  fileCount: number;
};

export type RawFile = { path: string; content: string };

// ── Vocabulary ───────────────────────────────────────────────────────────────
//
// A tool/product gazetteer. These are generic SaaS / connector names — NOT
// customer-identifying — so they're safe to ship in source (unlike people names,
// which we never hardcode; see detectPeople). The gazetteer doubles as a stoplist
// for people detection: anything matched here is a product, not a person.

const TOOL_VOCAB: { canonical: string; patterns: RegExp[] }[] = [
  { canonical: "Gmail", patterns: [/\bgmail\b/i] },
  { canonical: "Google Calendar", patterns: [/\bgoogle calendar\b/i, /\bgcal\b/i] },
  { canonical: "Slack", patterns: [/\bslack\b/i] },
  { canonical: "QuickBooks", patterns: [/\bquickbooks\b/i, /\bqbo\b/i] },
  { canonical: "Stripe", patterns: [/\bstripe\b/i] },
  { canonical: "Calendly", patterns: [/\bcalendly\b/i] },
  { canonical: "Zoom", patterns: [/\bzoom\b/i] },
  { canonical: "Twilio", patterns: [/\btwilio\b/i] },
  { canonical: "Notion", patterns: [/\bnotion\b/i] },
  { canonical: "GitHub", patterns: [/\bgithub\b/i] },
  { canonical: "Vercel", patterns: [/\bvercel\b/i] },
  { canonical: "Supabase", patterns: [/\bsupabase\b/i] },
  { canonical: "Modal", patterns: [/\bmodal\b/i] },
  { canonical: "Resend", patterns: [/\bresend\b/i] },
  { canonical: "Whisper", patterns: [/\bwhisper\b/i] },
  { canonical: "Bright Data", patterns: [/\bbright data\b/i] },
  { canonical: "Cloudflare", patterns: [/\bcloudflare\b/i] },
  { canonical: "OpenAI", patterns: [/\bopenai\b/i] },
  { canonical: "Anthropic", patterns: [/\banthropic\b/i, /\bclaude\b/i] },
  { canonical: "YouTube", patterns: [/\byoutube\b/i] },
  { canonical: "Google Maps", patterns: [/\bgoogle maps\b/i] },
];

// Capitalized phrases that look like names but are products, places, or section
// words — kept out of people detection. The tool gazetteer covers product names
// already; this catches the rest.
const PERSON_STOPWORDS = new Set(
  [
    "Pocket Agent", "Lead Scout", "Mission Control", "Daily Brief", "Brain Map",
    "Email Drafter", "Follow Up", "Bright Data", "Google Maps", "Google Cloud",
    "Tennessee Valley", "United States", "New York", "San Francisco",
    "Claude Code", "Fresh Page", "Home Improvement", "Buildout Studios",
    "Whited Consulting", "Pocket", "Agent", "Studio", "Pro", "Free", "Phase",
    "Wave", "January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December", "Monday",
    "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
    "Inbox", "Apps", "Tasks", "Connections", "Settings", "Projects",
    // Brands/products that slip past the tool gazetteer, plus common English
    // words that land in TitleCase at the start of a sentence or in a heading.
    "Claude", "Facebook", "Instagram", "LinkedIn", "Twitter", "Mac", "iPhone",
    "The", "What", "It", "Real", "Names", "Name", "Custom", "Your", "Our",
    "Their", "His", "Her", "Here", "There", "Now", "Then", "Also", "See",
    "Note", "Why", "How", "When", "Where", "Who", "This", "That", "Don",
    "Personas", "Skills", "Routines", "Capture", "Documents",
  ].map((s) => s.toLowerCase()),
);

// Single tokens that show up in TitleCase phrases but are doc/domain jargon, never
// people. Any candidate phrase containing one of these is rejected outright — this
// is what keeps "Decision Log", "Build Tools", "Feature Inventory" out.
const PERSON_JARGON_TOKENS = new Set(
  [
    "log", "logs", "tools", "tool", "inventory", "pack", "items", "item", "plan",
    "plans", "workspace", "primitive", "pattern", "sheet", "thread", "threads",
    "architecture", "playbook", "stuff", "framing", "recovery", "rewrite",
    "product", "copy", "decision", "decisions", "change", "feature", "features",
    "daily", "active", "execution", "lanes", "lane", "build", "output", "action",
    "actions", "capture", "captured", "mark", "complete", "source", "details",
    "value", "bot", "estimates", "estimate", "pending", "framing", "scout",
    "control", "brief", "drafter", "radar", "pivot", "rollback", "anchor",
    "scaffold", "scaffolding", "dispatch", "dispatcher", "orchestrator", "wave",
    "phase", "studio", "agent", "pocket", "connection", "connections", "memory",
    "brain", "model", "models", "step", "steps", "this", "that", "never",
    "always", "drafting", "pairs", "via", "under", "framing", "account",
    // function words that appear at the head of TitleCase phrases
    "no", "the", "a", "an", "what", "real", "your", "our", "their", "up", "not",
    "names", "name", "custom", "dev", "new", "old", "more", "less", "next", "last",
  ],
);

// Words that, appearing immediately BEFORE a name, mark it as a person.
const PERSON_PREFIX =
  /\b(?:with|to|from|for|told|asked|email(?:ed|ing)?|met|meeting|call(?:ed|ing)?|client|customer|prospect|onboard\w*|contacted|texted|messaged|spoke|reached|hired|paid|owner|rep)\s*$/i;
// Words that, appearing immediately AFTER a name, mark it as a person.
const PERSON_SUFFIX =
  /^(?:'s\b|\s+(?:said|asked|called|wants?|needs?|replied|paid|signed|owns?|runs?|sent|texted|email(?:ed|s)?|reached|prospect|client|customer|onboard\w*|is\b|was\b|will\b))/i;

const AREA_LABELS: Record<KnowledgeArea, string> = {
  voice: "Voice",
  customers: "Customers & people",
  tools: "Tools & connectors",
  decisions: "Decisions & projects",
  "standing-rules": "Standing rules",
  business: "About the business",
  competitive: "Competitive intel",
};

// ── Frontmatter parsing ────────────────────────────────────────────────────────

export type Frontmatter = {
  name: string | null;
  description: string | null;
  type: MemoryKind;
  date: string | null;
  superseded: boolean;
  dependsOn: string[];
  supersededBy: string[];
};

// Pulls a YAML-ish frontmatter block. The brain mixes two conventions — `type:`
// at the top level and `type:` nested under a `metadata:` block — so we accept
// either. List fields (depends_on / superseded_by) come as inline `[a, b]` or
// multi-line `- a`; both are handled.
export function parseFrontmatter(content: string): Frontmatter {
  const empty: Frontmatter = {
    name: null,
    description: null,
    type: "unknown",
    date: null,
    superseded: false,
    dependsOn: [],
    supersededBy: [],
  };
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return empty;
  const block = match[1];
  const lines = block.split("\n");

  const scalar = (key: string): string | null => {
    // Matches `key: value` at any indentation (top-level or under metadata:).
    const re = new RegExp(`^\\s*${key}:\\s*(.*)$`, "m");
    const m = block.match(re);
    if (!m) return null;
    const v = m[1].trim().replace(/^["']|["']$/g, "");
    return v.length ? v : null;
  };

  const list = (key: string): string[] => {
    const out: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(new RegExp(`^\\s*${key}:\\s*(.*)$`));
      if (!m) continue;
      const inline = m[1].trim();
      if (inline.startsWith("[")) {
        // Inline form: [a, b, c] or []
        const inner = inline.replace(/^\[|\]$/g, "").trim();
        if (inner)
          out.push(
            ...inner
              .split(",")
              .map((s) => s.trim().replace(/^["']|["']$/g, ""))
              .filter(Boolean),
          );
      } else if (!inline) {
        // Block form: subsequent `- item` lines
        for (let j = i + 1; j < lines.length; j++) {
          const item = lines[j].match(/^\s*-\s+(.*)$/);
          if (!item) break;
          const v = item[1].trim().replace(/^["']|["']$/g, "");
          if (v) out.push(v);
        }
      }
      break;
    }
    return out;
  };

  const rawType = (scalar("type") ?? "").toLowerCase();
  const type: MemoryKind =
    rawType === "user" ||
    rawType === "feedback" ||
    rawType === "project" ||
    rawType === "reference"
      ? rawType
      : "unknown";

  const supersededBy = list("superseded_by");
  return {
    name: scalar("name"),
    description: scalar("description"),
    type,
    date: scalar("created") ?? scalar("last_reviewed"),
    superseded: supersededBy.length > 0,
    dependsOn: list("depends_on"),
    supersededBy,
  };
}

// First real paragraph of a markdown body (after frontmatter), heading stripped,
// clipped — used as a node summary when there's no frontmatter description.
function firstParagraph(content: string): string {
  const body = content.replace(/^---\n[\s\S]*?\n---\n?/, "");
  for (const block of body.split(/\n\s*\n/)) {
    const text = block
      .replace(/^#+\s.*$/gm, "")
      .replace(/[*_`>#-]/g, "")
      .trim();
    if (text.length > 12) return text.length > 240 ? `${text.slice(0, 240)}…` : text;
  }
  return "";
}

// ── Classification helpers ───────────────────────────────────────────────────────

function slugFromPath(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.mdx?$/i, "");
}

function humanizeSlug(slug: string): string {
  const underIdx = slug.indexOf("_");
  const rest = underIdx === -1 ? slug : slug.slice(underIdx + 1);
  const words = rest.replace(/[-_]/g, " ").replace(/\d{4}-\d{2}-\d{2}/g, "").trim();
  if (!words) return slug;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function isCompetitive(path: string, fm: Frontmatter): boolean {
  const hay = `${path} ${fm.name ?? ""} ${fm.description ?? ""}`.toLowerCase();
  return /competit|\brival\b|teardown/.test(hay) || /\/competitive\//.test(path);
}

function areaForMemory(path: string, fm: Frontmatter): KnowledgeArea {
  if (isCompetitive(path, fm)) return "competitive";
  switch (fm.type) {
    case "feedback":
      return "standing-rules";
    case "project":
      return "decisions";
    case "user":
      return "business";
    case "reference":
      return "tools";
    default:
      return "business";
  }
}

// ── People detection ─────────────────────────────────────────────────────────
//
// People are NEVER hardcoded — we never want a real customer name in shipped
// source (the no-real-names rule). Instead we derive them from the owner's own
// brain: TitleCase candidates that recur across ≥2 memory entries and aren't
// products (tool gazetteer) or section/place words (stoplist). Names listed in a
// `customer_names_protected.md` / `customers` / `people` memory are taken as-is.

const TITLECASE = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g;

function isToolPhrase(phrase: string): boolean {
  const p = phrase.toLowerCase();
  return TOOL_VOCAB.some((t) => t.canonical.toLowerCase() === p);
}

function explicitPeopleNames(files: RawFile[]): Set<string> {
  const names = new Set<string>();
  for (const f of files) {
    const slug = slugFromPath(f.path).toLowerCase();
    if (!/customer|people|person|relationship|contact|protected|prospect/.test(slug)) continue;
    const body = f.content.replace(/^---\n[\s\S]*?\n---\n?/, "");
    // (a) bolded or bulleted entries: "- **Alan Stoll**" / "- Alan Stoll —"
    for (const m of body.matchAll(/^\s*[-*]\s+\*{0,2}([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/gm)) {
      const n = m[1].trim();
      if (looksLikeName(n)) names.add(n);
    }
    // (b) prose declarations: "...names — Patrick, Alan, Stoll, Keaton, and any other..."
    for (const line of body.split("\n")) {
      const decl = line.match(/\bnames?\b.*?[—:-]\s*(.+)/i);
      if (!decl) continue;
      const seg = decl[1].split(/\band any\b|\bnever\b|\.\s|;/i)[0];
      for (const m of seg.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g)) {
        const n = m[1].trim();
        if (looksLikeName(n)) names.add(n);
      }
    }
  }
  return names;
}

function looksLikeName(phrase: string): boolean {
  const lower = phrase.toLowerCase();
  if (PERSON_STOPWORDS.has(lower)) return false;
  if (isToolPhrase(phrase)) return false;
  for (const word of lower.split(/\s+/)) {
    if (PERSON_JARGON_TOKENS.has(word)) return false;
  }
  return true;
}

export function detectPeople(
  files: RawFile[],
  ownerName: string | null,
  exclude: Set<string> = new Set(),
): { name: string; files: string[] }[] {
  const explicit = explicitPeopleNames(files);
  const owner = (ownerName ?? "").toLowerCase();
  const excluded = new Set<string>();
  for (const e of exclude) {
    excluded.add(e.toLowerCase());
    for (const tok of e.toLowerCase().split(/\s+/)) excluded.add(tok); // also drop name tokens
  }
  // candidate -> files mentioning it at all, and files mentioning it in a
  // person-shaped context (verb/preposition before, possessive/verb after).
  const docFreq = new Map<string, Set<string>>();
  const ctxFreq = new Map<string, Set<string>>();

  for (const f of files) {
    if (!f.path.startsWith("memory/")) continue;
    const body = f.content.replace(/^---\n[\s\S]*?\n---\n?/, "");
    for (const m of body.matchAll(TITLECASE)) {
      const phrase = m[1].trim();
      const lower = phrase.toLowerCase();
      if (!looksLikeName(phrase)) continue;
      if (excluded.has(lower)) continue;
      if (owner && lower.includes(owner)) continue;

      const all = docFreq.get(phrase) ?? new Set<string>();
      all.add(f.path);
      docFreq.set(phrase, all);

      const idx = m.index ?? 0;
      const before = body.slice(Math.max(0, idx - 24), idx);
      const after = body.slice(idx + phrase.length, idx + phrase.length + 16);
      if (PERSON_PREFIX.test(before) || PERSON_SUFFIX.test(after) || explicit.has(phrase)) {
        const ctx = ctxFreq.get(phrase) ?? new Set<string>();
        ctx.add(f.path);
        ctxFreq.set(phrase, ctx);
      }
    }
  }

  const byName = new Map<string, Set<string>>();

  // Generic detection accepts only multi-token "First Last" names — a two-word
  // TitleCase phrase that survives the jargon/function-word filter and appears in
  // a person-shaped context is almost always a real person. Single common nouns
  // ("Owner", "Business") are too noisy to accept generically, so single-token
  // names come only from the explicit people/protected-names list below.
  for (const [name, fileSet] of docFreq) {
    if (!name.includes(" ")) continue;
    const ctx = ctxFreq.get(name) ?? new Set<string>();
    if (ctx.size >= 2 || (ctx.size >= 1 && fileSet.size >= 2)) {
      byName.set(name, new Set(ctx.size ? ctx : fileSet));
    }
  }

  // Explicitly listed names (single- or multi-token) always qualify; their files
  // are every memory entry that names them.
  for (const name of explicit) {
    const word = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    const mentioning = files
      .filter((f) => f.path.startsWith("memory/") && word.test(f.content))
      .map((f) => f.path);
    if (mentioning.length) byName.set(name, new Set([...(byName.get(name) ?? []), ...mentioning]));
  }

  const out: { name: string; files: string[] }[] = [];
  for (const [name, fileSet] of byName) out.push({ name, files: [...fileSet] });
  // Merge a single-token name into a two-token name it's a surname of
  // (e.g. "Stoll" folded into "Alan Stoll") to avoid duplicate person nodes.
  const multi = out.filter((p) => p.name.includes(" "));
  const merged = out.filter((p) => {
    if (p.name.includes(" ")) return true;
    const surname = p.name;
    const parent = multi.find((m) => m.name.split(" ").includes(surname));
    if (parent) {
      for (const fp of p.files) if (!parent.files.includes(fp)) parent.files.push(fp);
      return false;
    }
    return true;
  });
  return merged.sort((a, b) => b.files.length - a.files.length);
}

// ── Core graph builder ─────────────────────────────────────────────────────────

export function buildGraphFromFiles(
  files: RawFile[],
  opts: { ownerName?: string | null } = {},
): BrainGraph {
  const nodes: BrainNode[] = [];
  const edges: BrainEdge[] = [];
  const nodeById = new Map<string, BrainNode>();

  const addNode = (n: BrainNode): void => {
    if (nodeById.has(n.id)) return;
    nodeById.set(n.id, n);
    nodes.push(n);
  };

  const memoryFiles = files.filter(
    (f) => f.path.startsWith("memory/") && /\.mdx?$/i.test(f.path),
  );

  // slug (filename without ext) -> node id, for resolving [[wikilink]] / depends_on
  const slugToId = new Map<string, string>();

  // 1) Memory + competitive doc nodes
  for (const f of memoryFiles) {
    const fm = parseFrontmatter(f.content);
    const slug = slugFromPath(f.path);
    const competitive = isCompetitive(f.path, fm);
    const node: BrainNode = {
      id: f.path,
      label: fm.name && fm.name.length <= 48 ? fm.name : humanizeSlug(slug),
      type: competitive ? "competitive" : "memory",
      area: areaForMemory(f.path, fm),
      memoryKind: fm.type,
      path: f.path,
      date: fm.date,
      superseded: fm.superseded,
      summary: fm.description ?? firstParagraph(f.content),
      refs: [],
      degree: 0,
    };
    addNode(node);
    slugToId.set(slug.toLowerCase(), node.id);
  }

  // Also ingest standalone competitive docs that live outside memory/ (PA user
  // brains keep them under brain/competitive/). Memory-based competitive notes are
  // already covered above.
  for (const f of files) {
    if (f.path.startsWith("memory/")) continue;
    if (!/\.mdx?$/i.test(f.path)) continue;
    if (!/\/competitive\//.test(f.path)) continue;
    const fm = parseFrontmatter(f.content);
    const node: BrainNode = {
      id: f.path,
      label: fm.name ?? humanizeSlug(slugFromPath(f.path)),
      type: "competitive",
      area: "competitive",
      path: f.path,
      date: fm.date,
      superseded: fm.superseded,
      summary: fm.description ?? firstParagraph(f.content),
      refs: [],
      degree: 0,
    };
    addNode(node);
  }

  // 2) Voice influence nodes — one per creator directory under voice/influences/.
  const influenceDirs = new Set<string>();
  for (const f of files) {
    const m = f.path.match(/^voice\/influences\/([^/]+)\//);
    if (m) influenceDirs.add(m[1]);
  }
  for (const dir of influenceDirs) {
    const sampleCount = files.filter((f) =>
      f.path.startsWith(`voice/influences/${dir}/`),
    ).length;
    addNode({
      id: `voice:${dir}`,
      label: humanizeSlug(dir),
      type: "voice",
      area: "voice",
      path: `voice/influences/${dir}`,
      date: null,
      superseded: false,
      summary: `Voice influence — ${sampleCount} reference ${sampleCount === 1 ? "sample" : "samples"} PA studies to sound like you.`,
      refs: [],
      degree: 0,
    });
  }

  // 3) Explicit cross-reference edges: [[wikilink]] + depends_on + superseded_by
  const linkEdge = (sourceId: string, targetSlug: string, kind: BrainEdgeKind): void => {
    const targetId = slugToId.get(targetSlug.toLowerCase().replace(/\.mdx?$/i, ""));
    if (!targetId || targetId === sourceId) return;
    edges.push({ source: sourceId, target: targetId, kind });
    const src = nodeById.get(sourceId);
    if (src && !src.refs.includes(targetId)) src.refs.push(targetId);
  };

  for (const f of memoryFiles) {
    const fm = parseFrontmatter(f.content);
    const sourceId = f.path;
    for (const m of f.content.matchAll(/\[\[([^\]]+)\]\]/g)) {
      linkEdge(sourceId, m[1].trim(), "reference");
    }
    for (const dep of fm.dependsOn) linkEdge(sourceId, dep, "depends");
    for (const sup of fm.supersededBy) linkEdge(sourceId, sup, "supersede");
  }

  // 4) People nodes + mention edges (shared-customer structure emerges via the hub).
  // Exclude voice-influence creators — they're authors PA studies, not customers,
  // and already have their own node.
  const influenceNames = new Set<string>();
  for (const dir of influenceDirs) {
    influenceNames.add(humanizeSlug(dir));
    influenceNames.add(dir.replace(/-/g, " "));
  }
  const people = detectPeople(files, opts.ownerName ?? null, influenceNames);
  for (const p of people) {
    const id = `person:${p.name.toLowerCase().replace(/\s+/g, "-")}`;
    addNode({
      id,
      label: p.name,
      type: "customer",
      area: "customers",
      date: null,
      superseded: false,
      summary: `Mentioned across ${p.files.length} ${p.files.length === 1 ? "entry" : "entries"} in your brain.`,
      refs: [],
      degree: 0,
    });
    for (const filePath of p.files) {
      if (nodeById.has(filePath)) edges.push({ source: filePath, target: id, kind: "mentions-person" });
    }
  }

  // 5) Tool nodes + usage edges (shared-tool structure emerges via the hub).
  for (const tool of TOOL_VOCAB) {
    const mentioning = memoryFiles.filter((f) =>
      tool.patterns.some((re) => re.test(f.content)),
    );
    if (mentioning.length === 0) continue;
    const id = `tool:${tool.canonical.toLowerCase().replace(/\s+/g, "-")}`;
    addNode({
      id,
      label: tool.canonical,
      type: "tool",
      area: "tools",
      date: null,
      superseded: false,
      summary: `Referenced in ${mentioning.length} ${mentioning.length === 1 ? "entry" : "entries"}.`,
      refs: [],
      degree: 0,
    });
    for (const f of mentioning) edges.push({ source: f.path, target: id, kind: "uses-tool" });
  }

  // 6) Degree counts for layout sizing.
  for (const e of edges) {
    const s = nodeById.get(e.source);
    const t = nodeById.get(e.target);
    if (s) s.degree += 1;
    if (t) t.degree += 1;
  }

  return {
    nodes,
    edges,
    areas: computeAreaCounts(nodes),
    gaps: computeGaps(nodes, files),
    fileCount: files.length,
  };
}

// ── Area counts (the headline strip) ─────────────────────────────────────────────

export function computeAreaCounts(nodes: BrainNode[]): AreaCount[] {
  const order: KnowledgeArea[] = [
    "voice",
    "customers",
    "tools",
    "decisions",
    "standing-rules",
    "business",
    "competitive",
  ];
  const counts = new Map<KnowledgeArea, number>();
  for (const n of nodes) counts.set(n.area, (counts.get(n.area) ?? 0) + 1);
  return order.map((area) => ({
    area,
    label: AREA_LABELS[area],
    count: counts.get(area) ?? 0,
  }));
}

// ── Gap detection ("what PA doesn't know") ───────────────────────────────────────
//
// The felt-value piece: turn thin coverage into a concrete next thing to feed PA.

export function computeGaps(nodes: BrainNode[], files: RawFile[]): Gap[] {
  const gaps: Gap[] = [];
  const countByArea = (area: KnowledgeArea): number =>
    nodes.filter((n) => n.area === area).length;
  const corpus = files.map((f) => `${f.path} ${f.content}`).join("\n").toLowerCase();

  const voiceNodes = nodes.filter((n) => n.type === "voice").length;
  if (voiceNodes === 0) {
    gaps.push({
      area: "Voice",
      message:
        "No voice samples yet — PA is guessing at your tone. Add a few writing samples or influences so it sounds like you.",
    });
  }

  if (countByArea("customers") === 0) {
    gaps.push({
      area: "Customers",
      message:
        "PA doesn't know who your customers are. Tell it about the people and accounts you work with.",
    });
  }

  if (!/testimonial|review|case study|loved working|five star|5-star/.test(corpus)) {
    gaps.push({
      area: "Testimonials",
      message:
        "No customer testimonials captured. Feed PA a couple of wins or quotes — it'll reuse them in proposals and outreach.",
    });
  }

  if (countByArea("competitive") === 0) {
    gaps.push({
      area: "Competitive intel",
      message:
        "No competitive intel yet. Drop in what your rivals charge and claim so PA can position against them.",
    });
  }

  if (countByArea("standing-rules") < 2) {
    gaps.push({
      area: "Standing rules",
      message:
        "Few standing rules on file. The more hard preferences PA knows, the less you have to correct it.",
    });
  }

  if (countByArea("business") === 0) {
    gaps.push({
      area: "About the business",
      message:
        "PA is missing the basics — what you sell, who you serve, how you price. Start there and everything else gets sharper.",
    });
  }

  if (!/pricing|\bprice\b|\brate\b|\$\d/.test(corpus)) {
    gaps.push({
      area: "Pricing",
      message:
        "No pricing on file. Add your rates and packages so PA can quote without asking you every time.",
    });
  }

  return gaps;
}

// ── Fetch-driven entry point ─────────────────────────────────────────────────────

// Files we bother reading for the graph. Skips binaries and the heavy non-brain
// product folders so a large repo stays fast and the read budget stays bounded.
function isGraphRelevant(path: string): boolean {
  if (!/\.mdx?$/i.test(path)) return false;
  if (path.startsWith("memory/")) return true;
  if (path.startsWith("voice/influences/")) return true;
  if (/\/competitive\//.test(path)) return true;
  if (path.startsWith("brain/")) return true;
  return false;
}

/**
 * Reads the owner's brain repo over the GitHub REST API and returns the graph.
 * One tree listing + a bounded set of file reads (capped so a sprawling repo
 * can't blow the request budget). Returns an empty graph on a missing repo
 * rather than throwing — the surface renders its own "connect a brain" state.
 */
export async function buildBrainGraph(
  repo: string,
  token: string | null,
  opts: { ownerName?: string | null; maxFiles?: number } = {},
): Promise<BrainGraph> {
  const maxFiles = opts.maxFiles ?? 400;
  const tree = await listRepoTree(repo, token);
  const relevant = tree
    .filter((e) => e.type === "blob" && isGraphRelevant(e.path))
    .slice(0, maxFiles);

  const files = await Promise.all(
    relevant.map(async (e) => ({
      path: e.path,
      content: await fetchFileContent(repo, e.path, token),
    })),
  );

  return buildGraphFromFiles(
    files.filter((f) => f.content.length > 0),
    { ownerName: opts.ownerName ?? null },
  );
}
