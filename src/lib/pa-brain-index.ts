import { z } from "zod";
import { listRepoTree } from "@/lib/pa-brain";
import { classifyDeepPath, extractDeepEntries } from "@/lib/brain/deep-entries";

// ── Public types ────────────────────────────────────────────────────────────────

// The four deep types come from the deep walk (decision logs, SPEC docs,
// open-question files, change logs across the whole repo); the first five come
// from the memory/ walker as before.
export type MemoryEntryType =
  | "user"
  | "feedback"
  | "project"
  | "reference"
  | "unknown"
  | "decision"
  | "spec"
  | "open_question"
  | "change_log_entry";

export type MemoryIndexRow = {
  id: string;
  user_id: string;
  path: string;
  file_sha: string;
  name: string | null;
  description: string | null;
  type: MemoryEntryType;
  frontmatter_raw: Record<string, unknown>;
  body_excerpt: string | null;
  indexed_at: string;
};

export type RootFile = {
  name: "CLAUDE.md" | "MEMORY.md" | "AGENTS.md";
  present: boolean;
  sha: string | null;
  size: number | null;
};

export type BrainIndexResult = {
  indexed: number;
  skipped: number;
  errors: string[];
  rootFiles: RootFile[];
  /** Upserted entries per type — lets callers verify the index shape at a glance. */
  byType: Record<string, number>;
};

// ── Zod schemas ─────────────────────────────────────────────────────────────────

const VALID_TYPES = [
  "user",
  "feedback",
  "project",
  "reference",
  "unknown",
  "decision",
  "spec",
  "open_question",
  "change_log_entry",
] as const;

const IndexRowInsertSchema = z.object({
  user_id: z.string().uuid(),
  path: z.string().min(1),
  file_sha: z.string().min(1),
  name: z.string().max(300).nullable(),
  description: z.string().max(1000).nullable(),
  type: z.enum(VALID_TYPES),
  frontmatter_raw: z.record(z.string(), z.unknown()),
  body_excerpt: z.string().max(700).nullable(),
  indexed_at: z.string(),
});

type IndexRowInsert = z.infer<typeof IndexRowInsertSchema>;

// ── Supabase helpers ────────────────────────────────────────────────────────────

function paEnv(): { url: string; key: string } | { error: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return { error: "Supabase env vars not set" };
  return { url: url.replace(/\/$/, ""), key };
}

// The deep walk pushes a brain past PostgREST's per-request row cap, so both
// readers page until a short page comes back.
const PAGE_SIZE = 1000;

