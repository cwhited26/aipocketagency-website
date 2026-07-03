import type { Metadata } from "next";
import { PersonaLanding, type PersonaPageCopy } from "@/components/marketing/persona-landing";

const PAGE_URL = "https://aipocketagent.com/for/agencies";
const TITLE = "Pocket Agent for Agencies — Client Updates and Proposals Across Every Account";
const DESCRIPTION =
  "Client updates, proposals, new-business research, and the follow-ups across every account — drafted in your agency's voice, staged for approval. Pocket Agent for marketing agencies, dev shops, and studios. $37 a month.";

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
  slug: "agencies",
  pill: "Pocket Agent · for agencies",
  h1: "Every new client comes with a new inbox.",
  sub: "Pocket Agent drafts the client updates, the proposals, and the follow-ups across every account — in your agency’s voice, staged for your approval — so headcount stops being the ceiling.",
  dayIntro:
    "A composite day from small agencies running Pocket Agent — names changed, hours real. Four people, nine retainers, and a founder who’s still the account manager on all of them.",
  without: [
    {
      time: "7:30am",
      body: "Four client emails asking “any update?” before you’ve had coffee. Each answer means reconstructing a week.",
    },
    {
      time: "10:00am",
      body: "New-business call. The research is whatever you skimmed in the parking lot.",
    },
    {
      time: "1:00pm",
      body: "A proposal is due Friday. You’re assembling it from three old decks and a rate sheet you don’t trust.",
    },
    {
      time: "3:30pm",
      body: "A past client’s contract ended two months ago. Nobody has checked in.",
    },
    {
      time: "5:30pm",
      body: "Status reports. The billable work stops so the reporting can start.",
    },
    {
      time: "8:00pm",
      body: "You’re writing your own agency’s newsletter. The cobbler’s kids, barefoot again.",
    },
  ],
  withPa: [
    {
      time: "7:30am",
      body: "All four update replies are drafted from each account’s actual activity. Approve, approve, approve, edit-then-approve.",
    },
    {
      time: "10:00am",
      body: "Your Research AI Agent’s brief landed last night: the prospect’s business, their competitors, three angles for the pitch.",
    },
    {
      time: "1:00pm",
      body: "The proposal is drafted from your past scopes, rates, and case studies. You spend the hour on the idea, not the formatting.",
    },
    {
      time: "3:30pm",
      body: "Follow-Up Sweeps flagged the lapsed client and staged a check-in you approved Monday. They booked a call.",
    },
    {
      time: "5:30pm",
      body: "Status reports drafted per account from the work that shipped. You review all nine before the team stands up from their desks.",
    },
    {
      time: "8:00pm",
      body: "Your own newsletter went out this morning — drafted from this month’s client problems, approved with one edit.",
    },
  ],
  handles: [
    "Client update replies drafted from each account’s real activity",
    "Proposals assembled from your past scopes, rates, and case studies",
    "New-business research briefs before every pitch",
    "Follow-Up Sweeps across warm leads and lapsed clients",
    "Status reports drafted per account, not reconstructed from memory",
    "Your own agency’s marketing finally shipping — newsletter, posts, case studies",
    "Meeting notes turned into action lists and recap emails",
    "Freelancer and vendor emails triaged out of your day",
    "Contract renewals and check-ins timed, not remembered",
    "Every client’s context — voice, history, scope — kept straight in one Business Brain",
  ],
  anchor: {
    heading: "The alternative is a coordinator who covers four accounts.",
    body: [
      "An account coordinator runs $45–60k a year loaded and covers maybe four accounts before they’re underwater too.",
      "Pocket Agent starts at $37 a month and reads every account’s history before it drafts a word.",
    ],
  },
};

export default function AgenciesPage() {
  return <PersonaLanding copy={COPY} />;
}
