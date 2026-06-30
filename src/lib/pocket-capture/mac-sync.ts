// mac-sync.ts — ingest a batch of captures from the Pocket Agent Capture Mac app (PA-CAPTURE-MAC
// v0.1). The menu-bar app watches the clipboard + screenshot folders and POSTs queued items to
// /api/capture/mac-sync with the owner's personal API token. This module owns:
//
//   1. the Zod boundary for one synced item (MacCaptureItemSchema) + the batch body,
//   2. pure composition of the inbox entry for an item (buildMacCaptureEntry — unit-tested),
//   3. the durable idempotency claim against pa_pocket_capture_mac_sync_log (claim-before-write,
//      release-on-failure) so a retried upload never double-writes the brain,
//   4. writeMacCaptureBatch — the batched writer: claim each item, stage binaries in Storage, then
//      one brain commit for the whole batch, reporting a per-item status the uploader acts on.
//
// The brain write reuses the shipped path (fetchFileContent + appendEntryToRaw + commitMemoryFile)
// exactly like the email / SMS / voice surfaces, tagging entries source="mac_app".

import { z } from "zod";
import { fetchFileContent, commitMemoryFile } from "@/lib/pa-brain";
import { appendEntryToRaw, type InboxKind } from "@/lib/pa-inbox";
import type { CaptureOwner } from "./slug";
import { paEnv, authHeaders } from "./supabase";
import { uploadCaptureAttachment } from "./storage";

const INBOX_PATH = "memory/inbox.md";
const LOG_TABLE = "pa_pocket_capture_mac_sync_log";

/** The capture surface tag written into each inbox entry's metadata. */
export const MAC_CAPTURE_SOURCE = "mac_app";

/**
 * Hard cap on a single binary (image/file) after base64 decode. Kept under Vercel's ~4.5MB request
 * body limit (base64 inflates ~33%), so a 4MB blob is the most an inline upload can carry. The Mac
 * app enforces a matching client-side cap and never sends larger; the server rejects oversized blobs
 * defensively (status "rejected" — a permanent outcome the client drops rather than retries).
 */
export const MAX_BINARY_BYTES = 4 * 1024 * 1024;

/** Max items in one sync batch. The uploader sends small batches every 30s. */
export const MAX_BATCH_ITEMS = 100;

// ─── Zod boundary ─────────────────────────────────────────────────────────────────

export const MacCaptureKind = z.enum(["text", "image", "file", "url"]);
export type MacCaptureKind = z.infer<typeof MacCaptureKind>;

/**
 * One captured item as the Mac app sends it. `content` is the raw text for text/url, or base64 of the
 * file bytes for image/file. `hash` is the client's SHA-256 of the content (the dedup key). filename
 * + mimeType are required for binaries (needed to store + label them) and ignored for text/url.
 */
export const MacCaptureItemSchema = z
  .object({
    kind: MacCaptureKind,
    // 40MB ceiling on the raw field guards the JSON parse; per-kind semantic caps are enforced below
    // (text → 50k chars at write time via the inbox slice; binary → MAX_BINARY_BYTES after decode).
    content: z.string().min(1, "content is required").max(40_000_000),
    filename: z.string().max(255).nullable().optional(),
    mimeType: z.string().max(255).nullable().optional(),
    sourceApp: z.string().max(255).nullable().optional(),
    capturedAt: z.string().datetime({ message: "capturedAt must be an ISO timestamp" }),
    hash: z.string().regex(/^[0-9a-f]{64}$/, "hash must be a 64-char hex SHA-256"),
  })
  .superRefine((item, ctx) => {
    if ((item.kind === "image" || item.kind === "file") && !item.filename?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "filename is required for image/file captures",
        path: ["filename"],
      });
    }
  });

export type MacCaptureItem = z.infer<typeof MacCaptureItemSchema>;

export const MacSyncBodySchema = z.object({
  items: z.array(MacCaptureItemSchema).min(1, "items must not be empty").max(MAX_BATCH_ITEMS),
});

export type MacSyncBody = z.infer<typeof MacSyncBodySchema>;

// ─── Pure composition (unit-tested) ─────────────────────────────────────────────────

/** Human provenance footer naming the source app (when known). Pure. */
export function macProvenanceLine(sourceApp: string | null | undefined): string {
  const app = sourceApp?.trim();
  return app ? `— Captured from ${app} via Mac Capture` : "— Captured via Mac Capture";
}

