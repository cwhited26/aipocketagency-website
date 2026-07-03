import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { MONO_FONT } from "@/components/marketing/cta";

const PAGE_URL = "https://aipocketagent.com/replay";
const DESCRIPTION =
  "Watch the replay: Build Your AI Team Without Becoming An AI Expert. See how Pocket Agent helps owner-led businesses build a Business Brain, clone-and-customize Personas, use workflow Apps, and review everything from Mission Control.";

export const metadata: Metadata = {
  title: "Replay — Build Your AI Team Without Becoming An AI Expert",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Build Your AI Team Without Becoming An AI Expert",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "Pocket Agent",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Build Your AI Team Without Becoming An AI Expert",
    description: DESCRIPTION,
  },
};

const OFFER_INCLUDES: string[] = [
  "Business Brain Setup Checklist.",
  "3 starter Personas (Admin Assistant. Follow-Up Agent for sales follow-up. Content Creator.)",
  "5 starter workflow templates.",
  "Mission Control Review Checklist.",
  "7-Day Setup Plan.",
  "Access to the Pocket Agent Launchpad on Skool.",
  "30 prebuilt Skills auto-seeded into your Business Brain based on your tier.",
];

const VISIBLE_PLANS: { name: string; price: string; blurb: string; cta: string; href: string }[] = [
  {
    name: "Personal Brain",
    price: "$37/month",
    blurb: "For the solo owner who wants a single brain.",
    cta: "Start My Personal Brain",
    href: "/start?tier=starter",
  },
  {
    name: "Business Agent",
    price: "$97/month",
    blurb: "For the growing operator with active integrations. Most popular starting point.",
    cta: "Build My AI Team",
    href: "/start?tier=pro",
  },
  {
    name: "AI Agent Workspace",
    price: "$497/month",
    blurb:
      "For businesses that want Idea Engine, Lead Scout vertical packs, Decision Roundtable, full cockpit, and all 30 Skills.",
    cta: "Get AI Agent Workspace",
    href: "/start?tier=studio_plus",
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "What if I missed the live training?",
    a: "Watch the replay on this page. The offer is available while the replay is active.",
  },
  {
    q: "What plan should I choose?",
    a: "Start with Personal Brain if you only want a single brain. Start with Business Agent if you want the main business plan with Personas, Apps, and Mission Control. Choose AI Agent Workspace if you want Idea Engine, Lead Scout vertical packs, Decision Roundtable, and the full cockpit.",
  },
  {
    q: "Is the AI Office Launch Kit included?",
    a: "Yes. Every paid subscription includes the AI Office Launch Kit.",
  },
  {
    q: "What is the Pocket Agent Launchpad?",
    a: "It is the Skool implementation hub included with paid subscriptions. It helps you follow the 7-Day Setup Plan and hit 3-3-3 activation.",
  },
  {
    q: "Do I pay API token costs?",
    a: "No. Your plan includes usage allowances for leads, Whisper hours, and sub-agent runs. If you hit a cap, upgrade to the next tier. Studio+ owners who bring their own Anthropic key can see real dollar usage because that is their own LLM spend.",
  },
  {
    q: "What happens after checkout?",
    a: "You log in at app.aipocketagent.com, start your Business Brain, join the Pocket Agent Launchpad, clone your first Persona, install your first workflow, and review in Mission Control.",
  },
];

