// /app/captures/settings — Pocket Capture surfaces + API token management (PC-CORE-6). Open to every
// logged-in PA user; the client fetches each surface's value from the endpoints PC-CORE-2/3/4 already
// ship (email-forward address, SMS number, API tokens) and the iOS Shortcut deep-link from env.

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CapturesSettingsClient from "./CapturesSettingsClient";

export const dynamic = "force-dynamic";

export default async function CapturesSettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login?next=/app/captures/settings");

  return <CapturesSettingsClient />;
}
