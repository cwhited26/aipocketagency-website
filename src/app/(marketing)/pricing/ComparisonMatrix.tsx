// ComparisonMatrix — the full "what comes with each tier" table on /pricing (launch prep
// 2026-07-02). Chase's ask: play out every shipped feature per tier so a buyer can see exactly
// what they get, no fluff. Every number here mirrors the enforced caps in
// src/lib/personas/tier-caps.ts (+ starter-skills/catalog.ts for the Skills gate). If a cap
// changes there, change it here — this table is the customer-facing mirror, not a second source
// of truth. Pure presentational server component (no client JS): a scrolling table on wide
// screens, stacked per-tier cards on narrow ones, both from the same data below.

const COLUMNS = [
  { name: "Personal Brain", price: "$37" },
  { name: "Business Agent", price: "$97" },
  { name: "Pro+", price: "$149" },
  { name: "Studio", price: "$297" },
  { name: "AI Agent Workspace", price: "$497" },
  { name: "Enterprise", price: "Custom" },
] as const;

// Column order: starter, pro, pro_plus, studio, studio_plus, enterprise.
type Cells = [string, string, string, string, string, string];
type Row = { label: string; cells: Cells };
type Group = { title: string; rows: Row[]; note?: string };

const Y = "✓";
const N = "—";

const GROUPS: Group[] = [
  {
    title: "Business Brain",
    rows: [
      { label: "Business Brain in your own Git repo", cells: [Y, Y, Y, Y, Y, Y] },
      {
        label: "Capture + ingestion — photo, PDF, voice, email, YouTube, podcast",
        cells: ["Basic", Y, Y, Y, Y, Y],
      },
      { label: "Brain Map — Galaxy + Folders views", cells: [Y, Y, Y, Y, Y, Y] },
      { label: "RAG retrieval over brain zones", cells: [Y, Y, Y, Y, Y, Y] },
      {
        label: "Stored agent memories",
        cells: ["100", "1,000", "1,000", "10,000", "10,000", "Unlimited"],
      },
    ],
  },
  {
    title: "Personas",
    note: "Personal Brain includes your single agent. Business Agent and up add configured team Personas — Admin, Sales, Content.",
    rows: [
      { label: "Personas", cells: ["1", "5", "10", "20", "50", "Unlimited"] },
      { label: "Seats per Persona", cells: [N, "10", "25", "50", "Unlimited", "Unlimited"] },
      {
        label: "Messages / mo per Persona",
        cells: [N, "2,000", "5,000", "15,000", "50,000", "Unlimited"],
      },
      { label: "Public-link Persona", cells: [N, "Add-on", "1 incl.", Y, Y, Y] },
      { label: "Website widget Persona", cells: [N, N, "Add-on", Y, Y, Y] },
      { label: "Remove “Built with Pocket Agent” badge", cells: [N, N, N, Y, Y, Y] },
    ],
  },
  {
    title: "Apps",
    rows: [
      { label: "Email Drafter", cells: [N, Y, Y, Y, Y, Y] },
      { label: "Lead Scout", cells: [N, Y, Y, Y, Y, Y] },
      { label: "Follow-Up Sweeps", cells: [N, Y, Y, Y, Y, Y] },
      { label: "Landing Page Builder (build + deploy)", cells: [N, "Preview", "Preview", Y, Y, Y] },
      { label: "Competitor Inspector", cells: [N, N, Y, Y, Y, Y] },
      {
        label: "Idea Engine",
        cells: [N, N, "Prompt pack", "Prompt pack", "Auto-build", "Auto-build"],
      },
      { label: "Decision Roundtable", cells: [N, N, N, N, "30 / mo", "150 / mo"] },
      { label: "Lead Scout vertical packs (7 verticals)", cells: [N, N, N, N, Y, Y] },
      { label: "Podcast vertical packs", cells: [N, N, N, N, Y, Y] },
    ],
  },
  {
    title: "Skills",
    note: "5 Voice + Style Skills for everyone; + Email / Sales / Research at Pro+ (20 total); + Operations / Decision-shape at the full workspace (30 total).",
    rows: [
      { label: "Prebuilt Skills, auto-seeded", cells: ["5", "5", "20", "20", "30", "30"] },
    ],
  },
  {
    title: "Connected Tools",
    rows: [
      { label: "Connect Gmail, Calendar, Slack, QuickBooks, Stripe", cells: [N, Y, Y, Y, Y, Y] },
      { label: "Talk to your agent in Slack", cells: [N, Y, Y, Y, Y, Y] },
      { label: "SMS, Telegram, and other channels", cells: [N, N, Y, Y, Y, Y] },
    ],
  },
  {
    title: "Mission Control",
    rows: [
      { label: "Live cockpit — every agent action, staged for approval", cells: [Y, Y, Y, Y, Y, Y] },
      { label: "Cost tracking + monthly budget caps", cells: [Y, Y, Y, Y, Y, Y] },
    ],
  },
  {
    title: "Limits",
    rows: [
      { label: "Active rituals (scheduled recurring jobs)", cells: ["1", "5", "10", "25", "100", "100"] },
      { label: "Workflow Vault recipes unlocked", cells: ["3", "5", "10", "18", "25", "25"] },
    ],
  },
  {
    title: "Setup & Support",
    rows: [
      { label: "AI Office Launch Kit + Skool community", cells: [Y, Y, Y, Y, Y, Y] },
      { label: "Implementation Guarantee (7-day setup)", cells: [Y, Y, Y, Y, Y, Y] },
    ],
  },
];

