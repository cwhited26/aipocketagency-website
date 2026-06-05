// containment-guard.ts — PA-side structural privacy enforcement for brain-repo reads.
//
// Inspired by PAI's ContainmentGuard. The brain repo declares privacy "zones" in a
// `brain-containment.json` file at its root. Before ANY brain file is fed into an LLM
// call, the originating read path is checked against the zones. Files in a
// `user-private` zone are blocked unless the action that triggered the read is an
// explicit user share. This is belt-and-suspenders on top of Supabase RLS (which
// isolates tenants at the database layer) — RLS stops cross-tenant leaks; this stops
// an agent from pulling a user's own private files into a context where they don't
// belong.
//
// UI label for this feature is "Privacy zones" — we never surface "ContainmentGuard".

import { z } from "zod";
import { commitMemoryFile, fetchFileContent } from "@/lib/pa-brain";

export const CONTAINMENT_FILE_PATH = "brain-containment.json";

// ── Zone config schema ──────────────────────────────────────────────────────────

// A zone maps a zone name to a list of glob-ish path patterns. We support a tiny,
// dependency-free glob subset: `**` (any depth, including zero segments) and `*`
// (any run of non-slash chars). Two zone names are semantically meaningful:
//   - "user-private"   → blocked from LLM reads unless explicitly shared
//   - "project-shared" → freely readable by agents
// Unknown zone names are treated as private-by-default (fail closed).
export const ZoneConfigSchema = z.object({
  zones: z.record(z.string(), z.array(z.string().min(1)).max(200)),
});

export type ZoneConfig = z.infer<typeof ZoneConfigSchema>;

export const DEFAULT_ZONE_CONFIG: ZoneConfig = {
  zones: {
    "user-private": ["personal/**", "finance/**"],
    "project-shared": ["projects/**", "memory/**", "voice/**"],
  },
};

// Actions allowed to bypass the user-private block. Reads originating from an explicit
// user share (e.g. the user opened the file themselves, or sent it via share-to-brain)
// carry this origin and are permitted.
export type ReadOrigin = "agent-read" | "user-explicit-share";

// ── Typed error ─────────────────────────────────────────────────────────────────

export class ContainmentBlockedError extends Error {
  readonly path: string;
  readonly zone: string;
  // A clear, user-facing message safe to render directly in the UI.
  readonly userMessage: string;

  constructor(path: string, zone: string) {
    const userMessage =
      `Blocked: "${path}" is in your "${zone}" privacy zone and can't be read by the agent. ` +
      `Open it yourself or share it explicitly to use it here. You can adjust your zones in Settings → Privacy zones.`;
    super(`ContainmentBlocked: ${path} (zone: ${zone})`);
    this.name = "ContainmentBlockedError";
    this.path = path;
    this.zone = zone;
    this.userMessage = userMessage;
  }
}

// ── Glob matching ───────────────────────────────────────────────────────────────

