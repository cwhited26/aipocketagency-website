"use client";

// MoneyMath — the "what your busywork costs" calculator on /pricing (launch prep 2026-07-02).
// Two inputs (hours/week on repeatable ops + fully-loaded hourly rate) → the monthly cost of that
// work. Deliberately framed for the upsell (Skool Engine playbook): show the money already leaving
// every month, then anchor $37/mo against it. Every visible string is voice-checked against
// whited-brain/voice/chase-spec.md — plain English, no "unlock / seamless / game-changing".

import { useState } from "react";

const WEEKS_PER_MONTH = 4.33;

function toNumber(raw: string): number {
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function usd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function MoneyMath() {
  const [hours, setHours] = useState("10");
  const [rate, setRate] = useState("50");

  const hoursNum = toNumber(hours);
  const rateNum = toNumber(rate);
  const monthly = hoursNum * rateNum * WEEKS_PER_MONTH;
  const yearly = monthly * 12;

  return (
    <div>
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          What that busywork costs you
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-400">
          The quotes, the follow-ups, the data entry — the repeatable ops work has a price. Put
          your numbers in and see the monthly bill.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="grid gap-6 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-slate-300">
              Hours per week you or your team spend on repeatable ops work
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-lg font-semibold text-slate-100 outline-none focus:border-cyan-300/50"
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-300">Fully-loaded hourly rate</span>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-500">
                $
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 py-3 pl-8 pr-4 text-lg font-semibold text-slate-100 outline-none focus:border-cyan-300/50"
              />
            </div>
          </label>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.05] p-6">
            <div className="text-sm text-slate-300">
              What repeatable ops work costs you
            </div>
            <div className="mt-1 text-4xl font-extrabold tracking-tight text-slate-100">
              {usd(monthly)}
              <span className="ml-1 text-base font-medium text-slate-500">/mo</span>
            </div>
            <div className="mt-1 text-sm text-slate-400">{usd(yearly)} a year.</div>
          </div>

          <div className="flex flex-col justify-center rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <p className="text-[15px] leading-relaxed text-slate-300">
              Pocket Agent starts at{" "}
              <span className="font-semibold text-slate-100">$37/mo</span>. Save even 30 minutes
              of that work a week and it&apos;s paid back.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
