import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AppsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const result = await fetchPaUser(user.id);
  const paUser = result.ok ? result.data : null;

  if (!paUser) redirect("/app/onboarding");

  const hasApiKey = Boolean(paUser.anthropic_api_key);
  const hasBrain = Boolean(paUser.brain_repo);
  const hasGithubToken = Boolean(paUser.github_token);

  const apps = [
    {
      href: "/app/apps/quote",
      label: "Quote / Proposal Writer",
      description:
        "Drop in a client name, the scope, and any specifics. It reads your brain for services, pricing, and positioning — then produces a structured draft in your voice.",
      tag: "Output",
    },
    {
      href: "/app/apps/email",
      label: "Email Drafter",
      description:
        "Tell it who you're writing to, why, and what to cover. It reads your voice from the brain and drafts an email that sounds like you wrote it.",
      tag: "Output",
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-2">
            Level 2 · Drafts in your voice
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Work</h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Your brain does the work. These apps read your memory files — services, pricing, voice,
            client history — and produce output that sounds like you wrote it.
          </p>
        </div>

        {!hasApiKey && (
          <div className="mb-5 rounded-xl border border-[#22d3ee]/20 bg-[#22d3ee]/5 px-5 py-4 flex items-start gap-3">
            <span className="text-[#22d3ee] shrink-0 mt-0.5 font-mono text-sm">→</span>
            <div>
              <p className="text-sm font-semibold text-slate-100">Add your Anthropic API key to run these apps.</p>
              <p className="text-sm text-slate-300 mt-1">
                Your key, your bill, your data.{" "}
                <Link href="/app/settings" className="text-[#22d3ee] hover:underline">
                  Go to Settings →
                </Link>
              </p>
            </div>
          </div>
        )}

        {!hasBrain && (
          <div className="mb-5 rounded-xl border border-slate-700/60 bg-slate-900/60 px-5 py-4 flex items-start gap-3">
            <span className="text-slate-400 shrink-0 mt-0.5 font-mono text-sm">◈</span>
            <div>
              <p className="text-sm font-semibold text-slate-100">No brain connected</p>
              <p className="text-sm text-slate-300 mt-1">
                These apps will still draft — they just won&apos;t have your services, pricing, or
                voice to pull from.{" "}
                {hasGithubToken ? (
                  <Link href="/app/onboarding" className="text-[#22d3ee] hover:underline">
                    Connect a brain →
                  </Link>
                ) : (
                  <a href="/api/app/auth/github?next=/app/onboarding" className="text-[#22d3ee] hover:underline">
                    Connect GitHub first →
                  </a>
                )}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {apps.map((app) => (
            <Link
              key={app.href}
              href={app.href}
              className="group block rounded-xl border border-slate-700/60 bg-slate-900/50 px-6 py-5 hover:border-slate-600 hover:bg-slate-900 transition-all"
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <h2 className="text-sm font-semibold text-slate-100 group-hover:text-white transition-colors">
                  {app.label}
                </h2>
                <span className="shrink-0 text-[10px] font-mono text-slate-500 border border-slate-700 rounded px-1.5 py-0.5 uppercase tracking-wider">
                  {app.tag}
                </span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{app.description}</p>
              <div className="mt-3 text-[11px] text-[#22d3ee]/60 group-hover:text-[#22d3ee] transition-colors font-mono">
                Open →
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-slate-800/60">
          <p className="text-sm text-slate-400 leading-relaxed">
            The deeper your brain, the better the output. More work apps coming as the catalog grows.
          </p>
        </div>
      </div>
    </div>
  );
}
