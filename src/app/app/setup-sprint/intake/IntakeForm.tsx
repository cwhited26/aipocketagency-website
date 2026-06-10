"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SprintIntake } from "@/lib/setup-sprint/sprints";

type IntakeResponse = { ok?: true; error?: string };

const FIELD_CLASS =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none";

export default function IntakeForm({ defaults }: { defaults: Partial<SprintIntake> }) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState(defaults.business_name ?? "");
  const [offerings, setOfferings] = useState(defaults.offerings ?? "");
  const [targetCustomer, setTargetCustomer] = useState(defaults.target_customer ?? "");
  const [adminPain, setAdminPain] = useState(defaults.current_admin_pain ?? "");
  const [workflow1, setWorkflow1] = useState(defaults.top_workflows?.[0] ?? "");
  const [workflow2, setWorkflow2] = useState(defaults.top_workflows?.[1] ?? "");
  const [workflow3, setWorkflow3] = useState(defaults.top_workflows?.[2] ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setError(null);

    if (businessName.trim().length < 2) {
      setError("Add your business name.");
      return;
    }
    const topWorkflows = [workflow1, workflow2, workflow3]
      .map((w) => w.trim())
      .filter((w) => w.length > 0);
    if (topWorkflows.length < 1) {
      setError("Add at least one workflow you want set up first.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/app/setup-sprint/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: businessName.trim(),
          offerings: offerings.trim(),
          target_customer: targetCustomer.trim(),
          current_admin_pain: adminPain.trim(),
          top_workflows: topWorkflows,
        }),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as IntakeResponse;
      if (!res.ok || !body.ok) {
        setError(body.error ?? "Couldn't save your intake.");
        return;
      }
      router.push("/app/setup-sprint");
      router.refresh();
    } catch {
      setError("Couldn't save your intake.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="business_name" className="text-sm font-medium text-slate-200">
          Business name
        </label>
        <input
          id="business_name"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="Your business name"
          className={FIELD_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="offerings" className="text-sm font-medium text-slate-200">
          What you sell
        </label>
        <textarea
          id="offerings"
          value={offerings}
          onChange={(e) => setOfferings(e.target.value)}
          rows={3}
          placeholder="Your services or products, and roughly what they cost."
          className={FIELD_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="target_customer" className="text-sm font-medium text-slate-200">
          Who you work with
        </label>
        <textarea
          id="target_customer"
          value={targetCustomer}
          onChange={(e) => setTargetCustomer(e.target.value)}
          rows={3}
          placeholder="The customers you want more of."
          className={FIELD_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="admin_pain" className="text-sm font-medium text-slate-200">
          What eats your time
        </label>
        <textarea
          id="admin_pain"
          value={adminPain}
          onChange={(e) => setAdminPain(e.target.value)}
          rows={3}
          placeholder="The admin work you'd hand off first."
          className={FIELD_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-slate-200">
          Workflows to set up first
        </span>
        <p className="text-[12px] text-slate-500 leading-relaxed">
          One to three. The first things you want running after the call.
        </p>
        <input
          value={workflow1}
          onChange={(e) => setWorkflow1(e.target.value)}
          placeholder="Workflow 1 — e.g. follow up on every quote after 3 days"
          className={FIELD_CLASS}
        />
        <input
          value={workflow2}
          onChange={(e) => setWorkflow2(e.target.value)}
          placeholder="Workflow 2 (optional)"
          className={FIELD_CLASS}
        />
        <input
          value={workflow3}
          onChange={(e) => setWorkflow3(e.target.value)}
          placeholder="Workflow 3 (optional)"
          className={FIELD_CLASS}
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="min-h-[44px] rounded-xl bg-[#22d3ee] hover:bg-[#06b6d4] text-[#031820] text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy ? "Saving…" : "Save intake"}
      </button>
    </form>
  );
}
