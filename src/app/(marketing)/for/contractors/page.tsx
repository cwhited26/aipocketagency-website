import type { Metadata } from "next";
import { PersonaLanding, type PersonaPageCopy } from "@/components/marketing/persona-landing";

const PAGE_URL = "https://aipocketagent.com/for/contractors";
const TITLE = "Pocket Agent for Contractors — The Office Work, Done From the Truck";
const DESCRIPTION =
  "Quotes, adjuster chases, customer replies, and past-due invoices — drafted and staged for one-tap approval from the job site. Pocket Agent for roofing, HVAC, remodel, and home services. $37 a month.";

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
  slug: "contractors",
  pill: "Pocket Agent · for contractors",
  h1: "You run crews all day. The office work shouldn’t take your night.",
  sub: "Pocket Agent drafts the quotes, chases the adjusters and the past-due invoices, and answers the customer emails — staged for your approval from the truck between stops.",
  dayIntro:
    "A composite day from contracting companies running Pocket Agent — names changed, hours real. Owner-led crew, jobs across two counties, the office is the front seat of a pickup.",
  without: [
    {
      time: "6:45am",
      body: "The adjuster still hasn’t responded on the Henderson claim. You add it to the mental list. The mental list is full.",
    },
    {
      time: "8:00am",
      body: "A homeowner wants a quote revision. It’ll happen tonight — if you remember.",
    },
    {
      time: "11:30am",
      body: "A supplier emails about a delivery change on tomorrow’s job. You see it at 4pm.",
    },
    {
      time: "3:00pm",
      body: "A lead from the website has been sitting since morning without a reply. She called somebody else.",
    },
    {
      time: "7:30pm",
      body: "Quotes. Invoices. Emails. Dinner goes cold on the counter.",
    },
    {
      time: "10:00pm",
      body: "You remember the permit paperwork for the Coleman job. Tomorrow. Maybe.",
    },
  ],
  withPa: [
    {
      time: "6:45am",
      body: "Your agent chased the adjuster on the Henderson claim — you approved the draft from your phone yesterday. The reply is in, summarized in your morning brief.",
    },
    {
      time: "8:00am",
      body: "The quote revision is drafted from your unit prices. You read it at the first stop and tap send.",
    },
    {
      time: "11:30am",
      body: "The delivery-change email got flagged urgent the moment it landed. The reply is drafted; you approve it from the truck.",
    },
    {
      time: "3:00pm",
      body: "The website lead got a drafted reply with three visit times — you approved it at lunch. She picked Thursday.",
    },
    {
      time: "7:30pm",
      body: "Past-due invoice reminders went out this morning, polite and firm. Two already paid. You eat dinner hot.",
    },
    {
      time: "10:00pm",
      body: "The permit checklist is filed with the Coleman job in your Business Brain. Nothing lives in your head tonight.",
    },
  ],
  handles: [
    "Quotes drafted from your unit prices and your past jobs",
    "Adjuster and insurance chases staged in your voice, thread by thread",
    "Customer replies drafted while you’re on the roof",
    "Website and phone leads answered with a drafted reply before they go cold",
    "Past-due invoice reminders that actually go out — you just tap approve",
    "Job-site photos and voice memos filed to the right job, not your camera roll",
    "Review asks timed to the final walkthrough, when the customer is happiest",
    "Supplier emails triaged — urgent flagged now, the rest summarized in your brief",
    "Permit and warranty paperwork tracked per job",
    "A morning brief before your first stop: what needs you, what’s handled",
  ],
  anchor: {
    heading: "The alternative is an office manager for a one-desk office.",
    body: [
      "An office manager runs $50–65k a year loaded, and most owner-led crews can’t hand them enough hours to justify the desk.",
      "Pocket Agent starts at $37 a month, works nights and weekends, and doesn’t quit in the middle of storm season.",
    ],
  },
};

export default function ContractorsPage() {
  return <PersonaLanding copy={COPY} />;
}
