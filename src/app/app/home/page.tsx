import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chatAsHomeEnabled, TABBED_HOME_PATH } from "@/lib/chat/feature-flag";
import { getFilterState, listMessages } from "@/lib/chat/db";
import type { ChatMessage, FilterTag } from "@/lib/chat/types";
import { getCurrentTier, type Tier } from "@/lib/personas/tier-caps";
import { listPassesForOwner } from "@/lib/metering/store";
import { activePassForApp } from "@/lib/metering/passes";
import type { AppId } from "@/lib/apps/catalog";
import ChatHome from "@/components/chat/ChatHome";

export const dynamic = "force-dynamic";

// /app/home — the chat-as-surface home (PA v5 Wave A). Visible only when PA_CHAT_AS_HOME is
// set; otherwise it redirects to the existing tabbed home so paying customers see no change.
export default async function ChatHomePage() {
  if (!chatAsHomeEnabled()) {
    redirect(TABBED_HOME_PATH);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  // Restore the owner's last filter view; load that slice's most recent page.
  let filter: FilterTag = "general";
  let messages: ChatMessage[] = [];
  try {
    filter = await getFilterState(user.id);
    messages = await listMessages({
      userId: user.id,
      filter: filter === "general" ? undefined : filter,
      limit: 50,
    });
  } catch {
    // Render an empty chat rather than 500 if the table isn't applied yet (mig 018 pending).
    filter = "general";
    messages = [];
  }

  // Tier gates which Apps the `/`-dispatcher shows and will open (PA-SLASH-1).
  let tier: Tier = "starter";
  try {
    tier = await getCurrentTier(user.id);
  } catch {
    tier = "starter";
  }

  // Apps opened by an active Project Pass rather than the tier (PA-POS-31) — the slash popover
  // and /commands treat them as unlocked. Pass slugs map to their catalog App ids.
  const passes = await listPassesForOwner(user.id);
  const now = new Date();
  const passApps: AppId[] = [];
  if (activePassForApp(passes, "landing_page_builder", now)) passApps.push("landing-page-builder");
  if (activePassForApp(passes, "idea_engine", now)) passApps.push("idea-engine");
  if (activePassForApp(passes, "browser_agent", now)) passApps.push("browser-agent");
  if (activePassForApp(passes, "agent_builder", now)) passApps.push("agent-builder");

  return (
    <ChatHome
      userId={user.id}
      tier={tier}
      passApps={passApps}
      initialMessages={messages}
      initialFilter={filter}
    />
  );
}
