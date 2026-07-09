// lib/analytics/events.ts — product analytics event surface (GTM Phase 4, Part 7Z).
//
// There is no analytics backend wired yet, so `trackEvent` is a no-op-but-instrumented stub:
// every call is recorded as one structured JSON line (the channels/log.ts house pattern, scope
// "analytics"), greppable in the platform logs. When a real tracker lands (PostHog / Segment /
// custom), only this file changes — the instrumented call sites stay put. That's the whole point
// of routing every activation/usage/monetization/retention event through one typed helper.
//
// Slugs are a closed union so a typo is a compile error, not a silently-dropped event. The four
// groups below mirror Part 7Z verbatim.

type Level = "info";

/** Activation funnel — the 3-3-3 path the whole app is built around. */
export const ACTIVATION_EVENTS = [
  "account_created",
  "plan_selected",
  "first_login",
  "business_brain_created",
  "business_brain_asset_added",
  "three_business_brain_assets_added",
  "persona_cloned",
  "persona_customized",
  "three_personas_created",
  "workflow_installed",
  "three_workflows_installed",
  "mission_control_opened",
  "mission_control_item_reviewed",
  "activation_333_completed",
  "launchpad_joined",
] as const;

/** App usage — a Persona used an App to prepare work. */
export const APP_USAGE_EVENTS = [
  "capture_inbox_item_added",
  "email_draft_generated",
  "follow_up_sweep_run",
  "lead_scout_run",
  "lead_scout_prospects_approved",
  "youtube_video_ingested",
  "youtube_channel_watch_added",
  "podcast_episode_ingested",
  "podcast_show_watch_added",
  "landing_page_generated",
  "idea_engine_run_started",
  "idea_engine_page_generated",
  "idea_engine_prospects_generated",
  "decision_roundtable_started",
  "build_tools_run_started",
  "brain_map_opened",
] as const;

/** Monetization — pricing, upgrade prompts, add-ons, and money-model purchases. */
export const MONETIZATION_EVENTS = [
  "pricing_viewed",
  "upgrade_prompt_shown",
  "upgrade_prompt_clicked",
  "plan_upgraded",
  "usage_limit_hit",
  "pa_sync_prompt_shown",
  "pa_sync_purchased",
  "pa_publish_prompt_shown",
  "pa_publish_purchased",
  "dwy_setup_purchased",
  "pilot_purchased",
  "diy_kit_purchased",
  "enterprise_application_started",
] as const;

/** Retention — return visits, repeated workflows, and exit signals. */
export const RETENTION_EVENTS = [
  "day_1_active",
  "day_3_active",
  "day_7_active",
  "day_14_active",
  "day_30_active",
  "workflow_repeated",
  "mission_control_reviewed_twice",
  "launchpad_win_posted",
  "cancel_flow_started",
  "downgrade_selected",
  "support_request_submitted",
] as const;

/** Launch funnel — the start.aipocketagent.com qualifier quiz → license-matched offer flow. */
export const FUNNEL_EVENTS = [
  "funnel_landing_viewed",
  "funnel_quiz_started",
  "funnel_step_completed",
  "funnel_offer_viewed",
  "funnel_tier_selected",
  "funnel_checkout_started",
  "funnel_checkout_completed",
] as const;

/** GHL Agencies vertical — the /for/ghl-agency design-partner waitlist surface (SPEC v1 §9). */
export const GHL_AGENCY_EVENTS = [
  "ghl_agency_page_viewed",
  "ghl_waitlist_submitted",
] as const;

export const ANALYTICS_EVENTS = [
  ...ACTIVATION_EVENTS,
  ...APP_USAGE_EVENTS,
  ...MONETIZATION_EVENTS,
  ...RETENTION_EVENTS,
  ...FUNNEL_EVENTS,
  ...GHL_AGENCY_EVENTS,
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

function emit(level: Level, event: AnalyticsEvent, props?: AnalyticsProps): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    scope: "analytics",
    level,
    event,
    ...(props ?? {}),
  });
  // No real sink yet — structured line so the events are auditable until a tracker is wired.
  console.info(line);
}

/**
 * Record a product-analytics event. No-op against any external service today (just a structured
 * log line); the typed slug + props are the contract a future tracker reads. Never throws — an
 * analytics call must never break a user-facing flow.
 */
export function trackEvent(event: AnalyticsEvent, props?: AnalyticsProps): void {
  try {
    emit("info", event, props);
  } catch {
    // Swallowing here is intentional and bounded: analytics is best-effort and must not surface
    // to the user. A failure to serialize props is the only realistic path and is non-actionable.
  }
}

/** True if a string is a known event slug (defensive guard for dynamic call sites). */
export function isAnalyticsEvent(value: string): value is AnalyticsEvent {
  return (ANALYTICS_EVENTS as readonly string[]).includes(value);
}
