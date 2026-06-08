import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { PrimaryCTA, MONO_FONT } from "@/components/marketing/cta";

const PAGE_URL = "https://aipocketagent.com/pricing";
const DESCRIPTION =
  "Start where you are, move up when the business does. Starter $37, Pro $97, Pro+ $149, Studio $297, Studio+ $497, Enterprise. Every plan earns its price by turning on the next thing you can hand off. 14-day free trial.";

export const metadata: Metadata = {
  title: "Pricing — Pocket Agent",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Pricing — Pocket Agent",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "AI Pocket Agency",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing — Pocket Agent",
    description: DESCRIPTION,
  },
};

type Tier = {
  name: string;
  price: string;
  cadence?: string;
  tagline: string;
  body: string;
  unlocks: string[];
  featured?: boolean;
  // `href`: where the CTA points. Paid tiers route to the in-app /start?tier= checkout
  // (internal link); `external` opens a new tab and is only used for the Enterprise mailto.
  cta: { label: string; href: string; external?: boolean };
};

// All paid SMB tiers route through the in-app /start?tier= checkout so the same
// provisioning path stamps source=pocket_agent + user_id + tier into
// pocket_agent_subscriptions BEFORE Stripe checkout (closes the payment-link metadata
// gap from a152c5b). The raw Stripe payment links still exist in Stripe as a manual
// backup but are no longer linked from the marketing site. Enterprise is a "talk to
// sales" mailto with no Stripe price.
const ENTERPRISE_MAILTO =
  "mailto:chase@tnvex.com?subject=Pocket%20Agent%20Enterprise%20inquiry";

const TIERS: Tier[] = [
  {
    name: "Starter",
    price: "$37",
    cadence: "/mo",
    tagline: "You want a chat that remembers what you teach it.",
    body:
      "Pocket Agent remembers how your business runs and drafts the work — the daily brief, the email in your voice, the customer reply with the source attached, the decision you made three months ago found in seconds. One operator: you. This is the notebook that finally doesn't forget.",
    unlocks: [
      "Business memory that carries between conversations",
      "Email and customer-reply drafts in your voice",
      "A daily brief before the day starts",
      "Plain-English search across everything you've told it",
      "Capture from a voice note, a screenshot, an email, a link",
    ],
    cta: { label: "Start free for 14 days", href: "/start" },
  },
  {
    name: "Pro",
    price: "$97",
    cadence: "/mo",
    tagline: "You want to delegate the parts you keep doing by hand.",
    featured: true,
    body:
      "This is where it stops being a notebook and starts doing the work. Tell it what needs doing and it runs the steps across your tools — drafts the email and sends it, stages the invoice, sets the appointment — with your okay on anything that leaves the building. And you can build specialists your team asks instead of asking you.",
    unlocks: [
      "Everything in Starter",
      "It does the work: plans the steps, then carries them out",
      "Your tools connected — one can take actions, not just read",
      "Specialists your team can ask (sales, front desk, onboarding)",
      "You approve anything before it goes out",
    ],
    cta: { label: "Get Pro", href: "/start?tier=pro" },
  },
  {
    name: "Pro+",
    price: "$149",
    cadence: "/mo",
    tagline: "You want your team asking the bot instead of you.",
    body:
      "More tools it can act on, more specialists, and your first agent you can put in front of customers on a private link. For when one team and one inbox stopped being the whole picture.",
    unlocks: [
      "Everything in Pro",
      "More connected tools that can take actions",
      "More specialists for more roles",
      "Your first customer-facing agent (private link)",
    ],
    cta: { label: "Get Pro+", href: "/start?tier=pro_plus" },
  },
  {
    name: "Studio",
    price: "$297",
    cadence: "/mo",
    tagline: "You want Pocket Agent on your website, working while you sleep.",
    body:
      "Every tool connected, an agent embedded on your own website catching leads while you sleep, and your branding instead of ours. For the business with a site, a team, and more work than one person can shepherd.",
    unlocks: [
      "Everything in Pro+",
      "Every tool connected",
      "A chat agent on your own website, capturing leads",
      "Public agents for as many roles as the business needs",
      "White-label — your name, not ours",
    ],
    cta: { label: "Get Studio", href: "/start?tier=studio" },
  },
  {
    name: "Studio+",
    price: "$497",
    cadence: "/mo",
    tagline: "You want every part of your business running through one chat.",
    body:
      "For owners running more than one site or a growing team — every specialist, every connection, room to run them all at once. The ceiling before custom.",
    unlocks: [
      "Everything in Studio",
      "Widgets and agents across multiple sites",
      "Specialists for a full team's worth of roles",
      "Your own subdomain for the agents you ship",
    ],
    cta: { label: "Get Studio+", href: "/start?tier=studio_plus" },
  },
  {
    name: "Enterprise",
    price: "Let's talk",
    tagline: "You want a private deployment, your data on your terms.",
    body:
      "Private setup, dedicated infrastructure, as much as your operation needs. If you're already past Studio+, we'll build the plan around you.",
    unlocks: [
      "Everything in Studio+",
      "Dedicated infrastructure",
      "Custom connections and limits",
      "Hands-on setup with the team",
    ],
    cta: { label: "Talk to sales", href: ENTERPRISE_MAILTO, external: true },
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen text-slate-100">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-grid opacity-25" aria-hidden />
        <div className="absolute inset-0 bg-hero-glow" aria-hidden />
        <div className="relative mx-auto max-w-3xl px-6 pb-16 pt-24 text-center sm:pt-28">
          <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Start where you are. Move up when the business does.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-slate-300 sm:text-xl">
            Every plan earns its price by turning on the next thing you can hand
            off. The memory comes first. The operator turns on at Pro. You decide
            when the business is ready for more.
          </p>
          <p className="mt-6 text-sm text-slate-500" style={{ fontFamily: MONO_FONT }}>
            14-day free trial on every plan · cancel before day 15 and pay $0
          </p>
        </div>
      </section>

      <ValueAnchor />

      <section className="border-b border-white/5">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="grid gap-6 lg:grid-cols-3">
            {TIERS.map((t) => (
              <TierCard key={t.name} tier={t} />
            ))}
          </div>
        </div>
      </section>

      <Guarantee />
      <PersonalClose />
      <SiteFooter />
    </main>
  );
}

