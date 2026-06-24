import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/marketing/site-nav";
import { PrimaryCTA } from "@/components/marketing/cta";

const PAGE_URL = "https://aipocketagent.com/capture/welcome";

export const metadata: Metadata = {
  title: "Welcome to Pocket Capture",
  description: "Your Pocket Capture purchase is confirmed. Finish setup in about a minute.",
  alternates: { canonical: PAGE_URL },
  robots: { index: false },
};

// The four capture surfaces a Pocket Capture user turns on during onboarding (PC-MARK-3). The
// per-user address + number + Shortcut link are provisioned in the dashboard once they sign in
// (PC-CORE-2 email slug / PC-CORE-3 SMS number / PC-CORE-4 iOS Shortcut), so this confirmation page
// frames them as the next step rather than surfacing not-yet-provisioned values to a guest visitor.
const SURFACES: { icon: string; title: string; body: string }[] = [
  {
    icon: "🔗",
    title: "Share",
    body: "Tap Share in any app and send it straight to Pocket Capture.",
  },
  {
    icon: "🎤",
    title: "Speak",
    body: "Install one iOS Shortcut, then say “Hey Siri, save this.” Eyes up, hands free.",
  },
  {
    icon: "✉️",
    title: "Forward",
    body: "Forward or BCC any email to your personal capture address.",
  },
  {
    icon: "📱",
    title: "Text",
    body: "Text or MMS your personal number from anywhere — the universal fallback.",
  },
];

export default function CaptureWelcomePage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  // session_id is present when Stripe redirected here after a completed checkout. It's used only to
  // confirm the buyer arrived through payment; the durable purchase record is written by the webhook.
  const confirmed = Boolean(searchParams.session_id);

  return (
    <>
      <main className="text-slate-100">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-20" aria-hidden />
          <div className="absolute inset-0 bg-hero-glow" aria-hidden />
          <div className="relative mx-auto max-w-2xl px-6 pb-20 pt-24 text-center sm:pt-32">
            <p className="text-sm font-semibold uppercase tracking-widest text-accent">
              {confirmed ? "Payment confirmed" : "Pocket Capture"}
            </p>
            <h1 className="mt-3 text-balance text-3xl font-extrabold tracking-tight sm:text-5xl">
              You’re in. Pocket Capture is yours.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
              The lowest-friction way to get something out of your head and into a private feed only
              you can see. Setup takes about a minute — finish it in your dashboard and we’ll hand you
              your capture address, your number, and the Shortcut link.
            </p>

            <div className="mx-auto mt-10 grid max-w-md gap-3 sm:grid-cols-2">
              {SURFACES.map((s) => (
                <div
                  key={s.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span aria-hidden className="text-lg">
                      {s.icon}
                    </span>
                    <span className="text-sm font-semibold text-slate-100">{s.title}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.body}</p>
                </div>
              ))}
            </div>

            <div className="mx-auto mt-10 max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left">
              <p className="text-sm font-semibold text-slate-100">Your setup, waiting in the dashboard:</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                <li>📨 Your personal email-forward address — ready to copy into your contacts.</li>
                <li>📞 Your personal capture number — once provisioning finishes.</li>
                <li>⚡ The iOS Shortcut install link — one tap to add Siri voice capture.</li>
              </ul>
            </div>

            <div className="mt-9 flex flex-col items-center gap-4">
              <PrimaryCTA href="/app/captures/onboarding" label="Finish setup — 60 seconds" />
              <Link
                href="/capture/terms"
                className="text-sm font-semibold text-cyan-300 transition hover:underline"
              >
                30-day money-back guarantee →
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
