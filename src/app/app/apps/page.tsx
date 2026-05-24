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

  const apps = [
    {
      href: "/app/apps/quote",
      label: "Quote / Proposal Writer",
      description:
        "Drop in a client name, the scope, and any specifics. It reads your brain for services, pricing, and positioning — and produces a structured draft in your voice.",
      tag: "Output",
    },
    {
      href: "/app/apps/email",
      label: "Email Drafter",
      description:
        "Tell it who you're writing to, why, and what to cover. It reads your voice from the brain and drafts an email that sounds like you wrote it — not like AI wrote it.",
      tag: "Output",
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#05070a]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <div className="text-[10px] text-[#22d3ee]/50 font-mono tracking-[0.2em] uppercase mb-2">
            Level 2 · Drafts in your voice
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Work</h1>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            Your brain does the work. These apps read your memory files — your services, pricing,
            voice, client history — and produce output that sounds like you wrote it. The deeper
            your brain, the sharper the output.
          </p>
        </div>

        {!hasApiKey && (
          <div
            className="mb-6 rounded-xl px-5 py-4 flex items-start gap-3"
            style={{ border: "1px solid rgba(34,211,238,0.15)", background: "rgba(34,211,238,0.04)" }}
          >
            <span className="text-[#22d3ee] shrink-0 mt-0.5 text-xs font-mono">→</span>
            <div>
              <p className="text-sm font-medium text-slate-200">Add your Anthropic API key to run these apps.</p>
              <p className="text-xs text-slate-500 mt-1">
                Your key, your bill, your data.{" "}
                <Link href="/app/settings" className="text-[#22d3ee] hover:underline">
                  Settings →
                </Link>
              </p>
            </div>
          </div>
        )}

        {!hasBrain && (
          <div
            className="mb-6 rounded-xl px-5 py-4 flex items-start gap-3"
            style={{ border: "1px solid rgba(217,119,6,0.2)", background: "rgba(217,119,6,0.04)" }}
          >
            <span className="text-amber-500 shrink-0 mt-0.5 text-xs">◈</span>
            <div>
              <p className="text-sm font-medium text-amber-400/80">No brain connected</p>
              <p className="text-xs text-slate-500 mt-1">
                These apps will still draft — they just won&apos;t have your services, pricing, or
                voice to pull from.{" "}
                <Link href="/app/onboarding" className="text-[#22d3ee] hover:underline">
                  Connect a brain →
                </Link>
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {apps.map((app) => (
            <Link
              key={app.href}
              href={app.href}
              className="group rounded-xl px-6 py-5 transition-all block"
              style={{
                border: "1px solid rgba(51,65,85,0.5)",
                background: "rgba(7,13,18,0.5)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(51,65,85,0.75)";
                (e.currentTarget as HTMLElement).style.background = "rgba(7,13,18,0.8)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(51,65,85,0.5)";
                (e.currentTarget as HTMLElement).style.background = "rgba(7,13,18,0.5)";
              }}
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <h2 className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">
                  {app.label}
                </h2>
                <span
                  className="shrink-0 text-[9px] font-mono text-slate-700 rounded px-1.5 py-0.5 uppercase tracking-wider"
                  style={{ border: "1px solid rgba(51,65,85,0.5)" }}
                >
                  {app.tag}
                </span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{app.description}</p>
              <div className="mt-3 text-[10px] text-[#22d3ee]/50 group-hover:text-[#22d3ee] transition-colors font-mono">
                Open →
              </div>
            </Link>
          ))}
        </div>

        <div
          className="mt-10 pt-6"
          style={{ borderTop: "1px solid rgba(30,41,59,0.6)" }}
        >
          <p className="text-xs text-slate-700 leading-relaxed">
            The deeper your brain, the better the output. More work apps coming as the catalog grows.
          </p>
        </div>
      </div>
    </div>
  );
}
