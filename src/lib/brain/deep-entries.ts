// Deep brain entries — decisions, specs, open questions, change-log entries.
//
// The brain holds far more than memory/ — decision logs with hundreds of entries,
// SPEC documents, open-question files, and change logs live across BOS/, APA/,
// AOS/, WC/, shared/, and client folders. This module is the ONE place that knows
// how to find those files and split them into individual entries, shared by the
// DB indexer (pa-brain-index.ts) and the Brain Map graph (graph.ts). Pure
// functions over { path, content } so everything is unit-testable.
//
// The brain mixes several decision formats, all handled here:
//   ## Decision PA-COST-1..8 — 2026-06-08 — Title        (APA / WC headings)
//   ### Decision 7 from Session 1 — April 4, 2026 — Title (old BOS headings)
//   **Decision #206** — 2026-06-11 — **Title**            (new BOS / AOS bold)
//   **Decision #8 — 2026-06-11 — Title**                  (shared, one bold run)
//   ## HE-7 — 2026-06-10 — Title                          (client-coded headings)
//   ### P-DEC-2026-05-23-THUMBNAIL-STORAGE                (Patrick-mirror coded ids)

export type DeepEntryType = "decision" | "spec" | "open_question" | "change_log_entry";

export type DeepEntry = {
  type: DeepEntryType;
  /** Unique per entry — the file path, plus a #anchor for multi-entry files. */
  path: string;
  /** The source file the entry came from. */
  filePath: string;
  name: string;
  description: string | null;
  bodyExcerpt: string | null;
  /** ISO or prose date pulled from the entry marker, when present. */
  date: string | null;
  /** Decision/question id — "206", "PA-COST-1..8", "HE-7" — when present. */
  ref: string | null;
};

// ── Path classification ──────────────────────────────────────────────────────────

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

function isMarkdown(path: string): boolean {
  return /\.mdx?$/i.test(path);
}

// memory/ stays with the existing memory walker; hidden dirs are scratch.
function isExcludedPath(path: string): boolean {
  return path.startsWith("memory/") || /(^|\/)\./.test(path);
}

export function isDecisionLogPath(path: string): boolean {
  return isMarkdown(path) && !isExcludedPath(path) && /decisions?[_-]?log/i.test(basename(path));
}

export function isChangeLogPath(path: string): boolean {
  return isMarkdown(path) && !isExcludedPath(path) && /change[_-]?log/i.test(basename(path));
}

export function isOpenQuestionsPath(path: string): boolean {
  return !isExcludedPath(path) && /^open[_-]?questions\.mdx?$/i.test(basename(path));
}

// "spec" must appear as its own token (start/end or _-. delimited) so
// "inspection" / "prospect" never match. Master plans and roadmaps count too.
export function isSpecDocPath(path: string): boolean {
  if (!isMarkdown(path) || isExcludedPath(path)) return false;
  const base = basename(path);
  if (isDecisionLogPath(path) || isChangeLogPath(path) || isOpenQuestionsPath(path)) return false;
  if (/^(master[_-]?plan|roadmap)\.mdx?$/i.test(base)) return true;
  return /(^|[_\-.])specs?([_\-.]|\.mdx?$)/i.test(base);
}

/** The deep entry type a path produces, or null when the file isn't a deep source. */
export function classifyDeepPath(path: string): DeepEntryType | null {
  if (isDecisionLogPath(path)) return "decision";
  if (isOpenQuestionsPath(path)) return "open_question";
  if (isChangeLogPath(path)) return "change_log_entry";
  if (isSpecDocPath(path)) return "spec";
  return null;
}

