import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { listConversationThreads } from "@/lib/pa-conversations";
import { listScaffolds, type ScaffoldEntry } from "@/lib/pa-brain";
import HubClient from "./HubClient";

export const dynamic = "force-dynamic";

// /app/agent/hub — the real thread list behind the agent tab's "Hub" breadcrumb. Renders the
// owner's recent conversations (newest first, with a one-line preview), any in-flight Project
// Scaffolding plans, and a "Start new thread" entry. Tapping a row deep-links back into the
// agent surface at /app/ask?c=<id>, which restores the full conversation.
export default async function AgentHubPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const result = await fetchPaUser(user.id);
  const paUser = result.ok ? result.data : null;
  if (!paUser) redirect("/app/onboarding");

  const threadsResult = await listConversationThreads(user.id);
  // A read failure (e.g. mig 018 / table not provisioned) renders an empty Hub rather than a
  // 500 — the owner can still start a new thread.
  const threads = threadsResult.ok ? threadsResult.data : [];

  let scaffolds: ScaffoldEntry[] = [];
  if (paUser.brain_repo) {
    scaffolds = await listScaffolds(paUser.brain_repo, paUser.github_token);
  }

  return <HubClient threads={threads} scaffolds={scaffolds} />;
}
