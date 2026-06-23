// slug.ts — the per-user Pocket Capture email-forward address: <slug>@capture.aipocketagent.com.
//
// Three concerns:
//   1. Pure helpers — the capture domain, slug generation, and classifying an incoming
//      recipient address back to a slug (pure → directly unit-tested).
//   2. lookupOwnerByCaptureSlug — resolve an inbound recipient's slug to the owning user.
//   3. ensureCaptureEmailSlug — idempotently provision a slug for an owner (lazy, on first
//      inbound-config read), tolerating the cross-user UNIQUE collision with a retry.

import crypto from "node:crypto";
import { paEnv, authHeaders, type PaEnv } from "./supabase";

// The inbound subdomain Pocket Capture forwards land on. Overridable per environment; the
// default is the production subdomain locked in the SPEC (PA-CAPTURE-1).
export const CAPTURE_EMAIL_DOMAIN = (
  process.env.PA_CAPTURE_EMAIL_DOMAIN ?? "capture.aipocketagent.com"
).toLowerCase();

const SLUG_LENGTH = 12;
// Lowercase alphanumerics only — copy-pasteable, case-insensitive, no shell-quoting surprises.
const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export type CaptureOwner = {
  id: string;
  brain_repo: string | null;
  github_token: string | null;
};

/** A fresh random 12-char lowercase-alphanumeric slug. Rejection-samples to avoid modulo bias. */
export function generateCaptureSlug(length = SLUG_LENGTH): string {
  const out: string[] = [];
  // 256 % 36 != 0, so bytes ≥ 252 would bias the low letters — discard them and redraw.
  const limit = 256 - (256 % SLUG_ALPHABET.length);
  while (out.length < length) {
    for (const byte of crypto.randomBytes(length)) {
      if (byte >= limit) continue;
      out.push(SLUG_ALPHABET[byte % SLUG_ALPHABET.length]);
      if (out.length === length) break;
    }
  }
  return out.join("");
}

/** The full forwarding address for a slug. */
export function captureEmailForSlug(slug: string): string {
  return `${slug}@${CAPTURE_EMAIL_DOMAIN}`;
}

/**
 * If `addr` lands on the capture domain, return its slug (the local part, with any Gmail-style
 * `+tag` stripped); otherwise null. Addresses arrive already bare + lowercased from the parser.
 */
export function captureSlugFromAddress(addr: string, domain = CAPTURE_EMAIL_DOMAIN): string | null {
  const at = addr.lastIndexOf("@");
  if (at === -1) return null;
  const local = addr.slice(0, at).toLowerCase();
  const host = addr.slice(at + 1).toLowerCase();
  if (host !== domain.toLowerCase()) return null;
  const slug = local.split("+")[0].trim();
  return slug.length > 0 ? slug : null;
}

/** Resolve an inbound recipient's slug to the owning user (the webhook's routing key). */
export async function lookupOwnerByCaptureSlug(slug: string): Promise<PaResult<CaptureOwner | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/pocket_agent_users` +
      `?pocket_capture_email_slug=eq.${encodeURIComponent(slug)}` +
      `&select=id,brain_repo,github_token&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as CaptureOwner[];
  return { ok: true, data: rows[0] ?? null };
}

/** Read an owner's existing slug (null when not yet provisioned). */
async function readSlug(env: PaEnv, ownerId: string): Promise<PaResult<string | null>> {
  const res = await fetch(
    `${env.url}/rest/v1/pocket_agent_users` +
      `?id=eq.${encodeURIComponent(ownerId)}&select=pocket_capture_email_slug&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as { pocket_capture_email_slug: string | null }[];
  if (rows.length === 0) return { ok: false, status: 404, error: "no such user" };
  return { ok: true, data: rows[0].pocket_capture_email_slug };
}

// Claim `candidate` for an owner that has no slug yet. Returns "claimed" on success, "taken" on a
// cross-user UNIQUE collision (retry with a fresh candidate), or "already" when the row already had
// a slug set concurrently (re-read and use it).
async function claimSlug(
  env: PaEnv,
  ownerId: string,
  candidate: string,
): Promise<PaResult<"claimed" | "taken" | "already">> {
  const res = await fetch(
    `${env.url}/rest/v1/pocket_agent_users` +
      `?id=eq.${encodeURIComponent(ownerId)}&pocket_capture_email_slug=is.null`,
    {
      method: "PATCH",
      headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ pocket_capture_email_slug: candidate }),
      cache: "no-store",
    },
  );
  if (res.ok) {
    const rows = (await res.json()) as unknown[];
    // No row matched the `slug IS NULL` filter → a slug was set between our read and write.
    return { ok: true, data: rows.length > 0 ? "claimed" : "already" };
  }
  const body = await res.text();
  if (res.status === 409 || body.includes("23505") || body.includes("duplicate key")) {
    return { ok: true, data: "taken" };
  }
  return { ok: false, status: res.status, error: body };
}

/**
 * Idempotently ensure an owner has a Pocket Capture slug and return their forwarding address.
 * Safe to call on every inbound-config read: returns the existing slug when present, otherwise
 * provisions one, retrying on the (astronomically unlikely) cross-user collision.
 */
export async function ensureCaptureEmailSlug(ownerId: string): Promise<PaResult<{ slug: string; email: string }>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const existing = await readSlug(env, ownerId);
  if (!existing.ok) return existing;
  if (existing.data) {
    return { ok: true, data: { slug: existing.data, email: captureEmailForSlug(existing.data) } };
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = generateCaptureSlug();
    const claim = await claimSlug(env, ownerId, candidate);
    if (!claim.ok) return claim;
    if (claim.data === "claimed") {
      return { ok: true, data: { slug: candidate, email: captureEmailForSlug(candidate) } };
    }
    if (claim.data === "already") {
      const reread = await readSlug(env, ownerId);
      if (!reread.ok) return reread;
      if (reread.data) {
        return { ok: true, data: { slug: reread.data, email: captureEmailForSlug(reread.data) } };
      }
      // Fell through (slug cleared again) — loop and try a fresh candidate.
    }
    // "taken" → loop with a new candidate.
  }
  return { ok: false, status: 500, error: "could not provision a unique capture slug" };
}
