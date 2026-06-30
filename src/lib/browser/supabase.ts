// supabase.ts — shared service-role REST plumbing for the Browser Automation lane (direct REST, no
// SDK — standing rule). Mirrors the env resolution every other PA data layer uses (pa-supabase.ts,
// pocket-capture/supabase.ts) so the same Vercel env vars drive it.

export type PaEnv = { url: string; key: string };

export function paEnv(): PaEnv | { error: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return { error: "Supabase service-role env vars not set" };
  return { url: url.replace(/\/$/, ""), key };
}

export function authHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` };
}
