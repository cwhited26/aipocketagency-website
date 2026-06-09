import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { redirect } from "next/navigation";
import BrainMapClient from "./BrainMapClient";

export const metadata = { title: "Brain Map — Pocket Agent" };

export default async function BrainMapPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const result = await fetchPaUser(user.id);
  const paUser = result.ok ? result.data : null;
  if (!paUser) redirect("/app/onboarding");

  return (
    <BrainMapClient
      brainRepo={paUser.brain_repo}
      hasGithubToken={Boolean(paUser.github_token)}
    />
  );
}
