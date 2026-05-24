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
