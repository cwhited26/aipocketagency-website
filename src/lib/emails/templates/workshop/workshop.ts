// lib/emails/templates/workshop/* — the 4-email pre-workshop sequence (PA-POS-38 §24.4).
// Anchored to the attendee's chosen slot: confirmation now, reminder at T-24h, countdown at T-1h,
// lobby-open at T-15m. Voice per voice/chase-spec.md — no urgency theater, honest math, the
// cancel-anytime line rides the confirmation. Each is a pure data function via composeEmail.

import { composeEmail, SITE_ORIGIN, type RenderedEmail } from "../../render";
import type { BaseEmailProps } from "../shared";
import { SKOOL_URL } from "@/lib/constants/skool";

export type WorkshopEmailProps = BaseEmailProps & {
  /** Absolute lobby URL for this registration. */
  lobbyUrl?: string | null;
  /** Human-readable slot time in the attendee's timezone, e.g. "Tuesday, July 7 at 1:00 PM (CDT)". */
  slotDisplay?: string | null;
  /** Whether the Fast-Start Brain Import bump was purchased. */
  bump?: boolean | null;
};

const WORKBOOK_URL = `${SITE_ORIGIN}/workshop/workbook.pdf`;

function slotLine(pr: WorkshopEmailProps): string {
  return pr.slotDisplay ? `Your session: ${pr.slotDisplay}.` : "Your session time is on your confirmation page.";
}

function lobbyHref(pr: WorkshopEmailProps): string {
  return pr.lobbyUrl ?? `${SITE_ORIGIN}/workshop`;
}

// ── Email 1: purchase confirmation (immediate) ───────────────────────────────────────────────────
export function workshopPurchaseConfirmation(pr: WorkshopEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "You're in — the Business Brain Workshop",
    transactional: true,
    blocks: [
      { kind: "p", text: "Your seat is booked." },
      { kind: "p", text: slotLine(pr) },
      { kind: "p", text: "What you bought:" },
      {
        kind: "bullets",
        items: [
          "The 60-minute Business Brain Workshop — you build alongside me, live on your screen.",
          "The 15-page workbook (link below — save it before your session).",
          "The template repo you'll fork during the workshop. It ends up in YOUR GitHub, not ours.",
          "30 days of Pocket Agent Business Agent tier — already provisioned.",
          "Skool community access, including the Friday Implementation Lab. Lifetime.",
          ...(pr.bump
            ? ["Fast-Start Brain Import — we pre-populate your Brain before your session."]
            : []),
        ],
      },
      { kind: "h", text: "One piece of homework" },
      {
        kind: "p",
        text: "You need a free GitHub account before your session — that's where your Business Brain will live, under your name. If you don't have one, create it at github.com now so the fork step is one click on the day.",
      },
      { kind: "button", label: "Download the workbook", href: WORKBOOK_URL },
      {
        kind: "p",
        text: "Your workshop lobby opens 15 minutes before your slot. The link lands in your inbox — and it's the same one below.",
      },
      { kind: "button", label: "Your workshop lobby", href: lobbyHref(pr) },
      {
        kind: "p",
        text: "The plain math, so there's no surprise on day 31: you paid $97 today. That covered the workshop and your first 30 days of Business Agent. On day 31, Pocket Agent renews at $97/mo unless you cancel — one click in Settings. You keep the workshop, the workbook, your repo, and Skool either way.",
      },
      { kind: "p", text: "— Chase" },
    ],
  });
}

// ── Email 2: T-24h reminder ──────────────────────────────────────────────────────────────────────
export function workshopReminder24h(pr: WorkshopEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Tomorrow: your Business Brain gets built",
    blocks: [
      { kind: "p", text: slotLine(pr) },
      {
        kind: "p",
        text: "Tomorrow you build the thing that stops you re-explaining your business to your AI every conversation. Sixty minutes, five zones, your own repo at the end of it.",
      },
      { kind: "p", text: "Three things to have ready:" },
      {
        kind: "bullets",
        items: [
          "A GitHub account, logged in.",
          "The workbook, downloaded (link below).",
          "65 minutes blocked. The build steps happen live — catching up later means pausing a video that doesn't pause.",
        ],
      },
      { kind: "button", label: "Download the workbook", href: WORKBOOK_URL },
      { kind: "p", text: "Lobby opens 15 minutes before your slot:" },
      { kind: "button", label: "Your workshop lobby", href: lobbyHref(pr) },
    ],
  });
}

// ── Email 3: T-1h countdown ──────────────────────────────────────────────────────────────────────
export function workshopReminder1h(pr: WorkshopEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "One hour out",
    blocks: [
      { kind: "p", text: slotLine(pr) },
      { kind: "p", text: "GitHub open. Workbook saved. 65 minutes blocked." },
      { kind: "p", text: "The lobby opens 15 minutes before we start. See you in there." },
      { kind: "button", label: "Your workshop lobby", href: lobbyHref(pr) },
    ],
  });
}

// ── Email 4: T-15m lobby open ────────────────────────────────────────────────────────────────────
export function workshopLobbyOpen(pr: WorkshopEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Your lobby is open",
    blocks: [
      { kind: "p", text: "The doors are open. Your session starts on the countdown." },
      { kind: "button", label: "Enter the lobby", href: lobbyHref(pr) },
      {
        kind: "p",
        text: "Run the checklist on the lobby screen while you wait — GitHub open, workbook saved, time blocked. When the countdown hits zero the workshop starts on its own.",
      },
      { kind: "p", text: `After the session, the conversation continues in Skool: ${SKOOL_URL}` },
    ],
  });
}
