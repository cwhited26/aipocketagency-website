"use client";

import { useEffect, useState } from "react";
import {
  isToastDismissed,
  nextPurchaseIndex,
  purchaseToastMessage,
  PURCHASE_TOAST_DISMISS_KEY,
  PURCHASE_TOAST_GAP_MS,
  PURCHASE_TOAST_VISIBLE_MS,
  type RecentPurchase,
} from "@/lib/pocket-capture/recent-purchases";

// Live purchase-notification toast (PC-MARK-4). Mounts in the #pocket-capture-purchase-toast slot.
// Fetches the last few real standalone purchases, rotates one at a time in the bottom-left: visible
// 8s, next one every 12s. X (or the visit being over) dismisses; the X persists a "don't show me
// this" preference in localStorage. Pauses while hovered. Renders nothing when there are no
// attributable purchases yet — no fake placeholders (SPEC §4.5).

export function PurchaseToast() {
  const [purchases, setPurchases] = useState<RecentPurchase[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Honor the saved dismissal before anything renders.
  useEffect(() => {
    try {
      if (isToastDismissed(window.localStorage.getItem(PURCHASE_TOAST_DISMISS_KEY))) {
        setDismissed(true);
      }
    } catch {
      // localStorage can throw in private modes — treat as "not dismissed" and carry on.
      setDismissed(false);
    }
  }, []);

  // Load the recent purchases once (the endpoint is cached server-side).
  useEffect(() => {
    if (dismissed) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/pocket-capture/recent-purchases", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { purchases?: unknown };
        const list = Array.isArray(body.purchases) ? body.purchases : [];
        const clean = (list as unknown[]).filter(
          (p): p is RecentPurchase =>
            typeof p === "object" &&
            p !== null &&
            typeof (p as RecentPurchase).city === "string" &&
            typeof (p as RecentPurchase).purchased_at === "string",
        );
        if (!cancelled && clean.length > 0) {
          setPurchases(clean);
          setVisible(true);
        }
      } catch {
        // Network failure → stay in the empty state; never block the page.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dismissed]);

  // The rotation clock. While a toast is up, schedule its 8s auto-dismiss; while it's down, schedule
  // the next one to appear (12s cadence = 4s gap after the 8s visible window). Pausing or dismissing
  // clears the pending timer; unpausing restarts the current phase.
  useEffect(() => {
    if (dismissed || paused || purchases.length === 0) return;
    if (visible) {
      const t = window.setTimeout(() => setVisible(false), PURCHASE_TOAST_VISIBLE_MS);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      setIndex((i) => nextPurchaseIndex(i, purchases.length));
      setVisible(true);
    }, PURCHASE_TOAST_GAP_MS - PURCHASE_TOAST_VISIBLE_MS);
    return () => window.clearTimeout(t);
  }, [visible, paused, dismissed, purchases.length]);

  if (dismissed || purchases.length === 0 || !visible) return null;

  const current = purchases[index] ?? purchases[0];

  function close() {
    setDismissed(true);
    try {
      window.localStorage.setItem(PURCHASE_TOAST_DISMISS_KEY, "1");
    } catch {
      // If we can't persist, the toast still hides for this visit.
    }
  }

  return (
    <div
      className="fixed bottom-4 left-4 z-50 max-w-[20rem]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-slate-900/95 px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur">
        <span className="mt-0.5 text-lg" aria-hidden>
          🎉
        </span>
        <p className="flex-1 text-sm leading-snug text-slate-200">
          {purchaseToastMessage(current)}
        </p>
        <button
          type="button"
          onClick={close}
          aria-label="Dismiss purchase notifications"
          className="-mr-1 -mt-1 rounded-md p-1 text-slate-500 transition hover:text-slate-200"
        >
          <span aria-hidden>×</span>
        </button>
      </div>
    </div>
  );
}
