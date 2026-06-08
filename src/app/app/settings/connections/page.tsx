import { createClient } from "@/lib/supabase/server";
import { fetchGmailConnectionPublic } from "@/lib/pa-gmail-connections";
import { fetchCalendarConnectionPublic } from "@/lib/pa-calendar-connections";
import { fetchSlackConnectionPublic } from "@/lib/pa-slack-connections";
import { isSlackOAuthConfigured } from "@/lib/connectors/slack/oauth";
import { redirect } from "next/navigation";
import GmailConnectionCard from "./GmailConnectionCard";
import CalendarConnectionCard from "./CalendarConnectionCard";
import SlackConnectionCard from "./SlackConnectionCard";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, { title: string; body: string; kind: "success" | "error" }> = {
  connected: {
    title: "Gmail connected",
    body: "Incoming email now flows into your Inbox for triage. The first batch appears within a few minutes.",
    kind: "success",
  },
  not_configured: {
    title: "Gmail sign-in unavailable",
    body: "Gmail connections are live, but this workspace's Google sign-in isn't enabled. Contact support and we'll switch it on.",
    kind: "error",
  },
  error: {
    title: "Connection failed",
    body: "Something went wrong connecting Gmail. Try again, or contact support if it keeps happening.",
    kind: "error",
  },
};

const CALENDAR_MESSAGES: Record<string, { title: string; body: string; kind: "success" | "error" }> = {
  connected: {
    title: "Google Calendar connected",
    body: "Your agent can now read your schedule and stage events for you to approve. Nothing is written to your calendar without a tap.",
    kind: "success",
  },
  not_configured: {
    title: "Calendar sign-in unavailable",
    body: "Calendar connections reuse this workspace's Google sign-in, which isn't enabled yet. Contact support and we'll switch it on.",
    kind: "error",
  },
  missing_scope: {
    title: "Calendar permission not granted",
    body: "The connection went through but didn't include calendar access. Reconnect and approve the calendar permission to finish.",
    kind: "error",
  },
  error: {
    title: "Calendar connection failed",
    body: "Something went wrong connecting Google Calendar. Try again, or contact support if it keeps happening.",
    kind: "error",
  },
};

const SLACK_MESSAGES: Record<string, { title: string; body: string; kind: "success" | "error" }> = {
  connected: {
    title: "Slack connected",
    body: "Your agent can now post, reply in threads, and DM — each send waits for your approval in the Inbox.",
    kind: "success",
  },
  not_configured: {
    title: "Slack sign-in unavailable",
    body: "Slack OAuth isn't configured for this deployment yet. Add SLACK_CLIENT_ID and SLACK_CLIENT_SECRET in Vercel to switch it on.",
    kind: "error",
  },
  error: {
    title: "Slack connection failed",
    body: "Something went wrong connecting Slack. Try again, or contact support if it keeps happening.",
    kind: "error",
  },
};

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: { connection?: string; calendar?: string; slack?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const [gmailResult, calendarResult, slackResult] = await Promise.all([
    fetchGmailConnectionPublic(user.id),
    fetchCalendarConnectionPublic(user.id),
    fetchSlackConnectionPublic(user.id),
  ]);
  const gmail = gmailResult.ok ? gmailResult.data : null;
  const calendar = calendarResult.ok ? calendarResult.data : null;
  const slack = slackResult.ok ? slackResult.data : null;
  const slackOAuthConfigured = isSlackOAuthConfigured();

  const message = searchParams.connection ? MESSAGES[searchParams.connection] ?? null : null;
  const calendarMessage = searchParams.calendar
    ? CALENDAR_MESSAGES[searchParams.calendar] ?? null
    : null;
  const slackMessage = searchParams.slack ? SLACK_MESSAGES[searchParams.slack] ?? null : null;

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-lg mx-auto px-6 py-10 space-y-7">
        <div>
          <a
            href="/app/settings"
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
          >
            ← Settings
          </a>
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mt-3 mb-1">
            Connections
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Connect your tools</h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Connect an account and your agent pulls what needs your attention into the{" "}
            <a href="/app/apps/inbox" className="text-[#22d3ee] hover:underline">
              Inbox
            </a>{" "}
            — one tap each to handle, reply, or archive.
          </p>
        </div>

        {message && (
          <div
            className={`rounded-xl border px-5 py-4 space-y-1 ${
              message.kind === "success"
                ? "border-[#22d3ee]/25 bg-[#22d3ee]/5"
                : "border-slate-700/60 bg-slate-900/50"
            }`}
          >
            <p className="text-sm font-semibold text-slate-100">{message.title}</p>
            <p className="text-sm text-slate-300 leading-relaxed">{message.body}</p>
          </div>
        )}

        {calendarMessage && (
          <div
            className={`rounded-xl border px-5 py-4 space-y-1 ${
              calendarMessage.kind === "success"
                ? "border-[#22d3ee]/25 bg-[#22d3ee]/5"
                : "border-slate-700/60 bg-slate-900/50"
            }`}
          >
            <p className="text-sm font-semibold text-slate-100">{calendarMessage.title}</p>
            <p className="text-sm text-slate-300 leading-relaxed">{calendarMessage.body}</p>
          </div>
        )}

        {slackMessage && (
          <div
            className={`rounded-xl border px-5 py-4 space-y-1 ${
              slackMessage.kind === "success"
                ? "border-[#22d3ee]/25 bg-[#22d3ee]/5"
                : "border-slate-700/60 bg-slate-900/50"
            }`}
          >
            <p className="text-sm font-semibold text-slate-100">{slackMessage.title}</p>
            <p className="text-sm text-slate-300 leading-relaxed">{slackMessage.body}</p>
          </div>
        )}

        <GmailConnectionCard connection={gmail} />

        <CalendarConnectionCard connection={calendar} />

        <SlackConnectionCard connection={slack} oauthConfigured={slackOAuthConfigured} />

        <p className="text-xs text-slate-600 leading-relaxed">
          Gmail access lets your agent read incoming mail and archive a thread when you tap
          “I’ll handle” or “Archive.” Calendar access lets it read your schedule and propose,
          create, or reschedule events. Slack access lets it post, reply in threads, and DM. It
          never sends, deletes, or writes anything on its own — replies and calendar changes are
          always staged for your approval first.
        </p>
      </div>
    </div>
  );
}
