import type { Metadata } from "next";
import { CompareLanding, type ComparePageCopy } from "@/components/marketing/compare-landing";

const PAGE_URL = "https://aipocketagent.com/compare/claude-cowork";
const TITLE = "Pocket Agent vs Claude Cowork — A Workspace With AI vs a Team That Works";
const DESCRIPTION =
  "Claude Cowork is Anthropic's workspace for getting work done with Claude. Pocket Agent is ten packaged AI Agents running your business on accounts you own. Honest comparison — we build on Claude too.";

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
  slug: "claude-cowork",
  competitor: "Claude Cowork",
  pill: "pocket agent vs claude cowork",
  h1: "Cowork drafts. Pocket Agent drafts, sends, follows up, and lands the deal.",
  sub: "Claude Cowork is Anthropic's workspace for doing knowledge work with Claude — organize files, generate reports, run recurring tasks. Pocket Agent takes the same class of models and packages them into a business team: ten AI Agents reading your business, sending through your channels, building on accounts you own.",
  tldr: [
    {
      label: "What it does",
      them: "A workspace where you and Claude get knowledge work done — files, reports, decks, scheduled recurring tasks.",
      pa: "Ten packaged AI Agents doing business work — sales outreach, marketing pages, content, customer replies, research, follow-up.",
    },
    {
      label: "Mode",
      them: "You work with it. Sessions, tasks, and a shared workspace, driven by you.",
      pa: "It works for you. Agents run between your sessions; every send is staged in Mission Control for your approval.",
    },
    {
      label: "Where the work lives",
      them: "Inside your Claude workspace at claude.ai.",
      pa: "In accounts you own — your GitHub, your Vercel, your Supabase. Leave, and the work stays with you.",
    },
    {
      label: "Pricing",
      them: "Pro $20 a month; Team from $25 per user a month (5-seat minimum).",
      pa: "$37, $97, or $497 a month. Flat. No seats.",
    },
  ],
  difference: [
    "Full credit where it's due — and it's due twice. Cowork is built by Anthropic, whose Claude models are the best working models available, and for deep sessions over documents — synthesize this folder, build this deck, answer hard questions across a hundred files — Cowork is better than Pocket Agent. It should be: that's the whole product. And Pocket Agent runs on Claude too, so this page isn't us against the model. It's two different products built on the same engine.",
    "The split is who's driving. Cowork is a workspace: you open it, you direct it, the output lands in the workspace. Pocket Agent is a workforce: the Sales AI Agent chases the lead that went quiet on Tuesday, the Content AI Agent has the newsletter drafted before you sit down, the Admin AI Agent files the voice memo you sent from the truck — all of it staged for one-tap approval, all of it grounded in a Business Brain that holds your voice, your prices, your customers, and your decisions. Cowork gives you a brilliant collaborator for the hours you're at the desk. Pocket Agent gives you a team for the hours you're not.",
    "And the ownership line: your Cowork workspace lives at claude.ai. Everything Pocket Agent builds lands in accounts you own — the Business Brain is a folder of plain files in your own GitHub (a free account you set up in under a minute — Pocket Agent walks you through it), landing pages go live on your own Vercel (also free, also under a minute to set up), customer records sit in your own Supabase (same — free, quick to set up, no technical knowledge required). Cancel tomorrow and the sites stay live, the brain stays yours, everything already made stays. The agents themselves stop — they live in Pocket Agent — but the work is yours.",
  ],
  moatLine:
    "You own the stack. You rent the workers. Cowork keeps your workspace at claude.ai — Pocket Agent leaves the work in accounts with your name on them.",
  featureGroups: [
    {
      title: "What the product does",
      rows: [
        {
          label: "The pitch",
          them: "Get real work done with Claude in one workspace.",
          pa: "A packaged AI team that runs your business's busywork.",
          verdict: "even",
        },
        {
          label: "Who drives",
          them: "You do — sessions and scheduled tasks you set up and steer.",
          pa: "The agents do — they work between your sessions and stage results for approval.",
          verdict: "pa",
        },
        {
          label: "Built for",
          them: "Knowledge workers and teams doing document-heavy work.",
          pa: "Owner-led businesses doing $250K–$5M, where the owner wears too many hats.",
          verdict: "even",
        },
      ],
    },
    {
      title: "Capabilities",
      rows: [
        {
          label: "Deep document work",
          them: "The best in this comparison — synthesis, reports, decks across big file sets.",
          pa: "Solid through the Business Brain, but it's not the centerpiece.",
          verdict: "them",
        },
        {
          label: "Business memory",
          them: "Workspace context and project files inside Cowork.",
          pa: "A Business Brain — plain files in your own GitHub holding voice, prices, customers, decisions. Every agent reads it; every run sharpens it.",
          verdict: "pa",
        },
        {
          label: "Packaged agents",
          them: "One Claude, plus Skills you assemble for your workflows.",
          pa: "Ten pre-built AI Agents by role — Sales, Sales Manager, Marketing, Content, Customer Support, Research, Admin, Operations, Idea, Voice.",
          verdict: "pa",
        },
        {
          label: "Sends through your channels",
          them: "Connectors are growing, but Cowork isn't answering your SMS or WhatsApp.",
          pa: "Slack, SMS, WhatsApp, iMessage, forwarded email, iPhone share sheet — one agent, every door.",
          verdict: "pa",
        },
        {
          label: "Computer use",
          them: "Dispatch — in research preview.",
          pa: "Browser automation behind a trust ladder, shipped.",
          verdict: "even",
        },
        {
          label: "Builds things",
          them: "Documents, decks, artifacts inside the workspace.",
          pa: "Working websites with signup forms and databases, live on your own accounts.",
          verdict: "pa",
        },
        {
          label: "Model quality",
          them: "Claude, first-party.",
          pa: "The same Claude models, plus bring-your-own across six providers.",
          verdict: "even",
        },
      ],
    },
    {
      title: "Ownership",
      rows: [
        {
          label: "Where the work lives",
          them: "In your workspace at claude.ai.",
          pa: "Your GitHub, your Vercel, your Supabase — accounts in your name.",
          verdict: "pa",
        },
        {
          label: "After you cancel",
          them: "You can export files; the workspace and its context end with the subscription.",
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
          them: "$20 a month for Pro.",
          pa: "$37 a month for Personal Brain.",
          verdict: "them",
        },
        {
          label: "What the top tier buys",
          them: "Team seats at $25 per user — more people using the same workspace.",
          pa: "$497 buys every agent, every App, every Skill — more work done, not more seats.",
          verdict: "pa",
        },
      ],
    },
  ],
  pickThem: [
    "Your work is document-heavy knowledge work — synthesis, reports, analysis — and you'll be at the desk driving it.",
    "You want the first-party Anthropic product and the workspace your whole team shares.",
    "$20 a month is the budget.",
    "You'd rather assemble your own Skills and workflows than take a pre-built team.",
  ],
  pickPa: [
    "You want the work happening while you're on a job site, in a session, or asleep.",
    "You want agents that already know your business — voice, prices, customers — on day one.",
    "You want output going out through your real channels: email, SMS, WhatsApp, Slack.",
    "You want the work — websites, pages, records, memory — in accounts you own.",
  ],
  faq: [
    {
      q: "Isn't Pocket Agent just Claude with extra steps?",
      a: "Pocket Agent runs on Claude, and we're glad it does. What you're paying for is everything wrapped around the model: the Business Brain that makes output sound like you, the ten pre-configured agents, the channels, the approval gate, the spend ledger, and the build pipeline to your own accounts. Building that yourself is roughly a year of learning. The subscription is the shortcut past it.",
    },
    {
      q: "Cowork keeps improving. Won't it catch up?",
      a: "It will keep getting better — Anthropic ships fast. What it won't do is build on your accounts. Cowork's model is the workspace at claude.ai; ours is your GitHub, your Vercel, your Supabase. That's a business-model line, not a feature gap, and it's the one thing on this page that doesn't erode with the next release.",
    },
    {
      q: "Can I use both?",
      a: "Yes, and it's a reasonable setup: Cowork for your own deep desk work, Pocket Agent for the business team running between sessions. They don't fight — one is a workspace you drive, the other is a workforce you approve.",
    },
    {
      q: "What happens if I cancel Pocket Agent?",
      a: "Everything the agents made stays: websites live on your Vercel, the Business Brain in your GitHub, customer data in your Supabase. The agents themselves stop — they run inside Pocket Agent. Come back any time and pick up where you left off.",
    },
    {
      q: "Is Pocket Agent SOC 2 certified?",
      a: "Not yet — SOC 2 Type I is planned. Anthropic's compliance posture is ahead of ours; if certification is a hard requirement today, that row goes to Cowork.",
    },
  ],
};

export default function CompareClaudeCoworkPage() {
  return <CompareLanding copy={COPY} />;
}
