import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { redirect } from "next/navigation";
import DigestClient from "./DigestClient";

export const maxDuration = 60;

export default async function DigestPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  const brainRepo = (paResult.ok && paResult.data?.brain_repo) || null;
  const hasApiKey = Boolean(paResult.ok && paResult.data?.anthropic_api_key);
  const hasGithubToken = Boolean(user.user_metadata?.user_name);

  return (
    <DigestClient
      brainRepo={brainRepo}
      hasApiKey={hasApiKey}
      hasGithubToken={hasGithubToken}
    />
  );
}
