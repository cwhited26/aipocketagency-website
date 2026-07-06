// lib/workshop/copy.ts — every customer-facing string on the workshop funnel pages, in one
// module so the vitest voice gate scans it (PA-POS-38 §24.7: honest math, no urgency theater,
// cancel-anytime always visible; voice per voice/chase-spec.md §10 + PA-POS-19 ownership frame).

import {
  WORKSHOP_BUMP_CENTS,
  WORKSHOP_OTO1_CENTS,
  WORKSHOP_OTO2_CENTS,
  WORKSHOP_PRICE_CENTS,
  WORKSHOP_VALUE_TOTAL_CENTS,
  formatWorkshopPrice,
} from "./product";

export const WORKSHOP_COPY = {
  hero: {
    pill: "[ the business brain workshop ]",
    headline: "The Business Brain Workshop — give your AI a permanent memory of your business in 60 minutes.",
    sub: "Every new AI conversation starts from zero. You re-explain your customers, your prices, your voice — every time. In 60 minutes you build the fix: a five-zone Business Brain in a GitHub repo you own, connected to your AI, maintained by Pocket Agent from day one.",
  },
  bullets: [
    "The 60-minute workshop — you build alongside Chase, live on your screen. Fork, fill, connect: your Brain exists before the video ends.",
    "The 15-page workbook — per-zone prompts, so you're never staring at a blank file.",
    "The template repo — forked into YOUR GitHub as your-username/business-brain. Your repo, not our database.",
    "30 days of Pocket Agent Business Agent tier — the agent that maintains the Brain you just built.",
    "Skool community access + the Friday Implementation Lab. Lifetime — you keep it even if you cancel.",
  ],
  frame: {
    heading: "The plain math",
    valueLine: `${formatWorkshopPrice(WORKSHOP_VALUE_TOTAL_CENTS)} of value. You pay ${formatWorkshopPrice(WORKSHOP_PRICE_CENTS)} today.`,
    renewal:
      "Pocket Agent renews at $97/mo on day 31 unless you cancel. One-click cancel in Settings. You keep the workshop, the workbook, your repo, and Skool forever.",
  },
  cta: `Reserve your seat — ${formatWorkshopPrice(WORKSHOP_PRICE_CENTS)}`,
  slotPicker: {
    heading: "Pick your session",
    sub: "Three sessions a day for the next seven days, in your timezone. You build during the session — block the full 65 minutes.",
  },
  checkout: {
    heading: "Reserve your seat",
    bumpLabel: `+${formatWorkshopPrice(WORKSHOP_BUMP_CENTS)} Fast-Start Brain Import`,
    bumpDetail:
      "We pre-populate your Brain with your voice, customers, and products before the workshop — you start the session editing, not typing from scratch.",
    payButton: `Reserve your seat — ${formatWorkshopPrice(WORKSHOP_PRICE_CENTS)}`,
    underButton:
      "You pay $97 today. Pocket Agent renews at $97/mo on day 31 unless you cancel — one click, and everything you built stays yours.",
  },
  oto1: {
    pill: "[ one-time offer — before you go ]",
    heading: "Want me to set the whole thing up with you?",
    body: "The workshop gets your Brain built. The Setup Sprint gets your whole workspace running: 60 minutes with me, one-on-one — your Brain wired, your first three Personas composed, your workflows live, your first week mapped. You leave with a working AI office, not a to-do list.",
    price: `${formatWorkshopPrice(WORKSHOP_OTO1_CENTS)}, one time`,
    yes: `Add the Setup Sprint — ${formatWorkshopPrice(WORKSHOP_OTO1_CENTS)}`,
    yesDetail: "Charged to the card you just used. No re-entry.",
    no: "No thanks — I'll set it up myself with the workshop",
  },
  oto2: {
    pill: "[ one-time offer — the backstage pass ]",
    heading: "Every workshop I ever run — yours.",
    body: "The Backstage Pass is lifetime access: every future workshop automatically, the behind-the-scenes builds, the monthly Q&A, and the private Skool tier. One payment, no renewal, no expiration.",
    price: `${formatWorkshopPrice(WORKSHOP_OTO2_CENTS)}, one time`,
    yes: `Add the Backstage Pass — ${formatWorkshopPrice(WORKSHOP_OTO2_CENTS)}`,
    yesDetail: "Charged to the card you just used. No re-entry.",
    no: "No thanks — take me to my confirmation",
  },
  thanks: {
    heading: "You're in.",
    lobbyNote:
      "Check your inbox for your workshop lobby link — the lobby opens 15 minutes before your slot. Your confirmation email is already on its way.",
  },
  lobby: {
    lockedHeading: "Your session isn't open yet.",
    checklist: ["GitHub open?", "Workbook saved?", "65 min blocked?"],
    checklistHint: "Tick all three — when the countdown hits zero, the workshop starts on its own.",
  },
  player: {
    unprovisioned:
      "The workshop video isn't wired up yet. Your registration is good — this screen goes live once the recording is published.",
    chatPlaceholder: "Say something — Chase reviews every message after the session.",
  },
} as const;
