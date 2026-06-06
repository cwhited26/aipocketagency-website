// widget-config — owner-only read/update of a persona's Mode C widget configuration
// (allowed origins, greeting, bubble color/position, lead-capture timing, off-topic
// message, white-label badge). Behind the PA_PERSONAS_PUBLIC_MODES_ENABLED flag.

import { NextResponse } from "next/server";
import { requireOwnedPersona, resolveOwner } from "@/lib/personas/owner";
import { fetchWidgetConfig, PersonaDbError, upsertWidgetConfig } from "@/lib/personas/db";
import { badgeRemovableForTier, getCurrentTier } from "@/lib/personas/tier-caps";
import { widgetConfigUpdateSchema, DEFAULT_WIDGET_CONFIG } from "@/lib/personas/types";
import { comingSoon503, publicModesEnabled } from "@/lib/personas/feature-flags";
import { widgetSnippetForToken } from "@/lib/personas/links";
import { fetchLivePublicToken } from "@/lib/personas/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  if (!publicModesEnabled()) return comingSoon503();
  const owner = await resolveOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });

  try {
    const owned = await requireOwnedPersona(params.id, owner.ctx.userId);
    if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });

    const [config, tier, widgetToken] = await Promise.all([
      fetchWidgetConfig(params.id),
      getCurrentTier(owner.ctx.userId),
      fetchLivePublicToken(params.id, "widget"),
    ]);

    return NextResponse.json({
      config: config ?? { persona_id: params.id, ...DEFAULT_WIDGET_CONFIG },
      badgeRemovable: badgeRemovableForTier(tier),
      snippet: widgetToken ? widgetSnippetForToken(widgetToken.token) : null,
    });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: Request, { params }: Params): Promise<NextResponse> {
  if (!publicModesEnabled()) return comingSoon503();
  const owner = await resolveOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = widgetConfigUpdateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });

  try {
    const owned = await requireOwnedPersona(params.id, owner.ctx.userId);
    if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });

    // Badge removal is a white-label (Studio+) entitlement — never let a lower tier set it.
    const patch = { ...parsed.data };
    if (patch.badge_removed === true) {
      const tier = await getCurrentTier(owner.ctx.userId);
      if (!badgeRemovableForTier(tier)) {
        return NextResponse.json(
          { error: "Removing the Pocket Agent badge requires the Studio plan." },
          { status: 403 },
        );
      }
    }

    const config = await upsertWidgetConfig(params.id, patch);
    return NextResponse.json({ config });
  } catch (e) {
    return fail(e);
  }
}

function fail(e: unknown): NextResponse {
  const status = e instanceof PersonaDbError ? e.status : 500;
  return NextResponse.json(
    { error: e instanceof Error ? e.message : "Unexpected error" },
    { status },
  );
}
