import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/marketing/site-nav";
import { MONO_FONT } from "@/components/marketing/cta";
import { isQualificationRoute } from "@/lib/enterprise/scoring";
import type { QualificationRoute } from "@/lib/enterprise/types";

const PAGE_URL = "https://aipocketagent.com/enterprise/thanks";

export const metadata: Metadata = {
  title: "Your Enterprise application is submitted — Pocket Agent",
  description:
    "We'll review your Pocket Agent Enterprise application and determine whether Enterprise is the right fit.",
  alternates: { canonical: PAGE_URL },
  robots: { index: false },
};

// The headline + recommended-plan emphasis flex on the qualification route passed through the redirect
// (Part 8G routing). Without a recognized route we fall back to the neutral Part 8F copy.
const ROUTE_COPY: Record<QualificationRoute, string> = {
  enterprise:
    "Your application looks like a strong Enterprise fit. We'll reach out with the next step — an Enterprise workflow call.",
  workspace_premium_dwy:
    "Enterprise may be more than you need right now. The better starting point is likely AI Agent Workspace with Premium Done-With-You Setup.",
  business_standard_dwy:
    "You probably do not need Enterprise yet. The right first move is Business Agent with Standard Done-With-You Setup.",
  pilot:
    "Before a full subscription, the right way to test this is the 14-Day Pilot — one useful loop, $97 that credits toward your subscription.",
  educational:
    "Based on your application, the best next step is to learn the system first. Start with Business Agent self-serve when you're ready to implement.",
};

type Plan = {
  key: string;
  name: string;
  price: string;
  body: string;
  href: string;
  cta: string;
};

const PLANS: Plan[] = [
  {
    key: "business",
    name: "Business Agent",
    price: "$97/month",
    body: "For owner-led businesses that need Personas, Apps, Mission Control, and active integrations.",
    href: "/start?tier=pro",
    cta: "Start Business Agent",
  },
  {
    key: "workspace",
    name: "AI Agent Workspace",
    price: "$497/month",
    body: "For businesses that want Idea Engine, Lead Scout vertical packs, Decision Roundtable, full cockpit, and all 30 Skills.",
    href: "/start?tier=studio_plus",
    cta: "Start With AI Agent Workspace",
  },
  {
    key: "premium_dwy",
    name: "Premium Done-With-You Setup",
    price: "$2,500 one-time",
    body: "Business Brain import, 1 Persona, 1 workflow, first Lead Scout run, first follow-up sweep, 90-minute call, and a 30-day check-in.",
    href: "/setup",
    cta: "See Premium Setup",
  },
  {
    key: "standard_dwy",
    name: "Standard Done-With-You Setup",
    price: "$997 one-time",
    body: "Business Brain import, 1 Persona, 1 workflow, and a 60-minute implementation call.",
    href: "/setup",
    cta: "See Standard Setup",
  },
];

// Which plan cards to badge as recommended, per route.
const RECOMMENDED: Record<QualificationRoute, string[]> = {
  enterprise: [],
  workspace_premium_dwy: ["workspace", "premium_dwy"],
  business_standard_dwy: ["business", "standard_dwy"],
  pilot: ["business"],
  educational: ["business"],
};

export default function EnterpriseThanksPage({
  searchParams,
}: {
  searchParams: { route?: string };
}) {
  const route = isQualificationRoute(searchParams.route) ? searchParams.route : null;
  const recommended = route ? RECOMMENDED[route] : [];

  return (
    <>
      <main className="text-slate-100">
        <section className="relative overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 bg-grid opacity-20" aria-hidden />
          <div className="absolute inset-0 bg-hero-glow" aria-hidden />
          <div className="relative mx-auto max-w-2xl px-6 pb-16 pt-24 text-center sm:pt-32">
            <div
              className="mb-4 inline-block text-xs text-cyan-300/70"
              style={{ fontFamily: MONO_FONT }}
            >
              [ application received ]
            </div>
            <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
              Your Enterprise application is submitted.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-slate-300">
              We&apos;ll review your application and determine whether Pocket Agent
              Enterprise is the right fit.
            </p>
            {route ? (
              <p className="mx-auto mt-5 max-w-xl rounded-xl border border-cyan-300/20 bg-cyan-300/[0.04] px-5 py-4 text-[15px] leading-relaxed text-slate-200">
                {ROUTE_COPY[route]}
              </p>
            ) : null}
          </div>
        </section>

        <section className="border-b border-white/5">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <p className="text-[15px] leading-relaxed text-slate-300">
              Thanks for applying. If your business is a fit for Enterprise, we&apos;ll
              reach out with the next step. If Enterprise is not the right move yet, we
              may recommend one of these instead:
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {PLANS.map((p) => {
                const isRec = recommended.includes(p.key);
                return (
                  <div
                    key={p.key}
                    className={`flex flex-col rounded-2xl border p-6 ${
                      isRec
                        ? "border-cyan-300/40 bg-cyan-300/[0.05]"
                        : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    {isRec ? (
                      <div
                        className="mb-3 inline-block w-fit rounded-full bg-cyan-300/15 px-3 py-1 text-[11px] font-medium text-cyan-300"
                        style={{ fontFamily: MONO_FONT }}
                      >
                        Recommended for you
                      </div>
                    ) : null}
                    <h3 className="text-base font-semibold text-slate-100">{p.name}</h3>
                    <div className="mt-1 text-lg font-bold text-slate-200">{p.price}</div>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
                      {p.body}
                    </p>
                    <Link
                      href={p.href}
                      className="mt-5 inline-flex items-center justify-center rounded-full border border-accent/50 bg-accent/[0.04] px-5 py-2.5 text-sm font-semibold text-accent transition hover:scale-[1.02] hover:bg-accent/[0.08]"
                    >
                      {p.cta}
                    </Link>
                  </div>
                );
              })}
            </div>
            <div className="mt-8 text-center">
              <Link
                href="/"
                className="text-sm font-semibold text-cyan-300 transition hover:underline"
              >
                Return to homepage →
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
