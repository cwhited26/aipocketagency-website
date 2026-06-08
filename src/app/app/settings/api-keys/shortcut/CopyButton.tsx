"use client";

import { useState } from "react";

/** Small copy-to-clipboard button for the endpoint URL in the Shortcut guide. */
export default function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={copy}
      className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-semibold text-[#22d3ee] hover:bg-slate-800 transition-colors whitespace-nowrap"
    >
      {copied ? "Copied!" : "Copy URL"}
    </button>
  );
}
