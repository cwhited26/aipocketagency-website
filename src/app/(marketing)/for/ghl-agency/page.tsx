import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { MONO_FONT, Arrow } from "@/components/marketing/cta";
import { GhlWaitlistForm } from "./waitlist-form";

// /for/ghl-agency — the design-partner waitlist surface for Pocket Agent for GHL Agencies
// (SPEC v1 §7-§9, Ship 3). Waitlist framing on purpose: HighLevel publicly confirmed their own
// MCP + Public API for mid-August 2026, so the connector builds on their substrate the day it
// lands. This page captures the first 5 design-partner agencies before the build starts.

const PAGE_URL = "https://aipocketagent.com/for/ghl-agency";
const TITLE = "Pocket Agent for GHL Agencies — The brain layer for your GHL portfolio.";
const DESCRIPTION =
  "Manage every GHL client from one AI partner. Cross-client memory, bulk operations, drafted weekly reports, review replies in each client's voice. Design-partner waitlist open.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "Pocket Agent",
    type: "website",
    images: [{ url: "https://aipocketagent.com/og-share.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["https://aipocketagent.com/og-share.png"],
  },
};

function ReserveCTA({ className = "" }: { className?: string }) {
  return (
    <a
      href="#reserve"
      className={`group inline-flex items-center justify-center gap-3 rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)] sm:text-lg ${className}`}
    >
      <span>Reserve your seat</span>
      <Arrow className="hidden h-5 w-5 transition group-hover:translate-x-1 sm:inline" />
    </a>
  );
}

const PAINS: Array<{ pain: string; answer: string }> = [
  {
    pain: "Every client onboarding takes 5–20 hours.",
    answer: "Describe the new client. Pocket Agent runs your standard setup — you approve each step.",
  },
  {
    pain: "Same funnel built 30 times.",
    answer: "Design it once, deploy to the clients you pick, one approval fans it out.",
  },
  {
    pain: "Reviews eat your Sundays.",
    answer: "30 clients, 30 personalized replies drafted in each client's voice. You approve.",
  },
  {
    pain: "Weekly client reports drain 3–4 hours.",
    answer: "Pocket Agent drafts them Sunday night. You review and send Monday morning.",
  },
  {
    pain: "No memory across clients.",
    answer: "Your brain remembers what each client sold, wanted, tried, and hated — forever.",
  },
];

const TIERS: Array<{
  name: string;
  price: string;
  cap: string;
  note?: string;
  recommended?: boolean;
}> = [
  {
    name: "Business Agent",
    price: "$97/mo",
    cap: "1 client sub-account via a $50 / 7-day GHL Project Pass",
    note: "Proof of concept only.",
  },
  { name: "Pro+", price: "$149/mo", cap: "Up to 3 client sub-accounts" },
  { name: "Studio", price: "$297/mo", cap: "Up to 10 client sub-accounts" },
  {
    name: "Studio+",
    price: "$497/mo",
    cap: "Up to 25 client sub-accounts",
    recommended: true,
  },
  { name: "Enterprise", price: "custom", cap: "25+ clients" },
];

const PARTNER_TERMS: Array<{ head: string; body: string }> = [
  {
    head: "50% off Studio+ for 6 months",
    body: "$248.50 a month instead of $497. That's $1,491 back in your pocket over the window.",
  },
  {
    head: "Direct Slack channel with Chase",
    body: "Not a support queue. The founder, in a channel with your team, while the connector gets built.",
  },
  {
    head: "Design-partner input into the connector",
    body: "The workflows you actually run decide what ships first.",
  },
  {
    head: "Case-study rights",
    body: "You share your numbers after 90 days of real use, we amplify your agency. Verified results only.",
  },
  {
    head: "Grandfathered pricing",
    body: "After the first 6 months, your rate is locked. Design partners never pay list. Ever.",
  },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "When will this actually work?",
    a: "When HighLevel ships their MCP — they've publicly confirmed mid-August. We're building on their substrate the day it lands, alongside the design partners on this list.",
  },
  {
    q: "Why aren't you building it now?",
    a: "Because HighLevel's MCP will replace anything we build on a REST connector today. We wait, we build once, we build right.",
  },
  {
    q: "What happens between now and launch?",
    a: "You get design-partner access — direct input into what ships, build updates in the Slack channel every week, and first look at the GHL Persona templates and Skills library.",
  },
  {
    q: "What if HighLevel's MCP slips?",
    a: "We ship the same architecture through a public REST fallback on their existing API. The date moves; the product doesn't.",
  },
  {
    q: "Can I use it with clients on Agency Pro / SaaS plans?",
    a: "Yes. Any GHL sub-account you manage.",
  },
  {
    q: "What if I only have 1 client?",
    a: "Business Agent tier plus the $50 GHL Project Pass. Proof of concept before you commit to a bigger tier.",
  },
];

