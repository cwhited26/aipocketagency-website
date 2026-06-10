export type Conversation = {
  id: string;
  user_id: string;
  title: string;
  // Which project this thread belongs to (migration 036). Null = a loose thread not in a project.
  // When set, the agent loop prepends the project's Instructions + references + memory to its
  // system prompt so the conversation runs inside the project's context.
  project_id: string | null;
  // Pin a thread to the top of its project's Conversations list (migration 036).
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  // Optional inline-card payload (migration 034). Carries the upload_result card the Ask box
  // renders for image/PDF uploads, or an off-app origin blob (lib/chat/message-origin.ts) for an
  // inbound Slack/SMS message; null on every ordinary message. Untyped at this layer — the render
  // side validates it against the matching Zod schema.
  metadata?: unknown;
};

// The title of the single per-owner thread that all inbound SMS land in.
export const SMS_CONVERSATION_TITLE = "Text messages";

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

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

function headers(key: string): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

export async function listConversations(
  userId: string,
): Promise<PaResult<Conversation[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pocket_agent_conversations` +
    `?user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc&limit=50`;

  const res = await fetch(endpoint, {
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: (await res.json()) as Conversation[] };
}

export async function createConversation(
  userId: string,
  title = "New conversation",
  // When provided, the new thread is linked to this project and inherits its context.
  projectId?: string,
): Promise<PaResult<Conversation>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint = `${env.url}/rest/v1/pocket_agent_conversations`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: headers(env.key),
    body: JSON.stringify({
      user_id: userId,
      title,
      ...(projectId ? { project_id: projectId } : {}),
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as Conversation[];
  const row = rows[0];
  if (!row) return { ok: false, status: 500, error: "No row returned" };
  return { ok: true, data: row };
}

export async function getConversation(
  id: string,
  userId: string,
): Promise<PaResult<Conversation | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pocket_agent_conversations` +
    `?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`;

  const res = await fetch(endpoint, {
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as Conversation[];
  return { ok: true, data: rows[0] ?? null };
}

export async function getMessages(
  conversationId: string,
  userId: string,
): Promise<PaResult<Message[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pocket_agent_messages` +
    `?conversation_id=eq.${encodeURIComponent(conversationId)}` +
    `&user_id=eq.${encodeURIComponent(userId)}&order=created_at.asc`;

  const res = await fetch(endpoint, {
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: (await res.json()) as Message[] };
}

export async function insertMessage(msg: {
  conversationId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  // Inline-card payload (migration 034) / off-app origin blob — set for upload_result or
  // Slack/SMS-origin rows, omitted otherwise.
  metadata?: unknown;
}): Promise<PaResult<Message>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint = `${env.url}/rest/v1/pocket_agent_messages`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: headers(env.key),
    body: JSON.stringify({
      conversation_id: msg.conversationId,
      user_id: msg.userId,
      role: msg.role,
      content: msg.content,
      ...(msg.metadata !== undefined ? { metadata: msg.metadata } : {}),
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as Message[];
  const row = rows[0];
  if (!row) return { ok: false, status: 500, error: "No row returned" };
  return { ok: true, data: row };
}

export async function updateConversation(
  id: string,
  userId: string,
  // title: rename. pinned: pin/unpin within a project. projectId: link (id) or remove from project
  // (null) — passing `projectId: null` is how "Remove from project" unlinks a thread.
  patch: { title?: string; pinned?: boolean; projectId?: string | null },
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.pinned !== undefined) body.pinned = patch.pinned;
  if (patch.projectId !== undefined) body.project_id = patch.projectId;

  const endpoint =
    `${env.url}/rest/v1/pocket_agent_conversations` +
    `?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`;

  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

// Lists the conversations linked to a project with a one-line preview of each thread's latest
// message — what the project workspace's Conversations tab renders. Pinned threads sort first,
// then most-recently-updated. Same two-request batched read as listConversationThreads.
export async function listProjectConversationThreads(
  userId: string,
  projectId: string,
): Promise<PaResult<ConversationThread[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const convEndpoint =
    `${env.url}/rest/v1/pocket_agent_conversations` +
    `?user_id=eq.${encodeURIComponent(userId)}&project_id=eq.${encodeURIComponent(projectId)}` +
    `&order=pinned.desc,updated_at.desc&limit=100`;
  const convRes = await fetch(convEndpoint, {
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
    cache: "no-store",
  });
  if (!convRes.ok) return { ok: false, status: convRes.status, error: await convRes.text() };
  const convs = (await convRes.json()) as Conversation[];
  if (convs.length === 0) return { ok: true, data: [] };

  const inList = convs.map((c) => c.id).join(",");
  const msgEndpoint =
    `${env.url}/rest/v1/pocket_agent_messages` +
    `?user_id=eq.${encodeURIComponent(userId)}` +
    `&conversation_id=in.(${inList})` +
    `&order=created_at.desc&select=conversation_id,content`;
  const msgRes = await fetch(msgEndpoint, {
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
    cache: "no-store",
  });
  if (!msgRes.ok) return { ok: false, status: msgRes.status, error: await msgRes.text() };
  const rows = (await msgRes.json()) as { conversation_id: string; content: string }[];

  const latest = new Map<string, string>();
  for (const row of rows) {
    if (!latest.has(row.conversation_id)) latest.set(row.conversation_id, row.content);
  }

  const threads: ConversationThread[] = convs.map((c) => {
    const last = latest.get(c.id);
    return { ...c, snippet: last ? messageSnippet(last) : null };
  });
  return { ok: true, data: threads };
}

// The title of the single conversation every inbound Slack DM / @mention for an owner appends to,
// so the back-and-forth lives in one thread the owner can also open in the Ask box. Matched by
// (user_id, title) since pocket_agent_conversations has no per-origin column.
const SLACK_CONVERSATION_TITLE = "Slack";

/**
 * Find — or create on first contact — the owner's dedicated Slack conversation (migration-free:
 * keyed on the reserved title above). Inbound Slack messages route here so the thread is stable
 * across DMs and survives in the Hub list like any other conversation.
 */
export async function getOrCreateSlackConversation(
  userId: string,
): Promise<PaResult<Conversation>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pocket_agent_conversations` +
    `?user_id=eq.${encodeURIComponent(userId)}` +
    `&title=eq.${encodeURIComponent(SLACK_CONVERSATION_TITLE)}` +
    `&order=created_at.asc&limit=1`;
  const res = await fetch(endpoint, {
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as Conversation[];
  if (rows[0]) return { ok: true, data: rows[0] };

  return createConversation(userId, SLACK_CONVERSATION_TITLE);
}

// The Hub thread title per Channels Gateway channel (PA-CHAN-1). Distinct from the legacy Slack DM
// thread above ("Slack") and parallel to the SMS thread ("Text messages") so an owner who connects
// both surfaces doesn't get one merged thread.
const CHANNEL_CONVERSATION_TITLES: Record<string, string> = {
  slack: "Slack messages",
};

/**
 * Find — or create on first contact — the owner's dedicated conversation for a Channels Gateway
 * channel (migration-free: keyed on the reserved per-channel title above). The headless channel
 * roundtrip routes its chat-answer turns here so the thread is stable and survives in the Hub.
 */
export async function getOrCreateChannelConversation(
  userId: string,
  channelSlug: string,
): Promise<PaResult<Conversation>> {
  const title = CHANNEL_CONVERSATION_TITLES[channelSlug] ?? `Channel: ${channelSlug}`;
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pocket_agent_conversations` +
    `?user_id=eq.${encodeURIComponent(userId)}` +
    `&title=eq.${encodeURIComponent(title)}` +
    `&order=created_at.asc&limit=1`;
  const res = await fetch(endpoint, {
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as Conversation[];
  if (rows[0]) return { ok: true, data: rows[0] };

  return createConversation(userId, title);
}

export function generateTitle(firstMessage: string): string {
  const clean = firstMessage.trim().replace(/\n+/g, " ");
  return clean.length > 52 ? clean.slice(0, 49) + "…" : clean;
}

// A short, single-line preview of a message body for the Hub thread list. Collapses
// whitespace and clips to `max` chars so long or multi-line messages render as one tidy row.
export function messageSnippet(text: string, max = 80): string {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
}

export type ConversationThread = Conversation & {
  // The latest message in the thread, clipped for the Hub preview. Null when the
  // conversation row exists but has no messages yet.
  snippet: string | null;
};

// Lists the owner's conversations with a one-line preview of each thread's most recent
// message — the data the Hub thread list renders. One batched message query (latest-first,
// scoped to the listed conversation ids) backs every preview, so it stays a two-request read
// regardless of how many threads exist.
export async function listConversationThreads(
  userId: string,
): Promise<PaResult<ConversationThread[]>> {
  const convResult = await listConversations(userId);
  if (!convResult.ok) return convResult;
  const convs = convResult.data;
  if (convs.length === 0) return { ok: true, data: [] };

  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  // UUID ids only contain [0-9a-f-], so they're URL-safe inside an in.() filter unquoted.
  const inList = convs.map((c) => c.id).join(",");
  const endpoint =
    `${env.url}/rest/v1/pocket_agent_messages` +
    `?user_id=eq.${encodeURIComponent(userId)}` +
    `&conversation_id=in.(${inList})` +
    `&order=created_at.desc&select=conversation_id,content`;

  const res = await fetch(endpoint, {
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as { conversation_id: string; content: string }[];

  // Rows arrive newest-first; the first row seen per conversation is its latest message.
  const latest = new Map<string, string>();
  for (const row of rows) {
    if (!latest.has(row.conversation_id)) latest.set(row.conversation_id, row.content);
  }

  const threads: ConversationThread[] = convs.map((c) => {
    const last = latest.get(c.id);
    return { ...c, snippet: last ? messageSnippet(last) : null };
  });
  return { ok: true, data: threads };
}

// The owner's single SMS thread: find the existing one (by its sentinel title) or create it. All
// inbound texts to the owner's PA number land here, so the owner picks up the same conversation in
// the app or over SMS. Returns the conversation id.
export async function findOrCreateSmsConversation(userId: string): Promise<PaResult<string>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pocket_agent_conversations` +
    `?user_id=eq.${encodeURIComponent(userId)}` +
    `&title=eq.${encodeURIComponent(SMS_CONVERSATION_TITLE)}` +
    `&order=created_at.asc&limit=1`;
  const res = await fetch(endpoint, {
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as Conversation[];
  if (rows[0]) return { ok: true, data: rows[0].id };

  const created = await createConversation(userId, SMS_CONVERSATION_TITLE);
  if (!created.ok) return created;
  return { ok: true, data: created.data.id };
}

export type SmsActivityItem = {
  snippet: string;
  created_at: string;
};

// Recent inbound texts for the owner — the "recent activity" list the Settings card renders so the
// owner can see texting is flowing. SMS-origin user messages carry a {kind:'sms_origin'} metadata
// blob (lib/chat/message-origin.ts); we filter on that jsonb key (the same pattern Slack origin
// uses) rather than a dedicated column.
export async function fetchRecentSmsActivity(
  userId: string,
  limit = 5,
): Promise<PaResult<SmsActivityItem[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pocket_agent_messages` +
    `?user_id=eq.${encodeURIComponent(userId)}` +
    `&metadata->>kind=eq.sms_origin` +
    `&order=created_at.desc&limit=${limit}&select=content,created_at`;
  const res = await fetch(endpoint, {
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as { content: string; created_at: string }[];
  return {
    ok: true,
    data: rows.map((r) => ({ snippet: messageSnippet(r.content, 64), created_at: r.created_at })),
  };
}
