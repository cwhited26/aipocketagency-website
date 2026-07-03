// compose-persona.ts — §19 step 2: pick the closest shipped role template, name the persona
// after the job, and set a starter prompt from the parsed intent. Deterministic — no model
// call. The persona name ALWAYS carries the intent's job-noun suffix, so it can never
// duplicate a shipped template's suggested name; collisions with the owner's existing
// personas get a numeric suffix on top.

import { getTemplate, listTemplates, type PersonaTemplate } from "@/lib/personas/templates";
import { slugifyPersonaName } from "@/lib/personas/types";
import type { AgentRole, ParsedIntent } from "./types";

// Every AgentRole resolves to a shipped template key — the compose surface can only ever
// clone what's in the catalog (composition, not generation).
const ROLE_TO_TEMPLATE: Record<AgentRole, string> = {
  sales: "sales",
  followup: "followup",
  email: "email",
  content: "content",
  lead_research: "lead-research",
  admin: "admin",
  ops: "ops-cos",
  support: "vcsa",
  recruiting: "vr",
  marketing: "vmd",
};

export function templateKeyForRole(role: AgentRole): string {
  return ROLE_TO_TEMPLATE[role];
}

function titleCase(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export type ComposedPersona = {
  templateKey: string;
  template: PersonaTemplate;
  name: string;
  slug: string;
  tone: string;
  starterPrompt: string;
  customFields: Record<string, string>;
};

/**
 * Composes the persona layer from the parsed intent. `existingNames` are the owner's current
 * persona names (case-insensitive dedupe — an archived persona still holds its slug).
 */
export function composePersona(params: {
  intent: ParsedIntent;
  existingNames: readonly string[];
}): ComposedPersona {
  const { intent } = params;
  const template = getTemplate(templateKeyForRole(intent.role)) ?? getTemplate("admin");
  if (!template) {
    // The admin template is a shipped constant; reaching here means the catalog itself broke.
    throw new Error("compose-persona: no shipped template resolved");
  }

  // "Sales Assistant — Adjuster Follow-Up": the suffix keeps composed names disjoint from
  // every shipped suggestedName (belt: assert it anyway).
  const jobNoun = titleCase(intent.jobNoun);
  const base = `${template.suggestedName} — ${jobNoun}`;
  const taken = new Set(params.existingNames.map((n) => n.trim().toLowerCase()));
  for (const shipped of listTemplates()) taken.add(shipped.suggestedName.trim().toLowerCase());

  let name = base;
  let n = 2;
  while (taken.has(name.trim().toLowerCase())) {
    name = `${base} ${n}`;
    n += 1;
  }

  // The starter prompt is the first thing the owner fires to see the agent working — the
  // parsed job itself, phrased as a first pass.
  const starterPrompt = `Run a first pass now: ${intent.summary}`;

  // Tune the spec fields against the parsed intent. The voice line binds the agent to the
  // owner's voice zone in their own Business Brain — read before drafting, never invented.
  const customFields: Record<string, string> = {
    goal: intent.summary,
    features: [intent.does, intent.watches ? `Watches: ${intent.watches}` : ""]
      .filter(Boolean)
      .join("\n"),
  };
  if (intent.voice === "owner") {
    customFields.constraints =
      `${template.fields.constraints ?? ""}\n` +
      "Write customer-facing output in the owner's voice: read the voice zone of the " +
      "Business Brain before drafting, and stage every send for the owner's approval.";
  }

  return {
    templateKey: template.key,
    template,
    name,
    slug: slugifyPersonaName(name),
    tone: template.defaultTone,
    starterPrompt,
    customFields,
  };
}
