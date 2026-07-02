import type { Metadata } from "next";
import Link from "next/link";
import {
  BUNDLE_PUBLIC_USD,
  KIT_CONFIG,
  KIT_RETAIL_USD,
  KIT_SLUGS,
} from "@/lib/kit-config";

const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

const PAGE_URL = "https://aipocketagent.com/bundle";

export const metadata: Metadata = {
  title: "The APA Bundle — All 5 kits, $60 | Pocket Agent",
  description:
    "All 5 Pocket Agent kits bundled — Dispatch, Dev-Team Document Set, CLAUDE.md Template Library, Discovery → MVP Prompt Pack, Wire-the-Brain-to-Stack. $60 instead of $75 buying them one at a time.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "The APA Bundle — All 5 kits, $60",
    description:
      "All 5 Pocket Agent kits bundled — $60 instead of $75 buying them one at a time.",
    url: PAGE_URL,
    siteName: "Pocket Agent",
    type: "website",
    images: [
      {
        url: "https://aipocketagent.com/og-share.png",
        width: 1200,
        height: 630,
        alt: "Pocket Agent — the bundle of 5 kits",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The APA Bundle — All 5 kits, $60",
    description:
      "All 5 Pocket Agent kits bundled — $60 instead of $75 buying them one at a time.",
    images: ["https://aipocketagent.com/og-share.png"],
  },
};

export default function BundlePage() {
  const kits = KIT_SLUGS.map((s) => KIT_CONFIG[s]);
  const individualTotalUsd = kits.length * KIT_RETAIL_USD;
  const savingUsd = individualTotalUsd - BUNDLE_PUBLIC_USD;
  const entryKit = KIT_CONFIG["dispatch-playbook"];

  return (
    <main className="min-h-screen text-slate-100">
      <div className="border-b border-white/5 bg-black/60 px-6 py-3">
        <p className="mx-auto max-w-3xl text-center text-sm leading-snug text-slate-400">
          Buy the bundle if you want the docs.{" "}
          <Link href="/start" className="font-medium text-accent underline-offset-4 hover:underline">
            Start Pocket Agent
          </Link>{" "}
          if you want the system running.
        </p>
      </div>
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
        <div className="absolute inset-0 bg-hero-glow" aria-hidden />
        <div className="relative mx-auto max-w-3xl px-6 pb-16 pt-20 sm:pt-28">
          <div className="flex flex-col items-center text-center">
            <div
              className="mb-4 whitespace-nowrap text-xs text-cyan-300/70 sm:text-sm"
              style={{ fontFamily: MONO_FONT }}
            >
              [ ${BUNDLE_PUBLIC_USD} · all 5 kits · instant download ]
            </div>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
              <span className="bg-gradient-to-r from-accent via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
                The full playbook stack — bundled once.
              </span>
            </h1>
            <p className="mt-6 text-balance text-lg text-slate-200 sm:text-xl">
              Five $15 kits buy one at a time = ${individualTotalUsd}.
              Bundled together = ${BUNDLE_PUBLIC_USD}. Save ${savingUsd} — one
              kit free, on the house.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-white/5 bg-black/30">
        <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
          <SectionLabel>what&apos;s inside</SectionLabel>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Five kits. One zip. Same artifacts I run on every client build.
          </h2>
          <ol className="mt-10 space-y-3">
            {kits.map((k, i) => (
              <li
                key={k.slug}
                className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6"
              >
                <span
                  className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent"
                  style={{ fontFamily: MONO_FONT }}
                >
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="text-base font-semibold leading-tight text-slate-100 sm:text-lg">
                    {k.fullName}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400 sm:text-base">
                    {k.blurb}
                  </p>
                </div>
                <div
                  className="hidden whitespace-nowrap text-xs text-slate-500 sm:block"
                  style={{ fontFamily: MONO_FONT }}
                >
                  ${KIT_RETAIL_USD}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="relative overflow-hidden border-b border-white/5 bg-gradient-to-b from-accent/5 via-transparent to-transparent">
        <div className="absolute inset-0 bg-hero-glow" aria-hidden />
        <div className="relative mx-auto max-w-xl px-6 py-20 sm:py-24">
          <div className="text-center">
            <SectionLabel>how to get it</SectionLabel>
            <h2 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
              ${BUNDLE_PUBLIC_USD} for the full stack. Save ${savingUsd}{" "}
              against buying each one separately.
            </h2>
            <p className="mt-6 text-base leading-relaxed text-slate-300 sm:text-lg">
              The bundle is offered inside the checkout funnel of any kit.
              Start with the Dispatch Playbook — fill the two-question form,
              and the bundle offer surfaces before payment. Same instant
              download. Same refund-on-reply guarantee. One zip, all five
              kits.
            </p>
            <div className="mt-10">
              <Link
                href={`/${entryKit.slug}#form`}
                className="group inline-flex items-center gap-3 rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)] sm:text-lg"
              >
                <span>Start with the Dispatch Playbook</span>
                <svg
                  aria-hidden
                  viewBox="0 0 20 20"
                  className="h-5 w-5 transition group-hover:translate-x-1"
                  fill="currentColor"
                >
                  <path d="M7.05 4.05a1 1 0 011.414 0l5.243 5.243a1 1 0 010 1.414l-5.243 5.243a1 1 0 01-1.414-1.414L11.586 11H3a1 1 0 110-2h8.586L7.05 5.464a1 1 0 010-1.414z" />
                </svg>
              </Link>
            </div>
            <p
              className="mt-6 text-xs text-slate-500"
              style={{ fontFamily: MONO_FONT }}
            >
              [ bundle offered at checkout · ${BUNDLE_PUBLIC_USD} vs $
              {individualTotalUsd} separately ]
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-white/5 bg-gradient-to-b from-accent/[0.04] via-transparent to-transparent">
        <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20 text-center">
          <SectionLabel>want it running automatically?</SectionLabel>
          <h2 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
            Pocket Agent runs them.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-300">
            The bundle teaches the patterns. Pocket Agent is the hosted software
            that keeps everything running — connected to your tools, every
            playbook in one place, every capability active from day one.
            $37/mo, 14-day free trial.
          </p>
          <div className="mt-8">
            <Link
              href="/start"
              className="inline-flex items-center gap-3 rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)] sm:text-lg"
            >
              Start your 14-day free trial
              <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
                <path d="M7.05 4.05a1 1 0 011.414 0l5.243 5.243a1 1 0 010 1.414l-5.243 5.243a1 1 0 01-1.414-1.414L11.586 11H3a1 1 0 110-2h8.586L7.05 5.464a1 1 0 010-1.414z" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-black/40">
        <div className="mx-auto max-w-3xl px-6 py-12 text-center">
          <p className="text-sm leading-relaxed text-slate-400">
            Delivered as PDF + markdown to the email used at checkout. If it
            doesn&apos;t land within minutes, full refund — just reply to the
            receipt.
          </p>
        </div>
        <div className="border-t border-white/5">
          <div className="mx-auto max-w-5xl px-6 py-4 text-xs text-slate-600">
            © {new Date().getFullYear()} Whited Consulting. All rights
            reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-4 whitespace-nowrap text-xs text-cyan-300/70 sm:text-sm"
      style={{ fontFamily: MONO_FONT }}
    >
      [ {children} ]
    </div>
  );
}
