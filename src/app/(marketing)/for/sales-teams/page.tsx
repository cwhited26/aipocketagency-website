import type { Metadata } from "next";
import { PersonaLanding, type PersonaPageCopy } from "@/components/marketing/persona-landing";

const PAGE_URL = "https://aipocketagent.com/for/sales-teams";
const TITLE = "Pocket Agent for Sales Teams — Every Follow-up Staged Before a Deal Goes Quiet";
const DESCRIPTION =
  "Prospect research, outreach drafts, pipeline reviews, and the follow-up that never slips — in your voice, staged for approval. Pocket Agent for owner-led, sales-heavy businesses. $37 a month.";

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
  slug: "sales-teams",
  pill: "Pocket Agent · for sales teams",
  h1: "Deals don’t die from a no. They die from no follow-up.",
  sub: "Pocket Agent researches your prospects, drafts the outreach and every follow-up in your voice, and keeps the pipeline honest — you approve, it moves.",
  dayIntro:
    "A composite day from owner-led sales teams running Pocket Agent — names changed, hours real. Owner plus two reps, growth gated entirely by outbound.",
  without: [
    {
      time: "7:00am",
      body: "The CRM says 40 open deals. You could name maybe twelve of them.",
    },
    {
      time: "9:00am",
      body: "Cold outreach block. You get through eight emails before the phone rings and the block is over.",
    },
    {
      time: "12:00pm",
      body: "Call with a prospect you didn’t have time to research. You wing it. He can tell.",
    },
    {
      time: "2:30pm",
      body: "A hot lead from last week — you swear you replied. You didn’t.",
    },
    {
      time: "4:30pm",
      body: "Forecast prep: gut feel and a spreadsheet nobody trusts.",
    },
    {
      time: "7:00pm",
      body: "You promise yourself tomorrow is a real prospecting day. Same promise as last week.",
    },
  ],
  withPa: [
    {
      time: "7:00am",
      body: "Your daily brief names the five deals that need attention today and why each one made the list.",
    },
    {
      time: "9:00am",
      body: "Twenty outreach drafts staged, each personalized from Lead Scout research. You approve the batch over coffee.",
    },
    {
      time: "12:00pm",
      body: "The pre-call brief is already in your inbox: his business, his competitors, your angle.",
    },
    {
      time: "2:30pm",
      body: "The hot lead got the follow-up you approved days ago. She’s on your calendar for Thursday.",
    },
    {
      time: "4:30pm",
      body: "Your Sales Manager AI Agent drafted the forecast from the pipeline’s actual state. You adjust two deals.",
    },
    {
      time: "7:00pm",
      body: "Follow-Up Sweeps staged tomorrow’s touches before you left the office. You go home.",
    },
  ],
  handles: [
    "Lead Scout prospect sweeps by vertical and territory",
    "Outreach drafted per lead, in your voice, staged in batches",
    "A drafted follow-up on every thread until it answers — nothing forgotten",
    "Pre-call research briefs on every prospect",
    "Pipeline reviews that name the deals at risk and why",
    "Forecast drafts from pipeline reality, not gut feel",
    "Proposals and quotes drafted from your pricing rules",
    "Call notes filed to the right deal, not a legal pad",
    "Re-engagement drafts for the deals that went dark last quarter",
    "A daily brief that opens the day with the five moves that matter",
  ],
  anchor: {
    heading: "The alternative is an SDR who still forgets the follow-up.",
    body: [
      "An SDR runs $65–80k a year loaded, and the follow-up still slips the week they’re slammed, sick, or interviewing somewhere else.",
      "Pocket Agent starts at $37 a month and never lets a thread go quiet without a staged next touch.",
    ],
  },
};

export default function SalesTeamsPage() {
  return <PersonaLanding copy={COPY} />;
}
