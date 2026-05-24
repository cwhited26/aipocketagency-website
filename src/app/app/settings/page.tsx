import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { redirect } from "next/navigation";
import Link from "next/link";
import ApiKeyForm from "./ApiKeyForm";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  const paUser = paResult.ok ? paResult.data : null;

  return (
    <main className="min-h-screen bg-[#05070a] px-4 py-10">
      <div className="max-w-lg mx-auto space-y-8">
        <div>
          <div className="text-[#22d3ee] text-xs font-mono tracking-[0.2em] uppercase mb-1">
            Settings
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Your account</h1>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 divide-y divide-slate-800">
          <SettingsRow label="GitHub username" value={paUser?.github_username || user.email || "—"} />
          <SettingsRow
            label="Brain repo"
            value={paUser?.brain_repo ?? "Not connected"}
            href={
              paUser?.brain_repo
                ? `https://github.com/${paUser.brain_repo}`
                : "/app/onboarding"
            }
          />
          <SettingsRow label="Email" value={user.email ?? "—"} />
          <ApiKeyForm hasKey={!!paUser?.anthropic_api_key} />
          <SettingsRow
            label="Billing"
            value="Manage subscription"
            href="/api/app/billing-portal"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <Link
            href="/app/ask"
            className="text-sm text-slate-500 hover:text-slate-300 underline"
          >
            ← Back to ask
          </Link>
          <form action="/api/app/sign-out" method="POST">
            <button
              type="submit"
              className="text-sm text-red-400 hover:text-red-300 underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
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
  return (
    <div className="px-5 py-4 flex items-center justify-between gap-4">
      <span className="text-sm text-slate-500">{label}</span>
      {href ? (
        <a
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
          className="text-sm text-[#22d3ee] hover:underline text-right truncate max-w-xs"
        >
          {value}
        </a>
      ) : (
        <span className="text-sm text-slate-200 text-right truncate max-w-xs">{value}</span>
      )}
    </div>
  );
}
