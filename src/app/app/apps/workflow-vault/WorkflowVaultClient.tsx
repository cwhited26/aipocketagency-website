"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  VAULT_CATEGORIES,
  VAULT_CATEGORY_LABELS,
  type VaultCategory,
} from "@/lib/workflow-vault/recipes";

export type RecipeView = {
  slug: string;
  name: string;
  description: string;
  category: VaultCategory;
  recommendedTierLabel: string;
  unlocked: boolean;
  installed: boolean;
  scheduleActive: boolean;
  hasSchedule: boolean;
};

type MutationResponse = { ok?: true; error?: string };

type FilterValue = VaultCategory | "all";

function RecipeCard({ recipe }: { recipe: RecipeView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function install() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/app/apps/workflow-vault/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe_slug: recipe.slug }),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as MutationResponse;
      if (!res.ok || !body.ok) {
        setError(body.error ?? "Couldn't install this workflow.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't install this workflow.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSchedule(active: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/app/apps/workflow-vault/install", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe_slug: recipe.slug, schedule_active: active }),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as MutationResponse;
      if (!res.ok || !body.ok) {
        setError(body.error ?? "Couldn't change the schedule.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't change the schedule.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`rounded-2xl border p-5 flex flex-col transition-colors ${
        recipe.unlocked
          ? "border-slate-700/50 bg-slate-900/50"
          : "border-slate-800/40 bg-slate-900/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={`text-sm font-semibold ${
            recipe.unlocked ? "text-slate-100" : "text-slate-400"
          }`}
        >
          {recipe.name}
        </p>
        <span className="shrink-0 text-[10px] font-mono uppercase tracking-wider text-[#22d3ee]/70 border border-[#22d3ee]/20 rounded px-1.5 py-0.5">
          {recipe.recommendedTierLabel}
        </span>
      </div>

      <div className="mt-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
          {VAULT_CATEGORY_LABELS[recipe.category]}
        </span>
      </div>

      <p className="text-[13px] text-slate-400 mt-2 leading-relaxed flex-1">
        {recipe.description}
      </p>

      <div className="mt-4">
        {!recipe.unlocked ? (
          <div className="flex flex-col gap-1.5">
            <button
              disabled
              className="min-h-[44px] w-full rounded-xl border border-slate-700/60 text-slate-500 text-sm font-semibold cursor-not-allowed"
            >
              Locked — {recipe.recommendedTierLabel}+
            </button>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Move up to {recipe.recommendedTierLabel} to install this, or add the Vault to open all
              25.
            </p>
          </div>
        ) : recipe.installed ? (
          <div className="flex flex-col gap-2">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#22d3ee]">
              <span aria-hidden>▣</span> Installed
            </span>
            {recipe.hasSchedule && (
              <button
                onClick={() => void toggleSchedule(!recipe.scheduleActive)}
                disabled={busy}
                className="min-h-[36px] self-start rounded-lg border border-slate-700 px-3 text-[12px] text-slate-300 hover:border-[#22d3ee]/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy
                  ? "Saving…"
                  : recipe.scheduleActive
                    ? "Pause schedule"
                    : "Resume schedule"}
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => void install()}
            disabled={busy}
            className="min-h-[44px] w-full rounded-xl bg-[#22d3ee] hover:bg-[#06b6d4] text-[#031820] text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? "Installing…" : "Install"}
          </button>
        )}
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>
    </div>
  );
}

export default function WorkflowVaultClient({
  recipes,
  tierLabel,
  unlockedCount,
  totalCount,
  hasVault,
}: {
  recipes: RecipeView[];
  tierLabel: string;
  unlockedCount: number;
  totalCount: number;
  hasVault: boolean;
}) {
  const [filter, setFilter] = useState<FilterValue>("all");

  const visible = useMemo(
    () => (filter === "all" ? recipes : recipes.filter((r) => r.category === filter)),
    [recipes, filter],
  );

  const chips: FilterValue[] = ["all", ...VAULT_CATEGORIES];

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-2">
          <Link
            href="/app/apps"
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
          >
            ← Apps
          </Link>
        </div>

        <div className="mb-6">
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-2">
            Plug-and-play workflows
          </div>
          <h1 className="text-2xl font-bold text-slate-100">AI Workflow Vault</h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Pre-built workflows you can install in one tap. Each one runs a Persona against your
            brain on a schedule and drops a draft in your Inbox for you to approve. Pick one, install
            it, and read the first result.
          </p>
          <p className="text-sm text-slate-400 mt-3">
            <span className="text-[#22d3ee]">
              {hasVault ? totalCount : unlockedCount} of {totalCount} unlocked
            </span>{" "}
            on your {tierLabel} plan
            {hasVault && " (Vault add-on)"}.
          </p>
          {!hasVault && (
            <p className="text-[13px] text-slate-500 mt-1.5 leading-relaxed">
              The AI Workflow Vault add-on opens all {totalCount}.{" "}
              <Link href="/pricing" className="text-[#22d3ee] hover:underline">
                See pricing
              </Link>
              .
            </p>
          )}
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {chips.map((chip) => {
            const active = filter === chip;
            const label = chip === "all" ? "All" : VAULT_CATEGORY_LABELS[chip];
            return (
              <button
                key={chip}
                onClick={() => setFilter(chip)}
                className={`min-h-[36px] rounded-full px-3.5 text-[12px] font-medium transition-colors ${
                  active
                    ? "bg-[#22d3ee]/15 border border-[#22d3ee]/50 text-[#22d3ee]"
                    : "border border-slate-700 text-slate-400 hover:border-slate-600"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {visible.map((recipe) => (
            <RecipeCard key={recipe.slug} recipe={recipe} />
          ))}
        </div>
      </div>
    </div>
  );
}
