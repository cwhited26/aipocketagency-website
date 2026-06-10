"use client";

import { useState, type FormEvent } from "react";
import {
  ROLE_OPTIONS,
  BUSINESS_TYPE_OPTIONS,
  REVENUE_OPTIONS,
  TEAM_SIZE_OPTIONS,
  AI_TOOL_OPTIONS,
  CONTEXT_LOCATION_OPTIONS,
  WORKFLOW_OPTIONS,
  APP_OPTIONS,
  HIGH_VOLUME_OPTIONS,
  YES_NO_NOTSURE_OPTIONS,
  YES_NO_MAYBELATER_OPTIONS,
  TIMELINE_OPTIONS,
  IMPLEMENTATION_OWNER_OPTIONS,
  WILLING_TO_GATHER_OPTIONS,
  USED_BEFORE_OPTIONS,
  BUDGET_OPTIONS,
  DWY_INTEREST_OPTIONS,
  type EnterpriseApplicationInput,
} from "@/lib/enterprise/types";

const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

const EMPTY: EnterpriseApplicationInput = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  company: "",
  website: "",
  role: "",
  businessType: "",
  whatYouSell: "",
  whoYouSellTo: "",
  monthlyRevenueRange: "",
  teamSize: "",
  currentAiTools: [],
  currentAiPain: "",
  contextLocations: [],
  desiredWorkflows: [],
  biggestBottleneck: "",
  successOutcome: "",
  interestedApps: [],
  highVolumeUsage: "",
  needsPermissions: "",
  needsByoLlm: "",
  needsIntegrations: "",
  integrationSystems: "",
  timeline: "",
  implementationOwner: "",
  willingToGatherContext: "",
  usedPocketAgentBefore: "",
  budgetRange: "",
  dwyInterest: "",
  additionalNotes: "",
};

const labelCls = "block text-sm font-medium text-slate-200";
const inputCls =
  "mt-2 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/50 focus:outline-none";

function SectionHeader({ index, title }: { index: number; title: string }) {
  return (
    <div className="border-b border-white/10 pb-3">
      <div className="text-xs text-cyan-300/70" style={{ fontFamily: MONO_FONT }}>
        [ section {index} ]
      </div>
      <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-100">{title}</h2>
    </div>
  );
}

