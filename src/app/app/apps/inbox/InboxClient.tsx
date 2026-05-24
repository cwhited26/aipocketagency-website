"use client";

import Link from "next/link";

export default function InboxClient({ brainRepo }: { brainRepo: string | null }) {
  return (
    <div className="min-h-screen bg-[#05070a]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-2">
          <Link
            href="/app/apps"
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
          >
            ← Work apps
          </Link>
        </div>

        <div className="mb-8">
          <div className="text-[10px] text-[#22d3ee]/60 font-mono tracking-[0.2em] uppercase mb-2">
            Agent desk · Approval queue
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Inbox</h1>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            Your agent&apos;s desk. Drafts staged for your approval, items needing a yes or no, and
            things the agent flagged for your attention.
          </p>
        </div>

        {/* Queue — empty state today */}
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-6 py-8 text-center mb-6">
          <div className="text-[#22d3ee]/30 font-mono text-xs tracking-[0.2em] uppercase mb-3">
            Queue
          </div>
          <div className="text-slate-100 text-sm font-medium mb-2">
            0 items pending approval
          </div>
          <p className="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto">
            When your agent prepares drafts — emails, quotes, follow-ups — and stages them for your
            review, they land here. You approve or edit before anything goes out.
          </p>
        </div>

        {/* What you can do today */}
        <div className="mb-6">
          <div className="text-[11px] font-mono text-slate-600 uppercase tracking-wider mb-3">
            Go draft something now
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { href: "/app/apps/quote", label: "Quote", desc: "Draft a proposal" },
              { href: "/app/apps/email", label: "Email", desc: "Write in your voice" },
              { href: "/app/apps/followups", label: "Follow-ups", desc: "Surface cold leads" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="glow-card px-4 py-3 text-center"
              >
                <div className="text-sm font-medium text-slate-200 mb-0.5">{item.label}</div>
                <div className="text-xs text-slate-500">{item.desc}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* Coming soon seam */}
        <div className="rounded-xl border border-slate-800/40 bg-transparent px-5 py-5">
          <div className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-700 mt-1.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-400">
                Live email sync arrives with Connections
              </p>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                Once you connect Gmail, your agent will parse your inbox for action items —
                proposals awaiting reply, clients who need a follow-up, payment threads — and stage
                them here for approval.{brainRepo ? " Your brain makes the parsing smarter." : ""}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
