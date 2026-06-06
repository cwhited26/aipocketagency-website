import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chatAsHomeEnabled, TABBED_HOME_PATH } from "@/lib/chat/feature-flag";
import { getFilterState, listMessages } from "@/lib/chat/db";
import type { ChatMessage, FilterTag } from "@/lib/chat/types";
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

  return <ChatHome userId={user.id} initialMessages={messages} initialFilter={filter} />;
}
