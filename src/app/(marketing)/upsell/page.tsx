import type { Metadata } from "next";
import { SiteFooter } from "@/components/marketing/site-nav";
import UpsellOffer from "./UpsellOffer";

const PAGE_URL = "https://aipocketagent.com/upsell";

export const metadata: Metadata = {
  title: "Want us to set it up for you? — Pocket Agent",
  description:
    "Done-With-You Setup: we build your Business Brain, configure your Personas, set up your first workflow, and get on a call with you. Skip the setup week.",
  alternates: { canonical: PAGE_URL },
  robots: { index: false },
};

export default function UpsellPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const sessionId = searchParams.session_id ?? null;

  return (
    <>
      <main className="text-slate-100">
        <section className="relative overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 bg-grid opacity-20" aria-hidden />
          <div className="relative mx-auto max-w-3xl px-6 pb-12 pt-20 text-center sm:pt-24">
            <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-5xl">
              Want us to set the whole thing up for you?
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
              You’ve got the workspace and the Launch Kit — you can set it up
              yourself this week, and most owners do. But if you’d rather hand it
              off: we’ll build your Business Brain from your real business,
              configure your Personas, set up your first workflow, and get on a
              call with you to make sure it’s running. You skip the setup week
              and go straight to working agents.
            </p>
          </div>
        </section>

        <section className="border-b border-white/5">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <UpsellOffer sessionId={sessionId} />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
