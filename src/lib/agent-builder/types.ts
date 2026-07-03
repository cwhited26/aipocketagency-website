// types.ts — the shared vocabulary of the Custom Agent Builder (PA-POS-27, Positioning Lock §19).
//
// Composition surface, NOT a code-generation surface: the parse step turns the owner's
// plain-English spec into a structured intent whose every field is an enum over SHIPPED PA
// primitives (role templates, App capabilities, brain zones). Nothing here can express
// "write arbitrary code" — that's the §19 "What it isn't" boundary, enforced by the schema.
//
// Zod at every boundary (repo rule): the parse output, the compose route body, and the
// approval-callback payload all validate through these schemas.

import { z } from "zod";

export const AGENT_BUILDER_PROPOSAL_KIND = "agent_builder_proposal" as const;
export const AGENT_BUILDER_SOURCE = "agent-builder" as const;

// ── Brain scopes ────────────────────────────────────────────────────────────────────────────
// The five Business Brain zones a composed agent may declare read access to (§19 step 5).
export const BRAIN_SCOPES = [
  "voice",
  "customers",
  "competitive",
  "decisions",
  "integrations",
] as const;
export type BrainScope = (typeof BRAIN_SCOPES)[number];
export const BrainScopeSchema = z.enum(BRAIN_SCOPES);

// ── Roles ───────────────────────────────────────────────────────────────────────────────────
// Every role maps 1:1 onto a shipped Persona template (compose-persona.ts). The parse step can
// only ever pick from this list — an agent PA can't compose from shipped parts fails the parse.
export const AGENT_ROLES = [
  "sales",
  "followup",
  "email",
  "content",
  "lead_research",
  "admin",
  "ops",
  "support",
  "recruiting",
  "marketing",
] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];
export const AgentRoleSchema = z.enum(AGENT_ROLES);

// ── Capabilities ────────────────────────────────────────────────────────────────────────────
// Each capability maps onto shipped Apps from src/lib/apps/catalog.ts (compose-toolkit.ts).
export const AGENT_CAPABILITIES = [
  "draft_email",
  "follow_up",
  "find_leads",
  "watch_website",
  "watch_competitor",
  "write_proposal",
  "build_landing_page",
  "build_mvp",
  "operate_browser",
  "daily_summary",
  "recurring_schedule",
  "message_channels",
  "watch_media",
  "capture_organize",
] as const;
export type AgentCapability = (typeof AGENT_CAPABILITIES)[number];
export const AgentCapabilitySchema = z.enum(AGENT_CAPABILITIES);

// ── Parsed intent (the parse step's output, Zod-validated) ──────────────────────────────────
export const ParsedIntentSchema = z.object({
  // One-line restatement of the job in plain English.
  summary: z.string().min(1).max(300),
  // Short noun phrase naming the job ("Adjuster Follow-Up", "Listing Watch") — becomes the
  // persona name suffix so a composed persona never collides with a shipped template name.
  jobNoun: z.string().min(1).max(60),
  role: AgentRoleSchema,
  // What the agent watches (inbox, a site, a saved search…). Empty when it's on-demand only.
  watches: z.string().max(300).default(""),
  // What it does when the watch fires / when asked.
  does: z.string().min(1).max(400),
  // Whose voice its output is written in. "owner" binds the voice brain zone.
  voice: z.enum(["owner", "neutral"]).default("owner"),
  // Plain-English schedule ("every Monday 8am") or null for on-demand.
  schedule: z.string().max(120).nullable().default(null),
  brainZones: z.array(BrainScopeSchema).max(5).default([]),
  capabilities: z.array(AgentCapabilitySchema).min(1).max(8),
  // Techniques the agent needs. compose-skills matches these against the starter Skill pack;
  // an unmatched one becomes a CANDIDATE Skill on the approval card — never auto-registered.
  neededTechniques: z.array(z.string().min(1).max(80)).max(5).default([]),
});
export type ParsedIntent = z.infer<typeof ParsedIntentSchema>;

// ── Candidate Skill (rides the approval card; never auto-registered) ────────────────────────
export const CandidateSkillSchema = z.object({
  slug: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(400),
  whenToUse: z.string().min(1).max(600),
  body: z.string().min(1).max(8_000),
});
export type CandidateSkill = z.infer<typeof CandidateSkillSchema>;

// ── The composed agent (the approval card's payload) ────────────────────────────────────────
export const ComposedAgentSchema = z.object({
  buildId: z.string().min(1).max(80),
  specText: z.string().min(1).max(4_000),
  intent: ParsedIntentSchema,
  personaTemplateKey: z.string().min(1).max(40),
  personaName: z.string().min(1).max(120),
  personaSlug: z.string().min(1).max(140),
  tone: z.string().min(1).max(40),
  starterPrompt: z.string().min(1).max(400),
  customFields: z.record(z.string(), z.string()).default({}),
  apps: z.array(z.string().min(1).max(60)).max(20),
  skillSlugs: z.array(z.string().min(1).max(60)).max(10),
  brainScopes: z.array(BrainScopeSchema).max(5),
  schedule: z.string().max(120).nullable(),
  candidateSkill: CandidateSkillSchema.nullable(),
});
export type ComposedAgent = z.infer<typeof ComposedAgentSchema>;

// ── pa_agent_builds row ─────────────────────────────────────────────────────────────────────
export const AGENT_BUILD_STATUSES = [
  "draft",
  "awaiting_approval",
  "approved",
  "rejected",
  "failed",
] as const;
export type AgentBuildStatus = (typeof AGENT_BUILD_STATUSES)[number];

export type AgentBuildRow = {
  id: string;
  owner_id: string;
  workspace_id: string | null;
  spec_text: string;
  parsed_intent: Record<string, unknown> | null;
  composed_persona_slug: string | null;
  composed_apps: string[];
  composed_skill_slugs: string[];
  composed_brain_scopes: string[];
  status: AgentBuildStatus;
  approval_inbox_item_id: string | null;
  created_at: string;
  updated_at: string;
};
