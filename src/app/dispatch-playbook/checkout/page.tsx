import type { Metadata } from "next";
import CheckoutForm from "./CheckoutForm";

const PAGE_URL = "https://aipocketagency.com/dispatch-playbook/checkout";
const PAGE_TITLE =
  "Checkout — The Dispatch Playbook ($15) | AI Pocket Agency";
const PAGE_DESCRIPTION =
  "One step from the Playbook. Drop your info, pay $15, and the PDF + markdown bundle lands in your inbox the moment Stripe confirms payment.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  robots: { index: false, follow: false },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    siteName: "AI Pocket Agency",
    type: "website",
    images: [
      {
        url: "https://aipocketagency.com/og-share.png",
        width: 1200,
        height: 630,
        alt: "The Dispatch Playbook — $15 instant download",
      },
    ],
  },
};

const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

export default function Page({
  searchParams,
}: {
  searchParams: { cancelled?: string };
}) {
  const cancelled = searchParams?.cancelled === "1";
  return (
    <main className="min-h-screen text-slate-100">
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
        <div className="absolute inset-0 bg-hero-glow" aria-hidden />
        <div className="relative mx-auto max-w-xl px-6 pb-20 pt-20 sm:pt-28">
          <div className="flex flex-col items-center text-center">
            <div
              className="mb-4 whitespace-nowrap text-xs text-cyan-300/70 sm:text-sm"
              style={{ fontFamily: MONO_FONT }}
            >
              [ checkout · $15 ]
            </div>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              <span className="bg-gradient-to-r from-accent via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
                One step from the Playbook.
              </span>
            </h1>
            <p className="mt-6 text-balance text-lg text-slate-300 sm:text-xl">
              Drop your info. Pay $15. PDF + markdown land in your inbox the
              moment Stripe confirms.
            </p>
          </div>

          {cancelled ? (
            <div
              className="mx-auto mt-8 max-w-md rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-4 text-center text-sm text-amber-200"
              role="status"
            >
              Checkout cancelled — no charge made. Re-submit when you&apos;re
              ready.
            </div>
          ) : null}

          <div className="mx-auto mt-10 max-w-md">
            <CheckoutForm />
          </div>

          <p className="mx-auto mt-6 max-w-md text-center text-xs text-slate-500">
            We never share your info. Used only to deliver the Playbook and
            send occasional updates.
          </p>
        </div>
      </section>
    </main>
  );
}
