// lib/emails/templates/shared.ts — common props + deep-link constants for the email templates.
// Every template imports from here so the in-app links and the base prop shape live in one place.

import { SKOOL_URL } from "@/lib/constants/skool";
import { APP_ORIGIN, SITE_ORIGIN } from "../render";

/** The base prop every template accepts: who it's going to (for the footer) + an optional first name. */
export type BaseEmailProps = {
  email: string;
  firstName?: string | null;
};

// In-app + marketing deep links. Kept as data so a surface rename is a one-line change here.
export const LINKS = {
  app: `${APP_ORIGIN}/app`,
  businessBrain: `${APP_ORIGIN}/app/onboarding`,
  documents: `${APP_ORIGIN}/app/documents`,
  personas: `${APP_ORIGIN}/app/personas`,
  apps: `${APP_ORIGIN}/app/apps`,
  missionControl: `${APP_ORIGIN}/app`,
  captureInbox: `${APP_ORIGIN}/app/apps/capture-inbox`,
  followUpSweeps: `${APP_ORIGIN}/app/apps/follow-up-sweeps`,
  leadScout: `${APP_ORIGIN}/app/apps/lead-scout`,
  ideaEngine: `${APP_ORIGIN}/app/apps/ideas`,
  launchKit: `${APP_ORIGIN}/app/launch-kit`,
  setupSprint: `${APP_ORIGIN}/app/setup-sprint`,
  // The Pocket Agent Launchpad (Skool community) — links direct to the real Skool URL for
  // trackability. The internal `${SITE_ORIGIN}/skool-invite` route 308-redirects to the same place.
  launchpad: SKOOL_URL,
  pricing: `${SITE_ORIGIN}/pricing`,
  enterprise: `${SITE_ORIGIN}/enterprise`,
  start: `${SITE_ORIGIN}/start`,
  diyKit: `${APP_ORIGIN}/app/apps/diy-kit`,
} as const;
