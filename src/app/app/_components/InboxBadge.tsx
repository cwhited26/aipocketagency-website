"use client";

import { useEffect, useState } from "react";

// Live count of pending Inbox items, shown on the Inbox card. Renders nothing
// until a positive count loads, so an empty Inbox shows no chrome. Fetched fresh
// on mount (the page is dynamic) — never a stale build-time number.
export default function InboxBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/app/inbox/count", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ total: number }>) : Promise.reject()))
      .then((d) => {
        if (active) setCount(d.total);
      })
      .catch(() => {
        /* badge stays hidden on error */
      });
    return () => {
      active = false;
    };
  }, []);

  if (count <= 0) return null;

  return (
    <span
      aria-label={`${count} item${count === 1 ? "" : "s"} awaiting you`}
      className="shrink-0 min-w-[20px] h-5 rounded-full bg-[#22d3ee]/15 border border-[#22d3ee]/40 text-[#22d3ee] text-[10px] font-mono flex items-center justify-center px-1.5"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
