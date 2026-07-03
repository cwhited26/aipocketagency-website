import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnedPersona, resolveOwner } from "@/lib/personas/owner";
import {
  fetchCurrentSpec,
  fetchLivePublicToken,
  fetchUsageMonthly,
  insertShareToken,
  listSeats,
  PersonaDbError,
  revokeAllPersonaTokens,
  updatePersona,
  upsertWidgetConfig,
} from "@/lib/personas/db";
import {
  evaluateCanUseMode,
  getCurrentTier,
  monthKey,
  TIER_LIMITS,
} from "@/lib/personas/tier-caps";
import { parsePersonaSpecMarkdown } from "@/lib/personas/spec";
import {
  modeSchema,
  personaNameSchema,
  toneSchema,
  isPublicMode,
  PERSONA_STATUSES,
} from "@/lib/personas/types";
import { generateShareToken } from "@/lib/personas/tokens";
import { sanitizeAppIds } from "@/lib/apps/catalog";
import { publicModesEnabled, PUBLIC_MODES_COMING_SOON } from "@/lib/personas/feature-flags";
import { publicChatUrlForToken } from "@/lib/personas/links";
import { markOnboardingStepComplete } from "@/lib/onboarding/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const owner = await resolveOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });

  try {
    const owned = await requireOwnedPersona(params.id, owner.ctx.userId);
    if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });
    const { persona } = owned;

    const [spec, seats, usage, tier] = await Promise.all([
      fetchCurrentSpec(persona),
      listSeats(persona.id),
      fetchUsageMonthly(persona.id, monthKey()),
      getCurrentTier(persona.business_id),
    ]);

    const limits = TIER_LIMITS[tier];
    const messageCap = limits.messagesPerMonthPerPersona;
    const messagesThisMonth = usage?.message_count ?? 0;

    // For public/widget personas, surface the live public link so the owner can copy it.
    let publicLink: string | null = null;
    if (isPublicMode(persona.mode)) {
      const liveToken = await fetchLivePublicToken(persona.id, persona.mode);
      if (liveToken) publicLink = publicChatUrlForToken(liveToken.token);
    }

    return NextResponse.json({
      persona,
      spec: spec
        ? { id: spec.id, version: spec.version, fields: parsePersonaSpecMarkdown(spec.body_md), createdAt: spec.created_at }
        : null,
      seats,
      usage: {
        messagesThisMonth,
        messageCap,
        capReached: messageCap !== null && messagesThisMonth >= messageCap,
      },
      tier,
      publicModesEnabled: publicModesEnabled(),
      publicLink,
    });
  } catch (e) {
    const status = e instanceof PersonaDbError ? e.status : 500;
    return NextResponse.json({ error: errMsg(e) }, { status });
  }
}

const patchSchema = z
  .object({
    name: personaNameSchema.optional(),
    tone: toneSchema.optional(),
    status: z.enum(PERSONA_STATUSES).optional(),
    mode: modeSchema.optional(),
    accessibleApps: z.array(z.string().max(40)).max(40).optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.tone !== undefined ||
      v.status !== undefined ||
      v.mode !== undefined ||
      v.accessibleApps !== undefined,
    { message: "Nothing to update" },
  );

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const owner = await resolveOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  try {
    const owned = await requireOwnedPersona(params.id, owner.ctx.userId);
    if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });
    const { persona } = owned;

    const { mode, accessibleApps, ...rest } = parsed.data;
    // Apps the persona can use are sanitized against the catalog before persisting.
    const appsPatch =
      accessibleApps !== undefined ? { accessible_apps: sanitizeAppIds(accessibleApps) } : {};

    // A mode change reissues the share token: the old token(s) are revoked and a fresh one
    // of the correct kind is minted, so an old link never works under a new mode.
    let newPublicLink: string | null = null;
    if (mode && mode !== persona.mode) {
      // Public + widget modes are gated behind the adversarial-testing flag.
      if (isPublicMode(mode) && !publicModesEnabled()) {
        return NextResponse.json(
          { error: PUBLIC_MODES_COMING_SOON, comingSoon: true },
          { status: 503 },
        );
      }
      const tier = await getCurrentTier(owner.ctx.userId);
      const allowed = evaluateCanUseMode(tier, mode);
      if (!allowed.ok) {
        return NextResponse.json({ error: allowed.reason, capped: true }, { status: 403 });
      }

      await revokeAllPersonaTokens(persona.id);
      const token = generateShareToken();
      await insertShareToken({
        token,
        persona_id: persona.id,
        seat_id: null,
        expires_at: null,
        mode,
      });
      if (mode === "widget") {
        // Ensure a config row exists so the loader + embed page resolve immediately.
        await upsertWidgetConfig(persona.id, {});
      }
      if (isPublicMode(mode)) newPublicLink = publicChatUrlForToken(token);
    }

    const updated = await updatePersona(params.id, {
      ...rest,
      ...(mode ? { mode } : {}),
      ...appsPatch,
    });
    // PA-POS-36: the first name set on any Persona completes "Name a Persona" (couples with the
    // PA-POS-35 rename surface — any rename lands through this PATCH). Never throws.
    if (parsed.data.name !== undefined) {
      await markOnboardingStepComplete(owner.ctx.userId, "name_persona");
    }
    return NextResponse.json({ persona: updated, publicLink: newPublicLink });
  } catch (e) {
    const status = e instanceof PersonaDbError ? e.status : 500;
    return NextResponse.json({ error: errMsg(e) }, { status });
  }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Unexpected error";
}
