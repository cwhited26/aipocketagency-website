import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { MONO_FONT } from "@/components/marketing/cta";

const PAGE_URL = "https://aipocketagent.com/enterprise";
const DESCRIPTION =
  "Pocket Agent Enterprise gives teams custom usage, permissions, implementation, integrations, BYO LLM options, and support — so your AI Agent Workspace fits how your business actually runs. Apply for Enterprise.";

export const metadata: Metadata = {
  title: "Pocket Agent Enterprise — Custom AI Agent Workspace",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Need Pocket Agent built around how your business actually runs?",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "AI Pocket Agency",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Need Pocket Agent built around how your business actually runs?",
    description: DESCRIPTION,
  },
};

const APPLY_HREF = "/enterprise/apply";
const WORKSPACE_HREF = "/start?tier=studio_plus";

const WHO_FOR = [
  "Custom usage allowances",
  "Advanced team permissions",
  "Workspace governance",
  "BYO LLM configuration",
  "Custom integrations",
  "Custom implementation",
  "Custom agent workflows",
  "Deeper Mission Control routing",
  "Enterprise support",
  "Multiple users or departments",
  "High-volume Lead Scout, ingestion, or sub-agent runs",
  "A custom setup around your existing business systems",
];

const WHAT_YOU_GET = [
  {
    title: "Custom Usage",
    body: "Get a plan built around your team's expected leads, Whisper hours, sub-agent runs, and workflow volume.",
  },
  {
    title: "Team Permissions",
    body: "Set up the workspace so the right people can access the right brains, Personas, Apps, and approvals.",
  },
  {
    title: "Custom Implementation",
    body: "Get help mapping your Business Brain, Personas, Apps, workflows, and Mission Control review process.",
  },
  {
    title: "BYO LLM Options",
    body: "For teams that want to bring their own LLM key and manage their own usage visibility.",
  },
  {
    title: "Advanced Integrations",
    body: "Connect Pocket Agent around the systems your business already uses, where feasible and scoped.",
  },
  {
    title: "Custom Agent Workflows",
    body: "Build workflows for your actual operating process instead of forcing everything into a generic template.",
  },
  {
    title: "Mission Control Governance",
    body: "Design review, approval, and escalation paths so AI prepares work and the right human approves it.",
  },
  {
    title: "Enterprise Support",
    body: "Get a support path aligned to your team's complexity and implementation needs.",
  },
];

const MECHANISM = [
  { name: "Business Brain", body: "Your company memory." },
  { name: "Personas", body: "The WHO. Trained AI roles." },
  { name: "Apps", body: "The WHAT. Workflow tools each Persona uses." },
  { name: "Mission Control", body: "The cockpit where work gets reviewed and approved." },
];

const USE_CASES = [
  {
    title: "Multi-Person Team Workspace",
    body: "You need multiple team members using Pocket Agent with different responsibilities, permissions, and approval paths.",
  },
  {
    title: "High-Volume Lead Research",
    body: "You use Lead Scout heavily and need custom usage around vertical research, prospect review, and follow-up workflows.",
  },
  {
    title: "Idea-To-Launch Workflow",
    body: "You use Idea Engine to validate, build, publish, and prospect for multiple offers or campaigns.",
  },
  {
    title: "Custom Mission Control Routing",
    body: "You need drafts, research, pages, follow-ups, and decisions routed to the right people for approval.",
  },
  {
    title: "BYO LLM Configuration",
    body: "You want to bring your own Anthropic key and see your own real dollar usage because that spend is yours.",
  },
  {
    title: "Agency / Client Workspace",
    body: "You are an agency, consultant, or operator setting up AI Agent Workspaces for multiple clients.",
  },
  {
    title: "Custom Workflow Implementation",
    body: "You have a specific workflow that does not fit a standard template and want it mapped, configured, and reviewed.",
  },
];

const NOT_FOR = [
  "You only need one Business Brain.",
  "You have not added any business context yet.",
  "You have not tried to create a Persona.",
  "You do not know what workflow you want.",
  "You are not ready to implement.",
  "You want AI to make decisions without human review.",
  "You are looking for a free strategy session.",
];

const PROCESS = [
  {
    step: "Apply",
    body: "Tell us about your business, workflows, team, systems, and what you want Pocket Agent to help with.",
  },
  {
    step: "Fit Review",
    body: "We review whether Enterprise is the right path or whether you should start with a standard plan.",
  },
  {
    step: "Workflow Call",
    body: "If there is a fit, we map your Business Brain, Personas, Apps, Mission Control, usage needs, and implementation scope.",
  },
  { step: "Proposal", body: "You receive a custom Enterprise recommendation." },
  {
    step: "Implementation",
    body: "If accepted, we help install Pocket Agent around the agreed workflow plan.",
  },
];

function Eyebrow({ children }: { children: string }) {
  return (
    <div
      className="mb-3 inline-block text-xs text-cyan-300/70"
      style={{ fontFamily: MONO_FONT }}
    >
      {children}
    </div>
  );
}

function ApplyButton({ className = "" }: { className?: string }) {
  return (
    <Link
      href={APPLY_HREF}
      className={`inline-flex items-center justify-center rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-accent-foreground transition hover:scale-[1.02] ${className}`}
    >
      Apply For Enterprise
    </Link>
  );
}

