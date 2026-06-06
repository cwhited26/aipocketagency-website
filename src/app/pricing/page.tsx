import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { PrimaryCTA, MONO_FONT } from "@/components/marketing/cta";

const PAGE_URL = "https://aipocketagency.com/pricing";
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
  cta: { label: string; href: string };
};

const TIERS: Tier[] = [
  {
    name: "Starter",
    price: "$37",
    cadence: "/mo",
    tagline: "The brain.",
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
    tagline: "The operator turns on.",
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
    cta: { label: "Start free for 14 days", href: "/start" },
  },
  {
    name: "Pro+",
    price: "$149",
    cadence: "/mo",
    tagline: "More room to run.",
    body:
      "More tools it can act on, more specialists, and your first agent you can put in front of customers on a private link. For when one team and one inbox stopped being the whole picture.",
    unlocks: [
      "Everything in Pro",
      "More connected tools that can take actions",
      "More specialists for more roles",
      "Your first customer-facing agent (private link)",
    ],
    cta: { label: "Start free for 14 days", href: "/start" },
  },
  {
    name: "Studio",
    price: "$297",
    cadence: "/mo",
    tagline: "Your name on it.",
    body:
      "Every tool connected, an agent embedded on your own website catching leads while you sleep, and your branding instead of ours. For the business with a site, a team, and more work than one person can shepherd.",
    unlocks: [
      "Everything in Pro+",
      "Every tool connected",
      "A chat agent on your own website, capturing leads",
      "Public agents for as many roles as the business needs",
      "White-label — your name, not ours",
    ],
    cta: { label: "Start free for 14 days", href: "/start" },
  },
  {
    name: "Studio+",
    price: "$497",
    cadence: "/mo",
    tagline: "Run them all.",
    body:
      "For owners running more than one site or a growing team — every specialist, every connection, room to run them all at once. The ceiling before custom.",
    unlocks: [
      "Everything in Studio",
      "Widgets and agents across multiple sites",
      "Specialists for a full team's worth of roles",
      "Your own subdomain for the agents you ship",
    ],
    cta: { label: "Start free for 14 days", href: "/start" },
  },
  {
    name: "Enterprise",
    price: "Let's talk",
    tagline: "Past the ceiling.",
    body:
      "Private setup, dedicated infrastructure, as much as your operation needs. If you're already past Studio+, we'll build the plan around you.",
    unlocks: [
      "Everything in Studio+",
      "Dedicated infrastructure",
      "Custom connections and limits",
      "Hands-on setup with the team",
    ],
    cta: { label: "Get in touch", href: "mailto:chase@whited.consulting?subject=Pocket%20Agent%20Enterprise" },
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
      <div className="mt-1 text-sm font-medium text-slate-300">{tier.tagline}</div>
      <p className="mt-4 text-sm leading-relaxed text-slate-400">{tier.body}</p>
      <ul className="mt-6 space-y-2.5">
        {tier.unlocks.map((u) => (
          <li key={u} className="flex items-start gap-2.5 text-sm text-slate-300">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            {u}
          </li>
        ))}
      </ul>
      <div className="mt-7 pt-1">
        <Link
          href={tier.cta.href}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition hover:scale-[1.02] ${
            tier.featured
              ? "bg-accent text-accent-foreground shadow-[0_0_40px_-12px_rgba(34,211,238,0.7)]"
              : "border border-accent/50 bg-accent/[0.04] text-accent hover:bg-accent/[0.08]"
          }`}
        >
          {tier.cta.label}
        </Link>
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
