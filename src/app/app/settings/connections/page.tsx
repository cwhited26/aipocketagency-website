import { createClient } from "@/lib/supabase/server";
import { fetchGmailConnectionPublic } from "@/lib/pa-gmail-connections";
import { fetchCalendarConnectionPublic } from "@/lib/pa-calendar-connections";
import { fetchSlackConnectionPublic } from "@/lib/pa-slack-connections";
import { fetchQuickBooksConnectionPublic } from "@/lib/pa-quickbooks-connections";
import { fetchStripeConnectionPublic } from "@/lib/pa-stripe-connections";
import { fetchZoomConnectionPublic } from "@/lib/pa-zoom-connections";
import { fetchCalendlyConnectionPublic } from "@/lib/pa-calendly-connections";
import { isSlackOAuthConfigured } from "@/lib/connectors/slack/oauth";
import { isQuickBooksOAuthConfigured } from "@/lib/connectors/quickbooks/oauth";
import { isStripeConnectConfigured } from "@/lib/connectors/stripe/oauth";
import { isZoomOAuthConfigured } from "@/lib/connectors/zoom/oauth";
import { isCalendlyOAuthConfigured } from "@/lib/connectors/calendly/oauth";
import { ensureInboundAddresses } from "@/lib/inbound-email/addresses";
import { INBOUND_DOMAIN, BCC_DOMAIN } from "@/lib/inbound-email/parse";
import { redirect } from "next/navigation";
import { TabGuide } from "../../_components/TabGuide";
import GmailConnectionCard from "./GmailConnectionCard";
import CalendarConnectionCard from "./CalendarConnectionCard";
import SlackConnectionCard from "./SlackConnectionCard";
import QuickBooksConnectionCard from "./QuickBooksConnectionCard";
import StripeConnectionCard from "./StripeConnectionCard";
import ZoomConnectionCard from "./ZoomConnectionCard";
import CalendlyConnectionCard from "./CalendlyConnectionCard";
import InboundEmailCard from "./InboundEmailCard";

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
    body: "Your agent can now post, reply in threads, and DM — each send waits for your approval in the Inbox. And you can DM @Pocket Agent (or @mention it in a channel) to ask anything; it replies right there in Slack.",
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

const QUICKBOOKS_MESSAGES: Record<string, { title: string; body: string; kind: "success" | "error" }> = {
  connected: {
    title: "QuickBooks connected",
    body: "Your agent can now draft invoices, record payments, and pull reports. Every invoice and payment is staged for your approval first — nothing posts to your books on its own.",
    kind: "success",
  },
  not_configured: {
    title: "QuickBooks sign-in unavailable",
    body: "QuickBooks OAuth isn't configured for this deployment yet. Add INTUIT_CLIENT_ID, INTUIT_CLIENT_SECRET, and INTUIT_ENVIRONMENT in Vercel to switch it on.",
    kind: "error",
  },
  missing_scope: {
    title: "QuickBooks permission not granted",
    body: "The connection went through but didn't include accounting access. Reconnect and approve the QuickBooks permission to finish.",
    kind: "error",
  },
  error: {
    title: "QuickBooks connection failed",
    body: "Something went wrong connecting QuickBooks. Try again, or contact support if it keeps happening.",
    kind: "error",
  },
};

const STRIPE_MESSAGES: Record<string, { title: string; body: string; kind: "success" | "error" }> = {
  connected: {
    title: "Stripe connected",
    body: "Your agent can now draft invoices, payment links, and refunds on your Stripe account. Every one is staged for your approval first — and refunds always ask before money moves.",
    kind: "success",
  },
  not_configured: {
    title: "Stripe Connect not enabled",
    body: "Connecting a Stripe account needs Stripe Connect enabled on this workspace's Stripe platform. Enable Connect in the Stripe Dashboard and we'll switch it on.",
    kind: "error",
  },
  error: {
    title: "Stripe connection failed",
    body: "Something went wrong connecting Stripe. Try again, or contact support if it keeps happening.",
    kind: "error",
  },
};

const ZOOM_MESSAGES: Record<string, { title: string; body: string; kind: "success" | "error" }> = {
  connected: {
    title: "Zoom connected",
    body: "Your agent can now schedule Zoom meetings and drop the join link straight into your calendar invites and emails. New meetings are staged for your approval first.",
    kind: "success",
  },
  not_configured: {
    title: "Zoom sign-in unavailable",
    body: "Zoom OAuth isn't configured for this deployment yet. Add ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET in Vercel to switch it on.",
    kind: "error",
  },
  error: {
    title: "Zoom connection failed",
    body: "Something went wrong connecting Zoom. Try again, or contact support if it keeps happening.",
    kind: "error",
  },
};

