"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AvatarFields = {
  whoTheyAre: string;
  whatTheyWant: string;
  fearsFrustrations: string;
  whereTheySpendTime: string;
  anythingElse: string;
};

type FieldConfig = {
  key: keyof AvatarFields;
  label: string;
  hint: string;
  placeholder: string;
  required: boolean;
};

const FIELDS: FieldConfig[] = [
  {
    key: "whoTheyAre",
    label: "Who they are",
    hint: "Age, job, life stage, income level — the real picture of the person writing the check",
    placeholder: "e.g. Small contractor, 35-55, running a crew of 2-5, making $200k-$800k/yr, no dedicated office staff",
    required: true,
  },
  {
    key: "whatTheyWant",
    label: "What they want",
    hint: "The outcome they're chasing — what a win looks like for them",
    placeholder: "e.g. More jobs without doing their own sales, professional-looking quotes, less admin headache",
    required: true,
  },
  {
    key: "fearsFrustrations",
    label: "What they're afraid of / frustrated by",
    hint: "What keeps them up at night, what they complain about",
    placeholder: "e.g. Losing bids to cheaper competitors, customers who ghost after a quote, chasing invoices",
    required: true,
  },
  {
    key: "whereTheySpendTime",
    label: "Where they spend time",
    hint: "Online haunts, communities, shows — where you'd find them",
    placeholder: "e.g. Facebook contractor groups, YouTube, local Chamber events",
    required: false,
  },
  {
    key: "anythingElse",
    label: "Anything else worth knowing",
    hint: "Anything that'd change how you'd talk to them",
    placeholder: "e.g. Very price-sensitive, responds better to text than email, trusts referrals over ads",
    required: false,
  },
];

const EMPTY_FIELDS: AvatarFields = {
  whoTheyAre: "",
  whatTheyWant: "",
  fearsFrustrations: "",
  whereTheySpendTime: "",
  anythingElse: "",
};

export default function AvatarFormClient({
  initialFields,
  hasBrain,
  hasGithubToken,
}: {
  initialFields: Record<string, string> | null;
  hasBrain: boolean;
  hasGithubToken: boolean;
}) {
  const router = useRouter();
  const [fields, setFields] = useState<AvatarFields>({
    whoTheyAre: initialFields?.whoTheyAre ?? "",
    whatTheyWant: initialFields?.whatTheyWant ?? "",
    fearsFrustrations: initialFields?.fearsFrustrations ?? "",
    whereTheySpendTime: initialFields?.whereTheySpendTime ?? "",
    anythingElse: initialFields?.anythingElse ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = initialFields !== null;

  function updateField(key: keyof AvatarFields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing = FIELDS.filter((f) => f.required && !fields[f.key].trim());
    if (missing.length > 0) {
      setError(`Please fill in: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/app/brain/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `Save failed (${res.status})`);
      }

      router.push("/app/brain");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setError(msg);
      setSaving(false);
    }
  }

  if (!hasBrain || !hasGithubToken) {
    return (
      <div className="h-full overflow-y-auto bg-[#06080b]">
        <div className="max-w-xl mx-auto px-5 py-8 flex flex-col gap-5">
          <div>
            <a href="/app/brain" className="text-[11px] font-mono text-slate-500 hover:text-slate-300 transition-colors">
              ← Brain
            </a>
          </div>
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-6 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-300">Brain not connected</p>
            <p className="text-sm text-slate-400">
              Set up your brain repo first, then come back to create your Customer Avatar.
            </p>
            <a href="/app/onboarding" className="inline-block text-sm text-[#22d3ee] hover:underline font-mono">
              Set up brain →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-xl mx-auto px-5 py-8 flex flex-col gap-6">

        {/* Header */}
        <div className="flex flex-col gap-1.5">
          <a
            href="/app/brain"
            className="text-[11px] font-mono text-slate-500 hover:text-slate-300 transition-colors"
          >
            ← Brain
          </a>
          <div className="text-[#22d3ee] text-[10px] font-mono tracking-[0.22em] uppercase">
            Brain · Customer Avatar
          </div>
          <h1 className="text-xl font-semibold text-slate-100">
            {isEdit ? "Edit your Customer Avatar" : "Create your Customer Avatar"}
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Define the person you sell to. Your agent uses this to make every draft speak directly to them — better quotes, sharper emails, stronger follow-ups.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {FIELDS.map((field) => (
            <div key={field.key} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <label
                  htmlFor={field.key}
                  className="text-sm font-semibold text-slate-200"
                >
                  {field.label}
                </label>
                {field.required && (
                  <span className="text-[10px] font-mono text-[#22d3ee]/70">required</span>
                )}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{field.hint}</p>
              <textarea
                id={field.key}
                value={fields[field.key]}
                onChange={(e) => updateField(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={3}
                className="w-full rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#22d3ee]/40 focus:ring-1 focus:ring-[#22d3ee]/20 resize-none transition-colors"
              />
            </div>
          ))}

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold bg-[#22d3ee] text-[#06080b] hover:bg-[#38e4ff] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <>
                  <span className="w-3.5 h-3.5 border border-[#06080b]/40 border-t-[#06080b] rounded-full animate-spin" />
                  Saving…
                </>
              ) : isEdit ? (
                "Update avatar"
              ) : (
                "Save avatar"
              )}
            </button>
            <a
              href="/app/brain"
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Cancel
            </a>
          </div>
        </form>

        {/* Context note */}
        <div className="rounded-xl border border-slate-800/40 bg-slate-900/20 px-4 py-3">
          <p className="text-[11px] font-mono text-slate-600 leading-relaxed">
            This is saved to your brain repo as{" "}
            <code className="text-slate-500">memory/customer-avatar.md</code> — your agent reads
            it automatically when drafting quotes, emails, and follow-ups.
          </p>
        </div>
      </div>
    </div>
  );
}
