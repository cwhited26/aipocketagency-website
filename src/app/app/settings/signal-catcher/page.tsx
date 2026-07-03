import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentTier, tierAllowsSignalCatcher } from "@/lib/personas/tier-caps";
import { fetchSignalCatcherSettings } from "@/lib/signal-catcher/db";
import SignalCatcherSettingsClient from "./SignalCatcherSettingsClient";

// Settings → Signal Catcher (PA-SIGNAL-1): the owner's toggle + sensitivity dial for the
// "you mentioned it once, PA proposes the ritual" primitive. Studio+/Enterprise feature; lower
// tiers see what it is and the upgrade path, and any saved preference sits dormant until then.

export default async function SignalCatcherSettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const [settingsRes, tier] = await Promise.all([
    fetchSignalCatcherSettings(user.id),
    getCurrentTier(user.id),
  ]);

  return (
    <SignalCatcherSettingsClient
      initial={settingsRes.ok ? settingsRes.data : { enabled: true, sensitivity: "medium" }}
      tierAllows={tierAllowsSignalCatcher(tier)}
    />
  );
}
