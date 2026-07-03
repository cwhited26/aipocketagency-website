import type { Metadata } from "next";
import { PersonaLanding, type PersonaPageCopy } from "@/components/marketing/persona-landing";

const PAGE_URL = "https://aipocketagent.com/for/coaches";
const TITLE = "Pocket Agent for Coaches — Recaps, Check-ins, and Content Handled";
const DESCRIPTION =
  "Session recaps, client check-ins, content, and invoice chases — drafted in your voice, staged for one tap. Pocket Agent for life, business, and executive coaches. $37 a month.";

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
  slug: "coaches",
  pill: "Pocket Agent · for coaches",
  h1: "You signed up to coach people. Not to chase them.",
  sub: "Pocket Agent drafts your session recaps, client check-ins, content, and invoice reminders in your voice — you review, tap approve, and get back to the client in front of you.",
  dayIntro:
    "A composite day from coaching practices running Pocket Agent — names changed, hours real. Solo practice, fourteen active clients, no assistant.",
  without: [
    {
      time: "6:15am",
      body: "Writing this week’s newsletter over coffee instead of prepping for the 8am client.",
    },
    {
      time: "9:30am",
      body: "Session ends. You promised recap notes. They join the four you already owe.",
    },
    {
      time: "12:00pm",
      body: "Tuesday’s discovery-call lead still hasn’t heard back from you. She’s talking to another coach by now.",
    },
    {
      time: "2:30pm",
      body: "Thirty minutes into Instagram trying to remember what you meant to post.",
    },
    {
      time: "5:00pm",
      body: "Two clients need reschedules. You’re playing calendar tennis by text between calls.",
    },
    {
      time: "9:00pm",
      body: "Invoicing. Three clients are past due and you hate sending the reminder, so you don’t.",
    },
  ],
  withPa: [
    {
      time: "6:15am",
      body: "The newsletter draft is waiting — built from last week’s session themes, in your voice. You edit two lines and approve.",
    },
    {
      time: "9:30am",
      body: "Session ends. Your Admin AI Agent drafts the recap from your notes. It’s in the client’s inbox before your next call starts.",
    },
    {
      time: "12:00pm",
      body: "Tuesday’s lead got a follow-up you approved yesterday. She booked. It’s on your calendar.",
    },
    {
      time: "2:30pm",
      body: "Your Content AI Agent turned Monday’s session themes into five post drafts. You pick three and approve.",
    },
    {
      time: "5:00pm",
      body: "Both reschedules handled — your agent proposed open times from your calendar, the clients picked, done.",
    },
    {
      time: "9:00pm",
      body: "Past-due reminders drafted — polite, firm, yours. You tap approve on all three and close the laptop.",
    },
  ],
  handles: [
    "Session recaps drafted from your notes, in your voice",
    "Client check-ins between sessions, staged for one tap",
    "Discovery-call follow-ups drafted the day the call happens",
    "One client call turned into a week of content — posts, newsletter, video script",
    "New-lead replies drafted from your packages and prices",
    "Proposals for corporate and executive engagements, built from your rates",
    "Invoice reminders that actually get sent — because you only have to approve them",
    "Reschedules answered with real open times from your calendar",
    "Testimonial asks timed to client wins, not to your guilt",
    "Podcasts and videos you consume filed into your Business Brain as content ideas",
  ],
  anchor: {
    heading: "The alternative is a hire you don’t need yet.",
    body: [
      "A part-time VA for a coaching practice runs $1,500–2,500 a month, and you’re still the one training them on your voice, your packages, and which clients get the gentle touch.",
      "Pocket Agent starts at $37 a month and reads all of that from your Business Brain — your voice, your prices, your client history — from the first session you log.",
    ],
  },
};

export default function CoachesPage() {
  return <PersonaLanding copy={COPY} />;
}
