import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { redirect } from "next/navigation";
import QuoteClient from "./QuoteClient";

export default async function QuotePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const result = await fetchPaUser(user.id);
  const paUser = result.ok ? result.data : null;

  if (!paUser) redirect("/app/onboarding");

  return (
    <QuoteClient
      brainRepo={paUser.brain_repo}
      hasApiKey={Boolean(paUser.anthropic_api_key)}
    />
  );
}
