import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import GatesClient from "./GatesClient";

export default async function GatesSettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  return <GatesClient />;
}
