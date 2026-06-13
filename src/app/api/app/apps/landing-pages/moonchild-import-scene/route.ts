// POST /api/app/apps/landing-pages/moonchild-import-scene  { sceneId, sceneName, pageId? }
// Path A of the PA-LPB-13 wizard. Fetches the design system bundle for the owner's selected
// Moonchild scene and converts it to a DesignSystemSnapshot. When pageId is provided the snapshot
// is persisted on the page row. (PA-LPB-13)

import { createClient } from "@/lib/supabase/server";
import { getCurrentTier, tierAllowsLandingPageBuilder } from "@/lib/personas/tier-caps";
import { resolveMoonchildToken } from "@/lib/pa-moonchild-connections";
import { getDesignSystemBundleWithCredentials } from "@/lib/connectors/moonchild/client";
import { moonchildDsToSnapshot } from "@/lib/landing-pages/design-snapshot";
import { getPage, updatePage } from "@/lib/landing-pages/pages";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  sceneId: z.string().min(1).max(200),
  sceneName: z.string().max(500).optional().default(""),
  pageId: z.string().uuid().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tier = await getCurrentTier(user.id);
  if (!tierAllowsLandingPageBuilder(tier)) {
    return NextResponse.json(
      { error: "upgrade_required", message: "The Landing Page Builder is a Studio feature." },
      { status: 403 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  const { sceneId, sceneName, pageId } = parsed.data;

  const creds = await resolveMoonchildToken(user.id);
  if (!creds.ok) {
    return NextResponse.json({ error: creds.error }, { status: creds.status });
  }

  const result = await getDesignSystemBundleWithCredentials(
    { mcpUrl: creds.mcpUrl, token: creds.token },
    user.id,
    sceneId,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 502 });
  }

  const { designSystem, designSystemId } = result.data;
  const importedFrom = `moonchild:scene:${sceneId}`;
  const snapshot = moonchildDsToSnapshot(designSystem, importedFrom);
  if (sceneName) snapshot.name = sceneName;

  if (pageId) {
    const found = await getPage(pageId, user.id);
    if (found.ok && found.data) {
      await updatePage(pageId, user.id, {
        designSystemId,
        designSystemImportedFrom: importedFrom,
        designSystemSnapshot: snapshot,
      });
    }
  }

  return NextResponse.json({
    designSystem,
    designSystemId,
    importedFrom,
    snapshot,
  });
}
