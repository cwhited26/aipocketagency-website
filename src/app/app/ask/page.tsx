import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { listConversations } from "@/lib/pa-conversations";
import { redirect } from "next/navigation";
import HomeClient from "./HomeClient";

export default async function AskPage({
  searchParams,
}: {
  // ?c=<conversationId> deep-links into a thread (set by the Hub thread list).
  searchParams: { c?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const result = await fetchPaUser(user.id);
  const paUser = result.ok ? result.data : null;

  // If there's no user record at all, send them through onboarding to create one.
  if (!paUser) redirect("/app/onboarding");

  // Load recent conversations to pre-populate the sidebar.
  const convsResult = await listConversations(user.id);
  const initialConversations = convsResult.ok ? convsResult.data : [];

  return (
    <HomeClient
      brainRepo={paUser.brain_repo}
      hasApiKey={!!paUser.anthropic_api_key}
      hasGithubToken={!!paUser.github_token}
      initialConversations={initialConversations}
      initialConversationId={searchParams.c ?? null}
    />
  );
}
