"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SmsNumberRow } from "@/lib/pa-sms-numbers";
import type { SmsActivityItem } from "@/lib/pa-conversations";

function SmsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.5 3.5h11a1 1 0 011 1v6a1 1 0 01-1 1H6l-3 2.5v-2.5H2.5a1 1 0 01-1-1v-6a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Plain-language summary of what texting the PA number does.
const CAPABILITY_CHIPS = ["text your agent", "voice memos", "send a photo", "replies by text"];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

export default function SmsConnectionCard({
  number,
  configured,
  activity,
}: {
  number: SmsNumberRow | null;
  configured: boolean;
  activity: SmsActivityItem[];
}) {
  const router = useRouter();
  const [provisioning, setProvisioning] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [areaCode, setAreaCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = number?.status === "active";

  async function handleProvision() {
    if (provisioning) return;
    setProvisioning(true);
    setError(null);
    try {
      const res = await fetch("/api/connectors/sms/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(areaCode.trim() ? { areaCode: areaCode.trim() } : {}),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Couldn't get a number. Try again.");
        return;
      }
      router.refresh();
    } finally {
      setProvisioning(false);
    }
  }

  async function handleRelease() {
    if (releasing) return;
    setReleasing(true);
    setError(null);
    try {
      const res = await fetch("/api/connectors/sms/release", { method: "POST", cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Disconnect failed. Try again.");
        return;
      }
      router.refresh();
    } finally {
      setReleasing(false);
    }
  }

  async function handleCopy() {
    if (!number?.e164_number) return;
    try {
      await navigator.clipboard.writeText(number.e164_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy — select the number and copy it manually.");
    }
  }

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className={`mt-0.5 shrink-0 ${isActive ? "text-[#22d3ee]" : "text-slate-600"}`}>
            <SmsIcon />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100">Text messages (SMS)</p>
            {isActive ? (
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm text-slate-300 font-mono">{number?.e164_number}</span>
                <button
                  onClick={handleCopy}
                  className="text-[10px] font-mono text-[#22d3ee]/80 hover:text-[#22d3ee] border border-[#22d3ee]/30 rounded px-1.5 py-0.5 transition-colors"
                >
                  {copied ? "copied" : "copy"}
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">
                Get a dedicated phone number for your agent. Text it like you&apos;d text an
                assistant — ask for a draft, leave a voice memo, send a photo — and it texts you
                back. Perfect when you&apos;re out of the office and off your computer.
              </p>
            )}
            {isActive && (
              <>
                <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
                  Save it to your phone as &quot;Pocket Agent&quot; and text it anytime.
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {CAPABILITY_CHIPS.map((c) => (
                    <span
                      key={c}
                      className="text-[10px] font-mono text-slate-400 border border-slate-700/60 rounded px-1.5 py-0.5"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 mt-0.5">
          {isActive ? (
            <>
              <span className="text-[10px] font-mono text-[#22d3ee] border border-[#22d3ee]/30 rounded px-2 py-1 bg-[#22d3ee]/5">
                connected
              </span>
              <button
                onClick={handleRelease}
                disabled={releasing}
                className="text-xs text-slate-500 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {releasing ? "Disconnecting…" : "Disconnect"}
              </button>
            </>
          ) : configured ? (
            <div className="flex flex-col items-end gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={areaCode}
                onChange={(e) => setAreaCode(e.target.value)}
                placeholder="Area code"
                aria-label="Preferred area code"
                className="w-24 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee]/50 focus:outline-none"
              />
              <button
                onClick={handleProvision}
                disabled={provisioning}
                className="inline-flex items-center rounded-lg bg-[#22d3ee] px-3.5 py-2 text-xs font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {provisioning ? "Getting your number…" : "Get my PA number →"}
              </button>
            </div>
          ) : (
            <span className="text-[10px] font-mono text-amber-400/80 border border-amber-500/30 rounded px-2 py-1 bg-amber-500/5 text-right leading-snug">
              Add TWILIO_ACCOUNT_SID
              <br />
              in Vercel
            </span>
          )}
        </div>
      </div>

      {!isActive && configured && (
        <p className="mt-3 text-[11px] text-slate-600 pl-7 leading-relaxed">
          Leave the area code blank and we&apos;ll pick one from the national pool.
        </p>
      )}

      {isActive && activity.length > 0 && (
        <div className="mt-4 pl-7">
          <p className="text-[10px] font-mono text-slate-500 tracking-[0.14em] uppercase mb-1.5">
            Recent texts
          </p>
          <ul className="flex flex-col gap-1">
            {activity.map((item, i) => (
              <li key={i} className="flex items-baseline gap-2 text-[11px] min-w-0">
                <span className="shrink-0 text-[#22d3ee]/50">→</span>
                <span className="truncate text-slate-400">{item.snippet}</span>
                <span className="ml-auto shrink-0 font-mono text-slate-600">
                  {relativeTime(item.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-400 pl-7">{error}</p>}
    </div>
  );
}
