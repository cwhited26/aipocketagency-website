import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchTelos } from "@/lib/brain/telos";
import { redirect } from "next/navigation";
import NorthStarClient from "./NorthStarClient";

export default async function NorthStarPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  const paUser = paResult.ok ? paResult.data : null;
  if (!paUser?.brain_repo) redirect("/app/brain");

  const initialFields = await fetchTelos(paUser.brain_repo, paUser.github_token);

  return (
    <NorthStarClient
      initialFields={initialFields}
      hasGithubToken={Boolean(paUser.github_token)}
    />
  );
}
