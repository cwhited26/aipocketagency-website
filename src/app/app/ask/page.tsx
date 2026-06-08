import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import {
  listConversations,
  listConversationThreads,
  type ConversationThread,
} from "@/lib/pa-conversations";
import { listScaffolds, type ScaffoldEntry } from "@/lib/pa-brain";
import { fetchGmailConnectionPublic } from "@/lib/pa-gmail-connections";
import { fetchCalendarConnectionPublic } from "@/lib/pa-calendar-connections";
import { redirect } from "next/navigation";
import HomeClient from "./HomeClient";

export default async function AskPage({
  searchParams,
}: {
  // ?c=<conversationId> deep-links into a thread (restored from the recent-threads list).
  // ?q=<text> pre-fills the composer (set by starter prompts and other tabs' "start" inputs).
  searchParams: { c?: string; q?: string };
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

  // The Agent landing is the mascot page: the Ask box, the recent-threads list, and in-flight
  // plans all live here, so load them alongside the sidebar conversations.
  const [convsResult, threadsResult, gmailResult, calendarResult] = await Promise.all([
    listConversations(user.id),
    listConversationThreads(user.id),
    fetchGmailConnectionPublic(user.id),
    fetchCalendarConnectionPublic(user.id),
  ]);
  const initialConversations = convsResult.ok ? convsResult.data : [];
  const threads: ConversationThread[] = threadsResult.ok ? threadsResult.data : [];

  let scaffolds: ScaffoldEntry[] = [];
  if (paUser.brain_repo) {
    scaffolds = await listScaffolds(paUser.brain_repo, paUser.github_token);
  }

  const hasConnection = Boolean(
    (gmailResult.ok && gmailResult.data) || (calendarResult.ok && calendarResult.data),
  );

  return (
    <HomeClient
      brainRepo={paUser.brain_repo}
      hasApiKey={!!paUser.anthropic_api_key}
      hasGithubToken={!!paUser.github_token}
      hasConnection={hasConnection}
      initialConversations={initialConversations}
      threads={threads}
      scaffolds={scaffolds}
      initialConversationId={searchParams.c ?? null}
      initialQuery={searchParams.q ?? null}
    />
  );
}
