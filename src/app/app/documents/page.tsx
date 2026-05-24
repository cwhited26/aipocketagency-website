import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { redirect } from "next/navigation";
import DocumentsClient from "./DocumentsClient";

export const metadata = { title: "Documents — Pocket Agent" };

export default async function DocumentsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const result = await fetchPaUser(user.id);
  const paUser = result.ok ? result.data : null;
  if (!paUser) redirect("/app/onboarding");

  return (
    <DocumentsClient
      brainRepo={paUser.brain_repo}
      hasGithubToken={!!paUser.github_token}
    />
  );
}
