import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { redirect } from "next/navigation";
import ApiKeyForm from "./ApiKeyForm";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { billing?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  const paUser = paResult.ok ? paResult.data : null;

  const billingParam = searchParams.billing;
  let billingMessage: { text: string; sub?: string } | null = null;
  if (billingParam === "no_customer") {
    billingMessage = {
      text: "Nothing to manage",
      sub: "This account was comped or is in trial — there's no Stripe subscription attached yet.",
    };
  } else if (billingParam === "portal_error") {
    billingMessage = {
      text: "Couldn't open billing portal",
      sub: "Stripe returned an error. Try again in a moment or contact support.",
    };
  }

  const hasGithubToken = !!paUser?.github_token;

  return (
    <div className="h-full overflow-y-auto bg-[#05070a]">
      <div className="max-w-lg mx-auto px-6 py-10 space-y-8">
        <div>
          <div className="text-[10px] text-[#22d3ee]/50 font-mono tracking-[0.2em] uppercase mb-1">
            Settings
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Your account</h1>
        </div>

        {billingMessage && (
          <div
            className="rounded-xl px-4 py-3 space-y-1"
            style={{ border: "1px solid rgba(51,65,85,0.5)", background: "rgba(7,13,18,0.5)" }}
          >
            <p className="text-sm font-medium text-slate-300">{billingMessage.text}</p>
            {billingMessage.sub && (
              <p className="text-xs text-slate-500 leading-relaxed">{billingMessage.sub}</p>
            )}
          </div>
        )}

        <div
          className="rounded-xl overflow-hidden divide-y divide-slate-800/60"
          style={{
            border: "1px solid rgba(51,65,85,0.5)",
            background: "rgba(7,13,18,0.5)",
          }}
        >
          <SettingsRow label="Email" value={user.email ?? "—"} />
          <SettingsRow
            label="GitHub"
            value={hasGithubToken ? (paUser?.github_username || "Connected") : "Not connected"}
            href={hasGithubToken ? undefined : `/api/app/auth/github?next=/app/settings`}
            linkLabel={hasGithubToken ? undefined : "Connect GitHub →"}
          />
          <SettingsRow
            label="Brain repo"
            value={paUser?.brain_repo ?? "Not connected"}
            href={
              paUser?.brain_repo
                ? `https://github.com/${paUser.brain_repo}`
                : "/app/onboarding"
            }
          />
          <ApiKeyForm hasKey={!!paUser?.anthropic_api_key} />
          <SettingsRow
            label="Billing"
            value="Manage subscription"
            href="/api/app/billing-portal"
          />
        </div>

        <div className="flex justify-end pt-2">
          <form action="/api/app/sign-out" method="POST">
            <button
              type="submit"
              className="text-sm text-slate-600 hover:text-red-400 transition-colors"
            >
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
  linkLabel,
}: {
  label: string;
  value: string;
  href?: string;
  linkLabel?: string;
}) {
  const externalProps = href?.startsWith("http")
    ? { target: "_blank" as const, rel: "noopener noreferrer" }
    : {};

  return (
    <div className="px-5 py-4 flex items-center justify-between gap-4">
      <span className="text-sm text-slate-500">{label}</span>
      <div className="flex items-center gap-3 min-w-0">
        {/* Value cell: plain text if there's a separate linkLabel, otherwise a link */}
        {href && !linkLabel ? (
          <a
            href={href}
            {...externalProps}
            className="text-sm text-[#22d3ee] hover:underline text-right truncate max-w-[200px]"
          >
            {value}
          </a>
        ) : (
          <span className="text-sm text-slate-300 text-right truncate max-w-[160px]">{value}</span>
        )}
        {/* Separate action link */}
        {href && linkLabel && (
          <a
            href={href}
            {...externalProps}
            className="text-xs font-mono text-[#22d3ee]/70 hover:text-[#22d3ee] transition-colors whitespace-nowrap shrink-0"
          >
            {linkLabel}
          </a>
        )}
      </div>
    </div>
  );
}
