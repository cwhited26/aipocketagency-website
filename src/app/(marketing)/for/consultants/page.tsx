import type { Metadata } from "next";
import { PersonaLanding, type PersonaPageCopy } from "@/components/marketing/persona-landing";

const PAGE_URL = "https://aipocketagent.com/for/consultants";
const TITLE = "Pocket Agent for Consultants — Proposals and Follow-up Off Your Billable Hours";
const DESCRIPTION =
  "Proposals, prospect research, status summaries, and the follow-ups that keep slipping — drafted in your voice, staged for approval. Pocket Agent for solo consultants and small firms. $37 a month.";

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

const COPY: PersonaPageCopy = {
  slug: "consultants",
  pill: "Pocket Agent · for consultants",
  h1: "Every hour on proposals and follow-up is an hour you can’t bill.",
  sub: "Pocket Agent drafts the proposals, runs the prospect research, and chases the threads that went quiet — in your voice, staged for your approval, off your billable clock.",
  dayIntro:
    "A composite day from consulting practices running Pocket Agent — names changed, hours real. Solo practice, three active engagements, a pipeline that only moves when you push it.",
  without: [
    {
      time: "7:00am",
      body: "Rewriting the same proposal skeleton for the third time this month, from a doc named final_v4.",
    },
    {
      time: "10:00am",
      body: "Discovery call. You take notes you will never look at again.",
    },
    {
      time: "1:00pm",
      body: "A prospect from two weeks ago never replied. You keep meaning to nudge him. You keep not doing it.",
    },
    {
      time: "3:30pm",
      body: "A client asks for a status summary. You dig through email to reconstruct your own month.",
    },
    {
      time: "6:00pm",
      body: "LinkedIn post drafted, second-guessed, deleted.",
    },
    {
      time: "8:30pm",
      body: "Pipeline review happens in your head, in the shower. Nothing gets written down.",
    },
  ],
  withPa: [
    {
      time: "7:00am",
      body: "The proposal draft is staged — scope, rates, and terms pulled from your past engagements. You tighten the scope section and approve.",
    },
    {
      time: "10:00am",
      body: "Call ends. Your agent turns the notes into a follow-up email and the bones of a case study. Both staged.",
    },
    {
      time: "1:00pm",
      body: "The quiet prospect got a nudge you approved two days ago — Follow-Up Sweeps found the thread. He replied this morning.",
    },
    {
      time: "3:30pm",
      body: "The status summary is drafted from the month’s actual work. You read it once and send it in one tap.",
    },
    {
      time: "6:00pm",
      body: "Three LinkedIn drafts in your voice, built from this week’s client problems with the names stripped. You pick one.",
    },
    {
      time: "8:30pm",
      body: "Mission Control shows the pipeline — who’s warm, who went quiet, what’s staged for tomorrow. You close the laptop.",
    },
  ],
  handles: [
    "Proposals drafted from your rates, your scope patterns, and your past wins",
    "Prospect research briefs in your inbox before every call",
    "Follow-Up Sweeps on every thread that went quiet — quote, intro, or ghosted lead",
    "Discovery-call notes turned into follow-up emails and case-study drafts",
    "Monthly client status summaries built from the work that actually happened",
    "LinkedIn and newsletter drafts from real engagements, names stripped",
    "Invoice reminders staged in your voice, firm without being awkward",
    "Competitor and market scans filed straight into your Business Brain",
    "Referral thank-yous and stay-warm check-ins, timed instead of remembered",
    "Your frameworks, methods, and voice living in files you own — not in a tool you rent",
  ],
  anchor: {
    heading: "The alternative is an analyst you’d spend a year briefing.",
    body: [
      "A junior analyst runs $50–65k a year loaded, and their first year is you teaching them your methods, your rates, and what a good brief looks like.",
      "Pocket Agent starts at $37 a month and starts from your Business Brain — the methods, rates, and client history you’ve already written down once.",
    ],
  },
};

export default function ConsultantsPage() {
  return <PersonaLanding copy={COPY} />;
}
