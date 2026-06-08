// lib/connectors/slack/action-types.ts — the shape every Slack action conforms to (SPEC v5
// §9.5 action descriptor). Kept in its own module so action files and the index can both
// import it without a cycle.

import type { z } from "zod";
import type { SlackResult } from "@/lib/slack";

/** The normalized outcome of an executed action: a one-line summary + structured detail. */
export type SlackActionResult = {
  /** Human-readable result, written to pa_connector_action_log.response_summary. */
  summary: string;
  /** Structured detail for callers that need it (e.g. message ts, channel list). */
  data: Record<string, unknown>;
};

export interface SlackActionDescriptor<I> {
  /** Unqualified action name (e.g. "post_message"); scope token is `slack:<name>`. */
  name: string;
  description: string;
  /** True for writes (approval-gated). False for reads (auto-approve eligible by default). */
  mutates: boolean;
  /** Reads are auto-approve eligible from day one; writes earn it via the trust window. */
  autoApproveEligibleByDefault: boolean;
  inputSchema: z.ZodType<I>;
  /** Human-readable preview rendered on the approval card (roadmap §3.6). */
  dryRunSummary: (input: I) => string;
  /** Stable, PII-aware fields for the audit trail. */
  auditFields: (input: I) => Record<string, unknown>;
  /** The real Web API call. `token` is a fresh bot token from ensureFreshSlackToken. */
  execute: (args: { token: string; input: I }) => Promise<SlackResult<SlackActionResult>>;
}
