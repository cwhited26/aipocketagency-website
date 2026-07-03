import type { Metadata } from "next";
import { CompareLanding, type ComparePageCopy } from "@/components/marketing/compare-landing";

const PAGE_URL = "https://aipocketagent.com/compare/catch";
const TITLE = "Pocket Agent vs Catch — The Admin vs the Whole Office";
const DESCRIPTION =
  "Catch is a sharp AI executive assistant at $99 a month. Pocket Agent is ten packaged AI Agents — sales, marketing, content, support, and the admin — starting at $37. Honest comparison.";

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
  slug: "catch",
  competitor: "Catch",
  pill: "pocket agent vs catch",
  h1: "Catch is the admin. Pocket Agent is the whole office.",
  sub: "Catch is an AI executive assistant that triages your inbox, your calendar, and your calls — and it's good at it. Pocket Agent packages that admin work plus nine more AI Agents: sales, marketing, content, customer support, research, operations, and the rest.",
  tldr: [
    {
      label: "What it does",
      them: "An AI executive assistant: inbox triage, scheduling, calls, follow-ups on the personal-admin layer.",
      pa: "Ten packaged AI Agents covering the whole business — the admin work plus sales, marketing, content, support, research, and operations.",
    },
    {
      label: "Mode",
      them: "One assistant, always on, reachable on every channel you already use.",
      pa: "A team of role-based agents reading your Business Brain, with every send staged in Mission Control for your approval.",
    },
    {
      label: "Where the work lives",
      them: "Inside Catch. Leave, and the assistant and its context stay behind.",
      pa: "In accounts you own — your GitHub, your Vercel, your Supabase. Leave, and the work stays with you.",
    },
    {
      label: "Pricing",
      them: "$99 a month flat, phone calls included, 7-day free trial.",
      pa: "$37, $97, or $497 a month. Flat. No usage meter.",
    },
  ],
  difference: [
    "Catch deserves the credit first. It's a focused executive assistant with more live channels than almost anyone — Gmail, Outlook, SMS, WhatsApp, iMessage, Slack, phone, Zoom — and it carries SOC 2 Type II, CASA Tier-2, and Google verification. We have none of those certifications yet. If what you want is impeccable inbox-and-calendar triage from a product with the compliance paperwork done, Catch is ahead of us today on both counts.",
    "The split is scope. Catch stops at the admin layer: it manages your communication so you can do the work. Pocket Agent's Admin AI Agent does that same triage — and then the other nine agents do the work itself. The Sales AI Agent drafts outreach and chases every lead. The Marketing AI Agent builds landing pages. The Content AI Agent writes the newsletter. The Customer Support AI Agent answers customers with your full history in hand. An assistant saves you hours. A team moves the revenue line.",
    "And the line Catch doesn't cross: ownership. Everything Catch learns about you lives inside Catch. Everything Pocket Agent builds lands in accounts you own — your Business Brain is a folder of plain files in your own GitHub (a free account you set up in under a minute — Pocket Agent walks you through it), your landing pages go live on your own Vercel (also free, also under a minute to set up), and your customer records sit in your own Supabase (same — free, quick to set up, no technical knowledge required). Cancel tomorrow and the sites stay live, the brain stays yours, every email already sent is sent. The agents themselves stop — they live in Pocket Agent — but everything they made is yours.",
  ],
  moatLine:
    "You own the stack. You rent the workers. Catch's assistant takes everything it knows about you with it the day you leave — ours leaves it all in your accounts.",
  featureGroups: [
    {
      title: "What the product does",
      rows: [
        {
          label: "The pitch",
          them: "An AI executive assistant that handles your communication.",
          pa: "A packaged AI team that runs the work, not just the inbox.",
          verdict: "even",
        },
        {
          label: "Scope",
          them: "Admin: email, calendar, calls, reminders, follow-ups.",
          pa: "Admin plus sales, marketing, content, customer support, research, operations, ideas, and voice.",
          verdict: "pa",
        },
        {
          label: "Built for",
          them: "Busy executives and founders who need the communication layer handled.",
          pa: "Owner-led businesses doing $250K–$5M, where the owner is the bottleneck on everything.",
          verdict: "even",
        },
      ],
    },
    {
      title: "Capabilities",
      rows: [
        {
          label: "Channels live today",
          them: "Gmail, Outlook, SMS, WhatsApp, iMessage, Slack, phone, Zoom, Google Meet.",
          pa: "Slack, SMS, WhatsApp, iMessage, forwarded email, iPhone share sheet, and the web app. No phone-answering for outsiders on the entry tiers — the Voice AI Agent covers that at the top tier.",
          verdict: "them",
        },
        {
          label: "Business memory",
          them: "The assistant learns your preferences and history inside Catch.",
          pa: "A Business Brain — plain files in your own GitHub holding your voice, prices, customers, and decisions. Every agent reads it; every run sharpens it.",
          verdict: "pa",
        },
        {
          label: "Does the actual work",
          them: "Manages communication around the work.",
          pa: "Drafts the proposal, builds the landing page, writes the newsletter, chases the lead, answers the customer.",
          verdict: "pa",
        },
        {
          label: "Builds things",
          them: "No — it's an assistant, not a builder.",
          pa: "The Idea AI Agent takes an idea to a working website with a signup form and a database, live on your own accounts.",
          verdict: "pa",
        },
        {
          label: "Approval control",
          them: "The assistant acts on your behalf with configurable autonomy.",
          pa: "Every outgoing send is staged in Mission Control until you tap approve. Spend is visible to the cent, with a budget cap.",
          verdict: "pa",
        },
      ],
    },
    {
      title: "Ownership",
      rows: [
        {
          label: "Where the work lives",
          them: "Inside Catch's platform, hosted in the US.",
          pa: "Your GitHub, your Vercel, your Supabase — accounts in your name.",
          verdict: "pa",
        },
        {
          label: "After you cancel",
          them: "Access ends. The assistant's knowledge of you stays behind.",
          pa: "Sites stay live, the brain stays yours, everything already made stays. The agents themselves stop — they need Pocket Agent to run.",
          verdict: "pa",
        },
        {
          label: "Compliance",
          them: "SOC 2 Type II, CASA Tier-2, Google verified.",
          pa: "None yet. SOC 2 Type I is planned. If certification is a hard requirement, Catch wins this row outright.",
          verdict: "them",
        },
      ],
    },
    {
      title: "Pricing",
      rows: [
        {
          label: "Price",
          them: "$99 a month flat, one plan, calls included.",
          pa: "$37 entry, $97 for the working tier, $497 for the full workspace.",
          verdict: "even",
        },
        {
          label: "Trial",
          them: "7-day free trial.",
          pa: "No free trial — you start at $37 and the first week is a guided setup.",
          verdict: "them",
        },
      ],
    },
  ],
  pickThem: [
    "You want one thing done impeccably: inbox, calendar, and calls handled.",
    "You need the assistant answering your phone and sitting in your Zoom calls today.",
    "SOC 2 Type II or Google verification is a hard requirement right now.",
    "You'd rather have one assistant to talk to than a team to direct.",
  ],
  pickPa: [
    "You need the admin handled and the sales, marketing, content, and support work done too.",
    "You want the work — websites, pages, customer records, memory — in accounts you own.",
    "You want agents that build things, not just manage your communication.",
    "You want to start at $37 instead of $99 and add agents as the load grows.",
  ],
  faq: [
    {
      q: "Is Catch better at pure executive-assistant work?",
      a: "On channel breadth, yes — phone and Zoom are live on Catch today, and that matters if calls are your bottleneck. Pocket Agent's Admin AI Agent covers the triage, recaps, and follow-ups, and the Voice AI Agent handles phone at the top tier. If EA work is the entire job, Catch is a fair pick.",
    },
    {
      q: "Why does Pocket Agent start cheaper than Catch?",
      a: "Different shapes. Catch is one plan, $99, everything included. Pocket Agent tiers by how much team you need: $37 gets your Business Brain and first agent, $97 gets the working team across your connected tools, $497 gets every agent and every App. Most owners land at $97 — still under Catch's one price.",
    },
    {
      q: "Pocket Agent has no SOC 2. Should that stop me?",
      a: "It depends who your customers are. If you sell into companies that audit vendors, Catch's SOC 2 Type II is a real advantage and we won't argue it. SOC 2 Type I is planned on our side. If you're an owner-led business without procurement reviews, the certification question matters less than where your data lives — and ours lives in accounts you own.",
    },
    {
      q: "What actually happens if I cancel Pocket Agent?",
      a: "Everything the agents made stays: websites live on your Vercel, the Business Brain in your GitHub, customer data in your Supabase. The agents themselves stop — they run inside Pocket Agent. Come back any time and pick up where you left off.",
    },
  ],
};

export default function CompareCatchPage() {
  return <CompareLanding copy={COPY} />;
}
