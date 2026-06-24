"use client";

import { useEffect, useState } from "react";
import { TESTIMONIALS_PLACEHOLDER } from "@/data/pocket-capture/marketing";
import { PurchaseToast } from "./PurchaseToast";

// Below-the-fold social proof (PC-MARK-1). Client component so it can rotate; placed last
// before pricing so it never competes with the hero for LCP.
//
// PC-MARK-4 fills the live purchase-notification slot below with <PurchaseToast />. Real
// testimonials still replace TESTIMONIALS_PLACEHOLDER (data file) when they land.

const ROTATE_MS = 6000;

export function SocialProof() {
  const items = TESTIMONIALS_PLACEHOLDER;
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const timer = window.setInterval(
      () => setActive((i) => (i + 1) % items.length),
      ROTATE_MS,
    );
    return () => window.clearInterval(timer);
  }, [items.length]);

  if (items.length === 0) return null;
  const current = items[active];

  return (
    <section className="border-b border-white/5">
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <blockquote className="min-h-[7rem] text-xl font-medium leading-relaxed text-slate-200">
          “{current.quote}”
        </blockquote>
        <div className="mt-4 text-sm text-slate-500">— {current.role}</div>

        <div className="mt-6 flex items-center justify-center gap-2">
          {items.map((item, i) => (
            <button
              key={item.role}
              type="button"
              aria-label={`Show testimonial ${i + 1}`}
              aria-current={i === active}
              onClick={() => setActive(i)}
              className={`h-2 w-2 rounded-full transition ${
                i === active ? "bg-cyan-300" : "bg-white/20 hover:bg-white/40"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Live purchase-notification mount point (PC-MARK-4). The toast itself is fixed-position. */}
      <div id="pocket-capture-purchase-toast" aria-live="polite">
        <PurchaseToast />
      </div>
    </section>
  );
}
