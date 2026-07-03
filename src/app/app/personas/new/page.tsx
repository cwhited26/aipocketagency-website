import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PersonaWizardClient from "./PersonaWizardClient";

export const metadata = { title: "New persona — Pocket Agent" };

export default async function NewPersonaPage({
  searchParams,
}: {
  // ?template=<key> preselects a template and opens on step 2 — the Home example-agent
  // card's "Clone and customize" deep link (PA-POS-22).
  searchParams: { template?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  return <PersonaWizardClient initialTemplateKey={searchParams.template ?? null} />;
}
