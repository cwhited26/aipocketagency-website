"use client";

import { useState } from "react";

// The two inbound-email addresses, with copy-to-clipboard and a plain-English explanation of
// the verb difference: forwarding = "act on this", BCC = "be aware." Rendered on the
// Connections page once the addresses are provisioned.

type Props = {
  inboundAddress: string | null;
  bccAddress: string | null;
};

function CopyRow({ label, hint, address }: { label: string; hint: string; address: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (no permission / insecure context) — the address is still visible
      // to select manually; surface the failure briefly instead of pretending it copied.
      setCopied(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-200">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="text-xs font-mono px-2.5 py-1 rounded-md border border-[#22d3ee]/30 text-[#22d3ee] hover:bg-[#22d3ee]/10 transition-colors"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{hint}</p>
      <code className="block mt-2 text-[13px] text-slate-300 font-mono break-all select-all">
        {address}
      </code>
    </div>
  );
}

export default function InboundEmailCard({ inboundAddress, bccAddress }: Props) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-100">Email your agent</h2>
        <p className="text-sm text-slate-400 mt-1 leading-relaxed">
          Two addresses, two jobs. <strong className="text-slate-300">Forward</strong> an email to
          the first one when you want your agent to act on it — it reads the email and writes back.{" "}
          <strong className="text-slate-300">BCC</strong> the second one on emails you send when you
          just want your agent to stay aware — it logs the touchpoint and, when the other person
          replies, drafts your response for you to approve.
        </p>
      </div>

      {inboundAddress && bccAddress ? (
        <div className="space-y-3">
          <CopyRow
            label="Forward here — “act on this”"
            hint="Forward any email to this address. Your agent treats it as a message to handle and replies to you."
            address={inboundAddress}
          />
          <CopyRow
            label="BCC here — “just be aware”"
            hint="Add this to the BCC line on emails you send. Your agent logs it and watches for the reply."
            address={bccAddress}
          />
          <p className="text-xs text-slate-600 leading-relaxed">
            Manage what’s been received and purge anything from your brain on the{" "}
            <a href="/app/settings/inbound-email" className="text-[#22d3ee] hover:underline">
              inbound email privacy page
            </a>
            .
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          Connect your brain first and your two email addresses will appear here.
        </p>
      )}
    </div>
  );
}
