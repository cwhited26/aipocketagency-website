import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PersonaMemoryClient from "./PersonaMemoryClient";

export const metadata = { title: "What it remembers — Pocket Agent" };

export default async function PersonaMemoryPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  return <PersonaMemoryClient personaId={params.id} />;
}
