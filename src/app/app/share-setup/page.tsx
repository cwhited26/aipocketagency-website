import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ShareSetupClient from "./ShareSetupClient";

function sbEnv(): { url: string; key: string } | null {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

type ShareTokenRow = {
  id: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

async function fetchTokenStatus(userId: string): Promise<{ hasToken: boolean; lastUsedAt: string | null }> {
  const env = sbEnv();
  if (!env) return { hasToken: false, lastUsedAt: null };
  try {
    const res = await fetch(
      `${env.url}/rest/v1/pocket_agent_share_tokens?user_id=eq.${encodeURIComponent(userId)}&revoked_at=is.null&order=created_at.desc&limit=1`,
      { headers: { apikey: env.key, Authorization: `Bearer ${env.key}` }, cache: "no-store" },
    );
    if (!res.ok) return { hasToken: false, lastUsedAt: null };
    const rows = (await res.json()) as ShareTokenRow[];
    const row = rows[0];
    if (!row) return { hasToken: false, lastUsedAt: null };
    return { hasToken: true, lastUsedAt: row.last_used_at };
  } catch {
    return { hasToken: false, lastUsedAt: null };
  }
}

export default async function ShareSetupPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const { hasToken, lastUsedAt } = await fetchTokenStatus(user.id);

  return (
    <ShareSetupClient
      hasToken={hasToken}
      lastUsedAt={lastUsedAt}
    />
  );
}