const CALENDLY_MESSAGES: Record<string, { title: string; body: string; kind: "success" | "error" }> = {
  connected: {
    title: "Calendly connected",
    body: "Your agent can now send prospects a booking link with the right meeting type, see what's booked, and cancel a booking. Booking links and cancellations are staged for your approval first.",
    kind: "success",
  },
  not_configured: {
    title: "Calendly sign-in unavailable",
    body: "Calendly OAuth isn't configured for this deployment yet. Add CALENDLY_CLIENT_ID and CALENDLY_CLIENT_SECRET in Vercel to switch it on.",
    kind: "error",
  },
  error: {
    title: "Calendly connection failed",
    body: "Something went wrong connecting Calendly. Try again, or contact support if it keeps happening.",
    kind: "error",
  },
};

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: {
    connection?: string;
    calendar?: string;
    slack?: string;
    quickbooks?: string;
    stripe?: string;
    zoom?: string;
    calendly?: string;
  };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const [
    gmailResult,
    calendarResult,
    slackResult,
    quickbooksResult,
    stripeResult,
    zoomResult,
    calendlyResult,
  ] =
    await Promise.all([
      fetchGmailConnectionPublic(user.id),
      fetchCalendarConnectionPublic(user.id),
      fetchSlackConnectionPublic(user.id),
      fetchQuickBooksConnectionPublic(user.id),
      fetchStripeConnectionPublic(user.id),
      fetchZoomConnectionPublic(user.id),
      fetchCalendlyConnectionPublic(user.id),
    ]);
  const gmail = gmailResult.ok ? gmailResult.data : null;
  const calendar = calendarResult.ok ? calendarResult.data : null;
  const slack = slackResult.ok ? slackResult.data : null;
  const quickbooks = quickbooksResult.ok ? quickbooksResult.data : null;
  const stripe = stripeResult.ok ? stripeResult.data : null;
  const zoom = zoomResult.ok ? zoomResult.data : null;
  const calendly = calendlyResult.ok ? calendlyResult.data : null;
  const slackOAuthConfigured = isSlackOAuthConfigured();
  const quickBooksOAuthConfigured = isQuickBooksOAuthConfigured();
  const stripeConfigured = isStripeConnectConfigured();
  const zoomOAuthConfigured = isZoomOAuthConfigured();
  const calendlyOAuthConfigured = isCalendlyOAuthConfigured();

  // Inbound-email addresses: ensure both exist (idempotent) and resolve them for display.
  const seedName =
    (user.user_metadata?.user_name as string | undefined) ?? user.email?.split("@")[0] ?? "owner";
  const addressesResult = await ensureInboundAddresses(user.id, seedName);
  const inboundLocal = addressesResult.ok
    ? addressesResult.data.find((a) => a.kind === "inbound")?.local_part ?? null
    : null;
  const bccLocal = addressesResult.ok
    ? addressesResult.data.find((a) => a.kind === "bcc")?.local_part ?? null
    : null;
  const inboundAddress = inboundLocal ? `${inboundLocal}@${INBOUND_DOMAIN}` : null;
  const bccAddress = bccLocal ? `${bccLocal}@${BCC_DOMAIN}` : null;

  const message = searchParams.connection ? MESSAGES[searchParams.connection] ?? null : null;
  const calendarMessage = searchParams.calendar
    ? CALENDAR_MESSAGES[searchParams.calendar] ?? null
    : null;
  const slackMessage = searchParams.slack ? SLACK_MESSAGES[searchParams.slack] ?? null : null;
  const quickbooksMessage = searchParams.quickbooks
    ? QUICKBOOKS_MESSAGES[searchParams.quickbooks] ?? null
    : null;
  const stripeMessage = searchParams.stripe ? STRIPE_MESSAGES[searchParams.stripe] ?? null : null;
  const zoomMessage = searchParams.zoom ? ZOOM_MESSAGES[searchParams.zoom] ?? null : null;
  const calendlyMessage = searchParams.calendly
    ? CALENDLY_MESSAGES[searchParams.calendly] ?? null
    : null;

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
            The outside tools your agent can read from and act on.
          </p>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed">
          Out of the box, your agent works from your brain. Connect a tool and it can work with the
          real thing. Connect Gmail and it reads your mail and drafts replies in your voice.
          Connect Google Calendar and it can see your schedule and propose times. Connect
          QuickBooks and it can draft invoices; Slack and it can post for you. Reads happen on
          their own — but every action that changes something out there waits in your{" "}
          <a href="/app/apps/inbox" className="text-[#22d3ee] hover:underline">
            Inbox
          </a>{" "}
          for your approval first. Nothing sends, books, or charges without your tap.
        </p>

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

        {quickbooksMessage && (
          <div
            className={`rounded-xl border px-5 py-4 space-y-1 ${
              quickbooksMessage.kind === "success"
                ? "border-[#22d3ee]/25 bg-[#22d3ee]/5"
                : "border-slate-700/60 bg-slate-900/50"
            }`}
          >
            <p className="text-sm font-semibold text-slate-100">{quickbooksMessage.title}</p>
            <p className="text-sm text-slate-300 leading-relaxed">{quickbooksMessage.body}</p>
          </div>
        )}

        {stripeMessage && (
          <div
            className={`rounded-xl border px-5 py-4 space-y-1 ${
              stripeMessage.kind === "success"
                ? "border-[#22d3ee]/25 bg-[#22d3ee]/5"
                : "border-slate-700/60 bg-slate-900/50"
            }`}
          >
            <p className="text-sm font-semibold text-slate-100">{stripeMessage.title}</p>
            <p className="text-sm text-slate-300 leading-relaxed">{stripeMessage.body}</p>
          </div>
        )}

        {zoomMessage && (
          <div
            className={`rounded-xl border px-5 py-4 space-y-1 ${
              zoomMessage.kind === "success"
                ? "border-[#22d3ee]/25 bg-[#22d3ee]/5"
                : "border-slate-700/60 bg-slate-900/50"
            }`}
          >
            <p className="text-sm font-semibold text-slate-100">{zoomMessage.title}</p>
            <p className="text-sm text-slate-300 leading-relaxed">{zoomMessage.body}</p>
          </div>
        )}

        {calendlyMessage && (
          <div
            className={`rounded-xl border px-5 py-4 space-y-1 ${
              calendlyMessage.kind === "success"
                ? "border-[#22d3ee]/25 bg-[#22d3ee]/5"
                : "border-slate-700/60 bg-slate-900/50"
            }`}
          >
            <p className="text-sm font-semibold text-slate-100">{calendlyMessage.title}</p>
            <p className="text-sm text-slate-300 leading-relaxed">{calendlyMessage.body}</p>
          </div>
        )}

        <GmailConnectionCard connection={gmail} />

        <InboundEmailCard inboundAddress={inboundAddress} bccAddress={bccAddress} />

        <CalendarConnectionCard connection={calendar} />

        <SlackConnectionCard connection={slack} oauthConfigured={slackOAuthConfigured} />

        <QuickBooksConnectionCard
          connection={quickbooks}
          oauthConfigured={quickBooksOAuthConfigured}
        />

        <StripeConnectionCard connection={stripe} configured={stripeConfigured} />

        <ZoomConnectionCard connection={zoom} oauthConfigured={zoomOAuthConfigured} />

        <CalendlyConnectionCard connection={calendly} oauthConfigured={calendlyOAuthConfigured} />

        <p className="text-xs text-slate-600 leading-relaxed">
          Gmail access lets your agent read incoming mail and archive a thread when you tap
          “I’ll handle” or “Archive.” Calendar access lets it read your schedule and propose,
          create, or reschedule events. Slack access lets it post, reply in threads, and DM.
          QuickBooks access lets it draft invoices, record payments, and pull reports. Stripe
          access lets it draft invoices, payment links, and refunds on your own Stripe account. Zoom
          access lets it schedule the video call and drop the join link into your invites and emails.
          Calendly access lets it send prospects a booking link with the right meeting type, see
          what’s booked, and cancel a booking. It never sends, deletes, or writes anything on its
          own — replies, calendar changes, new Zoom meetings, booking links, and every invoice,
          payment, or refund are always staged for your approval first.
        </p>

        {/* First-touch guide — what to ask, what this connects to, and a sample status */}
        <TabGuide
          promptsHeading="Try one of these"
          prompts={[
            "What can you do for me once I connect Gmail?",
            "Once QuickBooks is connected, draft an invoice for last week's landscaping jobs",
            "After I connect Slack, post a heads-up to my crew channel",
          ]}
          worksWith={[
            {
              href: "/app/email",
              label: "Email",
              blurb: "Gmail powers the Email tab — reading threads and sending your approved replies.",
            },
            {
              href: "/app/calendar",
              label: "Calendar",
              blurb: "Google Calendar powers the Calendar tab — reading and proposing events.",
            },
            {
              href: "/app/apps/inbox",
              label: "Inbox",
              blurb: "Every action on a connected tool stages here for your approval before it runs.",
            },
          ]}
          exampleLabel="See an example of what connecting unlocks"
          exampleNote="This is a sample. Connect a tool above and these become real on your account."
        >
          <ul className="flex flex-col gap-1.5">
            {[
              { tool: "Gmail", does: "Reads incoming mail, drafts replies in your voice, sends on approval." },
              { tool: "Google Calendar", does: "Reads your schedule, proposes times, books events on approval." },
              { tool: "QuickBooks", does: "Drafts invoices, records payments, pulls reports — writes on approval." },
              { tool: "Slack", does: "Posts messages, replies in threads, sends DMs — each send on approval." },
              { tool: "Stripe", does: "Drafts invoices, payment links, and refunds — refunds always ask first." },
              { tool: "Zoom", does: "Schedules the call and adds the join link to your calendar invite + emails — new meetings on approval." },
              { tool: "Calendly", does: "Sends prospects a booking link with the right meeting type — links and cancellations on approval." },
              { tool: "GitHub", does: "Connects the repo that holds your brain so your agent can read and update it." },
            ].map((c) => (
              <li
                key={c.tool}
                className="rounded-xl border border-slate-800/60 bg-slate-950/50 px-4 py-3"
              >
                <p className="text-sm font-semibold text-slate-100">{c.tool}</p>
                <p className="text-[13px] text-slate-500 leading-relaxed mt-0.5">{c.does}</p>
              </li>
            ))}
          </ul>
        </TabGuide>
      </div>
    </div>
  );
}
