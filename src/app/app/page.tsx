import { redirect } from "next/navigation";
import { chatAsHomeEnabled } from "@/lib/chat/feature-flag";

// The app's home entry point. When the chat-as-surface flag (PA_CHAT_AS_HOME) is ON, the
// home becomes the single chat surface; otherwise it stays the existing tabbed brain home.
// Decision PA-ORCH-12: the old surface remains reachable until Chase flips the flag.
export default function AppRootPage() {
  if (chatAsHomeEnabled()) {
    redirect("/app/home");
  }
  redirect("/app/brain");
}
