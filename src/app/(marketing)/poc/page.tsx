// /poc — the about-Poc page (PA-POS-33). Poc is Pocket Agent's character: a friendly alien
// who lives in your pocket and does the work. This page introduces the character; the product
// naming stays "Packaged AI Agents" (PA-POS-16) — Poc is who does the work, not what the
// product is called. Art is the placeholder set at public/avatars/poc/ until Chase's
// illustrated pass lands; copy is voice-checked against voice/chase-spec.md §10 + the Poc bio.

import type { Metadata } from "next";
import Image from "next/image";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { MONO_FONT, PrimaryCTA, SecondaryCTA } from "@/components/marketing/cta";
import { pocArtSrc, type PocVariant } from "@/lib/personas/poc-variants";

const PAGE_URL = "https://aipocketagent.com/poc";
const TITLE = "Meet Poc — Pocket Agent";
const DESCRIPTION =
  "Poc is the alien in your pocket. Every agent you hire in Pocket Agent is Poc in a different role — reading your business, drafting the work, and waiting for your yes.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Meet Poc.",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "Pocket Agent",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Meet Poc.",
    description: DESCRIPTION,
  },
};

// Flip to "/whatsapp" + "Talk to Poc on WhatsApp" when the WhatsApp funnel lane (PA-POS-32)
// lands its marketing page.
const SECONDARY_CTA = { href: "/pricing", label: "See every plan" };

const ROLES: { variant: PocVariant; name: string; blurb: string }[] = [
  {
    variant: "glasses",
    name: "Poc the Researcher",
    blurb:
      "Digs through leads, podcasts, and competitors, then writes up the part that matters to you.",
  },
  {
    variant: "headset",
    name: "Poc the Sales Assistant",
    blurb:
      "Works your pipeline. Drafts the follow-up the day a deal goes quiet, in your voice.",
  },
  {
    variant: "clipboard",
    name: "Poc the Admin",
    blurb:
      "Keeps the calendar, the inbox, and the loose ends off your plate — and shows the work first.",
  },
];

const BEATS: { title: string; body: string }[] = [
  {
    title: "Poc reads your brain",
    body:
      "Every draft starts from your business — your customers, your voice, your past decisions. Not from zero.",
  },
  {
    title: "Poc drafts the work",
    body:
      "Emails, follow-ups, research memos, landing pages. Real work product sitting in your review queue, not a chat transcript.",
  },
  {
    title: "Poc waits for your yes",
    body:
      "Nothing goes out the door until you approve it. Every send, every post, every change is staged for you first.",
  },
  {
    title: "Poc runs where you already are",
    body: "Slack, WhatsApp, Gmail, iMessage. You reply where you already work — no new tab to babysit.",
  },
];

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-5 inline-block text-xs text-cyan-300/70"
      style={{ fontFamily: MONO_FONT }}
    >
      {children}
    </div>
  );
}

export default function PocPage() {
  return (
    <>
      <SiteHeader />
      <main className="text-slate-100">
        {/* HERO */}
        <section className="relative overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 bg-grid opacity-20" aria-hidden />
          <div className="absolute inset-0 bg-hero-glow" aria-hidden />
          <div className="relative mx-auto max-w-3xl px-6 pb-16 pt-20 text-center sm:pt-28">
            <Pill>[ the character inside Pocket Agent ]</Pill>
            <div className="mx-auto mb-8 flex h-48 w-48 items-center justify-center rounded-3xl border border-white/10 bg-[#0a1f28] sm:h-56 sm:w-56">
              <Image
                src={pocArtSrc("default")}
                width={224}
                height={224}
                alt="Poc, Pocket Agent's alien character"
                priority
              />
            </div>
            <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-6xl">
              Meet Poc.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
              Poc lives in your pocket and does the work. Formal name Pocket —
              everyone says Poc.
            </p>
          </div>
        </section>

        {/* WHO IS POC */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              Who is Poc?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-slate-400">
              One alien, every role in your business. When you hire a Packaged AI
              Agent, that&apos;s Poc picking up a different prop.
            </p>
            <div className="mt-12 grid gap-5 sm:grid-cols-3">
              {ROLES.map((role) => (
                <div
                  key={role.variant}
                  className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center"
                >
                  <span className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl bg-[#0a1f28]">
                    <Image
                      src={pocArtSrc(role.variant)}
                      width={112}
                      height={112}
                      alt={role.name}
                    />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-slate-100">
                    {role.name}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {role.blurb}
                  </p>
                </div>
              ))}
            </div>
            <p
              className="mt-8 text-center text-xs text-cyan-300/70"
              style={{ fontFamily: MONO_FONT }}
            >
              [ same character · different props ]
            </p>
          </div>
        </section>

        {/* HOW POC WORKS */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              How Poc works
            </h2>
            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {BEATS.map((beat, i) => (
                <div
                  key={beat.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
                >
                  <div
                    className="text-xs text-cyan-300/70"
                    style={{ fontFamily: MONO_FONT }}
                  >
                    0{i + 1}
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-slate-100">
                    {beat.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {beat.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section>
          <div className="mx-auto max-w-3xl px-6 py-20 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Put Poc to work.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-400">
              Tell Poc about your business once. The drafts start showing up for
              your approval.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <PrimaryCTA href="/start?tier=starter" label="Start for $37" />
              <SecondaryCTA href={SECONDARY_CTA.href} label={SECONDARY_CTA.label} />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