/**
 * The display name for a binary capture: its (path-stripped) filename, or a kind-appropriate default.
 * Pure → unit-tested.
 */
export function macBinaryName(item: Pick<MacCaptureItem, "kind" | "filename">): string {
  const base = (item.filename ?? "").split(/[\\/]/).pop()?.trim();
  if (base) return base;
  return item.kind === "image" ? "screenshot" : "file";
}

/**
 * Compose the inbox entry payload for one captured item. Text/url carry the content inline (url also
 * sets sourceUrl); image/file reference the staged Storage object path in the body. Pure → the whole
 * mapping (kind → InboxKind, provenance, title) is unit-tested without any I/O.
 */
export function buildMacCaptureEntry(
  item: MacCaptureItem,
  storedPath: string | null,
): { kind: InboxKind; content: string; title?: string; sourceUrl?: string; source: string } {
  const provenance = macProvenanceLine(item.sourceApp);

  if (item.kind === "url") {
    const url = item.content.trim();
    return {
      kind: "url",
      content: `${url}\n\n${provenance}`,
      sourceUrl: url,
      source: MAC_CAPTURE_SOURCE,
    };
  }

  if (item.kind === "text") {
    return {
      kind: "text",
      content: `${item.content.trim()}\n\n${provenance}`,
      source: MAC_CAPTURE_SOURCE,
    };
  }

  // image | file
  const name = macBinaryName(item);
  const location = storedPath ? `Stored at ${storedPath}` : "(attachment not stored)";
  return {
    kind: "note",
    content: `${name}\n\n${location}\n\n${provenance}`,
    title: name,
    source: MAC_CAPTURE_SOURCE,
  };
}

// ─── Result shape ───────────────────────────────────────────────────────────────────

export type MacItemStatus =
  | "accepted" // written to the brain this call — client marks synced
  | "duplicate" // already ingested (idempotent re-send) — client marks synced
  | "rejected" // permanently unprocessable (e.g. too large) — client drops, no retry
  | "error"; // transient failure — client keeps queued and retries

export type MacItemResult = { hash: string; status: MacItemStatus; reason?: string };

export type MacBatchResult =
  | { ok: true; results: MacItemResult[] }
  | { ok: false; reason: "no-brain"; error: string };

// ─── Idempotency ledger (direct REST, no SDK) ────────────────────────────────────────

type ClaimOutcome = "claimed" | "duplicate" | { error: string };

