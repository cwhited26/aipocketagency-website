import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { redirect } from "next/navigation";
import TasksClient from "./TasksClient";

export const metadata = { title: "Tasks — Pocket Agent" };

export default async function TasksPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const result = await fetchPaUser(user.id);
  const paUser = result.ok ? result.data : null;

  if (!paUser) redirect("/app/onboarding");

  return <TasksClient brainRepo={paUser.brain_repo ?? null} />;
}