function Cell({ value }: { value: string }) {
  if (value === Y) return <span className="text-cyan-300">{Y}</span>;
  if (value === N) return <span className="text-slate-600">{N}</span>;
  return <span className="text-slate-200">{value}</span>;
}

export default function ComparisonMatrix() {
  return (
    <div>
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Everything that comes with each plan
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-400">
          Actual features, actual limits — the same caps your account enforces. No asterisks.
        </p>
      </div>

      {/* WIDE: scrolling table */}
      <div className="mt-10 hidden md:block">
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="bg-white/[0.03]">
                <th className="sticky left-0 z-10 bg-[#05070a] px-5 py-4 text-left font-semibold text-slate-300">
                  Feature
                </th>
                {COLUMNS.map((c) => (
                  <th key={c.name} className="px-4 py-4 text-center align-bottom">
                    <div className="text-sm font-semibold text-slate-100">{c.name}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{c.price}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((g) => (
                <GroupRows key={g.title} group={g} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* NARROW: one stacked card per tier */}
      <div className="mt-10 space-y-5 md:hidden">
        {COLUMNS.map((c, ci) => (
          <div
            key={c.name}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          >
            <div className="flex items-baseline justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-semibold text-slate-100">{c.name}</h3>
              <span className="text-sm text-slate-400">{c.price}</span>
            </div>
            <div className="mt-3 space-y-4">
              {GROUPS.map((g) => (
                <div key={g.title}>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300/70">
                    {g.title}
                  </div>
                  <dl className="mt-1.5 space-y-1.5">
                    {g.rows.map((r) => (
                      <div key={r.label} className="flex items-start justify-between gap-4">
                        <dt className="text-[13px] leading-snug text-slate-400">{r.label}</dt>
                        <dd className="shrink-0 text-[13px] font-medium">
                          <Cell value={r.cells[ci]} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Group notes, shown once below the grid */}
      <div className="mx-auto mt-6 max-w-3xl space-y-1.5">
        {GROUPS.filter((g) => g.note).map((g) => (
          <p key={g.title} className="text-xs leading-relaxed text-slate-500">
            <span className="text-slate-400">{g.title}:</span> {g.note}
          </p>
        ))}
      </div>
    </div>
  );
}

function GroupRows({ group }: { group: Group }) {
  return (
    <>
      <tr>
        <td
          colSpan={COLUMNS.length + 1}
          className="sticky left-0 border-t border-white/10 bg-white/[0.04] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-cyan-300/80"
        >
          {group.title}
        </td>
      </tr>
      {group.rows.map((r) => (
        <tr key={r.label} className="border-t border-white/5">
          <td className="sticky left-0 z-10 bg-[#05070a] px-5 py-3 text-left text-slate-300">
            {r.label}
          </td>
          {r.cells.map((value, i) => (
            <td key={i} className="px-4 py-3 text-center">
              <Cell value={value} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
