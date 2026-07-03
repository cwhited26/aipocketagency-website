import type { Metadata } from "next";
import { CompareLanding, type ComparePageCopy } from "@/components/marketing/compare-landing";

const PAGE_URL = "https://aipocketagent.com/compare/zapier";
const TITLE = "Pocket Agent vs Zapier — Mapped Steps vs Hired Workers";
const DESCRIPTION =
  "Zapier connects 9,000+ apps and runs the workflows you map. Pocket Agent ships ten packaged AI Agents that handle the work you can't map — drafting, judgment, follow-through. Honest comparison.";

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

const COPY: ComparePageCopy = {
  slug: "zapier",
  competitor: "Zapier",
  pill: "pocket agent vs zapier",
  h1: "Zapier maps steps. Pocket Agent hires the workers.",
  sub: "Zapier runs the workflows you can draw: when this happens, do that, across 9,000+ apps. Pocket Agent handles the work you can't draw — drafting in your voice, judging what a reply needs, chasing a lead until it answers.",
  tldr: [
    {
      label: "What it does",
      them: "Automation plumbing: triggers and actions across 9,000+ connected apps, exactly as you mapped them.",
      pa: "Ten packaged AI Agents doing owner work — sales outreach, content, customer replies, research, follow-up — on your business context.",
    },
    {
      label: "Mode",
      them: "You design the workflow. It executes the same way every time.",
      pa: "You hand the agent the job. It drafts, you approve in Mission Control, it follows through.",
    },
    {
      label: "Where the work lives",
      them: "The workflows live inside Zapier; the data flows between your apps.",
      pa: "In accounts you own — your GitHub, your Vercel, your Supabase. The work products stay yours.",
    },
    {
      label: "Pricing",
      them: "Free tier; Professional from about $20 a month billed annually; Team from about $69; Enterprise custom. Task-metered.",
      pa: "$37, $97, or $497 a month. Flat. No task meter.",
    },
  ],
  difference: [
    "Zapier is the most connected automation product ever built — 9,000+ apps, a decade and a half of reliability, and if a trigger-action workflow is what you need, nothing on this page beats it. Invoice lands in Gmail, row appears in Sheets, Slack pings the channel: that's Zapier's home turf, and it will run that play flawlessly for years.",
    "The split is the kind of work. A Zap does exactly what you mapped — no more, no less. It can't read a rambling customer email and decide the reply needs an apology and a reschedule. It can't draft outreach that sounds like you, because it doesn't know you. Pocket Agent's agents read your Business Brain — your voice, your prices, your customers, your decisions — and handle the ambiguous middle of the job, not just the hand-offs between apps. Zapier automates the plumbing between your tools. Pocket Agent does the work inside them. They're different species; plenty of businesses will run both.",
    "The ownership line still gets drawn. Your Zaps live inside Zapier — leave, and the workflows you spent months building stay behind. Everything Pocket Agent builds lands in accounts you own: your Business Brain is a folder of plain files in your own GitHub (a free account you set up in under a minute — Pocket Agent walks you through it), landing pages go live on your own Vercel (also free, also under a minute to set up), customer records sit in your own Supabase (same — free, quick to set up, no technical knowledge required). Cancel tomorrow and the sites stay live, the brain stays yours. The agents themselves stop — they live in Pocket Agent — but everything they made is yours.",
  ],
  moatLine:
    "You own the stack. You rent the workers. Zapier rents you the plumbing and keeps the blueprints — we hand you the building.",
  featureGroups: [
    {
      title: "What the product does",
      rows: [
        {
          label: "The pitch",
          them: "Connect your apps and automate the hand-offs between them.",
          pa: "A packaged AI team that does the work inside the job, not just between apps.",
          verdict: "even",
        },
        {
          label: "Kind of work",
          them: "Deterministic: the same trigger runs the same steps, every time.",
          pa: "Judgment work: drafting, deciding, following up — staged for your approval.",
          verdict: "even",
        },
        {
          label: "Built for",
          them: "Anyone with repeatable hand-offs between tools — solo operators to enterprises.",
          pa: "Owner-led businesses doing $250K–$5M, where the owner is the bottleneck.",
          verdict: "even",
        },
      ],
    },
    {
      title: "Capabilities",
      rows: [
        {
          label: "Integrations",
          them: "9,000+ apps. The deepest catalog in automation, full stop.",
          pa: "Gmail, Google Calendar, Slack, QuickBooks, Stripe, Twilio, and more. Fewer connections, wired deeper.",
          verdict: "them",
        },
        {
          label: "Handles ambiguity",
          them: "No — a Zap can't decide; it executes the map.",
          pa: "Yes — agents read context, draft a judgment call, and stage it for your approval.",
          verdict: "pa",
        },
        {
          label: "Writes in your voice",
          them: "Only what a template or a prompt step produces.",
          pa: "Drafts from your actual voice samples in the Business Brain — outreach, replies, and content that read like you.",
          verdict: "pa",
        },
        {
          label: "Business memory",
          them: "None — each Zap knows its own steps.",
          pa: "A Business Brain every agent reads and every successful run sharpens.",
          verdict: "pa",
        },
        {
          label: "Builds things",
          them: "Moves data; doesn't build products.",
          pa: "The Idea AI Agent ships a working website with a signup form and a database to your own accounts.",
          verdict: "pa",
        },
        {
          label: "Reliability at scale",
          them: "Battle-tested for fifteen-plus years across millions of workflows.",
          pa: "Young by comparison — built and run daily inside three real businesses, but without Zapier's track record.",
          verdict: "them",
        },
      ],
    },
    {
      title: "Ownership",
      rows: [
        {
          label: "Where the work lives",
          them: "Workflows live in Zapier; your data stays in the connected apps.",
          pa: "Your GitHub, your Vercel, your Supabase — accounts in your name.",
          verdict: "pa",
        },
        {
          label: "After you cancel",
          them: "The Zaps stop and stay behind — months of workflow-building doesn't come with you.",
          pa: "Sites stay live, the brain stays yours, everything already made stays. The agents themselves stop — they need Pocket Agent to run.",
          verdict: "pa",
        },
      ],
    },
    {
      title: "Pricing",
      rows: [
        {
          label: "Entry price",
          them: "Free tier exists; paid starts around $20 a month billed annually.",
          pa: "$37 a month, flat.",
          verdict: "them",
        },
        {
          label: "Bill predictability",
          them: "Task-metered — a busy month means a bigger bill or stalled Zaps.",
          pa: "Flat tiers: $37, $97, $497. A spend cap inside the product, visible to the cent.",
          verdict: "pa",
        },
      ],
    },
  ],
  pickThem: [
    "Your problem is repeatable hand-offs between apps — trigger in, action out.",
    "You need an integration Pocket Agent doesn't have; their catalog covers 9,000+ apps.",
    "You want a free tier to start and deterministic workflows you fully control.",
    "Fifteen years of reliability history matters more to you than AI judgment.",
  ],
  pickPa: [
    "The work you're drowning in can't be drawn as a flowchart — it needs drafting and judgment.",
    "You want output that sounds like you, grounded in your prices and your customers.",
    "You want the work — websites, pages, records, memory — in accounts you own.",
    "You want a flat bill and every send staged for your approval.",
  ],
  faq: [
    {
      q: "Should I replace Zapier with Pocket Agent?",
      a: "Probably not — they solve different problems. If you have Zaps moving data between apps, keep them running. Pocket Agent takes the other pile: the drafting, the follow-ups, the customer replies, the pages that need building. Plenty of businesses will run both and be right to.",
    },
    {
      q: "Zapier has AI features now too. Isn't that the same thing?",
      a: "Zapier has added AI steps inside workflows, and they're useful. The difference is the starting point: a Zap's AI step runs inside a map you drew, with no memory of your business. Pocket Agent's agents start from your Business Brain and carry the whole job — including the parts you never mapped.",
    },
    {
      q: "Do I need to know how to code for the GitHub part?",
      a: "No. GitHub is a free account that takes about a minute to create — about as easy as making a Facebook account — and Pocket Agent walks you through every step. It's where your business context lives, in files you can open and read.",
    },
    {
      q: "What happens if I cancel Pocket Agent?",
      a: "Everything the agents made stays: websites live on your Vercel, the Business Brain in your GitHub, customer data in your Supabase. The agents themselves stop — they run inside Pocket Agent. Come back any time and pick up where you left off.",
    },
    {
      q: "Is Pocket Agent SOC 2 certified?",
      a: "Not yet — SOC 2 Type I is planned. Zapier carries enterprise-grade compliance; if that's a hard requirement today, it wins that row.",
    },
  ],
};

export default function CompareZapierPage() {
  return <CompareLanding copy={COPY} />;
}