/** Claim an item by inserting its ledger row. A UNIQUE (owner_id, content_hash) collision → duplicate. */
async function claimMacCapture(ownerId: string, item: MacCaptureItem): Promise<ClaimOutcome> {
  const env = paEnv();
  if ("error" in env) return { error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${LOG_TABLE}`, {
    method: "POST",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      owner_id: ownerId,
      content_hash: item.hash,
      kind: item.kind,
      source_app: item.sourceApp?.trim() ? item.sourceApp.trim().slice(0, 255) : null,
      captured_at: item.capturedAt,
    }),
    cache: "no-store",
  });
  if (res.ok) return "claimed";
  const body = await res.text();
  if (res.status === 409 || body.includes("23505") || body.includes("duplicate key")) {
    return "duplicate";
  }
  return { error: `claim failed (${res.status}): ${body}` };
}

/** Mark a claimed item processed once its brain write succeeded (best-effort; logs on failure). */
async function markProcessed(ownerId: string, hash: string): Promise<void> {
  const env = paEnv();
  if ("error" in env) return;
  const res = await fetch(
    `${env.url}/rest/v1/${LOG_TABLE}` +
      `?owner_id=eq.${encodeURIComponent(ownerId)}&content_hash=eq.${encodeURIComponent(hash)}`,
    {
      method: "PATCH",
      headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ processed: true }),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    console.error("[pocket-capture/mac-sync] mark-processed failed", { hash, status: res.status });
  }
}

/**
 * Release a claim (DELETE its ledger row) after a brain-write failure, so the uploader's retry can
 * re-attempt instead of being deduped into a permanent loss. Best-effort: a failed release leaves the
 * row claimed (the next retry would dedupe), which we record but never throw on.
 */
async function releaseClaim(ownerId: string, hash: string): Promise<void> {
  const env = paEnv();
  if ("error" in env) return;
  const res = await fetch(
    `${env.url}/rest/v1/${LOG_TABLE}` +
      `?owner_id=eq.${encodeURIComponent(ownerId)}&content_hash=eq.${encodeURIComponent(hash)}` +
      `&processed=eq.false`,
    {
      method: "DELETE",
      headers: { ...authHeaders(env.key), Prefer: "return=minimal" },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    console.error("[pocket-capture/mac-sync] release-claim failed", { hash, status: res.status });
  }
}

// ─── Batched writer ──────────────────────────────────────────────────────────────────

/** Decode + size-check a base64 binary. Returns the bytes, or a permanent rejection reason. */
function decodeBinary(item: MacCaptureItem): { ok: true; bytes: Buffer } | { ok: false; reason: string } {
  const bytes = Buffer.from(item.content, "base64");
  if (bytes.length === 0) return { ok: false, reason: "empty or invalid base64 content" };
  if (bytes.length > MAX_BINARY_BYTES) {
    return { ok: false, reason: `binary too large (${bytes.length} bytes; max ${MAX_BINARY_BYTES})` };
  }
  return { ok: true, bytes };
}

/**
 * Ingest a batch of Mac-app captures for one owner. Two phases:
 *   1. Per item: claim the idempotency row. Duplicates + permanently-rejected items (bad binary /
 *      too large, with their claim released) are recorded; the rest, with any binary staged in
 *      Storage, are collected for the brain write.
 *   2. One brain commit for all collected items. On success they're marked processed (accepted); on
 *      failure their claims are released so the uploader retries (error).
 *
 * Returns reason "no-brain" when the owner hasn't connected a brain repo, so the route can 409 and
 * the client keeps everything queued until the brain is connected.
 */
export async function writeMacCaptureBatch(
  owner: CaptureOwner,
  items: MacCaptureItem[],
): Promise<MacBatchResult> {
  if (!owner.brain_repo || !owner.github_token) {
    return { ok: false, reason: "no-brain", error: "owner has no brain repo connected" };
  }
  const repo = owner.brain_repo;
  const token = owner.github_token;

  const results: MacItemResult[] = [];
  const toWrite: { item: MacCaptureItem; storedPath: string | null }[] = [];

  // Phase 1 — claim + stage binaries.
  for (const item of items) {
    const claim = await claimMacCapture(owner.id, item);
    if (claim === "duplicate") {
      results.push({ hash: item.hash, status: "duplicate" });
      continue;
    }
    if (claim !== "claimed") {
      results.push({ hash: item.hash, status: "error", reason: claim.error });
      continue;
    }

    if (item.kind === "image" || item.kind === "file") {
      const decoded = decodeBinary(item);
      if (!decoded.ok) {
        // Permanent: release the claim and tell the client to drop it (don't retry forever).
        await releaseClaim(owner.id, item.hash);
        results.push({ hash: item.hash, status: "rejected", reason: decoded.reason });
        continue;
      }
      const upload = await uploadCaptureAttachment({
        ownerId: owner.id,
        captureId: item.hash,
        filename: macBinaryName(item),
        contentType: item.mimeType?.trim() || "application/octet-stream",
        bytes: decoded.bytes,
      });
      if (!upload.ok) {
        // Transient (Storage hiccup): release the claim so the retry re-attempts.
        await releaseClaim(owner.id, item.hash);
        results.push({ hash: item.hash, status: "error", reason: upload.error });
        continue;
      }
      toWrite.push({ item, storedPath: upload.path });
      continue;
    }

    toWrite.push({ item, storedPath: null });
  }

  if (toWrite.length === 0) return { ok: true, results };

  // Phase 2 — one brain commit for the whole batch.
  const existing = await fetchFileContent(repo, INBOX_PATH, token);
  let raw = existing;
  for (const { item, storedPath } of toWrite) {
    const payload = buildMacCaptureEntry(item, storedPath);
    raw = appendEntryToRaw(raw, payload).content;
  }

  const commit = await commitMemoryFile({
    repo,
    token,
    path: INBOX_PATH,
    mode: "replace",
    content: raw,
    commitMessage: `Pocket Capture — Mac app sync (${toWrite.length} item${toWrite.length === 1 ? "" : "s"})`,
  });

  if (commit.ok) {
    for (const { item } of toWrite) {
      await markProcessed(owner.id, item.hash);
      results.push({ hash: item.hash, status: "accepted" });
    }
  } else {
    for (const { item } of toWrite) {
      await releaseClaim(owner.id, item.hash);
      results.push({ hash: item.hash, status: "error", reason: commit.error });
    }
  }

  return { ok: true, results };
}
