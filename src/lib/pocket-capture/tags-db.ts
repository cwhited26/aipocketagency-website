// tags-db.ts — service-role REST data layer for pa_capture_tags (migration 097): the owner-editable
// Captures Dashboard tab strip. Direct REST, no SDK (standing rule). Every read/write is owner-scoped:
// the WHERE clause pins owner_id so a user can only ever touch their own tags. The route resolves the
// caller's user id from the session before calling in here.
//
// Tag ASSIGNMENT is not stored here — it rides a capture's tags[] meta in the brain file (see tags.ts
// + pa-inbox.ts). This layer is purely the tab definitions: list, lazy-seed defaults, create, rename /
// recolor, delete, reorder.

import { paEnv, authHeaders } from "./supabase";
import {
  DEFAULT_TAG_SEED,
  snapToPalette,
  CaptureTagSchema,
  type CaptureTag,
} from "./tags";
import { normalizeTags } from "@/lib/pa-inbox";

const TABLE = "pa_capture_tags";
const MAX_TAGS_PER_OWNER = 24;

export type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

type TagRow = {
  id: string;
  name: string;
  color_hex: string;
  sort_order: number;
};

/** Map a DB row to the validated CaptureTag shape the UI consumes. Throws (caught by the caller) on a
 *  malformed row so a bad row can't silently render. */
function toTag(row: TagRow): CaptureTag {
  return CaptureTagSchema.parse({
    id: row.id,
    name: row.name,
    colorHex: row.color_hex,
    sortOrder: row.sort_order,
  });
}

const SELECT = "select=id,name,color_hex,sort_order&order=sort_order.asc,created_at.asc";

/** Raw list of an owner's tags, tab order. Internal — listTagsWithSeed is the public entry. */
async function fetchTags(env: { url: string; key: string }, ownerId: string): Promise<PaResult<CaptureTag[]>> {
  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?owner_id=eq.${encodeURIComponent(ownerId)}&${SELECT}`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as TagRow[];
  return { ok: true, data: rows.map(toTag) };
}

/**
 * List an owner's tags in tab order, seeding the four defaults (Wins / Ideas / Tasks / Reference) the
 * first time an owner has none. The seed is best-effort and idempotent: a UNIQUE(owner_id, lower(name))
 * race just no-ops the duplicate insert, and we re-read afterwards so the caller always gets the
 * authoritative set. This is the entry the dashboard + settings + the GET route use.
 */
export async function listTagsWithSeed(ownerId: string): Promise<PaResult<CaptureTag[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const first = await fetchTags(env, ownerId);
  if (!first.ok || first.data.length > 0) return first;

  // Owner has no tags yet → seed the defaults, ignoring duplicate-key conflicts on a concurrent seed.
  await fetch(`${env.url}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "return=minimal,resolution=ignore-duplicates",
    },
    body: JSON.stringify(
      DEFAULT_TAG_SEED.map((seed, i) => ({
        owner_id: ownerId,
        name: seed.name,
        color_hex: seed.colorHex,
        sort_order: i,
      })),
    ),
    cache: "no-store",
  });

  return fetchTags(env, ownerId);
}

/**
 * Create a tag for an owner. Name is normalized + length-capped; color is snapped onto the 12-color
 * palette so a stored color is always on-list. New tags sort to the end (max sort_order + 1). Rejects
 * over the per-owner cap and surfaces a 409 on a duplicate name (the UNIQUE index).
 */
export async function createTag(
  ownerId: string,
  name: string,
  colorHex: string,
): Promise<PaResult<CaptureTag>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const cleanName = normalizeTags([name])[0];
  if (!cleanName) return { ok: false, status: 422, error: "Tag name can't be empty." };

  const existing = await fetchTags(env, ownerId);
  if (!existing.ok) return existing;
  if (existing.data.length >= MAX_TAGS_PER_OWNER) {
    return { ok: false, status: 422, error: `You can have up to ${MAX_TAGS_PER_OWNER} tags.` };
  }
  const nextOrder = existing.data.reduce((m, t) => Math.max(m, t.sortOrder), -1) + 1;

  const res = await fetch(`${env.url}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      owner_id: ownerId,
      name: cleanName,
      color_hex: snapToPalette(colorHex),
      sort_order: nextOrder,
    }),
    cache: "no-store",
  });
  if (res.status === 409) {
    return { ok: false, status: 409, error: `You already have a tag named "${cleanName}".` };
  }
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as TagRow[];
  const row = rows[0];
  if (!row) return { ok: false, status: 502, error: "Tag was not created." };
  return { ok: true, data: toTag(row) };
}

/**
 * Rename and/or recolor a tag, owner-scoped (the WHERE pins id AND owner_id). Returns the updated row,
 * or 404 when the id isn't the owner's. A 409 surfaces a duplicate name.
 */
export async function updateTag(
  id: string,
  ownerId: string,
  patch: { name?: string; colorHex?: string },
): Promise<PaResult<CaptureTag>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const body: Record<string, string> = {};
  if (patch.name !== undefined) {
    const cleanName = normalizeTags([patch.name])[0];
    if (!cleanName) return { ok: false, status: 422, error: "Tag name can't be empty." };
    body.name = cleanName;
  }
  if (patch.colorHex !== undefined) body.color_hex = snapToPalette(patch.colorHex);
  if (Object.keys(body).length === 0) {
    return { ok: false, status: 422, error: "Nothing to update." };
  }

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(env.key),
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  if (res.status === 409) return { ok: false, status: 409, error: "You already have a tag with that name." };
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as TagRow[];
  const row = rows[0];
  if (!row) return { ok: false, status: 404, error: "Tag not found." };
  return { ok: true, data: toTag(row) };
}

/** Delete a tag, owner-scoped. `deleted` reports whether a row actually matched so the route can 404
 *  honestly. The capture's tags[] is untouched — a deleted tab name simply stops matching a tab. */
export async function deleteTag(id: string, ownerId: string): Promise<PaResult<{ deleted: boolean }>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`,
    {
      method: "DELETE",
      headers: { ...authHeaders(env.key), Prefer: "return=representation" },
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as unknown[];
  return { ok: true, data: { deleted: rows.length > 0 } };
}

/**
 * Reorder an owner's tags to match `orderedIds` (the drag result): each id's sort_order becomes its
 * index. Only ids that belong to the owner are written (each PATCH is owner-scoped). Returns the
 * re-read, authoritative list. Unknown ids are ignored.
 */
export async function reorderTags(ownerId: string, orderedIds: string[]): Promise<PaResult<CaptureTag[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  for (let i = 0; i < orderedIds.length; i++) {
    const res = await fetch(
      `${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(orderedIds[i])}&owner_id=eq.${encodeURIComponent(ownerId)}`,
      {
        method: "PATCH",
        headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ sort_order: i }),
        cache: "no-store",
      },
    );
    if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  }
  return fetchTags(env, ownerId);
}
