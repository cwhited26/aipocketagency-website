import type { Metadata } from "next";
import { CompareLanding, type ComparePageCopy } from "@/components/marketing/compare-landing";

const PAGE_URL = "https://aipocketagent.com/compare/twin";
const TITLE = "Pocket Agent vs Twin — Agents in Their App vs Agents in Your GitHub";
const DESCRIPTION =
  "Twin builds AI agents inside their platform. Pocket Agent ships ten packaged AI Agents to accounts you own — GitHub, Vercel, Supabase. Honest comparison, feature by feature.";

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
  slug: "twin",
  competitor: "Twin",
  pill: "pocket agent vs twin",
  h1: "Twin builds agents inside their app. Pocket Agent builds them inside your GitHub.",
  sub: "Twin gives your team a workbench for assembling AI agents in Slack. Pocket Agent hands you the assembled team — ten packaged AI Agents already reading your business — and everything they make lands in accounts you own.",
  tldr: [
    {
      label: "What it does",
      them: "A platform where teams build and run AI agents, installed straight into Slack.",
      pa: "Ten packaged AI Agents — Sales, Marketing, Content, Customer Support, Research, and more — running on your own business context.",
    },
    {
      label: "Mode",
      them: "You assemble agents from their catalog and tune them for your team.",
      pa: "You hire a pre-built team. Every outgoing send is staged in Mission Control until you approve it.",
    },
    {
      label: "Where the work lives",
      them: "Inside Twin's platform. Leave, and the agents and their setup stay behind.",
      pa: "In accounts you own — your GitHub, your Vercel, your Supabase. Leave, and the work stays with you.",
    },
    {
      label: "Pricing",
      them: "Pro around $20 a month on a credit meter; Enterprise is custom.",
      pa: "$37, $97, or $497 a month. Flat. No usage meter.",
    },
  ],
  difference: [
    "Twin is a serious product. They raised a $10M seed led by LocalGlobe, they claim 70,000+ businesses on the platform, and their customer logos are real brands — Keller Williams, Redfin. If your whole company lives in Slack and you want an agent in the channel this afternoon, their install path is shorter than ours. Say that plainly and move on.",
    "The split is what you're buying. Twin sells a workbench: a catalog of agents you pick from, configure, and run inside their platform. Pocket Agent sells the workers: ten packaged AI Agents with the configuration already done, each one reading your Business Brain — your voice, your prices, your customers, your decisions — from the first day. Twin starts from a catalog. Pocket Agent starts from your business.",
    "And there's a line Twin can't cross: where the work lives. Everything a Twin agent builds lives inside Twin. Everything a Pocket Agent builds lands in accounts you own — your Business Brain is a folder of plain files in your own GitHub (a free account you set up in under a minute — Pocket Agent walks you through it), your landing pages go live on your own Vercel (also free, also under a minute to set up), your customer data sits in your own Supabase (same — free, quick to set up, no technical knowledge required). Cancel tomorrow and the sites stay live, the brain stays yours, and every email already sent is sent. The agents themselves stop — they live in Pocket Agent — but everything they made is yours.",
  ],
  moatLine:
    "You own the stack. You rent the workers. Twin can't match that without rebuilding their platform — their business model is the walled garden.",
  featureGroups: [
    {
      title: "What the product does",
      rows: [
        {
          label: "The pitch",
          them: "Build AI agents for your team, inside the chat tools you already use.",
          pa: "A packaged AI team that already knows your business.",
          verdict: "even",
        },
        {
          label: "Setup path",
          them: "Install the Slack app. Agents live where your team already chats.",
          pa: "Sign up, connect one free GitHub account, and the agents start reading your business.",
          verdict: "them",
        },
        {
          label: "Built for",
          them: "Teams that live in Slack — their flagship customers are large real-estate brokerages.",
          pa: "Owner-led businesses doing $250K–$5M, where one person wears too many hats.",
          verdict: "even",
        },
      ],
    },
    {
      title: "Capabilities",
      rows: [
        {
          label: "Business memory",
          them: "Workspace-level context you set up per agent.",
          pa: "A Business Brain — plain files in your own GitHub that every agent reads and every successful run sharpens.",
          verdict: "pa",
        },
        {
          label: "Packaged agents",
          them: "A catalog of agents you configure yourself.",
          pa: "Ten pre-built AI Agents by role: Sales, Sales Manager, Marketing, Content, Customer Support, Research, Admin, Operations, Idea, Voice.",
          verdict: "pa",
        },
        {
          label: "Integrations",
          them: "Claims 50,000 apps and websites, with 5,000+ ready-made integrations — one of the widest catalogs in the category.",
          pa: "Gmail, Google Calendar, Slack, QuickBooks, Stripe, Twilio, and more. Fewer connections, wired deeper.",
          verdict: "them",
        },
        {
          label: "Browser automation",
          them: "Yes — agents can drive a browser.",
          pa: "Yes — with a trust ladder, so the agent earns permissions instead of starting with all of them.",
          verdict: "even",
        },
        {
          label: "Models",
          them: "Routes across OpenAI, Anthropic, and Google models — bigger models plan, cheaper ones execute.",
          pa: "Claude-first, with bring-your-own across six providers if you want a different engine.",
          verdict: "even",
        },
        {
          label: "Where you reach it",
          them: "Slack and their web app.",
          pa: "Slack, SMS, WhatsApp, iMessage, forwarded email, iPhone share sheet, and the web app.",
          verdict: "pa",
        },
        {
          label: "Spend visibility",
          them: "Credit-based — builds and runs draw down a monthly meter.",
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
          them: "Inside Twin's platform.",
          pa: "Your GitHub, your Vercel, your Supabase — accounts in your name.",
          verdict: "pa",
        },
        {
          label: "After you cancel",
          them: "Access ends. The agents and their configuration stay behind.",
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
          them: "Around $20 a month for Pro.",
          pa: "$37 a month for Personal Brain.",
          verdict: "them",
        },
        {
          label: "Bill predictability",
          them: "Credits meter your builds and runs — a heavy month costs more or waits for the meter to reset.",
          pa: "Flat tiers: $37, $97, $497. The bill is the bill.",
          verdict: "pa",
        },
      ],
    },
  ],
  pickThem: [
    "Your whole company lives in Slack and you want agents in the channel today.",
    "You want to assemble and tune your own agents from a large catalog.",
    "You need the widest possible integration surface more than you need deep business context.",
    "A $20 seat is the budget and usage-based billing doesn't bother you.",
  ],
  pickPa: [
    "You're the owner and you want workers, not a workbench.",
    "You want the work — websites, pages, customer records, memory — in accounts you own.",
    "You want every outgoing send staged for your approval, with AI spend visible to the cent.",
    "You want a flat bill instead of usage math.",
  ],
  faq: [
    {
      q: "Can Pocket Agent work inside Slack like Twin does?",
      a: "Yes. Slack DM and @mention are live, and the same agent answers on SMS, WhatsApp, iMessage, and forwarded email. One brain, one memory, every door.",
    },
    {
      q: "Twin claims 70,000+ businesses. Isn't the bigger product the safer bet?",
      a: "Scale is a real signal and we won't pretend otherwise. The question to ask is what happens to your work if you ever leave. On Twin, it stays behind. On Pocket Agent, it was in your accounts the whole time — so the safer bet is the one where leaving costs you nothing you made.",
    },
    {
      q: "Do I need to know how to code for the GitHub part?",
      a: "No. GitHub is a free account that takes about a minute to create — about as easy as making a Facebook account — and Pocket Agent walks you through every step. It's simply where your business context lives, in files you can open and read.",
    },
    {
      q: "What actually happens if I cancel Pocket Agent?",
      a: "Everything the agents made stays: your websites stay live on your Vercel, your Business Brain stays in your GitHub, your customer data stays in your Supabase. The agents themselves stop — they run inside Pocket Agent. Come back any time and they pick up where they left off.",
    },
    {
      q: "Is Pocket Agent SOC 2 certified?",
      a: "Not yet — SOC 2 Type I is planned. If a certification is a hard requirement today, we're not there yet and we won't pretend to be.",
    },
  ],
};

export default function CompareTwinPage() {
  return <CompareLanding copy={COPY} />;
}
