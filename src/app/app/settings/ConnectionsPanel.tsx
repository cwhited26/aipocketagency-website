"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ConnectionRow, ConnectionProvider } from "@/lib/pa-connections";

type Props = {
  connections: ConnectionRow[];
  oauthConfigured: boolean;
};

type ProviderMeta = {
  id: ConnectionProvider;
  label: string;
  description: string;
  icon: React.ReactNode;
};

function GmailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 4L8 9.5 14.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2.5" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 1v3M11 1v3M1 6.5h14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: "google_gmail",
    label: "Gmail",
    description: "Read-only access so your agent can reference emails in context.",
    icon: <GmailIcon />,
  },
  {
    id: "google_calendar",
    label: "Google Calendar",
    description: "Read-only access so your agent knows your schedule.",
    icon: <CalendarIcon />,
  },
];

export default function ConnectionsPanel({ connections, oauthConfigured }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<ConnectionProvider | null>(null);
  const [errors, setErrors] = useState<Partial<Record<ConnectionProvider, string>>>({});

  const byProvider = Object.fromEntries(connections.map((c) => [c.provider, c])) as Partial<
    Record<ConnectionProvider, ConnectionRow>
  >;

  async function handleDisconnect(provider: ConnectionProvider) {
    if (pending) return;
    setPending(provider);
    setErrors((e) => ({ ...e, [provider]: undefined }));
    try {
      const res = await fetch("/api/app/connections/google/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErrors((e) => ({ ...e, [provider]: body.error ?? "Disconnect failed. Try again." }));
        return;
      }
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-1">
          Connections
        </div>
        <p className="text-sm text-slate-400 leading-relaxed">
          Read-only access to your tools. Your agent can see but cannot send, edit, or delete
          anything.
        </p>
      </div>

      {!oauthConfigured && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-5 py-4">
          <p className="text-sm font-semibold text-slate-200">
            Connections are being set up — coming soon
          </p>
          <p className="text-sm text-slate-400 mt-1 leading-relaxed">
            Google integrations are on the way. You&rsquo;ll be notified when they go live.
          </p>
        </div>
      )}

      {oauthConfigured && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 overflow-hidden divide-y divide-slate-800/60">
          {PROVIDERS.map(({ id, label, description, icon }) => {
            const row = byProvider[id];
            const isConnected = row?.status === "connected";
            const isPending = pending === id;
            const error = errors[id];

            return (
              <div key={id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={`mt-0.5 shrink-0 ${isConnected ? "text-[#22d3ee]" : "text-slate-600"}`}
                    >
                      {icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-100">{label}</p>
                      {isConnected && row?.account_email ? (
                        <p className="text-sm text-slate-300 mt-0.5 truncate">
                          {row.account_email}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-500 mt-0.5">{description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 mt-0.5">
                    {isConnected ? (
                      <>
                        <span className="text-[10px] font-mono text-[#22d3ee] border border-[#22d3ee]/30 rounded px-2 py-1 bg-[#22d3ee]/5">
                          connected
                        </span>
                        <button
                          onClick={() => handleDisconnect(id)}
                          disabled={isPending}
                          className="text-xs text-slate-500 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {isPending ? "Disconnecting…" : "Disconnect"}
                        </button>
                      </>
                    ) : (
                      <a
                        href={`/api/app/connections/google/start?provider=${id}`}
                        className="inline-flex items-center rounded-lg bg-[#22d3ee] px-3 py-1.5 text-xs font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors"
                      >
                        Connect →
                      </a>
                    )}
                  </div>
                </div>

                {error && (
                  <p className="mt-2 text-xs text-red-400 pl-7">{error}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
