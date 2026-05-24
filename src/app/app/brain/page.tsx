import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { redirect } from "next/navigation";
import BrainHealthClient from "./BrainHealthClient";

export default async function BrainPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  const brainRepo = (paResult.ok && paResult.data?.brain_repo) || null;
  const hasGithubToken = Boolean(user.user_metadata?.user_name);

  return <BrainHealthClient brainRepo={brainRepo} hasGithubToken={hasGithubToken} />;
}
