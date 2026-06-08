import { redirect } from "next/navigation";

// /app/agent — the bare agent route is not a primary surface. The Agent nav entry and the
// command palette both land on the Hub thread list; anyone hitting /app/agent directly is
// sent there too, so the agent tab never opens onto a blank chat. New threads are created
// intentionally from the Hub (Ask box / "+ New") which route into /app/ask.
export default function AgentRootPage() {
  redirect("/app/agent/hub");
}
