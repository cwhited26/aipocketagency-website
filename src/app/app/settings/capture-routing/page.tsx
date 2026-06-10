import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CaptureRoutingClient from "./CaptureRoutingClient";

export default async function CaptureRoutingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  return <CaptureRoutingClient />;
}
