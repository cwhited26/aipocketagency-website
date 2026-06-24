// seed.ts — the 8-template ritual seed pack (PA-RITUAL-7, SPEC §10) + the target resolver.
//
// The pack mirrors the Launch Kit / Workflow Vault pattern: the owner taps "install" on a named
// template and it adds a ritual with a sensible schedule + target, which he then edits. The seeds carry
// the canonical cron directly (they're pre-authored, not owner-typed, so they skip the natural-language
// parser — that's only for what the owner types in the create flow), plus a plain-English schedule echo
// for the UI.
//
// resolveRitualTarget maps a ritual's slug to a deep-link target. Most targets are Apps from the
// catalog; one seed (Decision Roundtable Prep) points at a product surface that has a page but isn't an
// Apps-catalog entry, so the resolver also carries a small surfaces table. The create route validates a
// ritual's slug through this resolver, and the run executor deep-links through it — one source of truth.

import { getApp } from "@/lib/apps/catalog";
import type { RitualDelivery } from "./types";

export type RitualTarget = {
  /** The slug stored on the ritual's app_slug column. */
  slug: string;
  label: string;
  href: string;
  /** One line of what it does, used in the staged result card. */
  blurb: string;
};

// Product surfaces a ritual can target that aren't Apps-catalog entries (they have a page, but no AppId).
// Decision Roundtable lives in chat + /app/decisions, not the Apps grid — the seed pack points here.
// capture-inbox is the retired Capture Inbox App: its captures live in the unified Captures Dashboard
// now, so the Daily Inbox Digest seed deep-links there instead of a catalog card.
const RITUAL_SURFACES: Record<string, RitualTarget> = {
  "decision-roundtable": {
    slug: "decision-roundtable",
    label: "Decision Roundtable",
    href: "/app/decisions",
    blurb: "Three of your agents argue a flagged decision and bring you a verdict.",
  },
  "capture-inbox": {
    slug: "capture-inbox",
    label: "Captures Dashboard",
    href: "/app/captures",
    blurb: "Sorts what you captured overnight so the morning's filing is waiting.",
  },
};

/** Resolve a ritual's slug to its deep-link target — a catalog App first, then a known surface, else
 *  null. The create route uses this to validate a slug; the run executor uses it to build the card. */
export function resolveRitualTarget(slug: string): RitualTarget | null {
  const app = getApp(slug);
  if (app) return { slug: app.id, label: app.label, href: app.href, blurb: app.blurb };
  return RITUAL_SURFACES[slug] ?? null;
}

// ── The 8 seed templates ───────────────────────────────────────────────────────────

export type RitualSeed = {
  /** Stable id the install route looks the seed up by. */
  id: string;
  name: string;
  /** Catalog AppId or a known surface slug — must resolve through resolveRitualTarget. */
  appSlug: string;
  /** The canonical cron the ritual stores. */
  cron: string;
  biWeekly: boolean;
  /** Plain-English schedule echo, stored as the ritual's schedule_natural_text. */
  scheduleText: string;
  delivery: RitualDelivery;
  /** What this ritual does, shown on the install card. Voice-checked, plain English. */
  description: string;
};

export const RITUAL_SEEDS: RitualSeed[] = [
  {
    id: "monday-sales-pipeline-review",
    name: "Monday Sales Pipeline Review",
    appSlug: "lead-scout",
    cron: "0 20 * * 0",
    biWeekly: false,
    scheduleText: "Every Sunday at 8:00 PM",
    delivery: "inbox",
    description:
      "Reviews your open leads and stages a summary the night before the week starts, so Monday opens with the pipeline already read.",
  },
  {
    id: "daily-inbox-digest",
    name: "Daily Inbox Digest",
    appSlug: "capture-inbox",
    cron: "0 6 * * *",
    biWeekly: false,
    scheduleText: "Every day at 6:00 AM",
    delivery: "inbox",
    description: "Sorts what you captured overnight and has the morning's filing waiting before you sit down.",
  },
  {
    id: "weekly-follow-up-sweep",
    name: "Weekly Follow-Up Sweep",
    appSlug: "follow-up-sweeps",
    cron: "0 8 * * 0",
    biWeekly: false,
    scheduleText: "Every Sunday at 8:00 AM",
    delivery: "inbox",
    description: "Finds the contacts that went quiet and drafts the next touch for each, every Sunday.",
  },
  {
    id: "monthly-idea-engine-pulse",
    name: "Monthly Idea Engine Pulse",
    appSlug: "idea-engine",
    cron: "0 9 1 * *",
    biWeekly: false,
    scheduleText: "Monthly on the 1st at 9:00 AM",
    delivery: "inbox",
    description: "Pulls the ideas you captured this month and asks the one question worth answering: what to build next.",
  },
  {
    id: "end-of-day-email-drafts",
    name: "End-of-Day Email Drafts",
    appSlug: "email-drafter",
    cron: "0 17 * * 1-5",
    biWeekly: false,
    scheduleText: "Every weekday at 5:00 PM",
    delivery: "inbox",
    description: "Drafts the replies you flagged during the day so they're ready to send before you close the laptop.",
  },
  {
    id: "tuesday-decision-roundtable-prep",
    name: "Tuesday Decision Roundtable Prep",
    appSlug: "decision-roundtable",
    cron: "0 7 * * 2",
    biWeekly: false,
    scheduleText: "Every Tuesday at 7:00 AM",
    delivery: "inbox",
    description: "Surfaces the week's flagged decisions and stages the one worth putting to a debate.",
  },
  {
    id: "quarterly-brain-map-review",
    name: "Quarterly Brain Map Review",
    appSlug: "brain-map",
    cron: "0 10 1 1,4,7,10 *",
    biWeekly: false,
    scheduleText: "Quarterly, on the 1st at 10:00 AM",
    delivery: "inbox",
    description: "Stages a read of what changed in your brain this quarter — what PA learned, and where the gaps still are.",
  },
  {
    id: "wednesday-podcast-catch-up",
    name: "Wednesday Podcast Catch-Up",
    appSlug: "podcasts",
    cron: "0 12 * * 3",
    biWeekly: false,
    scheduleText: "Every Wednesday at 12:00 PM",
    delivery: "inbox",
    description: "Pulls what mattered from the shows you watch into one mid-week read, so you skip the hours of audio.",
  },
];

export function getSeed(id: string): RitualSeed | null {
  return RITUAL_SEEDS.find((s) => s.id === id) ?? null;
}
