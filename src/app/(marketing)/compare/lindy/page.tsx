import type { Metadata } from "next";
import { CompareLanding, type ComparePageCopy } from "@/components/marketing/compare-landing";

const PAGE_URL = "https://aipocketagent.com/compare/lindy";
const TITLE = "Pocket Agent vs Lindy — Templates vs the Whole Stack";
const DESCRIPTION =
  "Lindy gives you an AI assistant and a template library to automate tasks. Pocket Agent ships ten packaged AI Agents on accounts you own — GitHub, Vercel, Supabase. Honest comparison.";

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
  slug: "lindy",
  competitor: "Lindy",
  pill: "pocket agent vs lindy",
  h1: "Lindy sells templates. Pocket Agent gives you the whole stack — plus the room to change it.",
  sub: "Lindy is an AI assistant with a deep library of pre-built automations — pick a template, connect your tools, and it runs. Pocket Agent is a packaged AI team that starts from your business, not from a template gallery.",
  tldr: [
    {
      label: "What it does",
      them: "An AI work assistant: inbox, meetings, scheduling, plus a large library of pre-built automations you turn on.",
      pa: "Ten packaged AI Agents — sales, marketing, content, support, research, operations — running on your own business context.",
    },
    {
      label: "Mode",
      them: "Pick a template, connect your tools, tune the steps, let it run.",
      pa: "Hire the pre-built team. Every outgoing send is staged in Mission Control until you approve it.",
    },
    {
      label: "Where the work lives",
      them: "Inside Lindy's platform. Leave, and the automations and their history stay behind.",
      pa: "In accounts you own — your GitHub, your Vercel, your Supabase. Leave, and the work stays with you.",
    },
    {
      label: "Pricing",
      them: "$49.99 / $99.99 / $199.99 a month, credit-based, 7-day trial.",
      pa: "$37, $97, or $497 a month. Flat. No credits to ration.",
    },
  ],
  difference: [
    "Lindy has earned its reputation. The template library is one of the deepest in the category, the builder is polished, it's raised roughly $50M from Menlo Ventures and Battery Ventures, and computer use — the agent driving a browser — ships on their Pro tier. If your goal is one specific automation running this afternoon, a Lindy template is one of the fastest paths there.",
    "The split is what a template can't hold: your business. A meeting-scheduler template schedules meetings the same way for every customer who installs it. Pocket Agent's agents read your Business Brain first — your voice, your prices, your customers, your past decisions — so the outreach sounds like you wrote it and the proposal quotes your actual rates. Lindy starts from a gallery. Pocket Agent starts from your business. That's the difference between an automation and an employee.",
    "Then there's the line no template crosses: ownership. Everything Lindy runs lives inside Lindy. Everything Pocket Agent builds lands in accounts you own — your Business Brain is a folder of plain files in your own GitHub (a free account you set up in under a minute — Pocket Agent walks you through it), landing pages go live on your own Vercel (also free, also under a minute to set up), customer records sit in your own Supabase (same — free, quick to set up, no technical knowledge required). Cancel tomorrow and the sites stay live, the brain stays yours, everything already made stays made. The agents themselves stop — they live in Pocket Agent — but the work is yours.",
  ],
  moatLine:
    "You own the stack. You rent the workers. Lindy's automations run in Lindy's house — ours build in yours.",
  featureGroups: [
    {
      title: "What the product does",
      rows: [
        {
          label: "The pitch",
          them: "An AI assistant plus a library of automations you switch on.",
          pa: "A packaged AI team that already knows your business.",
          verdict: "even",
        },
        {
          label: "Time to first automation",
          them: "Pick a template, connect tools, done — among the fastest in the category.",
          pa: "Connect your free GitHub, seed the Business Brain, then the agents start working with real context.",
          verdict: "them",
        },
        {
          label: "Depth of catalog",
          them: "Hundreds of templates across sales, support, recruiting, and ops.",
          pa: "Ten packaged AI Agents by role, each bundling the Apps and Skills for that job.",
          verdict: "them",
        },
      ],
    },
    {
      title: "Capabilities",
      rows: [
        {
          label: "Business memory",
          them: "Per-automation context and preferences you configure.",
          pa: "A Business Brain — plain files in your own GitHub that every agent reads and every successful run sharpens.",
          verdict: "pa",
        },
        {
          label: "Voice matching",
          them: "Prompt-level tone settings per automation.",
          pa: "Agents draft from your actual voice samples in the brain — recaps, outreach, and content that read like you.",
          verdict: "pa",
        },
        {
          label: "Browser automation",
          them: "Computer use on Pro tier and up.",
          pa: "Yes — with a trust ladder, so the agent earns permissions instead of starting with all of them.",
          verdict: "even",
        },
        {
          label: "Builds things",
          them: "Automates workflows across your existing tools.",
          pa: "The Idea AI Agent ships a working website with a signup form and a database to your own accounts. The Marketing AI Agent puts landing pages live.",
          verdict: "pa",
        },
        {
          label: "Skills that improve",
          them: "You refine templates by editing them.",
          pa: "Skills evolve — every successful run can write what it learned back to the brain, so the same job gets sharper over time.",
          verdict: "pa",
        },
        {
          label: "Spend visibility",
          them: "Credit meter — tasks draw down your monthly allowance.",
          pa: "A Cost Ledger showing every dollar of AI spend to the cent, with a budget cap the agent won't cross without asking.",
          verdict: "pa",
        },
      ],
    },
    {
      title: "Ownership",
      rows: [
        {
          label: "Where the work lives",
          them: "Inside Lindy's platform.",
          pa: "Your GitHub, your Vercel, your Supabase — accounts in your name.",
          verdict: "pa",
        },
        {
          label: "After you cancel",
          them: "Access ends. Automations and their run history stay behind.",
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
          them: "$49.99 a month, credit-based.",
          pa: "$37 a month, flat.",
          verdict: "pa",
        },
        {
          label: "Bill predictability",
          them: "Credits meter your runs — a busy month burns the allowance faster.",
          pa: "Flat tiers: $37, $97, $497. The bill is the bill, with a spend cap inside it.",
          verdict: "pa",
        },
      ],
    },
  ],
  pickThem: [
    "You want one specific automation live this afternoon and a template already exists for it.",
    "You like assembling and tuning workflows yourself in a polished visual builder.",
    "Your job is mostly meetings, inbox, and scheduling — Lindy's home turf.",
    "You want the bigger company behind the product — Lindy has raised ~$50M.",
  ],
  pickPa: [
    "You want workers that know your business, not automations that know their template.",
    "You want the work — websites, pages, customer records, memory — in accounts you own.",
    "You want every outgoing send staged for approval, with AI spend visible to the cent.",
    "You want a flat bill instead of watching a credit meter.",
  ],
  faq: [
    {
      q: "Isn't a big template library better than ten packaged agents?",
      a: "For breadth of one-off automations, yes — Lindy's catalog is deeper, and we say so in the table above. The trade is depth per job: a template runs the same steps for everyone; a Pocket Agent reads your Business Brain and does the job the way your business does it. Wide and shallow versus narrow and deep. Pick by the shape of your problem.",
    },
    {
      q: "Lindy has computer use. Does Pocket Agent?",
      a: "Yes — Pocket Agent agents can drive a browser too, behind a trust ladder: the agent earns permissions step by step instead of starting with the keys. Lindy ships theirs on Pro tier and up.",
    },
    {
      q: "What's actually in a 'packaged AI Agent'?",
      a: "A Persona (the worker), the Apps it uses (Email Drafter, Lead Scout, Landing Page Builder, Follow-Up Sweeps), and the Skills it has learned. You see ten agents by role; underneath, it's the same architecture every time, reading the same Business Brain.",
    },
    {
      q: "What happens if I cancel Pocket Agent?",
      a: "Everything the agents made stays: websites live on your Vercel, the Business Brain in your GitHub, customer data in your Supabase. The agents themselves stop — they run inside Pocket Agent. Come back any time and pick up where you left off.",
    },
    {
      q: "Is Pocket Agent SOC 2 certified?",
      a: "Not yet — SOC 2 Type I is planned. If a certification is a hard requirement today, neither pitch on this page matters until that box is checked.",
    },
  ],
};

export default function CompareLindyPage() {
  return <CompareLanding copy={COPY} />;
}
