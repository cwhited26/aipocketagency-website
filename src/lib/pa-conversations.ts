export type Conversation = {
  id: string;
  user_id: string;
  title: string;
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
};

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
): Promise<PaResult<Conversation>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint = `${env.url}/rest/v1/pocket_agent_conversations`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: headers(env.key),
    body: JSON.stringify({ user_id: userId, title }),
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
  patch: { title?: string },
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pocket_agent_conversations` +
    `?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`;

  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
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
