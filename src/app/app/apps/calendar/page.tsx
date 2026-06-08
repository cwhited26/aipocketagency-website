import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchCalendarConnectionPublic } from "@/lib/pa-calendar-connections";
import { fetchCalendlyConnectionPublic } from "@/lib/pa-calendly-connections";
import { redirect } from "next/navigation";
import CalendarClient from "./CalendarClient";

export default async function CalendarPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const [result, calendarConn, calendlyConn] = await Promise.all([
    fetchPaUser(user.id),
    fetchCalendarConnectionPublic(user.id),
    fetchCalendlyConnectionPublic(user.id),
  ]);
  const paUser = result.ok ? result.data : null;

  if (!paUser) redirect("/app/onboarding");

  const hasCalendar = calendarConn.ok && calendarConn.data?.status === "active";
  const hasCalendly = calendlyConn.ok && calendlyConn.data?.status === "active";

  return (
    <CalendarClient
      brainRepo={paUser.brain_repo}
      hasApiKey={Boolean(paUser.anthropic_api_key)}
      hasCalendar={hasCalendar}
      hasCalendly={hasCalendly}
    />
  );
}
