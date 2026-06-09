// format.ts — SKILL.md (de)serialization. One artifact, two readers (PA-SKILL-5): the
// frontmatter is a small, fixed YAML subset we fully control on both ends, and the body below
// it IS the technique the sub-agent loads and the owner reads. We don't pull in a YAML
// dependency — the schema is bounded (scalars, string lists, a list of flat example objects),
// so a purpose-built emitter + tolerant parser is safer than a general parser turned loose on a
// hand-edited file. Parsing fails SOFT: unknown keys are ignored and missing/garbled fields fall
// back to schema defaults (mirrors loadZoneConfig), so a typo never bricks a Skill — the body,
// the load-bearing part, survives regardless.

import {
  SkillFrontmatterSchema,
  type Skill,
  type SkillExample,
  type SkillFrontmatter,
} from "./types";

const FENCE = "---";

// ── Emit ────────────────────────────────────────────────────────────────────────────────

/** Double-quote + escape a scalar string for the frontmatter. */
function q(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Collapse a value to a single line (description / when_to_use are one-liners by design). */
function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function serializeSkill(skill: Skill): string {
  const fm = skill.frontmatter;
  const ev = fm.evolution;
  const lines: string[] = [FENCE];
  lines.push(`name: ${q(fm.name)}`);
  lines.push(`slug: ${q(fm.slug)}`);
  lines.push(`description: ${q(oneLine(fm.description))}`);
  lines.push(`when_to_use: ${q(oneLine(fm.whenToUse))}`);
  lines.push(`zone: ${q(fm.zone)}`);

  lines.push("prerequisites:");
  for (const p of fm.prerequisites) lines.push(`  - ${q(oneLine(p))}`);

  lines.push("examples:");
  for (const ex of fm.examples) {
    lines.push(`  - run_id: ${q(ex.runId)}`);
    lines.push(`    date: ${q(ex.date)}`);
    lines.push(`    input: ${q(oneLine(ex.input))}`);
    lines.push(`    output: ${q(oneLine(ex.output))}`);
    lines.push(`    outcome: ${q(ex.outcome)}`);
  }

  lines.push(`created_at: ${q(ev.createdAt)}`);
  lines.push(`last_evolved_at: ${q(ev.lastEvolvedAt)}`);
  lines.push("evolved_from_runs:");
  for (const r of ev.evolvedFromRuns) lines.push(`  - ${q(r)}`);
  lines.push(`success_count: ${ev.successCount}`);
  lines.push(`owner_approvals_count: ${ev.ownerApprovalsCount}`);
  lines.push(`version: ${ev.version}`);
  lines.push(`auto_evolve: ${ev.autoEvolve}`);
  lines.push(FENCE);
  lines.push("");
  lines.push(skill.body.trim());
  lines.push("");
  return lines.join("\n");
}

// ── Parse ───────────────────────────────────────────────────────────────────────────────

/** Strip surrounding quotes + unescape, or trim a bare scalar. */
function unquote(raw: string): string {
  const v = raw.trim();
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return v;
}

function indentOf(line: string): number {
  const m = line.match(/^(\s*)/);
  return m ? m[1].length : 0;
}

/** Split a `key: value` line into [key, value]; value may be empty (a block follows). null if no colon. */
function splitKv(line: string): [string, string] | null {
  const t = line.trim();
  const idx = t.indexOf(":");
  if (idx === -1) return null;
  return [t.slice(0, idx).trim(), t.slice(idx + 1).trim()];
}

type RawMap = Record<string, unknown>;

/**
 * Parses the frontmatter block into a loose map (string scalars, string[] for `- ` lists, and an
 * array of flat objects for `examples`). Deliberately tolerant — anything it can't read is dropped,
 * not thrown.
 */
function parseFrontmatter(block: string): RawMap {
  const lines = block.split("\n");
  const out: RawMap = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || indentOf(line) > 0) {
      i++;
      continue;
    }
    const kv = splitKv(line);
    if (!kv) {
      i++;
      continue;
    }
    const [key, value] = kv;
    if (value !== "") {
      out[key] = unquote(value);
      i++;
      continue;
    }
    // Block follows: either a list of scalars (`  - x`) or, for examples, a list of objects.
    if (key === "examples") {
      const { items, next } = readExamples(lines, i + 1);
      out[key] = items;
      i = next;
    } else {
      const { items, next } = readScalarList(lines, i + 1);
      out[key] = items;
      i = next;
    }
  }
  return out;
}

