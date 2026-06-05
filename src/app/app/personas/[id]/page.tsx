import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PersonaDetailClient from "./PersonaDetailClient";

export const metadata = { title: "Persona — Pocket Agent" };

export default async function PersonaDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  return <PersonaDetailClient personaId={params.id} />;
}
