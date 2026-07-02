// PartsVsProduct — the concrete wedge on /pricing (launch prep 2026-07-02). Replaces the vague
// "most teach it, PA ships it" line Chase called out as meaningless to an outsider. Left = the
// stack of tools people get taught to wire together themselves; right = the Apps Pocket Agent
// ships assembled. Every App on the right is shipped (Positioning Lock §4.3 / §7). Voice-checked
// against whited-brain/voice/chase-spec.md — concrete over preachy, no marketing fluff.

const PARTS = [
  "n8n",
  "Zapier",
  "Claude Code",
  "Cursor",
  "A folder of ChatGPT prompts",
  "A Notion template",
  "A $497 Skool course",
  "A YouTube tutorial",
];

const PRODUCT = [
  "Email Drafter",
  "Lead Scout",
  "Follow-Up Sweeps",
  "Landing Page Builder",
  "Idea Engine",
  "Capture Inbox",
  "Podcast Ingester",
  "Decision Roundtable",
];

export default function PartsVsProduct() {
  return (
    <div>
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Everyone else sells you the parts. Pocket Agent ships the assembled product.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-400">
          Same idea the courses teach — memory, agents, skills wired together. The difference is
          whether you spend a month building it or open your account and use it.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h3 className="text-sm font-semibold text-slate-300">
            The tools people teach you to string together
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
            {PARTS.map((p) => (
              <li key={p} className="flex items-start gap-2">
                <span className="mt-0.5 text-slate-600">•</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-relaxed text-slate-500">
            You wire them, host them, and keep them running. Then you start on the actual work.
          </p>
        </div>

        <div className="rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.05] p-6">
          <h3 className="text-sm font-semibold text-cyan-200">Pocket Agent, ready to use</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-slate-200">
            {PRODUCT.map((p) => (
              <li key={p} className="flex items-start gap-2">
                <span className="mt-0.5 text-cyan-300">✓</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-cyan-300/15 pt-4 text-xs leading-relaxed text-slate-400">
            Already wired to your Business Brain, already running. You approve the work — you
            don&apos;t assemble the toolkit.
          </p>
        </div>
      </div>
    </div>
  );
}
