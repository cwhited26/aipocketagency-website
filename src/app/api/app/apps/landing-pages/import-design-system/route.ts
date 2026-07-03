// POST /api/app/apps/landing-pages/import-design-system — import a design system from a reference
// URL via the Moonchild MCP connector (PA-LPB-10). Called by the LPB wizard "Import from URL" step.
//
// When `pageId` is provided the DS is also persisted on the page row (snapshot + id + source URL).
// When `pageId` is absent the DS is returned for in-wizard preview only (no write).
//
// Studio+ gated — the same gate that guards the LPB itself.

import { createClient } from "@/lib/supabase/server";
import { getCurrentTier } from "@/lib/personas/tier-caps";
import { hasAppEntitlement } from "@/lib/metering/entitlement";
import { importDesignSystemFromUrl } from "@/lib/connectors/moonchild/client";
import { getPage, updatePage } from "@/lib/landing-pages/pages";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Tier OR active Project Pass (PA-POS-31) — the widened gate.
  const tier = await getCurrentTier(user.id);
  const lpbAccess = await hasAppEntitlement(user.id, "landing_page_builder", { tier });
  if (!lpbAccess.allowed) {
    return NextResponse.json(
      {
        error: "upgrade_required",
        message: "The Landing Page Builder is a Studio feature. Upgrade to import a design system.",
      },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url, pageId } = body as { url?: unknown; pageId?: unknown };

  if (typeof url !== "string" || !url.trim() || !isValidUrl(url.trim())) {
    return NextResponse.json({ error: "Provide a valid https:// URL to import from." }, { status: 400 });
  }

  const cleanUrl = url.trim();

  const correlationId = `import-ds-${user.id.slice(0, 8)}-${Date.now()}`;
  const result = await importDesignSystemFromUrl(cleanUrl, { ownerId: user.id, correlationId });

  if (!result.ok) {
    const status = result.error.kind === "not_configured" ? 503 : result.error.kind === "auth" ? 503 : 502;
    return NextResponse.json(
      { error: result.error.kind, message: result.error.message },
      { status },
    );
  }

  const { designSystem, designSystemId } = result.data;

  // If a page id is provided, persist the snapshot on the row so code-gen can use it.
  if (typeof pageId === "string" && pageId) {
    const found = await getPage(pageId, user.id);
    if (found.ok && found.data) {
      await updatePage(pageId, user.id, {
        designSystemId,
        designSystemImportedFrom: cleanUrl,
        designSystemSnapshot: {
          id: designSystemId,
          name: designSystem.name,
          importedFrom: cleanUrl,
          palette: designSystem.palette,
          typography: designSystem.typography,
          // DesignSystemSnapshot.components is Record<string, string> — matches the Zod inferred type.
          components: designSystem.components as Record<string, string> | undefined,
        },
      });
    }
  }

  return NextResponse.json({ designSystem, designSystemId, importedFrom: cleanUrl });
}
