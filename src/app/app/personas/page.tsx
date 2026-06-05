import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PersonasCatalogClient from "./PersonasCatalogClient";

export const metadata = { title: "Personas — Pocket Agent" };

export default async function PersonasPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  return <PersonasCatalogClient />;
}
