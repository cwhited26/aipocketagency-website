// /cancel/[reason] — the matching save option (Part 5J). Server component resolves the reason + option;
// the interactive bits (log the intent on view, "Cancel Anyway" → confirm) live in the client child.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { reasonBySlug, SAVE_OPTIONS } from "@/lib/cancel/flow";
import { CancelReasonClient } from "./CancelReasonClient";

export const metadata: Metadata = {
  title: "Before you cancel — Pocket Agent",
  robots: { index: false },
};

export default function CancelReasonPage({ params }: { params: { reason: string } }) {
  const reason = reasonBySlug(params.reason);
  if (!reason) notFound();
  const option = SAVE_OPTIONS[reason.option];

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-16 text-neutral-100">
      <div className="mx-auto max-w-xl">
        <Link href="/cancel" className="text-sm text-neutral-500 hover:text-neutral-300">
          ← Back
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">{option.headline}</h1>
        <div className="mt-4 space-y-3 text-neutral-300">
          {option.copy.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>

        <div className="mt-8">
          <Link
            href={option.cta.href}
            className="inline-block rounded-lg bg-emerald-400 px-5 py-3 font-semibold text-neutral-950 transition hover:bg-emerald-300"
          >
            {option.cta.label}
          </Link>
        </div>

        <CancelReasonClient reason={reason.slug} secondaryLabel={option.secondaryLabel} />
      </div>
    </main>
  );
}