export default function ReplayPage() {
  // Embed the replay only when a real URL is configured; the fallback page URL would frame itself.
  const replayUrl = process.env.WEBINAR_REPLAY_URL?.trim() || "";

  return (
    <main className="min-h-screen text-slate-100">
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
        <div className="absolute inset-0 bg-hero-glow" aria-hidden />
        <div className="relative mx-auto max-w-3xl px-6 pb-16 pt-20 text-center sm:pt-28">
          <div
            className="mb-4 text-xs uppercase tracking-wider text-cyan-300/70"
            style={{ fontFamily: MONO_FONT }}
          >
            Replay Available
          </div>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Build Your AI Team Without Becoming An AI Expert
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
            Watch the replay to see how Pocket Agent helps owner-led businesses build a Business Brain,
            clone-and-customize trained Personas, use workflow Apps, and review everything from Mission
            Control.
          </p>
          <div className="mt-8">
            <a
              href="#replay-video"
              className="inline-flex items-center justify-center gap-3 rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] sm:text-lg"
            >
              Watch The Replay
            </a>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Generic AI starts from zero. Pocket Agent starts from your business.
          </p>
        </div>
      </section>

      {/* VIDEO */}
      <section id="replay-video" className="border-b border-white/5">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Watch the training before the replay comes down.
          </h2>
          <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
            {replayUrl ? (
              <iframe
                src={replayUrl}
                title="Pocket Agent training replay"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="aspect-video w-full"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-cyan-500/10 to-transparent">
                <span
                  className="text-xs uppercase tracking-wider text-slate-400"
                  style={{ fontFamily: MONO_FONT }}
                >
                  Replay loads here
                </span>
              </div>
            )}
          </div>
          <div className="mt-6 space-y-2 text-center text-slate-300">
            <p>This training shows the Pocket Agent System: Business Brain. Personas. Apps. Mission Control.</p>
            <p>
              You&apos;ll see why generic AI still makes you do the work, how to start with 3-3-3
              activation, and how Idea Engine turns rough ideas into real things on the internet.
            </p>
          </div>
          <div className="mt-6 text-center">
            <Link
              href="/start?tier=pro"
              className="inline-flex items-center justify-center gap-3 rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground transition hover:scale-[1.02] sm:text-lg"
            >
              Build My AI Team
            </Link>
          </div>
        </div>
      </section>

      {/* OFFER */}
      <section className="border-b border-white/5">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Start Pocket Agent and get the AI Office Launch Kit included free.
          </h2>
          <p className="mt-3 text-slate-300">
            The Launch Kit helps you install your first AI team instead of staring at another blank
            tool.
          </p>
          <p className="mt-4 text-slate-300">Every paid Pocket Agent subscription includes the AI Office Launch Kit. Inside, you get:</p>
          <ul className="mt-5 space-y-2.5 text-sm text-slate-300">
            {OFFER_INCLUDES.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <span className="mt-1 text-cyan-300">✓</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <Link
              href="/start?tier=pro"
              className="inline-flex items-center justify-center gap-3 rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground transition hover:scale-[1.02] sm:text-lg"
            >
              Build My AI Team
            </Link>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="border-b border-white/5">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Choose the workspace your business needs now.
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {VISIBLE_PLANS.map((p) => (
              <div
                key={p.name}
                className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-6"
              >
                <div className="text-lg font-semibold text-slate-100">{p.name}</div>
                <div className="mt-1 text-2xl font-extrabold text-slate-100">{p.price}</div>
                <p className="mt-3 flex-1 text-sm text-slate-400">{p.blurb}</p>
                <Link
                  href={p.href}
                  className="mt-5 inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:scale-[1.02]"
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>

          <details className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <summary className="cursor-pointer text-sm font-semibold text-slate-200">See all plans</summary>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <p>Pro+ — $149/month</p>
              <p>Studio — $297/month</p>
              <p>Enterprise — custom</p>
              <p className="pt-2 text-slate-400">Add-ons: PA Sync — $96/year · PA Publish — $200/year</p>
              <p className="pt-2">
                <Link href="/pricing" className="text-accent transition hover:underline">
                  Compare every plan on the pricing page →
                </Link>
              </p>
            </div>
          </details>
        </div>
      </section>

      {/* IDEA ENGINE */}
      <section className="border-b border-white/5">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">The heavy hitter: Idea Engine</h2>
          <div className="mt-5 space-y-3 text-slate-300">
            <p>
              Drop an idea — a voice memo, a podcast you just listened to, a thought you had in the
              shower. Pocket Agent validates whether real people would buy it, plans the version that
              should actually ship, builds it for you, gets a sales page live, and lines up the first 25
              prospects to email. By the time you finish your morning coffee, your idea is a real thing
              on the internet you can show people.
            </p>
            <p>Other tools hand you a blueprint and a stack of prompts you go execute somewhere else.</p>
            <p className="font-semibold text-slate-100">
              The Idea Engine ends with a working website you can share.
            </p>
          </div>
          <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.04] p-5 text-slate-300">
            <p>PaidCreators charges $497 once for the Gameplan you have to execute somewhere else.</p>
            <p className="mt-2">
              Pocket Agent includes Idea Engine in AI Agent Workspace at $497/month — and it actually
              ships the working website for you.
            </p>
          </div>
        </div>
      </section>

      {/* GUARANTEE */}
      <section className="border-b border-white/5">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            The Pocket Agent Implementation Guarantee
          </h2>
          <div className="mt-5 space-y-3 text-slate-300">
            <p>Complete the Launch Kit&apos;s 7-day setup steps.</p>
            <p>
              If you don&apos;t have 3 trained Personas and 3 working workflows inside Pocket Agent by
              day 7, we help you finish the setup.
            </p>
            <p>That is the only guarantee.</p>
            <p className="font-semibold text-slate-100">Implementation, not revenue.</p>
          </div>
          <div className="mt-6">
            <Link
              href="/start?tier=pro"
              className="inline-flex items-center justify-center gap-3 rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground transition hover:scale-[1.02] sm:text-lg"
            >
              Build My AI Team
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-white/5">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Replay FAQ</h2>
          <div className="mt-8 space-y-4">
            {FAQ.map((f) => (
              <details key={f.q} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <summary className="cursor-pointer font-semibold text-slate-100">{f.q}</summary>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-b border-white/5">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Build My AI Team</h2>
          <p className="mt-3 text-slate-300">
            Generic AI starts from zero. Pocket Agent starts from your business.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/start?tier=pro"
              className="inline-flex items-center justify-center gap-3 rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground transition hover:scale-[1.02] sm:text-lg"
            >
              Build My AI Team
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-accent/50 bg-accent/[0.04] px-7 py-4 text-base font-semibold text-accent transition hover:scale-[1.02] sm:text-lg"
            >
              See Plans
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
