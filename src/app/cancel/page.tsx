// /cancel — the save-flow entry. "Before you cancel, what happened?" + the 9 reason picker (Part 5J).
// Each reason links to /cancel/<slug>, which shows the matching save option.

import type { Metadata } from "next";
import Link from "next/link";
import { CANCEL_HEADLINE, CANCEL_REASONS } from "@/lib/cancel/flow";

export const metadata: Metadata = {
  title: "Before you cancel — Pocket Agent",
  robots: { index: false },
};

export default function CancelPage() {
  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-16 text-neutral-100">
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-semibold">{CANCEL_HEADLINE}</h1>
        <p className="mt-3 text-neutral-400">
          Pick the closest reason. This is not aggressive — it helps us point you at the fastest fix.
        </p>
        <ul className="mt-8 space-y-3">
          {CANCEL_REASONS.map((r) => (
            <li key={r.slug}>
              <Link
                href={`/cancel/${r.slug}`}
                className="block rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 transition hover:border-emerald-500/60 hover:bg-neutral-800"
              >
                {r.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