// Compiles a single glob pattern into a RegExp. Supports `**` and `*` only. Patterns
// and paths are compared case-sensitively against the repo-relative path.
function globToRegExp(pattern: string): RegExp {
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "*") {
      if (pattern[i + 1] === "*") {
        // `**` → any characters including slashes. A trailing `/**` should also match
        // the directory itself, so we make the preceding slash optional below.
        re += ".*";
        i++;
        // swallow an immediate `/` after `**` so `personal/**` matches `personal/a/b`
        if (pattern[i + 1] === "/") i++;
      } else {
        // single `*` → any run of non-slash characters
        re += "[^/]*";
      }
    } else {
      re += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${re}$`);
}

function normalizePath(path: string): string {
  return path.replace(/^\.?\//, "").replace(/\/+/g, "/");
}

/**
 * Returns the name of the FIRST zone whose patterns match the path, or null if the
 * path is in no declared zone. Zone iteration order follows the config's key order.
 */
export function zoneForPath(path: string, config: ZoneConfig): string | null {
  const p = normalizePath(path);
  for (const [zone, patterns] of Object.entries(config.zones)) {
    for (const pattern of patterns) {
      // A bare `personal/**` should also match the literal `personal` directory entry.
      if (globToRegExp(pattern).test(p)) return zone;
      const dirPattern = pattern.replace(/\/\*\*$/, "");
      if (dirPattern !== pattern && globToRegExp(dirPattern).test(p)) return zone;
    }
  }
  return null;
}

// A zone is "private" if it is not the explicitly-shared zone. Unknown/extra zones
// fail closed (treated as private) so adding a new zone never silently opens a leak.
export function isPrivateZone(zone: string | null): boolean {
  if (zone === null) return false; // unzoned paths are shared by default
  return zone !== "project-shared";
}

/**
 * Throws ContainmentBlockedError if the path may NOT be read under the given origin.
 * Returns void when the read is permitted. Pure and synchronous — callers load the
 * zone config (via loadZoneConfig) once per request and reuse it.
 */
export function assertReadAllowed(
  path: string,
  config: ZoneConfig,
  origin: ReadOrigin,
): void {
  if (origin === "user-explicit-share") return; // explicit shares bypass the guard
  const zone = zoneForPath(path, config);
  if (isPrivateZone(zone)) {
    throw new ContainmentBlockedError(normalizePath(path), zone ?? "user-private");
  }
}

/**
 * Filters a list of read paths down to those permitted under the origin. Unlike
 * assertReadAllowed this never throws — it's for bulk read paths (e.g. assembling
 * memory blocks) where one private file should be silently skipped rather than
 * aborting the whole request. Returns the allowed paths plus the blocked ones so the
 * caller can decide whether to surface a notice.
 */
export function partitionReadablePaths(
  paths: string[],
  config: ZoneConfig,
  origin: ReadOrigin,
): { allowed: string[]; blocked: { path: string; zone: string }[] } {
  if (origin === "user-explicit-share") return { allowed: [...paths], blocked: [] };
  const allowed: string[] = [];
  const blocked: { path: string; zone: string }[] = [];
  for (const path of paths) {
    const zone = zoneForPath(path, config);
    if (isPrivateZone(zone)) {
      blocked.push({ path: normalizePath(path), zone: zone ?? "user-private" });
    } else {
      allowed.push(path);
    }
  }
  return { allowed, blocked };
}

// ── Config loading ──────────────────────────────────────────────────────────────

/**
 * Loads and validates brain-containment.json from the brain repo. Returns the parsed
 * config, or the safe default when the file is missing or malformed. A malformed file
 * is a soft failure (default config) rather than a hard error so a hand-edit typo
 * never bricks every agent read — callers that need to know can pass a logger.
 */
export function parseZoneConfig(raw: string): ZoneConfig {
  if (!raw.trim()) return DEFAULT_ZONE_CONFIG;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return DEFAULT_ZONE_CONFIG;
  }
  const parsed = ZoneConfigSchema.safeParse(json);
  return parsed.success ? parsed.data : DEFAULT_ZONE_CONFIG;
}

// ── Repo I/O ────────────────────────────────────────────────────────────────────

export type LoadedZoneConfig = {
  config: ZoneConfig;
  // True when the repo has no brain-containment.json yet (we fell back to the default).
  isDefault: boolean;
};

/**
 * Reads brain-containment.json from the repo root, falling back to the default config
 * when the file is absent or malformed. `isDefault` lets the UI show "first-time
 * setup" state and the read paths stay safe regardless.
 */
export async function loadZoneConfig(
  repo: string,
  token: string | null,
): Promise<LoadedZoneConfig> {
  const raw = await fetchFileContent(repo, CONTAINMENT_FILE_PATH, token);
  if (!raw.trim()) return { config: DEFAULT_ZONE_CONFIG, isDefault: true };
  return { config: parseZoneConfig(raw), isDefault: false };
}

export async function saveZoneConfig(params: {
  repo: string;
  token: string;
  config: ZoneConfig;
}): Promise<{ ok: true; sha: string } | { ok: false; error: string }> {
  const content = JSON.stringify(params.config, null, 2);
  return commitMemoryFile({
    repo: params.repo,
    token: params.token,
    path: CONTAINMENT_FILE_PATH,
    mode: "replace",
    content,
    commitMessage: "brain: update privacy zones (brain-containment.json)",
  });
}
