"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TabGuide } from "../_components/TabGuide";
import { StarterBox } from "../_components/StarterBox";

// Mirrors GmailReadMessage from the Gmail read connector.
type GmailMessage = {
  from: string;
  subject: string;
  snippet: string;
  date: string | null;
};

type MessagesResponse = { messages: GmailMessage[] };

// `"Maya Rivera" <maya@host>` → "Maya Rivera"; bare `addr@host` → "addr@host".
function senderName(from: string): string {
  const quoted = from.match(/^"?([^"<]+?)"?\s*<.*>$/);
  if (quoted) return quoted[1].trim();
  return from.replace(/[<>]/g, "").trim();
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function EmailViewClient({
  connected,
  accountEmail,
}: {
  connected: boolean;
  accountEmail: string | null;
}) {
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [isLoading, setIsLoading] = useState(connected);
  const [error, setError] = useState<string | null>(null);
  const [reauth, setReauth] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setReauth(false);

    const res = await fetch("/api/connections/gmail/messages?limit=10", {
      cache: "no-store",
    }).catch(() => null);

    if (!res) {
      setError("Network error. Check your connection and try again.");
      setIsLoading(false);
      return;
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; reauth?: boolean };
      setReauth(Boolean(body.reauth));
      setError(body.error ?? "Couldn't load your email. Try again.");
      setIsLoading(false);
      return;
    }

    const data = (await res.json()) as MessagesResponse;
    setMessages(data.messages);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (connected) void load();
  }, [connected, load]);

  return (
    <div className="h-full overflow-y-auto bg-[#05070a]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] text-[#22d3ee]/60 font-mono tracking-[0.2em] uppercase mb-2">
              Gmail · Connection
            </div>
            <h1 className="text-2xl font-bold text-slate-100">Email</h1>
            <p className="text-slate-500 text-sm mt-2 leading-relaxed">
              {connected
                ? `Recent mail${accountEmail ? ` in ${accountEmail}` : ""}. Your agent triages incoming threads in the Inbox and never sends a reply without your tap.`
                : "Connect Gmail and your agent reads incoming mail, triages it in Mission Control, and drafts replies in your voice — every send waits for your approval."}
            </p>
          </div>
          {connected && (
            <Link
              href="/app/apps/email"
              className="shrink-0 rounded-lg bg-[#22d3ee]/10 border border-[#22d3ee]/40 text-[#22d3ee] text-sm font-medium px-4 py-2 hover:bg-[#22d3ee]/15 transition-colors"
            >
              Compose
            </Link>
          )}
        </div>

        <p className="text-sm text-slate-300 leading-relaxed mb-6">
          Connect Gmail and your agent reads your mail the way you would. Ask it to summarize the
          back-and-forth with a couple about their fall wedding and it gives you the short version.
          Ask it to draft a follow-up to the three couples who stopped by your booth and it writes
          each one in your voice — then stages them in Mission Control so you read, tweak, and send with
          one tap. Incoming mail gets triaged there too, so the stuff that needs you rises to the
          top. It reads and drafts on its own; it never sends without you.
        </p>

        {connected && (
          <div className="mb-6">
            <StarterBox
              placeholder="Ask your agent to draft a reply, summarize a thread, or follow up…"
              submitLabel="Ask →"
              rows={2}
            />
          </div>
        )}

        {connected && (
          <p className="text-xs text-slate-600 mb-5">
            Need to act on a thread?{" "}
            <Link href="/app/mission-control" className="text-[#22d3ee]/80 hover:text-[#22d3ee]">
              Open Inbox triage →
            </Link>
          </p>
        )}

        {!connected && (
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/50 px-6 py-8 text-center">
            <p className="text-sm font-semibold text-slate-100">No Gmail connected</p>
            <p className="text-sm text-slate-400 mt-1.5 leading-relaxed max-w-sm mx-auto">
              Once Gmail is connected, your recent threads show up here and flow into your Inbox for
              triage.
            </p>
            <Link
              href="/app/settings/connections"
              className="inline-flex items-center gap-2 mt-5 rounded-lg bg-[#22d3ee]/10 border border-[#22d3ee]/40 text-[#22d3ee] text-sm font-medium px-4 py-2 hover:bg-[#22d3ee]/15 transition-colors"
            >
              Connect Gmail →
            </Link>
          </div>
        )}

        {connected && isLoading && (
          <p className="text-sm text-slate-500 font-mono">Loading your email…</p>
        )}

        {connected && !isLoading && error && (
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-5 py-4">
            <p className="text-sm text-slate-200">{error}</p>
            {reauth ? (
              <Link
                href="/app/settings/connections"
                className="inline-block mt-3 text-sm text-[#22d3ee] hover:underline"
              >
                Reconnect Gmail →
              </Link>
            ) : (
              <button
                onClick={() => void load()}
                className="mt-3 text-sm text-[#22d3ee] hover:underline"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {connected && !isLoading && !error && messages.length === 0 && (
          <p className="text-sm text-slate-500">No recent mail in your inbox.</p>
        )}

        {connected && !isLoading && !error && messages.length > 0 && (
          <ul className="space-y-1.5">
            {messages.map((m, i) => (
              <li
                key={`${m.subject}-${i}`}
                className="rounded-xl border border-slate-800/70 bg-slate-900/40 px-5 py-3.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-100 truncate">{senderName(m.from)}</p>
                  <span className="shrink-0 text-[11px] text-slate-600 font-mono">
                    {formatDate(m.date)}
                  </span>
                </div>
                <p className="text-sm text-slate-300 truncate mt-0.5">{m.subject || "(no subject)"}</p>
                <p className="text-xs text-slate-500 truncate mt-1">{m.snippet}</p>
              </li>
            ))}
          </ul>
        )}

        {/* First-touch guide — what to ask, what this connects to, and a sample draft */}
        <div className="mt-10">
          <TabGuide
            promptsHeading="Try one of these"
            prompts={[
              "Draft a follow-up to the three couples who stopped by our booth this weekend",
              "Summarize the thread with the Hales about their fall date",
              "Reply to the latest inquiry and stage it for my approval",
            ]}
            worksWith={[
              {
                href: "/app/mission-control",
                label: "Mission Control",
                blurb: "Every reply your agent drafts lands there for you to read and send.",
              },
              {
                href: "/app/settings/connections",
                label: "Connections",
                blurb: "Connect Gmail here so your agent can read your mail and send as you.",
              },
              {
                href: "/app/personas",
                label: "Personas",
                blurb: "A sales persona drafts like a closer; a support persona drafts like an operator.",
              },
            ]}
            exampleLabel="See an example draft"
            exampleNote="This is a sample. Your real drafts land in Mission Control for approval before they send."
          >
            <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-4">
              <p className="text-[11px] font-mono text-slate-500">
                to maya + chris · drafted in your voice
              </p>
              <p className="mt-1.5 text-sm font-semibold text-slate-100">
                Re: October wedding — availability + packages
              </p>
              <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-800/40 bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-400 font-mono">
{`Hi Maya & Chris —

So good meeting you at the expo. I've got your October 11th
date open, and I put together two package options that fit
what you described — the full-day coverage you wanted plus
an engagement session.

Want me to send the details and hold the date for you?`}
              </pre>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-lg bg-[#22d3ee] px-3 py-1.5 text-xs font-semibold text-[#031820]">
                  Approve &amp; send
                </span>
                <span className="rounded-lg border border-slate-700/60 px-3 py-1.5 text-xs font-medium text-slate-300">
                  Edit first
                </span>
              </div>
            </div>
          </TabGuide>
        </div>
      </div>
    </div>
  );
}