async function fetchAllPages<T>(buildUrl: (offset: number) => string, key: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const res = await fetch(buildUrl(offset), {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return out;
    const page = (await res.json()) as T[];
    out.push(...page);
    if (page.length < PAGE_SIZE) return out;
  }
}

async function fetchExistingIndex(userId: string): Promise<Pick<MemoryIndexRow, "path" | "file_sha">[]> {
  const env = paEnv();
  if ("error" in env) return [];

  return fetchAllPages(
    (offset) =>
      `${env.url}/rest/v1/pocket_agent_memory_index?user_id=eq.${encodeURIComponent(userId)}&select=path,file_sha&order=path.asc&limit=${PAGE_SIZE}&offset=${offset}`,
    env.key,
  );
}

export async function fetchMemoryIndex(userId: string): Promise<MemoryIndexRow[]> {
  const env = paEnv();
  if ("error" in env) return [];

  return fetchAllPages(
    (offset) =>
      `${env.url}/rest/v1/pocket_agent_memory_index?user_id=eq.${encodeURIComponent(userId)}&order=type.asc,name.asc&limit=${PAGE_SIZE}&offset=${offset}`,
    env.key,
  );
}

// Removes the fragment rows of multi-entry files whose content changed, so a
// renumbered or deleted decision doesn't leave a stale row behind. One DELETE
// per file: fragments share the `<file>#` prefix.
async function deleteFragmentRows(userId: string, filePaths: string[]): Promise<void> {
  const env = paEnv();
  if ("error" in env) throw new Error(env.error);

  for (const filePath of filePaths) {
    const pattern = encodeURIComponent(`${filePath}#*`);
    const res = await fetch(
      `${env.url}/rest/v1/pocket_agent_memory_index?user_id=eq.${encodeURIComponent(userId)}&path=like.${pattern}`,
      {
        method: "DELETE",
        headers: {
          apikey: env.key,
          Authorization: `Bearer ${env.key}`,
          Prefer: "return=minimal",
        },
        cache: "no-store",
      },
    );
    if (!res.ok) {
      throw new Error(`Fragment cleanup failed for ${filePath} (${res.status}): ${await res.text()}`);
    }
  }
}

async function upsertIndexRows(rows: IndexRowInsert[]): Promise<void> {
  const env = paEnv();
  if ("error" in env) throw new Error(env.error);

  // on_conflict MUST name the (user_id, path) unique constraint. Without it,
  // PostgREST's merge resolution targets the primary key (id) only — and each
  // insert row carries a fresh server-generated id, so the (user_id, path)
  // unique constraint throws 23505 instead of merging. merge-duplicates →
  // ON CONFLICT DO UPDATE, so a re-index overwrites file_sha / excerpt in place.
  const res = await fetch(
    `${env.url}/rest/v1/pocket_agent_memory_index?on_conflict=user_id,path`,
    {
      method: "POST",
      headers: {
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    throw new Error(`Index upsert failed (${res.status}): ${await res.text()}`);
  }
}

async function saveRootIndexToUser(
  userId: string,
  rootFiles: RootFile[],
  indexedAt: string,
): Promise<void> {
  const env = paEnv();
  if ("error" in env) throw new Error(env.error);

  const res = await fetch(
    `${env.url}/rest/v1/pocket_agent_users?id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        brain_root_index_json: rootFiles,
        brain_indexed_at: indexedAt,
      }),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    throw new Error(`Root index save failed (${res.status}): ${await res.text()}`);
  }
}

// ── GitHub helpers ──────────────────────────────────────────────────────────────

function ghHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "pocket-agent/1.0",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

type GhDirItem = {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: string;
};

async function listDirItems(
  repo: string,
  token: string | null,
  dirPath: string,
): Promise<GhDirItem[]> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${dirPath}`,
    { headers: ghHeaders(token), cache: "no-store" },
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub dir listing failed for ${dirPath} (${res.status})`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data as GhDirItem[];
}

type GhBlob = { encoding: string; content: string };

async function fetchBlobContent(repo: string, sha: string, token: string | null): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/git/blobs/${sha}`,
    { headers: ghHeaders(token), cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Blob fetch failed (${res.status})`);
  const data = (await res.json()) as GhBlob;
  if (data.encoding === "base64") {
    return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
  }
  return data.content ?? "";
}

// ── Frontmatter parser ──────────────────────────────────────────────────────────
// Handles the subset of YAML used by Claude Code memory files:
//   top-level string values and one-level-deep nested objects.

function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentObj: Record<string, unknown> | null = null;

  for (const line of yaml.split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;

    if (/^\s+\S/.test(line) && currentObj !== null) {
      // indented → nested key
      const m = line.match(/^\s+([^:]+):\s*(.*)$/);
      if (m) currentObj[m[1].trim()] = m[2].trim();
    } else {
      // top-level key
      const m = line.match(/^([^:]+):\s*(.*)$/);
      if (!m) continue;
      const key = m[1].trim();
      const val = m[2].trim();
      if (val === "") {
        const nested: Record<string, unknown> = {};
        result[key] = nested;
        currentObj = nested;
      } else {
        result[key] = val;
        currentObj = null;
      }
    }
  }
  return result;
}

function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  if (!raw.startsWith("---")) {
    return { data: {}, body: raw };
  }
  const afterDash = raw.indexOf("\n");
  if (afterDash === -1) return { data: {}, body: raw };

  const closeIdx = raw.indexOf("\n---", afterDash + 1);
  if (closeIdx === -1) return { data: {}, body: raw };

  const yamlSection = raw.slice(afterDash + 1, closeIdx);
  const body = raw.slice(closeIdx + 4).replace(/^\n/, "");
  return { data: parseSimpleYaml(yamlSection), body };
}

// ── Field extractors ────────────────────────────────────────────────────────────

const VALID_TYPE_SET = new Set<string>(VALID_TYPES.filter((t) => t !== "unknown"));

function extractType(data: Record<string, unknown>, filePath: string): MemoryEntryType {
  // 1. metadata.type in frontmatter
  const meta = data.metadata;
  if (meta !== null && typeof meta === "object" && !Array.isArray(meta)) {
    const t = (meta as Record<string, unknown>).type;
    if (typeof t === "string" && VALID_TYPE_SET.has(t.toLowerCase())) {
      return t.toLowerCase() as MemoryEntryType;
    }
  }
  // 2. Infer from filename prefix: user_*.md, feedback_*.md, etc.
  const base = filePath.split("/").pop() ?? filePath;
  for (const t of VALID_TYPE_SET) {
    if (base.startsWith(`${t}_`)) return t as MemoryEntryType;
  }
  return "unknown";
}

function extractName(data: Record<string, unknown>, filePath: string): string | null {
  if (typeof data.name === "string" && data.name.trim()) {
    return data.name.trim().slice(0, 300);
  }
  const base = filePath.split("/").pop() ?? filePath;
  return base.replace(/\.md$/i, "");
}

function extractDescription(data: Record<string, unknown>, body: string): string | null {
  if (typeof data.description === "string" && data.description.trim()) {
    return data.description.trim().slice(0, 1000);
  }
  // First non-empty non-heading paragraph from body
  for (const para of body.split(/\n\n+/)) {
    const trimmed = para.trim();
    if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("---")) {
      return trimmed.slice(0, 200);
    }
  }
  return null;
}

function extractBodyExcerpt(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 700);
}

// ── Root file check ─────────────────────────────────────────────────────────────

const ROOT_FILE_NAMES = ["CLAUDE.md", "MEMORY.md", "AGENTS.md"] as const;

async function checkRootFiles(repo: string, token: string | null): Promise<RootFile[]> {
  let items: GhDirItem[] = [];
  try {
    items = await listDirItems(repo, token, "");
  } catch {
    return ROOT_FILE_NAMES.map((name) => ({ name, present: false, sha: null, size: null }));
  }

  const byName = new Map(items.filter((i) => i.type === "file").map((i) => [i.name, i]));

  return ROOT_FILE_NAMES.map((name) => {
    const item = byName.get(name);
    return item
      ? { name, present: true, sha: item.sha, size: item.size }
      : { name, present: false, sha: null, size: null };
  });
}

// ── Main export ─────────────────────────────────────────────────────────────────

export async function indexBrain(params: {
  userId: string;
  repo: string;
  token: string | null;
}): Promise<{ ok: true; result: BrainIndexResult } | { ok: false; error: string }> {
  const { userId, repo, token } = params;
  const errors: string[] = [];
  let indexed = 0;
  let skipped = 0;
  const byType: Record<string, number> = {};

  try {
    const [memoryItems, existingRows, tree] = await Promise.all([
      listDirItems(repo, token, "memory"),
      fetchExistingIndex(userId),
      listRepoTree(repo, token),
    ]);

    const mdFiles = memoryItems.filter((f) => f.type === "file" && f.name.endsWith(".md"));
    const existingShaByPath = new Map(existingRows.map((r) => [r.path, r.file_sha]));

    const entriesToUpsert: IndexRowInsert[] = [];
    const now = new Date().toISOString();

    // Process files in parallel (batches of 10 to be polite to GitHub)
    const BATCH = 10;
    for (let i = 0; i < mdFiles.length; i += BATCH) {
      const batch = mdFiles.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (file) => {
          const existingSha = existingShaByPath.get(file.path);
          if (existingSha === file.sha) {
            skipped++;
            return;
          }

          try {
            const content = await fetchBlobContent(repo, file.sha, token);
            const { data: fmData, body } = parseFrontmatter(content);

            const rawEntry = {
              user_id: userId,
              path: file.path,
              file_sha: file.sha,
              name: extractName(fmData, file.path),
              description: extractDescription(fmData, body),
              type: extractType(fmData, file.path),
              frontmatter_raw: fmData,
              body_excerpt: extractBodyExcerpt(body),
              indexed_at: now,
            };

            const parsed = IndexRowInsertSchema.safeParse(rawEntry);
            if (!parsed.success) {
              errors.push(`Validation error for ${file.path}: ${parsed.error.message}`);
              return;
            }

            entriesToUpsert.push(parsed.data);
            indexed++;
            byType[parsed.data.type] = (byType[parsed.data.type] ?? 0) + 1;
          } catch (e) {
            const msg = e instanceof Error ? e.message : "unknown error";
            errors.push(`Failed to index ${file.path}: ${msg}`);
          }
        }),
      );
    }

    // ── Deep walk — decision logs, SPEC docs, open questions, change logs ──────
    // The whole repo tree, not just memory/. Multi-entry files index one row per
    // entry under `<file>#<anchor>`; the file's blob sha rides on every fragment,
    // so an unchanged file is one map lookup to skip.
    const existingFileSha = new Map<string, string>();
    for (const r of existingRows) {
      const hashIdx = r.path.indexOf("#");
      existingFileSha.set(hashIdx === -1 ? r.path : r.path.slice(0, hashIdx), r.file_sha);
    }

    const deepBlobs = tree.filter(
      (e) => e.type === "blob" && classifyDeepPath(e.path) !== null,
    );
    const changedMultiEntryFiles: string[] = [];

    for (let i = 0; i < deepBlobs.length; i += BATCH) {
      const batch = deepBlobs.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (blob) => {
          if (existingFileSha.get(blob.path) === blob.sha) {
            skipped++;
            return;
          }

          try {
            const content = await fetchBlobContent(repo, blob.sha, token);
            const deepEntries = extractDeepEntries(blob.path, content);
            if (deepEntries.length === 0) return;
            if (deepEntries.some((d) => d.path !== blob.path) && existingFileSha.has(blob.path)) {
              changedMultiEntryFiles.push(blob.path);
            }

            for (const entry of deepEntries) {
              const rawEntry = {
                user_id: userId,
                path: entry.path,
                file_sha: blob.sha,
                name: entry.name,
                description: entry.description,
                type: entry.type,
                frontmatter_raw: {
                  source_file: entry.filePath,
                  ...(entry.ref ? { ref: entry.ref } : {}),
                  ...(entry.date ? { date: entry.date } : {}),
                },
                body_excerpt: entry.bodyExcerpt,
                indexed_at: now,
              };

              const parsed = IndexRowInsertSchema.safeParse(rawEntry);
              if (!parsed.success) {
                errors.push(`Validation error for ${entry.path}: ${parsed.error.message}`);
                continue;
              }
              entriesToUpsert.push(parsed.data);
              indexed++;
              byType[parsed.data.type] = (byType[parsed.data.type] ?? 0) + 1;
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : "unknown error";
            errors.push(`Failed to index ${blob.path}: ${msg}`);
          }
        }),
      );
    }

    // Changed multi-entry files first lose their old fragments, then the upsert
    // writes the fresh set — renumbered anchors can't leave stale rows behind.
    if (changedMultiEntryFiles.length > 0) {
      await deleteFragmentRows(userId, changedMultiEntryFiles);
    }

    if (entriesToUpsert.length > 0) {
      await upsertIndexRows(entriesToUpsert);
    }

    const rootFiles = await checkRootFiles(repo, token);
    await saveRootIndexToUser(userId, rootFiles, now);

    return { ok: true, result: { indexed, skipped, errors, rootFiles, byType } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return { ok: false, error: msg };
  }
}
