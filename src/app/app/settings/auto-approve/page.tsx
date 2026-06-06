import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AutoApproveClient from "./AutoApproveClient";

export default async function AutoApprovePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  return <AutoApproveClient />;
}
