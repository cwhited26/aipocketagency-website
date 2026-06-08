import { createClient } from "@/lib/supabase/server";
import { fetchGmailConnectionPublic } from "@/lib/pa-gmail-connections";
import { redirect } from "next/navigation";
import EmailViewClient from "./EmailViewClient";

export const dynamic = "force-dynamic";

// Top-level Email surface. Renders recent Gmail threads from the Gmail Connection (read-only)
// and points at the Inbox for triage and the Email Drafter to compose. When Gmail isn't
// connected, the client shows an empty state that links to Settings → Connections.
export default async function EmailPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const result = await fetchGmailConnectionPublic(user.id);
  const connection = result.ok ? result.data : null;
  const connected = Boolean(connection && connection.status === "active");

  return <EmailViewClient connected={connected} accountEmail={connection?.email ?? null} />;
}
