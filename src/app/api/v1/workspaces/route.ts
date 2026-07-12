// POST /api/v1/workspaces — external-product per-workspace key issuance.
//
// External products (e.g. Buildout Schedule) mint a per-workspace PA API key by calling this
// endpoint with their per-product MASTER key as a Bearer token. This is NOT the user-facing
// `pa_live_` key auth (lib/api-v1/context.ts) — it authenticates against pa_master_keys.
//
// Flow: authenticate master key (SHA-256 hash lookup) → rate limit (100/min per key) → Zod the
// body → find-or-create the workspace by (master key, external_workspace_id). Create mints a
// fresh `pa_ws_` key, stores its hash, and returns the plaintext ONCE. A repeat call rotates the
// key (we store hashes only, so the original can't be re-returned) and returns the new plaintext.
// Every call is audited to pa_master_key_audit. subscription_id is null (no billing tie-in yet).

import { NextResponse } from "next/server";
import { WorkspaceIssueSchema } from "@/lib/master-keys/schema";
import { extractBearerToken, generateWorkspaceKey, sha256Hex } from "@/lib/master-keys/keys";
import {
  findActiveMasterKeyByHash,
  findWorkspace,
  insertWorkspace,
  rotateWorkspaceKey,
  touchMasterKey,
  insertAudit,
} from "@/lib/master-keys/store";
import { hitRateLimit, pruneExpired, type RateWindow } from "@/lib/master-keys/rate-limit";
import { masterKeyLog } from "@/lib/master-keys/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-instance rate window store, keyed by master key id (see rate-limit.ts).
const rateStore = new Map<string, RateWindow>();

function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

export async function POST(req: Request): Promise<NextResponse> {
  const ip = clientIp(req);
  const userAgent = req.headers.get("user-agent");

  // 1. Authenticate the master key.
  const token = extractBearerToken(req.headers.get("authorization"));
  if (!token) {
    await insertAudit({
      master_key_id: null,
      action: "unauthorized_missing_bearer",
      external_workspace_id: null,
      ip,
      user_agent: userAgent,
      status_code: 401,
    });
    return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
  }

  const lookup = await findActiveMasterKeyByHash(sha256Hex(token));
  if (!lookup.ok) {
    masterKeyLog.error("master key lookup failed", { status: lookup.status });
    return NextResponse.json({ error: "Key verification unavailable." }, { status: 503 });
  }
  const masterKey = lookup.data;
  if (!masterKey) {
    await insertAudit({
      master_key_id: null,
      action: "unauthorized_invalid_key",
      external_workspace_id: null,
      ip,
      user_agent: userAgent,
      status_code: 401,
    });
    return NextResponse.json({ error: "Invalid master key." }, { status: 401 });
  }

  // 2. Rate limit (100/min per master key).
  const now = Date.now();
  pruneExpired(rateStore, now);
  const rate = hitRateLimit(rateStore, masterKey.id, now);
  if (!rate.ok) {
    await insertAudit({
      master_key_id: masterKey.id,
      action: "rate_limited",
      external_workspace_id: null,
      ip,
      user_agent: userAgent,
      status_code: 429,
    });
    return NextResponse.json(
      { error: "Rate limit exceeded (100/min)." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  // 3. Validate the body.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    await insertAudit({
      master_key_id: masterKey.id,
      action: "invalid_body",
      external_workspace_id: null,
      ip,
      user_agent: userAgent,
      status_code: 400,
    });
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = WorkspaceIssueSchema.safeParse(raw);
  if (!parsed.success) {
    await insertAudit({
      master_key_id: masterKey.id,
      action: "invalid_body",
      external_workspace_id: null,
      ip,
      user_agent: userAgent,
      status_code: 400,
    });
    return NextResponse.json(
      { error: "external_workspace_id, slug, owner_email, and source are required." },
      { status: 400 },
    );
  }
  const body = parsed.data;

  // Fire-and-forget last_used_at touch on the authenticated key.
  void touchMasterKey(masterKey.id);

  // 4. Find or create the workspace by (master key, external_workspace_id).
  const existing = await findWorkspace(masterKey.id, body.external_workspace_id);
  if (!existing.ok) {
    masterKeyLog.error("workspace lookup failed", {
      status: existing.status,
      product_slug: masterKey.product_slug,
    });
    return NextResponse.json({ error: "Workspace lookup failed." }, { status: 503 });
  }

  const fresh = generateWorkspaceKey();

  if (existing.data) {
    // Repeat call — rotate the key (hashes only, so the original plaintext is unrecoverable).
    const rotated = await rotateWorkspaceKey(existing.data.id, fresh.keyHash);
    if (!rotated.ok) {
      masterKeyLog.error("workspace rotate failed", { status: rotated.status });
      return NextResponse.json({ error: "Could not re-key workspace." }, { status: 503 });
    }
    masterKeyLog.info("workspace re-keyed", {
      product_slug: masterKey.product_slug,
      external_workspace_id: body.external_workspace_id,
    });
    await insertAudit({
      master_key_id: masterKey.id,
      action: "issue_existing_rotated",
      external_workspace_id: body.external_workspace_id,
      ip,
      user_agent: userAgent,
      status_code: 201,
    });
    return NextResponse.json({ api_key: fresh.plaintext, subscription_id: null }, { status: 201 });
  }

  const created = await insertWorkspace({
    source_master_key_id: masterKey.id,
    external_workspace_id: body.external_workspace_id,
    external_slug: body.slug,
    owner_email: body.owner_email,
    api_key_hashed: fresh.keyHash,
  });
  if (!created.ok) {
    masterKeyLog.error("workspace insert failed", { status: created.status });
    return NextResponse.json({ error: "Could not create workspace." }, { status: 503 });
  }
  masterKeyLog.info("workspace created", {
    product_slug: masterKey.product_slug,
    external_workspace_id: body.external_workspace_id,
  });
  await insertAudit({
    master_key_id: masterKey.id,
    action: "issue_created",
    external_workspace_id: body.external_workspace_id,
    ip,
    user_agent: userAgent,
    status_code: 201,
  });
  return NextResponse.json({ api_key: fresh.plaintext, subscription_id: null }, { status: 201 });
}
