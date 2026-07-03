import type { Metadata } from "next";
import { UseCasePlaceholder } from "@/components/marketing/use-case-placeholder";
import { FollowUpSweepsShot } from "@/components/marketing/motion-shots/follow-up-sweeps-shot";
import { RitualSchedulerShot } from "@/components/marketing/motion-shots/ritual-scheduler-shot";

const PAGE_URL = "https://aipocketagent.com/use-cases/operations";
const TITLE = "Operations with AI Agents — Pocket Agent";
const DESCRIPTION =
  "Briefs, digests, triage, and rituals that run whether you remember or not. The agents that do this work are in the library today, ready to run.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "Pocket Agent",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function OperationsPage() {
  return (
    <UseCasePlaceholder slug="operations">
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="text-2xl font-semibold tracking-tight">Watch the office run itself</h2>
        <p className="mt-2 max-w-2xl text-slate-400">
          A weekly sweep that drafts the follow-ups, and a ritual that fires Monday at 8:00
          whether you remember or not. Every draft waits for your approval.
        </p>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <FollowUpSweepsShot />
          <RitualSchedulerShot />
        </div>
      </section>
    </UseCasePlaceholder>
  );
}
