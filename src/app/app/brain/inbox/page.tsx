import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchFileContent, listDirMarkdownFiles } from "@/lib/pa-brain";
import { parseInboxForDisplay, parseShareSheetFile, mergeInboxEntries } from "@/lib/pa-inbox";
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
    const repo = paUser.brain_repo;
    // Two capture pipelines land items in different places:
    //  • the bearer-token API endpoint → PA-INBOX blocks in memory/inbox.md
    //  • the native iOS Working Copy shortcut → one file per item in sessions/inbox/
    // Read both so every genuinely-captured item shows up, regardless of source.
    const [blockRaw, shareFiles] = await Promise.all([
      fetchFileContent(repo, "memory/inbox.md", ghToken),
      listDirMarkdownFiles(repo, ghToken, "sessions/inbox"),
    ]);

    const blockEntries = parseInboxForDisplay(blockRaw);
    const shareEntries = (
      await Promise.all(
        shareFiles.map(async (f) =>
          parseShareSheetFile(f.path, await fetchFileContent(repo, f.path, ghToken)),
        ),
      )
    ).filter((e): e is NonNullable<typeof e> => e !== null);

    entries = mergeInboxEntries(blockEntries, shareEntries);
  }

  return <InboxClient initialEntries={entries} hasBrain={hasBrain} />;
}
