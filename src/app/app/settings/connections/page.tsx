import { createClient } from "@/lib/supabase/server";
import { fetchGmailConnectionPublic } from "@/lib/pa-gmail-connections";
import { redirect } from "next/navigation";
import GmailConnectionCard from "./GmailConnectionCard";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, { title: string; body: string; kind: "success" | "error" }> = {
  connected: {
    title: "Gmail connected",
    body: "Incoming email now flows into your Inbox for triage. The first batch appears within a few minutes.",
    kind: "success",
  },
  not_configured: {
    title: "Gmail sign-in unavailable",
    body: "Gmail connections are live, but this workspace's Google sign-in isn't enabled. Contact support and we'll switch it on.",
    kind: "error",
  },
  error: {
    title: "Connection failed",
    body: "Something went wrong connecting Gmail. Try again, or contact support if it keeps happening.",
    kind: "error",
  },
};

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: { connection?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const gmailResult = await fetchGmailConnectionPublic(user.id);
  const gmail = gmailResult.ok ? gmailResult.data : null;

  const message = searchParams.connection ? MESSAGES[searchParams.connection] ?? null : null;

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
            Connections
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Connect your tools</h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Connect an account and your agent pulls what needs your attention into the{" "}
            <a href="/app/apps/inbox" className="text-[#22d3ee] hover:underline">
              Inbox
            </a>{" "}
            — one tap each to handle, reply, or archive.
          </p>
        </div>

        {message && (
          <div
            className={`rounded-xl border px-5 py-4 space-y-1 ${
              message.kind === "success"
                ? "border-[#22d3ee]/25 bg-[#22d3ee]/5"
                : "border-slate-700/60 bg-slate-900/50"
            }`}
          >
            <p className="text-sm font-semibold text-slate-100">{message.title}</p>
            <p className="text-sm text-slate-300 leading-relaxed">{message.body}</p>
          </div>
        )}

        <GmailConnectionCard connection={gmail} />

        <p className="text-xs text-slate-600 leading-relaxed">
          Gmail access lets your agent read incoming mail and archive a thread when you tap
          “I’ll handle” or “Archive.” It never sends or deletes anything on its own — replies are
          always drafted for your approval first.
        </p>
      </div>
    </div>
  );
}
