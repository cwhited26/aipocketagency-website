import type { Metadata } from "next";
import { PersonaLanding, type PersonaPageCopy } from "@/components/marketing/persona-landing";

const PAGE_URL = "https://aipocketagent.com/for/med-spas";
const TITLE = "Pocket Agent for Med Spas — Bookings, Rebooking, and Reviews Between Clients";
const DESCRIPTION =
  "Booking replies, no-show follow-ups, review asks, and promo copy — drafted in your voice, staged for one tap between appointments. Pocket Agent for owner-operator med spas. $37 a month.";

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
  slug: "med-spas",
  pill: "Pocket Agent · for med spas",
  h1: "You’re the injector, the front desk, and the marketing department.",
  sub: "Pocket Agent drafts the booking replies, the no-show follow-ups, the review asks, and the promos — in your voice, staged for approval between clients.",
  dayIntro:
    "A composite day from med spas running Pocket Agent — names changed, hours real. Owner-operator, three treatment rooms, a phone that never stops buzzing in a drawer.",
  without: [
    {
      time: "8:30am",
      body: "Three booking DMs from overnight. You answer them one-thumbed while setting up the first room.",
    },
    {
      time: "11:00am",
      body: "A no-show. No follow-up either — you’re already numbing the next client.",
    },
    {
      time: "1:30pm",
      body: "Lunch goes to drafting an event promo you’re not sure about. You post nothing.",
    },
    {
      time: "4:00pm",
      body: "A patient texts an aftercare question. You answer from memory, mid-appointment, hoping you said it the same way as last time.",
    },
    {
      time: "6:30pm",
      body: "Reviews. You know you should ask today’s happy clients. You never do.",
    },
    {
      time: "9:00pm",
      body: "Tomorrow’s confirmations, sent one by one from the couch.",
    },
  ],
  withPa: [
    {
      time: "8:30am",
      body: "All three booking DMs have drafted replies with real open times from your calendar. You approve them while the room warms up.",
    },
    {
      time: "11:00am",
      body: "The no-show gets a warm rebooking text — drafted, staged, approved in one tap between clients.",
    },
    {
      time: "1:30pm",
      body: "Your Marketing AI Agent drafted the event promo from your actual services and prices. You change one line and approve. Lunch is lunch.",
    },
    {
      time: "4:00pm",
      body: "The aftercare reply is drafted from your own protocols — the ones in your Business Brain, not the internet’s. Same answer every time.",
    },
    {
      time: "6:30pm",
      body: "Review asks staged for the three clients who left glowing. You approve all three at the front desk.",
    },
    {
      time: "9:00pm",
      body: "Tomorrow’s confirmations were staged this afternoon; you approved them from the treatment room. The couch is off the clock.",
    },
  ],
  handles: [
    "Booking inquiries answered with real open times, staged for one tap",
    "No-show and cancellation follow-ups that get people rebooked",
    "Review asks timed to the visits that went well",
    "Promo and event copy drafted from your actual services and prices",
    "Aftercare replies drafted from your own protocols, consistent every time",
    "Membership and package renewal reminders staged before they lapse",
    "New-client intake follow-ups so nobody falls through after a consult",
    "Instagram captions in your voice, not a template’s",
    "Supplier and equipment emails triaged out of your treatment hours",
    "A morning brief before your first appointment: who’s coming, what needs you",
  ],
  anchor: {
    heading: "The alternative is a front-desk hire who can’t write your Instagram.",
    body: [
      "A front-desk hire runs $38–48k a year, covers the hours she’s in the building, and the marketing still lands on you.",
      "Pocket Agent starts at $37 a month and covers the desk work, the follow-ups, and the promos — you approve everything between clients.",
    ],
  },
};

export default function MedSpasPage() {
  return <PersonaLanding copy={COPY} />;
}
