import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchUserConnections } from "@/lib/pa-connections";
import { redirect } from "next/navigation";
import ApiKeyForm from "./ApiKeyForm";
import ConnectionsPanel from "./ConnectionsPanel";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { billing?: string; connection?: string; provider?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const [paResult, connectionsResult] = await Promise.all([
    fetchPaUser(user.id),
    fetchUserConnections(user.id),
  ]);
  const paUser = paResult.ok ? paResult.data : null;
  const connections = connectionsResult.ok ? connectionsResult.data : [];
  const oauthConfigured = Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID);

  const billingParam = searchParams.billing;
  let billingMessage: { title: string; body: string } | null = null;
  if (billingParam === "no_customer") {
    billingMessage = {
      title: "Nothing to manage",
      body: "This account is comped or in trial — no Stripe subscription is attached yet.",
    };
  } else if (billingParam === "portal_error") {
    billingMessage = {
      title: "Couldn't open billing portal",
      body: "Stripe returned an error. Try again in a moment or contact support.",
    };
  }

  const connectionParam = searchParams.connection;
  let connectionMessage: { title: string; body: string; kind: "success" | "error" } | null = null;
  if (connectionParam === "connected") {
    connectionMessage = {
      title: "Connected",
      body: "Your account was connected successfully. Your agent can now read from it.",
      kind: "success",
    };
  } else if (connectionParam === "not_configured") {
    connectionMessage = {
      title: "Not configured yet",
      body: "Google connections are being set up — they'll be available soon.",
      kind: "error",
    };
  } else if (connectionParam === "error") {
    connectionMessage = {
      title: "Connection failed",
      body: "Something went wrong. Try again, or contact support if this keeps happening.",
      kind: "error",
    };
  }

  const hasGithubToken = Boolean(paUser?.github_token);
  const githubUsername = paUser?.github_username;

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-lg mx-auto px-6 py-10 space-y-8">
        <div>
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-1">
            Settings
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Your account</h1>
        </div>

        {/* GitHub connector — always visible, prominent */}
        <div className={`rounded-xl border ${hasGithubToken ? "border-slate-700/60 bg-slate-900/50" : "border-[#22d3ee]/25 bg-[#22d3ee]/5"} px-5 py-4`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-100">GitHub</p>
              {hasGithubToken ? (
                <p className="text-sm text-slate-300 mt-0.5">
                  Connected{githubUsername ? ` as ${githubUsername}` : ""}
                </p>
              ) : (
                <p className="text-sm text-slate-300 mt-0.5 leading-relaxed">
                  Not connected — required to create or link your brain repo.
                </p>
              )}
            </div>
            {hasGithubToken ? (
              <span className="shrink-0 text-[10px] font-mono text-[#22d3ee] border border-[#22d3ee]/30 rounded px-2 py-1 bg-[#22d3ee]/5 mt-0.5">
                connected
              </span>
            ) : (
              <a
                href="/api/app/auth/github?next=/app/settings"
                className="shrink-0 inline-flex items-center rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors"
              >
                Connect GitHub →
              </a>
            )}
          </div>
        </div>

        {connectionMessage && (
          <div
            className={`rounded-xl border px-5 py-4 space-y-1 ${
              connectionMessage.kind === "success"
                ? "border-[#22d3ee]/25 bg-[#22d3ee]/5"
                : "border-slate-700/60 bg-slate-900/50"
            }`}
          >
            <p className="text-sm font-semibold text-slate-100">{connectionMessage.title}</p>
            <p className="text-sm text-slate-300 leading-relaxed">{connectionMessage.body}</p>
          </div>
        )}

        {billingMessage && (
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-5 py-4 space-y-1">
            <p className="text-sm font-semibold text-slate-100">{billingMessage.title}</p>
            <p className="text-sm text-slate-300 leading-relaxed">{billingMessage.body}</p>
          </div>
        )}

        {/* Account details table */}
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 overflow-hidden divide-y divide-slate-800/60">
          <SettingsRow label="Email" value={user.email ?? "—"} />
          <SettingsRow
            label="Brain repo"
            value={paUser?.brain_repo ?? "Not connected"}
            href={paUser?.brain_repo ? `https://github.com/${paUser.brain_repo}` : "/app/onboarding"}
          />
          <ApiKeyForm hasKey={!!paUser?.anthropic_api_key} />
          <SettingsRow label="Billing" value="Manage subscription" href="/api/app/billing-portal" />
        </div>

        <ConnectionsPanel connections={connections} oauthConfigured={oauthConfigured} />

        <div className="flex justify-end pt-2">
          <form action="/api/app/sign-out" method="POST">
            <button type="submit" className="text-sm text-slate-500 hover:text-red-400 transition-colors">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function SettingsRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const externalProps = href?.startsWith("http")
    ? { target: "_blank" as const, rel: "noopener noreferrer" }
    : {};

  return (
    <div className="px-5 py-4 flex items-center justify-between gap-4">
      <span className="text-sm text-slate-400">{label}</span>
      {href ? (
        <a href={href} {...externalProps} className="text-sm text-[#22d3ee] hover:underline text-right truncate max-w-[220px]">
          {value}
        </a>
      ) : (
        <span className="text-sm text-slate-200 text-right truncate max-w-[220px]">{value}</span>
      )}
    </div>
  );
}