// The value-stack anchor. List what an owner buys to replicate Pocket Agent by
// hand, foot the column honestly, strike it, then drop PA's price under it. The
// range total is the literal sum of the line items below (low ends / high ends)
// — it has to add up, an operator will check the column.
type Replacement = { job: string; tool: string; price: string };

const REPLACEMENTS: Replacement[] = [
  { job: "A part-time assistant to chase the busywork", tool: "executive assistant", price: "$1,500" },
  { job: "A lead list to prospect from", tool: "Apollo / ZoomInfo seat", price: "$79–300" },
  { job: "A CRM to hold the contacts and deals", tool: "HubSpot Starter", price: "$50" },
  { job: "A booking link on your calendar", tool: "Calendly Pro", price: "$12" },
  { job: "Voice notes turned into text", tool: "Otter.ai", price: "$20" },
  { job: "An AI that drafts your emails", tool: "Copy AI / Jasper", price: "$39–99" },
  { job: "A system that nudges the follow-ups", tool: "Followup.cc", price: "$30" },
];

// Low: 1500 + 79 + 50 + 12 + 20 + 39 + 30 = 1,730
// High: 1500 + 300 + 50 + 12 + 20 + 99 + 30 = 2,011
const STACK_TOTAL = "$1,730–$2,011/mo";

