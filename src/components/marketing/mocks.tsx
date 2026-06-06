import { MONO_FONT } from "./cta";

/*
 * SHOWN-EXAMPLE MOCKS — hand-built, styled to look like the real product.
 * FLAGGED FOR SWAP: replace each of these with a real screenshot capture of the
 * shipped Pocket Agent surface once Wave B (dispatcher) is live in prod.
 *   - ChatMock        -> real /app/home chat thread
 *   - PersonaSpecMock -> real persona.md render
 *   - ScaffoldMock    -> real scaffolds/<project>/scaffolding.md tree
 */

function WindowChrome({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-white/10 bg-black/50 px-4 py-2.5">
      <span className="h-3 w-3 rounded-full bg-red-500/60" />
      <span className="h-3 w-3 rounded-full bg-yellow-500/60" />
      <span className="h-3 w-3 rounded-full bg-green-500/60" />
      <span className="ml-3 text-xs text-slate-500" style={{ fontFamily: MONO_FONT }}>
        {label}
      </span>
    </div>
  );
}

export function ChatMock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black shadow-2xl">
      <WindowChrome label="pocket agent · chat" />
      <div className="space-y-4 p-4 sm:p-6">
        {/* owner message */}
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-md border border-accent/25 bg-accent/[0.07] px-4 py-3 text-[15px] leading-relaxed text-slate-100">
            Patrick called — he wants the supplement docs by Friday. Pull his
            job file, write the supplement letter from the inspection photos,
            draft the email with it attached, and queue the $6k for when he
            signs.
          </div>
        </div>

        {/* agent response */}
        <div className="flex justify-start">
          <div className="max-w-[92%] space-y-3 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.03] px-4 py-3.5 text-[15px] leading-relaxed text-slate-300">
            <p className="text-slate-200">On it. Three things running:</p>
            <ul className="space-y-2.5">
              <li className="flex gap-2.5">
                <span aria-hidden>📂</span>
                <span>
                  <span className="font-medium text-slate-100">Job file</span> —
                  found Patrick Williams, 4823 Elm. Last inspection May 28. 14
                  photos on file.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden>📝</span>
                <span>
                  <span className="font-medium text-slate-100">Supplement letter</span>{" "}
                  — drafting from the inspection photos and your standard
                  template.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden>💰</span>
                <span>
                  <span className="font-medium text-slate-100">Invoice</span> —
                  staged a $6,000 line for &ldquo;Williams supplement.&rdquo;
                  Won&apos;t go to your books until you say so.
                </span>
              </li>
            </ul>

            {/* approval card */}
            <div className="rounded-xl border border-white/10 bg-black/40 p-3.5">
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Email draft — needs your okay
              </div>
              <div className="mt-2 text-sm text-slate-300">
                <div>
                  <span className="text-slate-500">To:</span> patrick@freshpagehi.com
                </div>
                <div>
                  <span className="text-slate-500">Subject:</span> Williams
                  supplement — findings + scope
                </div>
                <div className="mt-1.5 text-slate-400">
                  Hey Patrick — attached is the supplement letter for the
                  Williams job, pulled from the May 28 inspection…
                </div>
                <div className="mt-2 text-xs text-slate-500" style={{ fontFamily: MONO_FONT }}>
                  📎 supplement-letter-williams.pdf
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground">
                  Send it
                </span>
                <span className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-300">
                  Edit
                </span>
                <span className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-300">
                  Save to drafts
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScaffoldMock() {
  const milestones = [
    {
      n: 1,
      title: "Find the job",
      done: true,
      tasks: ["Locate Williams job file", "Confirm last inspection + photos"],
    },
    {
      n: 2,
      title: "Write the supplement",
      done: true,
      tasks: ["Draft letter from inspection photos", "Match your standard scope template"],
    },
    {
      n: 3,
      title: "Send it to Patrick",
      done: false,
      tasks: ["Draft email with letter attached", "Hold for your approval before sending"],
    },
    {
      n: 4,
      title: "Queue the money",
      done: false,
      tasks: ["Stage $6,000 invoice line", "Release to books when Patrick signs"],
    },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black shadow-2xl">
      <WindowChrome label="pocket agent · plan" />
      <div className="p-4 sm:p-6">
        <div className="text-xs uppercase tracking-wider text-slate-500">The plan</div>
        <h4 className="mt-1 text-lg font-semibold text-slate-100">
          Send Patrick the supplement
        </h4>
        <p className="mt-1 text-sm text-slate-400">
          Four steps. Nothing leaves until you approve it.
        </p>
        <ol className="mt-5 space-y-3">
          {milestones.map((m) => (
            <li key={m.n} className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
              <div className="flex items-center gap-2.5">
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                    m.done
                      ? "bg-accent/20 text-accent"
                      : "border border-white/15 text-slate-500"
                  }`}
                >
                  {m.done ? "✓" : m.n}
                </span>
                <span className="text-sm font-medium text-slate-100">{m.title}</span>
                <span className="ml-auto text-[11px] uppercase tracking-wider text-slate-500">
                  {m.done ? "done" : "waiting"}
                </span>
              </div>
              <ul className="mt-2 space-y-1 pl-8">
                {m.tasks.map((t) => (
                  <li key={t} className="text-[13px] leading-relaxed text-slate-400">
                    {t}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground">
            Approve plan
          </span>
          <span className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-300">
            Change a step
          </span>
        </div>
      </div>
    </div>
  );
}

export function PersonaSpecMock() {
  const rows = [
    {
      label: "What it does",
      body: "Answers your reps' pricing and process questions the way you'd answer them.",
    },
    {
      label: "What it knows",
      body: "Your price book, your scope templates, your close playbook. Nothing else.",
    },
    {
      label: "How it talks",
      body: "Short, direct, no fluff. Never invents a number it can't point to.",
    },
    {
      label: "When it punts",
      body: "Anything about pay, hiring, or a customer dispute — it sends the rep to you.",
    },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black shadow-2xl">
      <WindowChrome label="persona · virtual-sales-manager" />
      <div className="p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent ring-1 ring-accent/30">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path d="M3 21v-2a4 4 0 014-4h6a4 4 0 014 4v2" strokeLinecap="round" />
              <circle cx="10" cy="7" r="4" />
            </svg>
          </span>
          <div>
            <h4 className="text-lg font-semibold text-slate-100">Virtual Sales Manager</h4>
            <div className="text-xs text-slate-500">
              Shared with 6 reps · answers in your voice
            </div>
          </div>
        </div>
        <dl className="mt-5 space-y-3.5">
          {rows.map((r) => (
            <div key={r.label} className="border-t border-white/[0.06] pt-3.5">
              <dt className="text-xs uppercase tracking-wider text-accent/80">{r.label}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate-300">{r.body}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-slate-500">
          A specialist is just a short, plain-English spec you can read and edit.
          You decide what it knows and what it won&apos;t touch.
        </div>
      </div>
    </div>
  );
}