export default function ApplyForm() {
  const [form, setForm] = useState<EnterpriseApplicationInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof EnterpriseApplicationInput>(
    key: K,
    value: EnterpriseApplicationInput[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggle(key: keyof EnterpriseApplicationInput, option: string) {
    setForm((f) => {
      const current = f[key] as string[];
      const next = current.includes(option)
        ? current.filter((v) => v !== option)
        : [...current, option];
      return { ...f, [key]: next };
    });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/enterprise/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      const data = (await res.json()) as { route?: string };
      window.location.href = data.route ?? "/enterprise/thanks";
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-12">
      {/* SECTION 1: CONTACT INFO */}
      <fieldset className="space-y-5">
        <SectionHeader index={1} title="Contact info" />
        <div className="grid gap-5 sm:grid-cols-2">
          <Text label="First name" value={form.firstName} onChange={(v) => set("firstName", v)} />
          <Text label="Last name" value={form.lastName} onChange={(v) => set("lastName", v)} />
        </div>
        <Text
          label="Email"
          type="email"
          required
          value={form.email}
          onChange={(v) => set("email", v)}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Text label="Phone number" value={form.phone} onChange={(v) => set("phone", v)} />
          <Text
            label="Company name"
            required
            value={form.company}
            onChange={(v) => set("company", v)}
          />
        </div>
        <Text label="Website" value={form.website} onChange={(v) => set("website", v)} />
        <Select
          label="Role"
          required
          options={ROLE_OPTIONS}
          value={form.role}
          onChange={(v) => set("role", v)}
        />
      </fieldset>

      {/* SECTION 2: BUSINESS PROFILE */}
      <fieldset className="space-y-5">
        <SectionHeader index={2} title="Business profile" />
        <Select
          label="What type of business do you run?"
          options={BUSINESS_TYPE_OPTIONS}
          value={form.businessType}
          onChange={(v) => set("businessType", v)}
        />
        <Area
          label="What do you sell?"
          required
          hint="Briefly describe your offer, service, product, or business model."
          value={form.whatYouSell}
          onChange={(v) => set("whatYouSell", v)}
        />
        <Area
          label="Who do you sell to?"
          hint="Describe your ideal customer."
          value={form.whoYouSellTo}
          onChange={(v) => set("whoYouSellTo", v)}
        />
        <Select
          label="What is your approximate monthly revenue?"
          options={REVENUE_OPTIONS}
          value={form.monthlyRevenueRange}
          onChange={(v) => set("monthlyRevenueRange", v)}
        />
        <Select
          label="How many people are on your team?"
          options={TEAM_SIZE_OPTIONS}
          value={form.teamSize}
          onChange={(v) => set("teamSize", v)}
        />
      </fieldset>

      {/* SECTION 3: CURRENT AI USAGE */}
      <fieldset className="space-y-5">
        <SectionHeader index={3} title="Current AI usage" />
        <Checks
          label="What AI tools are you currently using?"
          options={AI_TOOL_OPTIONS}
          selected={form.currentAiTools}
          onToggle={(o) => toggle("currentAiTools", o)}
        />
        <Area
          label="What is not working about your current AI setup?"
          required
          hint="Be specific. Where is the friction?"
          value={form.currentAiPain}
          onChange={(v) => set("currentAiPain", v)}
        />
        <Checks
          label="Where does your business context currently live?"
          options={CONTEXT_LOCATION_OPTIONS}
          selected={form.contextLocations}
          onToggle={(o) => toggle("contextLocations", o)}
        />
      </fieldset>

      {/* SECTION 4: WORKFLOW NEEDS */}
      <fieldset className="space-y-5">
        <SectionHeader index={4} title="Workflow needs" />
        <Checks
          label="Which workflows do you want Pocket Agent to help with?"
          options={WORKFLOW_OPTIONS}
          selected={form.desiredWorkflows}
          onToggle={(o) => toggle("desiredWorkflows", o)}
        />
        <Area
          label="What is the single biggest workflow bottleneck right now?"
          required
          hint="Example: leads are slipping, follow-up is slow, content is inconsistent, ideas never ship, approvals are messy, customer context is scattered."
          value={form.biggestBottleneck}
          onChange={(v) => set("biggestBottleneck", v)}
        />
        <Area
          label="What would a successful Enterprise implementation look like?"
          hint="Describe the outcome you want."
          value={form.successOutcome}
          onChange={(v) => set("successOutcome", v)}
        />
        <Checks
          label="Which Pocket Agent Apps are you most interested in?"
          options={APP_OPTIONS}
          selected={form.interestedApps}
          onToggle={(o) => toggle("interestedApps", o)}
        />
      </fieldset>

      {/* SECTION 5: USAGE AND TEAM REQUIREMENTS */}
      <fieldset className="space-y-5">
        <SectionHeader index={5} title="Usage and team requirements" />
        <Select
          label="Do you expect high-volume usage?"
          options={HIGH_VOLUME_OPTIONS}
          value={form.highVolumeUsage}
          onChange={(v) => set("highVolumeUsage", v)}
        />
        <Select
          label="Do you need team permissions or role-based access?"
          options={YES_NO_NOTSURE_OPTIONS}
          value={form.needsPermissions}
          onChange={(v) => set("needsPermissions", v)}
        />
        <Select
          label="Do you need BYO LLM configuration?"
          options={YES_NO_MAYBELATER_OPTIONS}
          value={form.needsByoLlm}
          onChange={(v) => set("needsByoLlm", v)}
        />
        <Select
          label="Do you need custom integrations?"
          options={YES_NO_NOTSURE_OPTIONS}
          value={form.needsIntegrations}
          onChange={(v) => set("needsIntegrations", v)}
        />
        <Area
          label="If yes, what systems do you want to connect?"
          hint="CRM, website, forms, dashboards, project tools, email, database, etc."
          value={form.integrationSystems}
          onChange={(v) => set("integrationSystems", v)}
        />
      </fieldset>

      {/* SECTION 6: IMPLEMENTATION READINESS */}
      <fieldset className="space-y-5">
        <SectionHeader index={6} title="Implementation readiness" />
        <Select
          label="How soon do you want to implement?"
          options={TIMELINE_OPTIONS}
          value={form.timeline}
          onChange={(v) => set("timeline", v)}
        />
        <Select
          label="Who will own implementation on your side?"
          options={IMPLEMENTATION_OWNER_OPTIONS}
          value={form.implementationOwner}
          onChange={(v) => set("implementationOwner", v)}
        />
        <Select
          label="Are you willing to gather business context for setup?"
          options={WILLING_TO_GATHER_OPTIONS}
          value={form.willingToGatherContext}
          onChange={(v) => set("willingToGatherContext", v)}
        />
        <Select
          label="Have you used Pocket Agent before?"
          options={USED_BEFORE_OPTIONS}
          value={form.usedPocketAgentBefore}
          onChange={(v) => set("usedPocketAgentBefore", v)}
        />
      </fieldset>

      {/* SECTION 7: BUDGET AND FIT */}
      <fieldset className="space-y-5">
        <SectionHeader index={7} title="Budget and fit" />
        <Select
          label="Enterprise requires custom pricing based on scope, usage, implementation, and support. What budget range are you prepared for?"
          options={BUDGET_OPTIONS}
          value={form.budgetRange}
          onChange={(v) => set("budgetRange", v)}
        />
        <Select
          label="Would you be interested in Done-With-You Setup if Enterprise is not the right fit?"
          options={DWY_INTEREST_OPTIONS}
          value={form.dwyInterest}
          onChange={(v) => set("dwyInterest", v)}
        />
        <Area
          label="Anything else we should know?"
          hint="Add context, constraints, or goals."
          value={form.additionalNotes}
          onChange={(v) => set("additionalNotes", v)}
        />
      </fieldset>

      {error ? (
        <p className="rounded-lg border border-red-400/30 bg-red-400/[0.06] px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="space-y-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-full items-center justify-center rounded-full bg-accent px-7 py-4 text-base font-semibold text-accent-foreground transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {busy ? "Submitting…" : "Apply For Enterprise"}
        </button>
        <p className="text-[13px] leading-relaxed text-slate-500">
          We&apos;ll review your application and follow up if Enterprise looks like
          the right fit. If not, we may recommend Business Agent, AI Agent
          Workspace, or Done-With-You Setup instead.
        </p>
      </div>
    </form>
  );
}

function Text({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className={labelCls}>
        {label}
        {required ? <span className="text-cyan-300"> *</span> : null}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
  hint,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className={labelCls}>
        {label}
        {required ? <span className="text-cyan-300"> *</span> : null}
      </span>
      {hint ? <span className="mt-1 block text-[13px] text-slate-500">{hint}</span> : null}
      <textarea
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className={`${inputCls} resize-y`}
      />
    </label>
  );
}

function Select({
  label,
  options,
  value,
  onChange,
  required = false,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className={labelCls}>
        {label}
        {required ? <span className="text-cyan-300"> *</span> : null}
      </span>
      <select
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} appearance-none`}
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o} value={o} className="bg-[#0b0e13]">
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Checks({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onToggle: (option: string) => void;
}) {
  return (
    <fieldset>
      <legend className={labelCls}>{label}</legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const checked = selected.includes(o);
          return (
            <label
              key={o}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition ${
                checked
                  ? "border-cyan-300/50 bg-cyan-300/[0.06] text-slate-100"
                  : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(o)}
                className="h-4 w-4 accent-cyan-400"
              />
              <span>{o}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
