// compose-toolkit.ts — §19 step 3: pick the composed agent's accessible_apps from the shipped
// catalog. Deterministic capability→App mapping — the toolkit can only ever contain Apps that
// exist in src/lib/apps/catalog.ts (sanitizeAppIds is the final guard), which is the whole
// point: composition over shipped primitives, nothing invented.

import { sanitizeAppIds, type AppId } from "@/lib/apps/catalog";
import type { AgentCapability, ParsedIntent } from "./types";

const CAPABILITY_TO_APPS: Record<AgentCapability, AppId[]> = {
  draft_email: ["email-drafter", "followups"],
  follow_up: ["follow-up-sweeps", "followups", "email-drafter"],
  find_leads: ["lead-scout", "email-drafter"],
  watch_website: ["website-monitor"],
  watch_competitor: ["competitor-inspector"],
  write_proposal: ["proposal-generator", "quote"],
  build_landing_page: ["landing-page-builder"],
  build_mvp: ["idea-engine"],
  operate_browser: ["browser-agent"],
  daily_summary: ["daily-brief"],
  recurring_schedule: ["ritual-scheduler"],
  message_channels: ["channels"],
  watch_media: ["youtube", "podcasts"],
  capture_organize: ["brain-map"],
};

/** The Apps a capability set resolves to (exported for the compose tests). */
export function appsForCapability(capability: AgentCapability): readonly AppId[] {
  return CAPABILITY_TO_APPS[capability];
}

/**
 * Composes the toolkit: the union of each capability's Apps, plus the Ritual Scheduler when
 * the intent carries a schedule (a scheduled agent needs the App that owns recurrence).
 * De-duped and normalized to catalog order by sanitizeAppIds.
 */
export function composeToolkit(intent: ParsedIntent): AppId[] {
  const picked: AppId[] = [];
  for (const capability of intent.capabilities) {
    picked.push(...CAPABILITY_TO_APPS[capability]);
  }
  if (intent.schedule) picked.push("ritual-scheduler");
  return sanitizeAppIds(picked);
}
