import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PersonaWizardClient from "./PersonaWizardClient";

export const metadata = { title: "New persona — Pocket Agent" };

export default async function NewPersonaPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  return <PersonaWizardClient />;
}
