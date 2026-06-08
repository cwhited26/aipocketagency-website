import { createClient } from "@/lib/supabase/server";
import { fetchCalendarConnectionPublic } from "@/lib/pa-calendar-connections";
import { redirect } from "next/navigation";
import CalendarViewClient from "./CalendarViewClient";

export const dynamic = "force-dynamic";

// Top-level Calendar surface. Renders the owner's real events from the Google Calendar
// Connection (read-only — list_events bypasses the approval Inbox). When the connection
// isn't live, the client shows an empty state that points to Settings → Connections.
export default async function CalendarPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const result = await fetchCalendarConnectionPublic(user.id);
  const connection = result.ok ? result.data : null;
  const connected = Boolean(connection && connection.status === "active");

  return <CalendarViewClient connected={connected} accountEmail={connection?.email ?? null} />;
}