function readScalarList(lines: string[], start: number): { items: string[]; next: number } {
  const items: string[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (indentOf(line) === 0) break;
    const t = line.trim();
    if (t.startsWith("- ")) items.push(unquote(t.slice(2)));
    else break;
    i++;
  }
  return { items, next: i };
}

function readExamples(lines: string[], start: number): { items: RawMap[]; next: number } {
  const items: RawMap[] = [];
  let current: RawMap | null = null;
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (indentOf(line) === 0) break;
    const t = line.trim();
    if (t.startsWith("- ")) {
      current = {};
      items.push(current);
      const kv = splitKv(t.slice(2));
      if (kv) current[kv[0]] = unquote(kv[1]);
    } else if (current) {
      const kv = splitKv(t);
      if (kv) current[kv[0]] = unquote(kv[1]);
    }
    i++;
  }
  return { items, next: i };
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function asNumber(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}
function asBool(v: unknown): boolean {
  return v === true || v === "true";
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function exampleFrom(raw: RawMap): Partial<SkillExample> {
  return {
    runId: asString(raw.run_id),
    date: asString(raw.date),
    input: asString(raw.input),
    output: asString(raw.output),
    // outcome validated by the schema; pass through and let safeParse default it.
    outcome: (raw.outcome as SkillExample["outcome"]) ?? undefined,
  };
}

/**
 * Parses a SKILL.md string into a Skill, or null when there's no usable frontmatter/name. The
 * frontmatter is mapped into the camelCase schema shape and validated; the body is everything
 * after the closing fence.
 */
export function parseSkill(md: string): Skill | null {
  const text = md.replace(/^﻿/, "");
  if (!text.trimStart().startsWith(FENCE)) return null;
  const afterOpen = text.slice(text.indexOf(FENCE) + FENCE.length);
  const closeIdx = afterOpen.indexOf(`\n${FENCE}`);
  if (closeIdx === -1) return null;
  const block = afterOpen.slice(0, closeIdx).replace(/^\n/, "");
  const body = afterOpen.slice(closeIdx + FENCE.length + 1).replace(/^\n+/, "");

  const raw = parseFrontmatter(block);
  const version = asNumber(raw.version);
  const successCount = asNumber(raw.success_count);
  const ownerApprovals = asNumber(raw.owner_approvals_count);

  const candidate = {
    name: asString(raw.name),
    slug: asString(raw.slug),
    description: asString(raw.description),
    whenToUse: asString(raw.when_to_use),
    prerequisites: asStringArray(raw.prerequisites),
    zone: asString(raw.zone) || undefined,
    examples: Array.isArray(raw.examples)
      ? (raw.examples as RawMap[]).map(exampleFrom)
      : [],
    evolution: {
      createdAt: asString(raw.created_at),
      lastEvolvedAt: asString(raw.last_evolved_at),
      evolvedFromRuns: asStringArray(raw.evolved_from_runs),
      successCount: successCount ?? 0,
      ownerApprovalsCount: ownerApprovals ?? 0,
      version: version ?? 1,
      autoEvolve: asBool(raw.auto_evolve),
    },
  };

  const parsed = SkillFrontmatterSchema.safeParse(candidate);
  if (!parsed.success) return null;
  return { frontmatter: parsed.data as SkillFrontmatter, body: body.trim() };
}
