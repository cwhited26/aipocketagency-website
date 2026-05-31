import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import RoutinesClient from "./RoutinesClient";

export const metadata = { title: "Routines — Pocket Agent" };

export default async function RoutinesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  return <RoutinesClient />;
}
