import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchFileContent } from "@/lib/pa-brain";
import { redirect } from "next/navigation";
import AvatarFormClient from "./AvatarFormClient";

const AVATAR_PATH = "memory/customer-avatar.md";

function parseAvatarMarkdown(md: string): Record<string, string> {
  const headerMap: Record<string, string> = {
    "Who they are": "whoTheyAre",
    "What they want": "whatTheyWant",
    "What they're afraid of / frustrated by": "fearsFrustrations",
    "Where they spend time": "whereTheySpendTime",
    "Anything else": "anythingElse",
  };

  const sections: Record<string, string> = {};
  let currentField: string | null = null;
  const buf: string[] = [];
  const rawLines = md.split("\n");

  for (const line of rawLines) {
    if (line.startsWith("## ")) {
      if (currentField && buf.length > 0) {
        sections[currentField] = buf.join("\n").trim();
        buf.length = 0;
      }
      const heading = line.slice(3).trim();
      currentField = headerMap[heading] ?? null;
    } else if (currentField) {
      buf.push(line);
    }
  }
  if (currentField && buf.length > 0) {
    sections[currentField] = buf.join("\n").trim();
  }
  return sections;
}

export default async function AvatarPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  const paUser = paResult.ok ? paResult.data : null;

  if (!paUser?.brain_repo) {
    redirect("/app/brain");
  }

  const raw = await fetchFileContent(paUser.brain_repo, AVATAR_PATH, paUser.github_token);
  const initialFields = raw ? parseAvatarMarkdown(raw) : null;

  return (
    <AvatarFormClient
      initialFields={initialFields}
      hasBrain={Boolean(paUser.brain_repo)}
      hasGithubToken={Boolean(paUser.github_token)}
    />
  );
}
