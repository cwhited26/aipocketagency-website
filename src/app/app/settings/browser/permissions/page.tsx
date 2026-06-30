// /app/settings/browser/permissions — per-domain allow/deny + Trust-Ladder auto-approve (prompt item 7).
// Server shell does the auth gate; the client component manages the live list + the add/edit form.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BrowserPermissionsClient from "./BrowserPermissionsClient";

export const dynamic = "force-dynamic";

export default async function BrowserPermissionsPage(): Promise<JSX.Element> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  return <BrowserPermissionsClient />;
}