// ── Small text helpers (local — graph.ts imports this module, so no cycle) ───────

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*|__|\*|_|`/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .trim();
}

function clip(text: string, max: number): string {
  const t = text.trim();
  // The ellipsis counts toward max so clipped output never exceeds it.
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

const ISO_DATE = /\b(20\d{2}-\d{2}-\d{2})\b/;
const PROSE_DATE =
  /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+20\d{2})\b/;

function extractDate(line: string): string | null {
  const iso = line.match(ISO_DATE);
  if (iso) return iso[1];
  const prose = line.match(PROSE_DATE);
  return prose ? prose[1] : null;
}

function isDateOnly(part: string): boolean {
  const t = stripMarkdown(part);
  return ISO_DATE.test(t) && t.replace(ISO_DATE, "").trim().length === 0
    ? true
    : PROSE_DATE.test(t) && t.replace(PROSE_DATE, "").trim().length === 0;
}

// First meaningful paragraph of a body block — headings and horizontal rules
// dropped, markdown stripped.
function firstBodyParagraph(lines: string[]): string {
  for (const block of lines.join("\n").split(/\n\s*\n/)) {
    const text = stripMarkdown(
      block.replace(/^#{1,6}\s.*$/gm, "").replace(/^-{3,}\s*$/gm, ""),
    );
    if (text.length > 12) return text;
  }
  return "";
}

// ── Decision logs ─────────────────────────────────────────────────────────────────

// A coded id like HE-7, WC-1, PA-COST-1..8, P-DEC-2026-05-23-THUMBNAIL-STORAGE.
const CODED_ID = /^[A-Z][A-Za-z0-9]*(?:-[A-Za-z0-9.]+)+$/;

type Marker = { ref: string | null; titleLine: string };

// Returns the entry marker when a line STARTS a decision entry, null otherwise.
function decisionMarker(line: string): Marker | null {
  // Bold form: **Decision #206** — date — **Title** / **Decision #8 — date — Title**
  const bold = line.match(/^\*\*Decision\s+#?([A-Za-z0-9][\w.]*)/);
  if (bold) return { ref: bold[1], titleLine: line };

  const heading = line.match(/^#{2,4}\s+(.+)$/);
  if (!heading) return null;
  const text = heading[1].trim();

  // "Decision <id> — …" headings. Plain "Decision Log"-style titles don't count.
  const decisionHead = text.match(/^Decision\s+#?(\S+)/i);
  if (decisionHead) {
    const ref = decisionHead[1].replace(/[—–:,·]+$/, "");
    // "## Decision Log" / "## Decision Record" are document titles, not entries.
    if (/^(logs?|records?)$/i.test(ref) || ref.length === 0) return null;
    // "## Decision from Session 4 — …" is an entry with no usable id.
    return { ref: /^(from|of|on|in)$/i.test(ref) ? null : ref, titleLine: text };
  }

  // Coded-id headings: "HE-7 — 2026-06-10 — Title" / "D-002 · date — Title" /
  // a bare "P-DEC-…" id.
  const firstToken = text.split(/\s+/)[0];
  if (CODED_ID.test(firstToken)) {
    const rest = text.slice(firstToken.length).trim();
    if (/^[—–·]/.test(rest) || rest.length === 0) {
      return { ref: firstToken, titleLine: text };
    }
  }
  return null;
}

// Any heading or bold-decision line ends the current entry's body, whether or
// not it starts a new one ("## Business & Product Decisions" is a section break).
function isBlockBreak(line: string): boolean {
  return /^#{1,4}\s+\S/.test(line) || /^\*\*Decision\s+#?[A-Za-z0-9]/.test(line);
}

function titleFromMarker(marker: Marker, bodyLines: string[]): string {
  // A "Title:" line in the body is the most explicit signal — the brain writes
  // it as "**Title:**", "**Title**:", and plain "Title:".
  for (const line of bodyLines.slice(0, 6)) {
    const m = line.match(/^\*{0,2}Title\*{0,2}\s*:\s*(.+)$/);
    if (m) return clip(stripMarkdown(m[1]), 300);
  }
  // Otherwise split the marker line on em-dash/hyphen separators and keep the
  // parts that aren't the "Decision #N" prefix or a date.
  const parts = stripMarkdown(marker.titleLine)
    .split(/\s+[—–·]\s+|\s+-\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const meaningful = parts.filter(
    (p, i) => !(i === 0 && /^(Decision\b|#)/i.test(p)) && !(i === 0 && marker.ref !== null && p.startsWith(marker.ref)) && !isDateOnly(p),
  );
  if (meaningful.length > 0) return clip(meaningful.join(" — "), 300);
  return marker.ref ? `Decision ${marker.ref}` : clip(stripMarkdown(marker.titleLine), 300);
}

function descriptionFromBody(bodyLines: string[]): string | null {
  // Prefer the explicit "**Decision:** …" sentence — that's the decision itself.
  for (const line of bodyLines) {
    const m = line.match(/^\*\*Decision[:.]\*\*\s*(.+)$/);
    if (m) {
      const text = stripMarkdown(m[1]);
      if (text.length > 0) return clip(text, 280);
    }
  }
  // The Title line already feeds the name — keep it out of the description.
  const withoutTitle = bodyLines.filter((l) => !/^\*{0,2}Title\*{0,2}\s*:/.test(l));
  const para = firstBodyParagraph(withoutTitle);
  return para ? clip(para, 280) : null;
}

function anchorSlug(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
}

export function extractDecisionEntries(filePath: string, content: string): DeepEntry[] {
  const lines = content.split("\n");
  const found: { marker: Marker; markerLine: string; body: string[] }[] = [];
  let current: { marker: Marker; markerLine: string; body: string[] } | null = null;

  for (const line of lines) {
    const marker = decisionMarker(line);
    if (marker) {
      if (current) found.push(current);
      current = { marker, markerLine: line, body: [] };
      continue;
    }
    if (current) {
      if (isBlockBreak(line)) {
        found.push(current);
        current = null;
      } else {
        current.body.push(line);
      }
    }
  }
  if (current) found.push(current);

  const entries: DeepEntry[] = [];
  const seenAnchors = new Set<string>();

  // No ref-based dedup: old BOS sessions restart numbering, so "Decision 7 from
  // Session 1" and "Decision #7" are DIFFERENT decisions. Anchor collisions get
  // an ordinal suffix instead, so every parsed entry survives with a unique path.
  found.forEach((f, i) => {
    let anchor = `decision-${f.marker.ref ? anchorSlug(f.marker.ref) : String(i + 1)}`;
    if (seenAnchors.has(anchor)) anchor = `${anchor}-${i + 1}`;
    seenAnchors.add(anchor);

    const body = f.body;
    const excerpt = stripMarkdown(body.join("\n").replace(/^-{3,}\s*$/gm, ""));
    entries.push({
      type: "decision",
      path: `${filePath}#${anchor}`,
      filePath,
      name: titleFromMarker(f.marker, body),
      description: descriptionFromBody(body),
      bodyExcerpt: excerpt ? clip(excerpt, 700) : null,
      date: extractDate(f.markerLine),
      ref: f.marker.ref,
    });
  });

  return entries;
}

