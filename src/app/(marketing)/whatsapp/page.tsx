// /whatsapp — the cold-traffic doorway (PA-POS-32 §22.5). Parallel entry to /pricing: cold
// traffic gets the WhatsApp path, warm traffic gets tier signup. The CTA deep-links into a
// wa.me thread with the composable first message pre-filled; when the PA public number env
// isn't set yet (Meta Business Verification pending), the page renders the coming-soon
// fallback instead of a dead link.

import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { MONO_FONT } from "@/components/marketing/cta";
import { publicWhatsappNumber } from "@/lib/onboarding/whatsapp-cold/config";

const PAGE_URL = "https://aipocketagent.com/whatsapp";
const DESCRIPTION =
  "No app to download. No signup. Text Poc on WhatsApp, watch it do real work for your business, and only pay when you want to keep it.";

export const metadata: Metadata = {
  title: "Text Poc on WhatsApp — Pocket Agent",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "No app to download. No signup. Text Poc.",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "Pocket Agent",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "No app to download. No signup. Text Poc.",
    description: DESCRIPTION,
  },
};

const PREFILL = "Setup a Sales agent for me";

function waMeUrl(number: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(PREFILL).replace(/%20/g, "+")}`;
}

const STEPS: ReadonlyArray<{ label: string; title: string; body: string }> = [
  {
    label: "you text",
    title: "Describe the job in one message",
    body: `"${PREFILL}." That's the whole setup. Poc composes the agent from Pocket Agent's shipped parts and replies in the same thread.`,
  },
  {
    label: "poc works",
    title: "Real drafts before any account exists",
    body: "Follow-up emails, review replies, lead lists — delivered as previews in the thread. No OAuth screens, no forms, no card on file.",
  },
  {
    label: "you decide",
    title: "Keep it by saving its brain",
    body: "After Poc has done real work, one link saves its brain to your own GitHub repo — $37/mo. Cancel and the repo still opens. Everything it learned stays yours.",
  },
];

export default function WhatsappPage() {
  const number = publicWhatsappNumber();

  return (
    <>
      <SiteHeader />
      <main className="text-slate-100">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 bg-grid opacity-20" aria-hidden />
          <div className="relative mx-auto max-w-4xl px-6 pb-16 pt-20 text-center sm:pt-24">
            <div
              className="mb-4 inline-block text-xs text-cyan-300/70"
              style={{ fontFamily: MONO_FONT }}
            >
              [ the whatsapp doorway ]
            </div>
            <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-6xl">
              No app to download. No signup. Text Poc.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
              Poc is the alien in your pocket — it runs your follow-ups, your inbox,
              your socials, from a WhatsApp thread. Your first message composes the
              agent. The work starts before any account exists.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3">
              {number ? (
                <a
                  href={waMeUrl(number)}
                  className="inline-flex items-center gap-3 rounded-xl bg-[#25D366] px-8 py-4 text-lg font-bold text-[#05070a] transition hover:brightness-110"
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden>
                    <path d="M12 2a10 10 0 0 0-8.66 15L2 22l5.16-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-2.96-.4-4.24-1.14l-.3-.18-3.06.77.8-2.98-.2-.31A8.2 8.2 0 1 1 12 20.2Zm4.52-6.13c-.25-.12-1.47-.72-1.7-.8-.22-.09-.39-.13-.55.12-.17.25-.64.8-.78.97-.14.16-.29.18-.53.06a6.7 6.7 0 0 1-3.35-2.93c-.25-.43.25-.4.72-1.34.08-.16.04-.3-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.42-.55-.42h-.47c-.16 0-.43.06-.65.3-.22.25-.86.84-.86 2.05 0 1.2.88 2.37 1 2.53.12.17 1.73 2.64 4.2 3.7.59.26 1.05.4 1.4.52.6.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.17-.48-.29Z" />
                  </svg>
                  Text Poc on WhatsApp
                </a>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/5 px-8 py-4">
                  <div className="text-lg font-bold text-slate-200">
                    Coming soon — waitlist
                  </div>
                  <p className="mt-1 text-sm text-slate-400">
                    Poc&apos;s public number is in Meta business verification. The
                    workspace is open now — start there and the WhatsApp thread joins
                    your plan the day the number is live.
                  </p>
                </div>
              )}
              <Link
                href="/pricing"
                className="text-sm text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline"
              >
                Rather start in the workspace? See pricing
              </Link>
            </div>
          </div>
        </section>

        {/* The three steps */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <div className="grid gap-6 sm:grid-cols-3">
              {STEPS.map((step) => (
                <div
                  key={step.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <div
                    className="text-xs text-cyan-300/70"
                    style={{ fontFamily: MONO_FONT }}
                  >
                    [ {step.label} ]
                  </div>
                  <h2 className="mt-3 text-lg font-bold">{step.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Ownership frame (PA-POS-19) */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-4xl px-6 py-16 text-center">
            <h2 className="text-balance text-2xl font-extrabold tracking-tight sm:text-3xl">
              You own the stack. You rent the workers.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-300">
              Every other agent keeps your business memory inside the vendor&apos;s
              database — cancel, and it dies with the subscription. Poc&apos;s brain
              saves to your own GitHub repo, in files you can read, fork, and walk
              away with. Cancel Pocket Agent tomorrow and the repo still opens.
            </p>
            <div className="mt-8">
              {number ? (
                <a
                  href={waMeUrl(number)}
                  className="inline-flex items-center rounded-xl bg-[#25D366] px-6 py-3 font-bold text-[#05070a] transition hover:brightness-110"
                >
                  Text Poc on WhatsApp
                </a>
              ) : (
                <Link
                  href="/pricing"
                  className="inline-flex items-center rounded-xl bg-cyan-400 px-6 py-3 font-bold text-[#05070a] transition hover:brightness-110"
                >
                  See pricing
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
