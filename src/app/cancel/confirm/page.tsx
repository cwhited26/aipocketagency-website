// /cancel/confirm — the final confirmation screen shown after a successful cancel.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Subscription canceled — Pocket Agent",
  robots: { index: false },
};

export default function CancelConfirmPage() {
  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-16 text-neutral-100">
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-semibold">Your Pocket Agent subscription has been canceled.</h1>
        <div className="mt-4 space-y-3 text-neutral-300">
          <p>
            If you canceled because you did not finish setup, the fastest path is still: Business Brain.
            Persona. Workflow. Mission Control.
          </p>
          <p>Generic AI starts from zero. Pocket Agent starts from your business.</p>
          <p>We sent a confirmation to your email. You can restart anytime.</p>
        </div>
        <div className="mt-8">
          <Link
            href="/start"
            className="inline-block rounded-lg bg-emerald-400 px-5 py-3 font-semibold text-neutral-950 transition hover:bg-emerald-300"
          >
            Restart Pocket Agent
          </Link>
        </div>
      </div>
    </main>
  );
}
