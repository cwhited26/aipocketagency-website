// db.ts — data-access layer for the chat-as-surface tables (migration 018). Uses the PA
// Supabase project over PostgREST with the service-role key, mirroring lib/pa-supabase.ts
// and lib/personas/db.ts. RLS exposes only owner SELECTs; every write here is scoped by
// user_id in the query. Functions throw ChatDbError on a hard failure (never a silent
// catch); routes translate to HTTP responses.

import {
  ChatMessageSchema,
  validateCardPayload,
  type CardKind,
  type ChatMessage,
  type FilterTag,
  type MessageRole,
} from "./types";
import { DEFAULT_FILTER } from "./types";
import { normalizeFilter } from "./filters";

export class ChatDbError extends Error {
  readonly status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "ChatDbError";
    this.status = status;
  }
}

function env(): { url: string; key: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new ChatDbError("Supabase env vars not set", 500);
  }
  return { url: url.replace(/\/$/, ""), key };
}

type RestInit = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  prefer?: string;
  body?: unknown;
};

async function rest<T>(pathAndQuery: string, init: RestInit = {}): Promise<T> {
  const { url, key } = env();
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.prefer) headers.Prefer = init.prefer;

  const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ChatDbError(
      `Supabase ${init.method ?? "GET"} ${pathAndQuery.split("?")[0]} failed (${res.status}): ${text.slice(0, 200)}`,
      res.status,
    );
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

const enc = encodeURIComponent;

/** Parses raw PostgREST rows into validated ChatMessages, dropping any that fail the schema
 *  loudly via throw (an unparseable row means the table drifted from the contract). */
function parseRows(rows: unknown): ChatMessage[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => ChatMessageSchema.parse(r));
}

// ── pa_chat_messages ────────────────────────────────────────────────────────────────────

export type InsertMessageInput = {
  userId: string;
  role: MessageRole;
  content?: string;
  cardKind?: CardKind | null;
  cardPayload?: unknown;
  parentMessageId?: string | null;
  filterTags?: FilterTag[];
};

/**
 * Appends one message to the owner's history. Validates card payloads against their
 * kind-specific schema before the write so a malformed card can never land. Enforces the
 * inline_card ⇔ card_kind invariant in code (mirrors the DB CHECK).
 */
export async function insertMessage(input: InsertMessageInput): Promise<ChatMessage> {
  const isCard = input.role === "inline_card";
  const cardKind = input.cardKind ?? null;

  if (isCard && !cardKind) {
    throw new ChatDbError("inline_card messages require a cardKind", 400);
  }
  if (!isCard && cardKind) {
    throw new ChatDbError("non-card messages must not carry a cardKind", 400);
  }

  let payload: unknown = null;
  if (isCard && cardKind) {
    // Throws ZodError → caught by the route as a 400.
    payload = validateCardPayload(cardKind, input.cardPayload ?? {});
  }

  const body = {
    user_id: input.userId,
    role: input.role,
    content: input.content ?? "",
    card_kind: cardKind,
    card_payload: payload,
    parent_message_id: input.parentMessageId ?? null,
    filter_tags: input.filterTags && input.filterTags.length > 0 ? input.filterTags : [DEFAULT_FILTER],
  };

  const rows = await rest<unknown>("pa_chat_messages", {
    method: "POST",
    prefer: "return=representation",
    body,
  });
  const parsed = parseRows(rows);
  if (!parsed[0]) throw new ChatDbError("Message insert returned no row");
  return parsed[0];
}

export type ListMessagesOptions = {
  userId: string;
  /** Scope to a filter view (filter_tags contains the tag). Omit / 'general' → general view. */
  filter?: FilterTag;
  /** Page size. */
  limit?: number;
  /** Cursor: return rows strictly older than this ISO timestamp (load-older-on-scroll). */
  before?: string;
};

/**
 * Returns the owner's live (non-archived) messages, newest first, paginated by created_at.
 * When a filter is given, restricts to rows whose filter_tags contains it.
 */
export async function listMessages(opts: ListMessagesOptions): Promise<ChatMessage[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const parts = [
    `user_id=eq.${enc(opts.userId)}`,
    "archived_at=is.null",
    "order=created_at.desc",
    `limit=${limit}`,
  ];
  if (opts.filter) parts.push(`filter_tags=cs.{${enc(opts.filter)}}`);
  if (opts.before) parts.push(`created_at=lt.${enc(opts.before)}`);

  const rows = await rest<unknown>(`pa_chat_messages?${parts.join("&")}`);
  return parseRows(rows);
}

/**
 * Returns a bounded slice of the owner's whole history for server-side search / export.
 * Capped to keep the request bounded; the UI documents the cap.
 */
export async function listAllForSearch(
  userId: string,
  cap = 2_000,
): Promise<ChatMessage[]> {
  const limit = Math.min(Math.max(cap, 1), 5_000);
  const rows = await rest<unknown>(
    `pa_chat_messages?user_id=eq.${enc(userId)}&archived_at=is.null&order=created_at.desc&limit=${limit}`,
  );
  return parseRows(rows);
}

/** Soft-archive a message (append-only — never a hard delete). Scoped to the owner. */
export async function archiveMessage(userId: string, id: string): Promise<void> {
  await rest<undefined>(
    `pa_chat_messages?id=eq.${enc(id)}&user_id=eq.${enc(userId)}`,
    {
      method: "PATCH",
      prefer: "return=minimal",
      body: { archived_at: new Date().toISOString() },
    },
  );
}

// ── personas lookup (read-only; for the "ask my <persona>" chat intent) ─────────────────
// Reads the shared personas table directly over PostgREST — this lane does not modify
// lib/personas. Returns the best active-persona match for a free-text name, or null.

export type ChatPersonaMatch = { id: string; name: string };

export async function findPersonaByName(
  businessId: string,
  query: string,
): Promise<ChatPersonaMatch | null> {
  const cleaned = query.trim();
  if (!cleaned) return null;
  // Try an exact (case-insensitive) match first, then a contains match.
  const exact = await rest<ChatPersonaMatch[]>(
    `personas?business_id=eq.${enc(businessId)}&status=eq.active&name=ilike.${enc(cleaned)}&select=id,name&limit=1`,
  ).catch(() => [] as ChatPersonaMatch[]);
  if (exact[0]) return exact[0];

  const contains = await rest<ChatPersonaMatch[]>(
    `personas?business_id=eq.${enc(businessId)}&status=eq.active&name=ilike.*${enc(cleaned)}*&select=id,name&limit=1`,
  ).catch(() => [] as ChatPersonaMatch[]);
  return contains[0] ?? null;
}

// ── pa_chat_filter_state ─────────────────────────────────────────────────────────────────

/** The owner's current filter view; defaults to 'general' when no row exists yet. */
export async function getFilterState(userId: string): Promise<FilterTag> {
  const rows = await rest<{ current_filter: string }[]>(
    `pa_chat_filter_state?user_id=eq.${enc(userId)}&select=current_filter&limit=1`,
  );
  return normalizeFilter(rows[0]?.current_filter ?? null);
}

/** Upserts the owner's current filter view (PK = user_id). */
export async function setFilterState(userId: string, filter: FilterTag): Promise<void> {
  await rest<undefined>("pa_chat_filter_state?on_conflict=user_id", {
    method: "POST",
    prefer: "return=minimal,resolution=merge-duplicates",
    body: {
      user_id: userId,
      current_filter: filter,
      updated_at: new Date().toISOString(),
    },
  });
}