export default function EnterprisePage() {
  return (
    <>
      <SiteHeader />
      <main className="text-slate-100">
        {/* SECTION 1: HERO */}
        <section className="relative overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 bg-grid opacity-20" aria-hidden />
          <div className="absolute inset-0 bg-hero-glow" aria-hidden />
          <div className="relative mx-auto max-w-4xl px-6 pb-20 pt-20 text-center sm:pt-28">
            <Eyebrow>[ Pocket Agent Enterprise ]</Eyebrow>
            <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">
              Need Pocket Agent built around how your business actually runs?
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
              Pocket Agent Enterprise gives teams custom usage, permissions,
              implementation, integrations, BYO LLM options, and support so your AI
              Agent Workspace can fit your workflows, data, people, and review
              process.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ApplyButton />
              <Link
                href={WORKSPACE_HREF}
                className="inline-flex items-center justify-center rounded-full border border-accent/50 bg-accent/[0.04] px-7 py-3.5 text-sm font-semibold text-accent transition hover:scale-[1.02] hover:bg-accent/[0.08]"
              >
                Start With AI Agent Workspace
              </Link>
            </div>
            <p className="mt-5 text-sm text-slate-500">
              Enterprise is for businesses that need more than a standard workspace.
            </p>
          </div>
        </section>

        {/* SECTION 2: PROBLEM */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-3xl px-6 py-16">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              At some point, generic setup is not enough.
            </h2>
            <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-slate-300">
              <p>
                Most owner-led businesses can start with Business Agent or AI Agent
                Workspace.
              </p>
              <p>
                They build a Business Brain. Clone Personas. Use Apps. Review in
                Mission Control.
              </p>
              <p>That is enough to install the first working loop.</p>
              <p>But some businesses need more.</p>
              <p>
                They have more users. More workflows. More data. More approvals.
                More permissions. More volume. More systems. More compliance
                concerns. More custom processes.
              </p>
              <p>
                And more places where AI needs to fit into the way the company
                already operates.
              </p>
              <p>That is where Pocket Agent Enterprise comes in.</p>
            </div>
          </div>
        </section>

        {/* SECTION 3: WHO ENTERPRISE IS FOR */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Enterprise is for teams that need custom fit.
            </h2>
            <p className="mt-4 text-[15px] text-slate-400">
              Apply for Pocket Agent Enterprise if you need:
            </p>
            <ul className="mt-6 grid gap-2.5 text-sm text-slate-300 sm:grid-cols-2">
              {WHO_FOR.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 text-cyan-300">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <ApplyButton />
            </div>
          </div>
        </section>

        {/* SECTION 4: WHAT YOU GET */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              What Pocket Agent Enterprise can include
            </h2>
            <p className="mt-3 text-sm text-slate-400">
              Final scope depends on your application, workflow needs, and
              implementation plan.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {WHAT_YOU_GET.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <h3 className="text-base font-semibold text-slate-100">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 5: THE ENTERPRISE MECHANISM */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              The same Pocket Agent System, configured deeper.
            </h2>
            <p className="mt-4 text-[15px] text-slate-300">
              Enterprise still uses the same four-part mechanism:
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {MECHANISM.map((m) => (
                <div
                  key={m.name}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                >
                  <div className="text-sm font-semibold text-cyan-300">{m.name}</div>
                  <p className="mt-1 text-sm text-slate-300">{m.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-slate-300">
              <p>The difference is depth.</p>
              <p>
                Enterprise helps you configure the system around your team, usage,
                permissions, workflows, integrations, and operating rhythm.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 6: COMMON ENTERPRISE USE CASES */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Common Enterprise use cases
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {USE_CASES.map((u, i) => (
                <div
                  key={u.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <div
                    className="text-xs text-cyan-300/70"
                    style={{ fontFamily: MONO_FONT }}
                  >
                    [ use case {i + 1} ]
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-slate-100">
                    {u.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {u.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 7: WHO SHOULD NOT APPLY */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-3xl px-6 py-16">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Do not apply if you should start with the standard plans.
            </h2>
            <p className="mt-5 text-[15px] text-slate-400">
              Do not apply for Enterprise if:
            </p>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-300">
              {NOT_FOR.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 text-slate-500">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 space-y-3 text-[15px] leading-relaxed text-slate-300">
              <p>
                Start with{" "}
                <Link href="/start?tier=pro" className="text-cyan-300 hover:underline">
                  Business Agent
                </Link>{" "}
                if you want the main business workspace.
              </p>
              <p>
                Start with{" "}
                <Link href={WORKSPACE_HREF} className="text-cyan-300 hover:underline">
                  AI Agent Workspace
                </Link>{" "}
                if you want Idea Engine, Lead Scout vertical packs, Decision
                Roundtable, and the full cockpit.
              </p>
              <p>Apply for Enterprise when you need custom fit.</p>
            </div>
          </div>
        </section>

        {/* SECTION 8: HOW THE PROCESS WORKS */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              How the process works
            </h2>
            <ol className="mt-8 space-y-5">
              {PROCESS.map((p, i) => (
                <li key={p.step} className="flex gap-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cyan-300/15 text-sm font-semibold text-cyan-300">
                    {i + 1}
                  </span>
                  <div>
                    <div className="text-base font-semibold text-slate-100">
                      {p.step}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-slate-400">
                      {p.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* SECTION 9: APPLICATION CTA */}
        <section>
          <div className="mx-auto max-w-3xl px-6 py-20 text-center">
            <Eyebrow>[ next step ]</Eyebrow>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Ready to see if Enterprise is the right fit?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-slate-300">
              Apply below. If Enterprise is not the right move, we will point you to
              the plan that makes more sense.
            </p>
            <div className="mt-8">
              <ApplyButton />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