export default function GhlAgencyPage() {
  return (
    <>
      <SiteHeader />
      <main className="text-slate-100">
        {/* HERO */}
        <section className="relative overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
          <div className="absolute inset-0 bg-hero-glow" aria-hidden />
          <div className="relative mx-auto max-w-3xl px-6 pb-16 pt-20 text-center sm:pb-20 sm:pt-24">
            <div className="mb-5 inline-block text-xs text-cyan-300/70" style={{ fontFamily: MONO_FONT }}>
              [ For GHL agency owners ]
            </div>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              GHL without the learning curve.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
              Pocket Agent is the brain layer for your GHL portfolio. Every client, every campaign,
              every follow-up — one AI partner that remembers what your agency does.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3">
              <ReserveCTA />
              <p className="text-sm text-slate-400">
                First 5 agencies get 50% off Studio+ for 6 months.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 1 — WHAT IT DOES */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Not another GHL replacement. The layer above.
            </h2>
            <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-slate-300">
              <p>
                You install one connection. Every client sub-account you manage shows up as a client
                folder in your own Business Brain — with their voice, their offers, their campaign
                history, their preferences.
              </p>
              <p>
                Your GHL Operator persona runs the repetitive work across every client. Bulk
                operations fan out with one approval. Weekly reports draft themselves. Reviews get
                replies in each client&rsquo;s voice. Every action stages for you to approve before
                it fires.
              </p>
            </div>
            <div className="mt-8 rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.04] p-6">
              <p className="text-[15px] leading-relaxed text-slate-200">
                <span className="font-semibold text-cyan-300" style={{ fontFamily: MONO_FONT }}>
                  When it ships:
                </span>{" "}
                the day HighLevel&rsquo;s public MCP + API drops — they&rsquo;ve publicly confirmed
                mid-August 2026. The waitlist opens today.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 2 — THE 5 PAINS */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-4xl px-6 py-20">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              The five jobs it takes off your plate.
            </h2>
            <div className="mt-10 space-y-4">
              {PAINS.map((p) => (
                <div
                  key={p.pain}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:flex sm:items-baseline sm:gap-6"
                >
                  <p className="font-semibold text-slate-100 sm:w-2/5">{p.pain}</p>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-300 sm:mt-0 sm:w-3/5">
                    {p.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 3 — PRICING */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-4xl px-6 py-20">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">The pricing.</h2>
            <p className="mt-4 text-slate-400">You keep your GHL plan. Pocket Agent sits on top.</p>
            <div className="mt-10 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[15px]">
                <thead>
                  <tr
                    className="text-xs uppercase tracking-wider text-slate-500"
                    style={{ fontFamily: MONO_FONT }}
                  >
                    <th className="pb-4 pr-6 font-medium">Tier</th>
                    <th className="pb-4 pr-6 font-medium">Price</th>
                    <th className="pb-4 font-medium">GHL client cap</th>
                  </tr>
                </thead>
                <tbody>
                  {TIERS.map((t) => (
                    <tr
                      key={t.name}
                      className={`border-t border-white/5 ${t.recommended ? "bg-cyan-300/[0.05]" : ""}`}
                    >
                      <td className="py-4 pr-6 font-semibold text-slate-100">
                        {t.name}
                        {t.recommended ? (
                          <span
                            className="ml-3 rounded-full border border-cyan-300/40 px-2.5 py-0.5 text-xs text-cyan-300"
                            style={{ fontFamily: MONO_FONT }}
                          >
                            recommended for most agencies
                          </span>
                        ) : null}
                      </td>
                      <td className="py-4 pr-6 text-slate-200" style={{ fontFamily: MONO_FONT }}>
                        {t.price}
                      </td>
                      <td className="py-4 text-slate-300">
                        {t.cap}
                        {t.note ? <span className="text-slate-500"> {t.note}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* SECTION 4 — THE DESIGN-PARTNER OFFER */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.04] p-8 sm:p-10">
              <div
                className="text-xs uppercase tracking-wider text-cyan-300"
                style={{ fontFamily: MONO_FONT }}
              >
                The design-partner offer
              </div>
              <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                <s className="text-slate-500">$497</s> $248.50/mo for your first 6 months.
              </h2>
              <div className="mt-8 space-y-5">
                {PARTNER_TERMS.map((t) => (
                  <div key={t.head} className="flex gap-3">
                    <span className="mt-0.5 text-cyan-300">✓</span>
                    <div>
                      <p className="font-semibold text-slate-100">{t.head}</p>
                      <p className="mt-1 text-[15px] leading-relaxed text-slate-300">{t.body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-8 font-semibold text-slate-100">Only 5 slots. Filled first-come.</p>
              <p className="mt-2 text-sm text-slate-400">
                Five is the cap because that&rsquo;s how many design-partner relationships Chase can
                run at once — when slot 5 fills, the offer closes.
              </p>
              <div className="mt-8">
                <ReserveCTA />
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5 — FAQ */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Questions, answered.</h2>
            <div className="mt-10 space-y-8">
              {FAQ.map((f) => (
                <div key={f.q}>
                  <h3 className="font-semibold text-slate-100">{f.q}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-300">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 6 — CLOSING CTA + THE FORM */}
        <section id="reserve" className="scroll-mt-20">
          <div className="mx-auto max-w-2xl px-6 py-24">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              Reserve your seat.
            </h2>
            <p className="mt-4 text-center text-slate-400">
              5 slots. Half off Studio+ for 6 months. When they&rsquo;re gone, they&rsquo;re gone.
            </p>
            <div className="mt-10">
              <GhlWaitlistForm />
            </div>
            <p className="mt-8 text-center text-sm text-slate-500">
              Running your own business solo instead?{" "}
              <Link href="/for/agencies" className="text-cyan-300 hover:underline">
                Pocket Agent for agencies
              </Link>{" "}
              covers the non-GHL side.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
