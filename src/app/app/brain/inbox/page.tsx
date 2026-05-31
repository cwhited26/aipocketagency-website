import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchFileContent } from "@/lib/pa-brain";
import { parseInboxForDisplay } from "@/lib/pa-inbox";
import type { InboxEntry } from "@/lib/pa-inbox";
import { redirect } from "next/navigation";
import InboxClient from "./InboxClient";

export default async function BrainInboxPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  const paUser = paResult.ok ? paResult.data : null;

  if (!paUser) redirect("/app/onboarding");

  const { data: { session } } = await supabase.auth.getSession();
  const ghToken = paUser.github_token ?? session?.provider_token ?? null;

  let entries: InboxEntry[] = [];
  const hasBrain = Boolean(paUser.brain_repo && ghToken);

  if (hasBrain && paUser.brain_repo && ghToken) {
    const raw = await fetchFileContent(paUser.brain_repo, "memory/inbox.md", ghToken);
    entries = parseInboxForDisplay(raw);
  }

  return <InboxClient initialEntries={entries} hasBrain={hasBrain} />;
}
