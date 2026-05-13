import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { redirect } from "next/navigation";
import AskClient from "./AskClient";

export default async function AskPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const result = await fetchPaUser(user.id);
  const paUser = result.ok ? result.data : null;

  if (!paUser?.brain_repo) redirect("/app/onboarding");

  return <AskClient brainRepo={paUser.brain_repo} />;
}
