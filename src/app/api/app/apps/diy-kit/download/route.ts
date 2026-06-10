// GET /api/app/apps/diy-kit/download
// Returns a 24-hour signed download URL for the AI Office DIY Setup Kit bundle (PA-DIYKIT-4). Gated on
// the owner holding a diy_setup_kit purchase. The bundle object is staged in Supabase Storage (the
// combined PDF/zip from buildDiyKitBundle); the path + bucket are env-driven (DIY_KIT_BUNDLE_*).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ownerHasDiyKitPurchase, signDiyKitDownload } from "@/lib/diy-kit/download";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owns = await ownerHasDiyKitPurchase({
    ownerId: user.id,
    email: user.email ?? null,
  });
  if (!owns) {
    return NextResponse.json(
      { error: "No DIY Setup Kit purchase found on your account." },
      { status: 403 },
    );
  }

  const signed = await signDiyKitDownload();
  if (!signed.ok) {
    console.error("[diy-kit/download] signing failed", {
      user_id: user.id,
      status: signed.status,
      error: signed.error,
    });
    return NextResponse.json(
      { error: "Your kit isn't ready to download yet. Reply to your receipt and we'll send it." },
      { status: 503 },
    );
  }
  return NextResponse.json({ download_url: signed.url, expires_in_seconds: signed.expiresInSeconds });
}
