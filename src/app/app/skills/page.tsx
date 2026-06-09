import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { redirect } from "next/navigation";
import SkillsClient from "./SkillsClient";

// Skills tab (PA-SKILL-2) — alongside Apps, not replacing it. Apps = the workflows PA ships out of
// the box; Skills = the techniques your agent has learned from YOU. This page is the owner-facing
// view of the moves accumulated in their brain repo.
export default async function SkillsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const result = await fetchPaUser(user.id);
  if (!result.ok || !result.data) redirect("/app/onboarding");

  return <SkillsClient hasBrain={Boolean(result.data.brain_repo)} />;
}
