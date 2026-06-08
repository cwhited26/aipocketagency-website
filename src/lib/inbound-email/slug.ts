// slug.ts — pure helpers for turning account names, recipients, and subjects into the
// safe, bounded strings the inbound-email feature needs: address local-parts, brain
// file paths, and a random fallback token when a name slug collides.

import crypto from "node:crypto";

/**
 * Slugify a name into an email local-part: lowercase, ASCII alphanumerics and single
 * hyphens only, no leading/trailing hyphen, bounded length. Returns "" when nothing
 * usable survives (e.g. an all-emoji name) — callers fall back to a random token.
 */
export function slugifyLocalPart(name: string, max = 40): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max)
    .replace(/-$/, "");
}

/**
 * Slugify an arbitrary string (recipient, subject) for use inside a brain file name.
 * Like {@link slugifyLocalPart} but falls back to a stable default when empty so a
 * path segment is never blank.
 */
export function slugifyForPath(value: string, fallback: string, max = 60): string {
  const slug = slugifyLocalPart(value, max);
  return slug || fallback;
}

/** A short, URL-safe random token (lowercase hex) for collision fallback / uniqueness. */
export function randomToken(bytes = 5): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/** The address-local-part slug for an owner, with a random suffix appended on collision. */
export function localPartWithSuffix(base: string, suffix: string): string {
  const safeBase = base || "owner";
  return `${safeBase}-${suffix}`.slice(0, 60).replace(/-$/, "");
}
