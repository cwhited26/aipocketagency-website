// create.ts — the one persona-creation sequence, shared by POST /api/personas (the wizard) and
// the vertical-onboarding seeder (lib/onboarding/vertical-seed.ts). Four steps, in order: write
// the spec file into the owner's brain repo, declare the ContainmentGuard zone, insert the
// personas row, insert the immutable v1 spec and point the persona at it. The brain writes come
// FIRST on purpose — the persona's spec lives in the owner's own repo (PA-POS-19), the DB row
// only points at it.
//
// Brain-write failures return a typed { ok: false } (the repo is the owner's — a 502 there is
// actionable, not exceptional). DB failures throw PersonaDbError, same as every lib/personas/db.ts
// caller expects — the wizard route translates a duplicate-slug 409 into its "pick a different
// name" message, the seeder treats it as "this role already exists".

import { insertPersona, insertSpec, updatePersona } from "./db";
import { applyTemplate, type PersonaTemplate } from "./templates";
import { buildPersonaSpecMarkdown } from "./spec";
import {
  personaScope,
  personaSpecPath,
  personaZoneKey,
  personaZonePattern,
  slugifyPersonaName,
  type PersonaRow,
  type ToneKey,
} from "./types";
import { commitMemoryFile } from "@/lib/pa-brain";
import { loadZoneConfig, saveZoneConfig, withZone } from "@/lib/brain/containment-guard";
import type { AppId } from "@/lib/apps/catalog";

export type CreatePersonaContext = {
  userId: string;
  brainRepo: string;
  githubToken: string;
};

export type CreatePersonaResult =
  | { ok: true; persona: PersonaRow }
  | { ok: false; status: number; error: string };

export async function createPersonaFromTemplate(input: {
  ctx: CreatePersonaContext;
  template: PersonaTemplate;
  name: string;
  tone: ToneKey;
  customFields: Record<string, string>;
  apps: AppId[];
}): Promise<CreatePersonaResult> {
  const { ctx, template, name, tone, customFields, apps } = input;

  const slug = slugifyPersonaName(name);
  const specFields = applyTemplate({ template, personaName: name, customFields });
  const specMarkdown = buildPersonaSpecMarkdown(specFields);
  const specPath = personaSpecPath(slug);
  const zoneKey = personaZoneKey(slug);

  // 1. Write the spec file (persona.md) into the brain repo.
  const specWrite = await commitMemoryFile({
    repo: ctx.brainRepo,
    token: ctx.githubToken,
    path: specPath,
    mode: "replace",
    content: specMarkdown,
    commitMessage: `persona: create ${personaScope(slug)} from template ${template.key}`,
  });
  if (!specWrite.ok) {
    return { ok: false, status: 502, error: specWrite.error };
  }

  // 2. Declare the persona's ContainmentGuard zone (knowledge folder).
  const { config } = await loadZoneConfig(ctx.brainRepo, ctx.githubToken);
  const nextConfig = withZone(config, zoneKey, [personaZonePattern(slug)]);
  const zoneWrite = await saveZoneConfig({
    repo: ctx.brainRepo,
    token: ctx.githubToken,
    config: nextConfig,
  });
  if (!zoneWrite.ok) {
    return { ok: false, status: 502, error: zoneWrite.error };
  }

  // 3. Create the persona row (throws PersonaDbError — a duplicate slug surfaces as 409).
  const persona = await insertPersona({
    business_id: ctx.userId,
    owner_user_id: ctx.userId,
    name,
    slug,
    template_key: template.key,
    tone,
    status: "active",
    spec_path: specPath,
    knowledge_zone_key: zoneKey,
    accessible_apps: apps,
  });

  // 4. Insert the immutable v1 spec row and point the persona at it.
  const spec = await insertSpec({
    persona_id: persona.id,
    version: 1,
    body_md: specMarkdown,
    created_by: ctx.userId,
  });
  const updated = await updatePersona(persona.id, { current_spec_version: spec.id });

  return { ok: true, persona: updated ?? persona };
}
