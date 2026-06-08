import type { ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Learn — Pocket Agent" };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-slate-200 border-b border-slate-800/60 pb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-700/60 bg-slate-900/70 px-5 py-4 ${className}`}>
      {children}
    </div>
  );
}

function AppRow({
  label,
  desc,
  href,
  tag,
}: {
  label: string;
  desc: string;
  href: string;
  tag: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-slate-800/50 bg-slate-900/40 hover:bg-slate-800/50 hover:border-slate-700/60 transition-all group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-sm font-semibold text-slate-200 group-hover:text-slate-100 transition-colors">
            {label}
          </span>
          <span className="text-[10px] font-mono text-slate-600 border border-slate-700/60 rounded px-1.5 py-0.5 uppercase tracking-wider">
            {tag}
          </span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
      </div>
      <span className="text-slate-600 group-hover:text-slate-400 transition-colors shrink-0 mt-0.5 text-xs">
        →
      </span>
    </Link>
  );
}

export default async function LearnPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-2xl mx-auto px-5 py-7 flex flex-col gap-8">

        {/* Header */}
        <div>
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-1">
            How it works
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Learn</h1>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            Everything you need to know about Pocket Agent — what it is, how the brain works,
            and what each surface does.
          </p>
        </div>

        {/* What is Pocket Agent */}
        <Section title="What is Pocket Agent?">
          <Card>
            <p className="text-sm text-slate-300 leading-relaxed mb-3">
              Pocket Agent is an AI chief of staff for small operators — contractors, consultants,
              solo service businesses. It handles the admin and communication overhead that eats your
              day: writing proposals, drafting follow-up emails, summarizing what&apos;s on your plate.
            </p>
            <p className="text-sm text-slate-300 leading-relaxed mb-3">
              The key difference from a general chatbot: Pocket Agent learns your business. It reads
              your brain — a set of memory files that describe your services, pricing, clients, voice,
              and decisions. Every draft it writes is conditioned on that context.
            </p>
            <div className="rounded-lg border border-slate-800/60 bg-slate-950/40 px-4 py-3 mt-1">
              <p className="text-[11px] font-mono text-slate-500 leading-relaxed">
                <span className="text-slate-400">Your bill, your data.</span> Pocket Agent runs on
                your own Anthropic API key. You control costs and nothing gets stored at our servers
                beyond what&apos;s in your GitHub brain repo.
              </p>
            </div>
          </Card>
        </Section>

        {/* The Brain */}
        <Section title="The Brain">
          <Card>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              Your brain is a GitHub repository full of plain Markdown files — one file per topic.
              The agent reads these files before writing anything, so the output reflects your actual
              business context, not a generic template.
            </p>

            <p className="text-[11px] font-mono text-slate-500 uppercase tracking-[0.14em] mb-3">
              The 7 brain areas
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {[
                { key: "Customer Avatar", desc: "The specific person you sell to" },
                { key: "Your business", desc: "What you do, who runs it, your rates" },
                { key: "Who you serve", desc: "Ideal clients, pain points, use cases" },
                { key: "Your voice", desc: "Tone, communication style" },
                { key: "Active projects", desc: "What you're working on right now" },
                { key: "Tools", desc: "Apps and systems you use day-to-day" },
                { key: "Key decisions", desc: "Choices made — so the agent doesn't re-ask" },
              ].map((area) => (
                <div
                  key={area.key}
                  className="rounded-lg border border-slate-800/50 bg-slate-950/30 px-3 py-2.5"
                >
                  <p className="text-xs font-semibold text-slate-300">{area.key}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{area.desc}</p>
                </div>
              ))}
            </div>

            <p className="text-[11px] font-mono text-slate-500 uppercase tracking-[0.14em] mb-3">
              How to feed your brain
            </p>
            <div className="flex flex-col gap-2">
              {[
                {
                  label: "Setup Wizard",
                  desc: "Answer 6 questions to bootstrap your brain from scratch.",
                  href: "/app/onboarding",
                },
                {
                  label: "Capture page",
                  desc: "Write freeform notes into any brain area on the fly.",
                  href: "/app/capture",
                },
                {
                  label: "File Upload",
                  desc: "Upload a PDF, TXT, or Markdown file directly into your repo.",
                  href: "/app/capture",
                },
                {
                  label: "Customer Avatar form",
                  desc: "Guided form for defining your ideal buyer in detail.",
                  href: "/app/brain/avatar",
                },
              ].map((item) => (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-800/50 hover:bg-slate-800/40 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-slate-300 group-hover:text-slate-100 transition-colors">
                      {item.label}
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                  </div>
                  <span className="text-slate-600 group-hover:text-slate-400 transition-colors text-xs shrink-0">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        </Section>

        {/* Work Apps */}
        <Section title="Work Apps">
          <p className="text-sm text-slate-400 leading-relaxed -mt-1">
            Each app reads your brain and produces output. The deeper the brain, the better the
            result.
          </p>
          <div className="flex flex-col gap-2">
            <AppRow
              label="Quote / Proposal Writer"
              desc="Client name, scope, specifics → structured proposal in your voice."
              href="/app/apps/quote"
              tag="Output"
            />
            <AppRow
              label="Email Drafter"
              desc="Who you're writing to, why, what to cover → email that sounds like you."
              href="/app/apps/email"
              tag="Output"
            />
            <AppRow
              label="Follow-up Radar"
              desc="Scans your brain for cold leads and drafts the nudge."
              href="/app/apps/followups"
              tag="Reads Brain"
            />
            <AppRow
              label="Daily Brief"
              desc="Morning read: what's on the radar, what's pending, the one thing to move on."
              href="/app/apps/daily-brief"
              tag="Reads Brain"
            />
            <AppRow
              label="Mission Control"
              desc="Agent proposals staged here for your approval. Nothing executes without your yes."
              href="/app/mission-control"
              tag="Queue"
            />
            <AppRow
              label="Calendar"
              desc="Upcoming items from your brain. Live calendar sync is coming as a Connections integration."
              href="/app/apps/calendar"
              tag="Upcoming"
            />
          </div>
        </Section>

        {/* Approval Gate */}
        <Section title="The Approval Gate">
          <Card>
            <p className="text-sm text-slate-300 leading-relaxed mb-3">
              When your agent decides something is worth writing into your brain — a new client
              detail you mentioned, a decision you made — it doesn&apos;t write it directly.
              Instead it stages a proposal in Mission Control.
            </p>
            <p className="text-sm text-slate-300 leading-relaxed mb-3">
              You see exactly what it wants to write and where. You Approve or Reject. Only after
              you approve does the change get committed to your brain repo.
            </p>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <p className="text-[11px] font-mono text-amber-400/80 leading-relaxed">
                Nothing executes without your explicit yes. The agent can propose. You decide.
              </p>
            </div>
            <div className="mt-3">
              <Link
                href="/app/mission-control"
                className="inline-flex items-center gap-1.5 text-sm text-[#22d3ee] hover:underline font-mono min-h-[44px]"
              >
                Go to Mission Control →
              </Link>
            </div>
          </Card>
        </Section>

        {/* Connections */}
        <Section title="Connections">
          <Card>
            <p className="text-sm text-slate-300 leading-relaxed mb-3">
              Connections are read-only integrations that let your agent pull live context from
              the tools you already use.
            </p>
            <div className="flex flex-col gap-2 mb-4">
              {[
                {
                  label: "Gmail",
                  desc: "Agent parses your inbox for action items and stages them in the approval queue.",
                  live: true,
                },
                {
                  label: "Google Calendar",
                  desc: "Live upcoming events surfaced in the Calendar app and Daily Brief.",
                  live: false,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-slate-800/50 bg-slate-950/30"
                >
                  {item.live ? (
                    <span className="text-[10px] font-mono text-[#22d3ee] border border-[#22d3ee]/30 rounded px-1.5 py-0.5 uppercase tracking-wider mt-0.5 shrink-0 bg-[#22d3ee]/5">
                      live
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-600 border border-slate-700/40 rounded px-1.5 py-0.5 uppercase tracking-wider mt-0.5 shrink-0">
                      soon
                    </span>
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-300">{item.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/app/settings"
              className="inline-flex items-center gap-1.5 text-sm text-[#22d3ee] hover:underline font-mono min-h-[44px]"
            >
              Manage connections in Settings →
            </Link>
          </Card>
        </Section>

        {/* Footer */}
        <div className="rounded-xl border border-slate-800/40 bg-transparent px-5 py-4">
          <p className="text-[11px] font-mono text-slate-600 leading-relaxed">
            Questions? Talk to your agent — it knows the product.{" "}
            <Link href="/app/ask" className="text-[#22d3ee]/60 hover:text-[#22d3ee] transition-colors">
              Open Agent →
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}
