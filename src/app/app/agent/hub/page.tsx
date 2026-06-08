import { redirect } from "next/navigation";

// /app/agent/hub — the thread list used to live on its own route. It now lives inside the Agent
// landing (/app/ask) alongside the mascot, Ask box, and activity. This stays as a deep-link alias
// so old links and bookmarks still land in the right place.
export default function AgentHubPage() {
  redirect("/app/ask");
}
