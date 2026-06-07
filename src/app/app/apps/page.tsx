import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { redirect } from "next/navigation";
import Link from "next/link";
import { GlowCard } from "../_components/GlowCard";
import InboxBadge from "../_components/InboxBadge";

type AppDef = {
  href: string;
  label: string;
  description: string;
  tag: string;
  tagColor?: "cyan" | "muted";
};

const apps: AppDef[] = [
  {
    href: "/app/apps/quote",
    label: "Quote / Proposal Writer",
    description:
      "Drop in a client name, the scope, and any specifics. Reads your brain for services, pricing, and positioning — then produces a structured draft in your voice.",
    tag: "Output",
    tagColor: "cyan",
  },
  {
    href: "/app/apps/email",
    label: "Email Drafter",
    description:
      "Tell it who you're writing to, why, and what to cover. Reads your voice from the brain and drafts an email that sounds like you wrote it.",
    tag: "Output",
    tagColor: "cyan",
  },
  {
    href: "/app/apps/followups",
    label: "Follow-up Radar",
    description:
      "Scans your brain for relationships, leads, and deals that have gone cold. Surfaces the gap and drafts the nudge for each one.",
    tag: "Reads Brain",
    tagColor: "cyan",
  },
  {
    href: "/app/apps/daily-brief",
    label: "Daily Brief",
    description:
      "Your morning read. The agent scans your brain and writes what's on the radar, what's pending, and the one thing to move on today.",
    tag: "Reads Brain",
    tagColor: "cyan",
  },
  {
    href: "/app/apps/inbox",
    label: "Inbox",
    description:
      "Your agent's desk — drafts staged for your approval and items that need a yes or no. Live email flows in through Connections, which is live now.",
    tag: "Queue",
    tagColor: "muted",
  },
  {
    href: "/app/apps/calendar",
    label: "Calendar",
    description:
      "Upcoming items the agent knows about from your brain — scheduled jobs, deadlines, follow-up timelines. Live calendar sync is coming as a Connections integration.",
    tag: "Upcoming",
    tagColor: "muted",
  },
];

function tagClass(color: AppDef["tagColor"]): string {
  if (color === "cyan") {
    return "text-[#22d3ee]/70 border-[#22d3ee]/20 bg-[#22d3ee]/5";
  }
  return "text-slate-600 border-slate-700 bg-transparent";
}

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

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-2">
            Your agent&apos;s workbench
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Work</h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Your brain does the heavy lifting. These surfaces read your memory files — services,
            pricing, voice, client history — and produce output that saves you hours.
          </p>
        </div>

        {!hasApiKey && (
          <div className="mb-5 rounded-xl border border-[#22d3ee]/20 bg-[#22d3ee]/5 px-5 py-4 flex items-start gap-3">
            <span className="text-[#22d3ee] shrink-0 mt-0.5 font-mono text-sm">→</span>
            <div>
              <p className="text-sm font-semibold text-slate-100">
                Add your Anthropic API key to run these apps.
              </p>
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
                Apps will still run — they just won&apos;t have your services, pricing, or voice to
                pull from.{" "}
                {hasGithubToken ? (
                  <Link href="/app/onboarding" className="text-[#22d3ee] hover:underline">
                    Connect a brain →
                  </Link>
                ) : (
                  <a
                    href="/api/app/auth/github?next=/app/onboarding"
                    className="text-[#22d3ee] hover:underline"
                  >
                    Connect GitHub first →
                  </a>
                )}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {apps.map((app) => (
            <GlowCard key={app.href} href={app.href} className="px-5 py-5 group">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h2 className="text-sm font-semibold text-slate-100">{app.label}</h2>
                <div className="flex items-center gap-1.5 shrink-0">
                  {app.href === "/app/apps/inbox" && <InboxBadge />}
                  <span
                    className={`text-[10px] font-mono border rounded px-1.5 py-0.5 uppercase tracking-wider ${tagClass(app.tagColor)}`}
                  >
                    {app.tag}
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">{app.description}</p>
              <div className="mt-3 text-[11px] text-[#22d3ee]/50 group-hover:text-[#22d3ee] transition-colors font-mono">
                Open →
              </div>
            </GlowCard>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-slate-800/60">
          <p className="text-sm text-slate-500 leading-relaxed">
            The deeper your brain, the better the output. More work apps ship as the platform
            grows.
          </p>
        </div>
      </div>
    </div>
  );
}