// ── Open questions ────────────────────────────────────────────────────────────────

export function extractOpenQuestionEntries(filePath: string, content: string): DeepEntry[] {
  const lines = content.split("\n");
  const entries: DeepEntry[] = [];
  const seenAnchors = new Set<string>();

  // Heading-per-question files (## HE-Q-1 — Title).
  let current: { heading: string; body: string[] } | null = null;
  const flush = (): void => {
    if (!current) return;
    // A heading whose body contains **Answered: has been resolved — skip it so
    // the counter and list only reflect genuinely open questions.
    const isAnswered = current.body.some((l) => /^\*\*Answered/i.test(l.trim()));
    if (isAnswered) {
      current = null;
      return;
    }
    const headText = stripMarkdown(current.heading);
    const firstToken = headText.split(/\s+/)[0];
    const ref = CODED_ID.test(firstToken) ? firstToken : null;
    let anchor = `oq-${ref ? anchorSlug(ref) : String(entries.length + 1)}`;
    if (seenAnchors.has(anchor)) anchor = `${anchor}-${entries.length + 1}`;
    seenAnchors.add(anchor);
    const para = firstBodyParagraph(current.body);
    entries.push({
      type: "open_question",
      path: `${filePath}#${anchor}`,
      filePath,
      name: clip(headText, 300),
      description: para ? clip(para, 280) : null,
      bodyExcerpt: para ? clip(stripMarkdown(current.body.join("\n")), 700) : null,
      date: extractDate(current.heading),
      ref,
    });
    current = null;
  };

  for (const line of lines) {
    const h = line.match(/^#{2,3}\s+(.+)$/);
    if (h) {
      flush();
      current = { heading: h[1].trim(), body: [] };
      continue;
    }
    if (current) current.body.push(line);
  }
  flush();
  if (entries.length > 0) return entries;

  // Fallback: top-level bullets, one question per bullet.
  let n = 0;
  for (const line of lines) {
    const m = line.match(/^[-*]\s+(.+)$/);
    if (!m) continue;
    n += 1;
    const text = stripMarkdown(m[1]);
    if (text.length < 8) continue;
    entries.push({
      type: "open_question",
      path: `${filePath}#oq-${n}`,
      filePath,
      name: clip(text, 300),
      description: null,
      bodyExcerpt: clip(text, 700),
      date: null,
      ref: null,
    });
  }
  return entries;
}

// ── Change logs ───────────────────────────────────────────────────────────────────

const CHANGE_LOG_ENTRY_CAP = 50;

export function extractChangeLogEntries(filePath: string, content: string): DeepEntry[] {
  const lines = content.split("\n");
  const entries: DeepEntry[] = [];
  let current: { heading: string; body: string[] } | null = null;

  // An entry heading is an H2/H3 that carries a date — "## 2026-06-11 (…)" or
  // "### June 11, 2026 — …". Sub-headings without a date ride in the body.
  const isEntryHeading = (line: string): string | null => {
    const h = line.match(/^#{2,3}\s+(.+)$/);
    if (!h) return null;
    return extractDate(h[1]) !== null ? h[1].trim() : null;
  };

  const flush = (): void => {
    if (!current || entries.length >= CHANGE_LOG_ENTRY_CAP) {
      current = null;
      return;
    }
    const para = firstBodyParagraph(current.body);
    entries.push({
      type: "change_log_entry",
      path: `${filePath}#cl-${entries.length + 1}`,
      filePath,
      name: clip(stripMarkdown(current.heading), 300),
      description: para ? clip(para, 280) : null,
      bodyExcerpt: para ? clip(stripMarkdown(current.body.join("\n")), 700) : null,
      date: extractDate(current.heading),
      ref: null,
    });
    current = null;
  };

  for (const line of lines) {
    const heading = isEntryHeading(line);
    if (heading !== null) {
      flush();
      if (entries.length >= CHANGE_LOG_ENTRY_CAP) break;
      current = { heading, body: [] };
      continue;
    }
    if (current) current.body.push(line);
  }
  flush();
  return entries;
}

// ── Spec documents ────────────────────────────────────────────────────────────────

export function extractSpecEntry(filePath: string, content: string): DeepEntry {
  const h1 = content.match(/^#\s+(.+)$/m);
  const fmMatch = content.match(/^---\n[\s\S]*?^description:\s*(.+)$[\s\S]*?\n---/m);
  // A ">-" / "|" capture is a YAML block-scalar marker, not the description.
  const fmDescription = fmMatch && !/^[>|]/.test(fmMatch[1].trim()) ? fmMatch[1] : null;
  const body = content.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const para = firstBodyParagraph(body.split("\n"));
  const fallbackName = basename(filePath)
    .replace(/\.mdx?$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return {
    type: "spec",
    path: filePath,
    filePath,
    name: clip(stripMarkdown(h1 ? h1[1] : fallbackName), 300),
    description: fmDescription
      ? clip(stripMarkdown(fmDescription), 280)
      : para
        ? clip(para, 280)
        : null,
    bodyExcerpt: para ? clip(para, 700) : null,
    date: null,
    ref: null,
  };
}

// ── Dispatcher ────────────────────────────────────────────────────────────────────

export function extractDeepEntries(filePath: string, content: string): DeepEntry[] {
  switch (classifyDeepPath(filePath)) {
    case "decision":
      return extractDecisionEntries(filePath, content);
    case "open_question":
      return extractOpenQuestionEntries(filePath, content);
    case "change_log_entry":
      return extractChangeLogEntries(filePath, content);
    case "spec":
      return [extractSpecEntry(filePath, content)];
    default:
      return [];
  }
}
