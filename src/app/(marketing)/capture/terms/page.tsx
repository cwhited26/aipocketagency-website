import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/marketing/site-nav";

const PAGE_URL = "https://aipocketagent.com/capture/terms";

export const metadata: Metadata = {
  title: "Pocket Capture — Terms & Refund Policy",
  description:
    "Pocket Capture terms of service and the 30-day money-back guarantee. No questions asked.",
  alternates: { canonical: PAGE_URL },
};

// PC-MARK-2 / PA-CAPTURE-1 (SPEC PC-Q8). The refund window is 30 days from purchase, measured by the
// same clock the webhook ledgers (the Stripe charge). Keep this copy in sync with
// POCKET_CAPTURE_REFUND_WINDOW_DAYS in src/lib/pocket-capture/product.ts.
const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: "1. What you’re buying",
    body: [
      "Pocket Capture is a one-time $47 purchase that gives you the capture surfaces — Share Sheet, iOS Shortcut voice, email forwarding, and SMS — feeding a private feed only you can see. It is a standalone product built on Pocket Agent’s infrastructure. Your captures are yours.",
    ],
  },
  {
    heading: "2. 30-day money-back guarantee",
    body: [
      "If Pocket Capture isn’t for you, you get a full refund within 30 days of your purchase. No questions asked.",
      "The 30 days run from the moment your payment clears, whether or not you’ve finished setup. To request a refund, reply to your purchase confirmation email or contact us before the window closes, and we’ll return the full $47 to your original payment method.",
    ],
  },
  {
    heading: "3. Your data",
    body: [
      "Your captures are private to you. We don’t sell them, and we don’t train on them. If you ever stop using Pocket Capture, your captures stay yours — and if you upgrade to Pocket Agent, they become the foundation of your brain.",
    ],
  },
  {
    heading: "4. Upgrades",
    body: [
      "Pocket Capture stays included free as part of any paid Pocket Agent subscription. Upgrading is optional — Pocket Capture works on its own for as long as you want it to.",
    ],
  },
  {
    heading: "5. Contact",
    body: [
      "Questions about your purchase, a refund, or your data? Reply to any email from us, or reach out through aipocketagent.com. A real person answers.",
    ],
  },
];

export default function CaptureTermsPage() {
  return (
    <>
      <main className="text-slate-100">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-10" aria-hidden />
          <div className="relative mx-auto max-w-2xl px-6 pb-20 pt-24 sm:pt-28">
            <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
              Pocket Capture — Terms &amp; Refund Policy
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-400">
              The short version: it’s $47 once, your captures are private, and you have 30 days to get
              every cent back if it’s not for you.
            </p>

            <div className="mt-10 space-y-8">
              {SECTIONS.map((s) => (
                <div key={s.heading}>
                  <h2 className="text-lg font-semibold text-slate-100">{s.heading}</h2>
                  {s.body.map((p, i) => (
                    <p key={i} className="mt-3 text-sm leading-relaxed text-slate-400">
                      {p}
                    </p>
                  ))}
                </div>
              ))}
            </div>

            <div className="mt-12">
              <Link
                href="https://capture.aipocketagent.com"
                className="text-sm font-semibold text-cyan-300 transition hover:underline"
              >
                ← Back to Pocket Capture
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
