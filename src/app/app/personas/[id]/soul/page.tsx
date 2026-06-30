import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PersonaSoulClient from "./PersonaSoulClient";

export const metadata = { title: "How it works with you — Pocket Agent" };

export default async function PersonaSoulPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  return <PersonaSoulClient personaId={params.id} />;
}
