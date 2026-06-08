import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { listApiKeysForUser } from "@/lib/api-keys/db";
import ApiKeysClient, { type ApiKeyView } from "./ApiKeysClient";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  let rows: Awaited<ReturnType<typeof listApiKeysForUser>> = [];
  try {
    rows = await listApiKeysForUser(user.id);
  } catch {
    rows = [];
  }

  const initialKeys: ApiKeyView[] = rows.map((k) => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.key_prefix,
    scopes: k.scopes,
    createdAt: k.created_at,
    lastUsedAt: k.last_used_at,
    revokedAt: k.revoked_at,
  }));

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-lg mx-auto px-6 py-10 space-y-7">
        <div>
          <a
            href="/app/settings"
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
          >
            ← Settings
          </a>
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mt-3 mb-1">
            API keys
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Public REST API keys</h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Generate a key to let any agent — Claude Code, Cursor, your own scripts — read and write
            your brain over REST. See the{" "}
            <a href="/api/v1/docs" className="text-[#22d3ee] hover:underline" target="_blank" rel="noopener noreferrer">
              API reference
            </a>
            . Keys are shown once; we store only a hash.
          </p>
        </div>

        <div className="rounded-xl border border-[#22d3ee]/25 bg-[#22d3ee]/[0.04] p-5">
          <div className="text-sm font-semibold text-slate-100">📸 Use it from your iPhone</div>
          <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
            Pair a key with an iPhone shortcut to snap a photo — a receipt, a whiteboard, an invoice
            — and get your agent’s answer back on your phone. We walk you through building it in
            about five minutes.
          </p>
          <a
            href="/app/settings/api-keys/shortcut"
            className="inline-block mt-3 text-sm font-semibold text-[#22d3ee] hover:underline"
          >
            How to use this →
          </a>
        </div>

        <ApiKeysClient initialKeys={initialKeys} />
      </div>
    </div>
  );
}
