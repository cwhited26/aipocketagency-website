import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { redirect } from "next/navigation";
import MemoryClient from "./MemoryClient";

export default async function MemoryPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  const paUser = paResult.ok ? paResult.data : null;
  if (!paUser?.brain_repo) redirect("/app/brain");

  return <MemoryClient hasGithubToken={Boolean(paUser.github_token)} />;
}
