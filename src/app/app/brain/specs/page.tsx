import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { redirect } from "next/navigation";
import SpecsClient from "./SpecsClient";

export default async function SpecsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  const paUser = paResult.ok ? paResult.data : null;
  if (!paUser?.brain_repo) redirect("/app/brain");

  return <SpecsClient hasGithubToken={Boolean(paUser.github_token)} />;
}