function ValueAnchor() {
  return (
    <section className="border-b border-white/5 bg-black/30">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <div className="text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            What you&apos;d pay to bolt this together yourself.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-slate-400">
            Pocket Agent does the job of a stack of tools and a person to drive
            them. Here&apos;s what that stack runs every month — the seats, plus
            the assistant you&apos;d pay to wire them together.
          </p>
        </div>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
          <ul className="divide-y divide-white/5">
            {REPLACEMENTS.map((r) => (
              <li
                key={r.tool}
                className="flex items-baseline justify-between gap-4 py-3.5"
              >
                <span className="min-w-0 text-[15px] text-slate-200">
                  {r.job}
                  <span className="ml-2 text-sm text-slate-500">{r.tool}</span>
                </span>
                <span
                  className="shrink-0 tabular-nums text-[15px] text-slate-400"
                  style={{ fontFamily: MONO_FONT }}
                >
                  {r.price}/mo
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-baseline justify-between gap-4 border-t border-white/10 pt-5">
            <span className="text-base font-semibold text-slate-300">
              Stitched together, every month
            </span>
            <span
              className="tabular-nums text-lg text-slate-500 line-through"
              style={{ fontFamily: MONO_FONT }}
            >
              {STACK_TOTAL}
            </span>
          </div>

          <div className="mt-6 flex flex-col items-start gap-3 rounded-xl border border-accent/30 bg-accent/[0.05] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-base font-semibold text-slate-100">
                Pocket Agent does the same job.
              </div>
              <div className="mt-1 text-sm text-slate-400">
                One chat. Your tools. Your okay before anything goes out.
              </div>
            </div>
            <div className="flex items-baseline gap-1.5 sm:shrink-0">
              <span className="text-3xl font-extrabold text-accent">$37</span>
              <span className="text-sm text-slate-500">/mo</span>
            </div>
          </div>
        </div>

        <p className="mx-auto mt-6 max-w-xl text-center text-sm leading-relaxed text-slate-500">
          And that stack still can&apos;t talk to itself. Pocket Agent is one
          place that does — and it remembers what you taught it last time.
        </p>
      </div>
    </section>
  );
}

// Eject symbol (triangle over a bar) — the trust mark on every tier card.
function EjectGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent/70"
      fill="currentColor"
    >
      <path d="M8 3.2 13 9H3l5-5.8zM3 11h10v1.6H3z" />
    </svg>
  );
}

function ctaClass(featured?: boolean): string {
  return `inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition hover:scale-[1.02] ${
    featured
      ? "bg-accent text-accent-foreground shadow-[0_0_40px_-12px_rgba(34,211,238,0.7)]"
      : "border border-accent/50 bg-accent/[0.04] text-accent hover:bg-accent/[0.08]"
  }`;
}

function TierCard({ tier }: { tier: Tier }) {
  return (
    <div
      className={`flex flex-col rounded-2xl border p-7 ${
        tier.featured
          ? "border-accent/40 bg-accent/[0.05] shadow-[0_0_50px_-20px_rgba(34,211,238,0.5)]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold uppercase tracking-wider text-accent">
          {tier.name}
        </div>
        {tier.featured ? (
          <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent">
            Most pick this
          </span>
        ) : null}
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-4xl font-extrabold text-slate-100">{tier.price}</span>
        {tier.cadence ? <span className="text-base text-slate-500">{tier.cadence}</span> : null}
      </div>
      <p className="mt-4 text-[15px] font-semibold leading-snug text-slate-100">{tier.tagline}</p>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">{tier.body}</p>
      <ul className="mt-6 space-y-2.5">
        {tier.unlocks.map((u) => (
          <li key={u} className="flex items-start gap-2.5 text-sm text-slate-300">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            {u}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-6">
        <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-3">
          <EjectGlyph />
          <p className="text-[13px] leading-snug text-slate-400">
            <span className="font-semibold text-slate-300">
              Your brain is a git repo on your own GitHub.
            </span>{" "}
            Eject anytime — Pocket Agent stops, your brain doesn&apos;t.
          </p>
        </div>
        <div className="mt-5">
          {tier.cta.external ? (
            <a
              href={tier.cta.href}
              target="_blank"
              rel="noopener noreferrer"
              className={ctaClass(tier.featured)}
            >
              {tier.cta.label}
            </a>
          ) : (
            <Link href={tier.cta.href} className={ctaClass(tier.featured)}>
              {tier.cta.label}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function Guarantee() {
  return (
    <section className="border-b border-white/5 bg-black/30">
      <div className="mx-auto max-w-3xl px-6 py-16 text-center sm:py-20">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          The card on file does nothing until day 15.
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-slate-300">
          You put a card down at signup so there&apos;s no second step later.
          Nothing charges for 14 days. If the first two weeks don&apos;t earn back
          the time you spend setting it up, cancel before day 15 and pay nothing
          — no form, no call, no &ldquo;are you sure.&rdquo;
        </p>
      </div>
    </section>
  );
}

function PersonalClose() {
  return (
    <section className="border-b border-white/5">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <div className="space-y-5 text-lg leading-relaxed text-slate-300">
          <p>
            I price Starter at $37 because the memory alone is worth it, and I
            want you in before you ever think about the bigger plans. Pro is
            where it pays for itself — the work it does in a week is the work
            you&apos;d pay someone to chase down all day.
          </p>
          <p>
            Move up when the business tells you to, not before. If a plan
            isn&apos;t the right shape for you, close the tab — no hard feelings.
            If it is, start free and find out in two weeks.
          </p>
        </div>
        <div className="mt-10">
          <PrimaryCTA />
        </div>
      </div>
    </section>
  );
}
