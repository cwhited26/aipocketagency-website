// actions-db.ts — data layer for pa_browser_actions (service-role REST, no SDK). This table is both
// the audit trail (one row per attempted tool call, whatever its fate) and the Trust-Ladder ledger
// (count of manually-approved executed actions per domain). Every write is scoped by owner_id; the
// routes resolve + gate ownership before calling in.

import { paEnv, authHeaders } from "./supabase";
import type { BrowserActionStatus } from "./constants";

const TABLE = "pa_browser_actions";

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export type BrowserActionRow = {
  id: string;
  owner_id: string;
  persona_id: string | null;
  task_id: string | null;
  action: string;
  target_url: string | null;
  domain: string | null;
  selector: string | null;
  payload_json: Record<string, unknown>;
  result_json: Record<string, unknown> | null;
  screenshot_url: string | null;
  status: BrowserActionStatus;
  approved_manually: boolean;
  error: string | null;
  inbox_item_id: string | null;
  created_at: string;
  updated_at: string;
};

// First-of-month (UTC) ISO, the lower bound for the monthly cap + the default log window.
export function monthStartIso(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export type InsertBrowserActionInput = {
  ownerId: string;
  personaId?: string | null;
  taskId?: string | null;
  action: string;
  targetUrl: string | null;
  domain: string | null;
  selector?: string | null;
  payloadJson: Record<string, unknown>;
  status: BrowserActionStatus;
  error?: string | null;
  approvedManually?: boolean;
  inboxItemId?: string | null;
};

export async function insertBrowserAction(input: InsertBrowserActionInput): Promise<PaResult<BrowserActionRow>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      owner_id: input.ownerId,
      persona_id: input.personaId ?? null,
      task_id: input.taskId ?? null,
      action: input.action,
      target_url: input.targetUrl,
      domain: input.domain,
      selector: input.selector ?? null,
      payload_json: input.payloadJson,
      status: input.status,
      error: input.error ?? null,
      approved_manually: input.approvedManually ?? false,
      inbox_item_id: input.inboxItemId ?? null,
    }),
    cache: "no-store",
  });

  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as BrowserActionRow[];
  if (!rows[0]) return { ok: false, status: 500, error: "No row returned after insert." };
  return { ok: true, data: rows[0] };
}

export type UpdateBrowserActionPatch = {
  status?: BrowserActionStatus;
  resultJson?: Record<string, unknown> | null;
  screenshotUrl?: string | null;
  error?: string | null;
  approvedManually?: boolean;
  inboxItemId?: string | null;
};

export async function updateBrowserAction(id: string, patch: UpdateBrowserActionPatch): Promise<PaResult<BrowserActionRow>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.resultJson !== undefined) body.result_json = patch.resultJson;
  if (patch.screenshotUrl !== undefined) body.screenshot_url = patch.screenshotUrl;
  if (patch.error !== undefined) body.error = patch.error;
  if (patch.approvedManually !== undefined) body.approved_manually = patch.approvedManually;
  if (patch.inboxItemId !== undefined) body.inbox_item_id = patch.inboxItemId;

  const res = await fetch(`${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as BrowserActionRow[];
  if (!rows[0]) return { ok: false, status: 500, error: "No row returned after update." };
  return { ok: true, data: rows[0] };
}

export async function fetchBrowserActionById(id: string): Promise<PaResult<BrowserActionRow | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&limit=1`, {
    headers: authHeaders(env.key),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as BrowserActionRow[];
  return { ok: true, data: rows[0] ?? null };
}

/**
 * How many actions this owner has used against the monthly cap (UTC month). Refused / blocked /
 * rejected rows never ran, so they don't count; executed, pending_approval (queued to run on
 * approval), and failed (ran but errored) all consume the quota.
 */
export async function countActionsThisMonth(ownerId: string): Promise<number> {
  const env = paEnv();
  if ("error" in env) return 0;

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}` +
      `?owner_id=eq.${encodeURIComponent(ownerId)}` +
      `&created_at=gte.${encodeURIComponent(monthStartIso())}` +
      `&status=in.(executed,pending_approval,failed)` +
      `&select=id`,
    { headers: { ...authHeaders(env.key), Prefer: "count=exact" }, cache: "no-store" },
  );
  if (!res.ok) return 0;
  return countFromResponse(res, await res.json());
}

/** Trust-Ladder count: manually-approved executed actions for one (owner, domain). */
export async function countManualApprovalsForDomain(ownerId: string, domain: string): Promise<number> {
  const env = paEnv();
  if ("error" in env) return 0;

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}` +
      `?owner_id=eq.${encodeURIComponent(ownerId)}` +
      `&domain=eq.${encodeURIComponent(domain)}` +
      `&status=eq.executed` +
      `&approved_manually=is.true` +
      `&select=id`,
    { headers: { ...authHeaders(env.key), Prefer: "count=exact" }, cache: "no-store" },
  );
  if (!res.ok) return 0;
  return countFromResponse(res, await res.json());
}

export type BrowserActionFilter = {
  domain?: string;
  personaId?: string;
  status?: BrowserActionStatus;
  limit?: number;
};

/** The audit log feed for /app/settings/browser/log, newest-first, with optional filters. */
export async function listBrowserActions(ownerId: string, filter: BrowserActionFilter = {}): Promise<PaResult<BrowserActionRow[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const params = [
    `owner_id=eq.${encodeURIComponent(ownerId)}`,
    "order=created_at.desc",
    `limit=${Math.min(Math.max(filter.limit ?? 100, 1), 500)}`,
  ];
  if (filter.domain) params.push(`domain=eq.${encodeURIComponent(filter.domain)}`);
  if (filter.personaId) params.push(`persona_id=eq.${encodeURIComponent(filter.personaId)}`);
  if (filter.status) params.push(`status=eq.${encodeURIComponent(filter.status)}`);

  const res = await fetch(`${env.url}/rest/v1/${TABLE}?${params.join("&")}`, {
    headers: authHeaders(env.key),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as BrowserActionRow[];
  return { ok: true, data: rows };
}

function countFromResponse(res: Response, body: unknown): number {
  const range = res.headers.get("content-range");
  if (range) {
    const total = Number(range.split("/")[1]);
    if (Number.isFinite(total)) return total;
  }
  return Array.isArray(body) ? body.length : 0;
}
