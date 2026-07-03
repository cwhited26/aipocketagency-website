"use client";

// PersonaNameChip — "Give this one a name?" (PA-POS-35). Surfaces in Mission Control after a
// Persona is seeded (vertical picker onboarding or an approved Agent Builder compose) and the
// owner hasn't named it yet. Three suggested names per role + "Something else". Naming PATCHes
// personas.display_name; "keep the template name" dismisses per-persona via localStorage so the
// chip never nags. Poc stays the visual constant — the name is the one thing that personalizes.

import { useCallback, useEffect, useState } from "react";
import type { PersonaRow } from "@/lib/personas/types";
import { getPersonaDisplayName, personaDisplayNameSchema } from "@/lib/personas/types";
import { suggestedNamesForTemplateKey } from "@/data/persona-name-suggestions";
import { avatarSlugForTemplateKey } from "@/lib/personas/templates";
import { PersonaAvatar } from "@/components/personas/avatar";

const DISMISS_PREFIX = "pa-name-chip-dismissed:";

function isDismissed(personaId: string): boolean {
  try {
    return window.localStorage.getItem(`${DISMISS_PREFIX}${personaId}`) === "1";
  } catch {
    return false;
  }
}

function dismiss(personaId: string): void {
  try {
    window.localStorage.setItem(`${DISMISS_PREFIX}${personaId}`, "1");
  } catch {
    // Storage unavailable (private mode) — the chip just reappears next visit.
  }
}

export default function PersonaNameChip() {
  const [persona, setPersona] = useState<PersonaRow | null>(null);
  const [custom, setCustom] = useState<string | null>(null); // null = suggestion buttons, string = free-text draft
  const [saving, setSaving] = useState<string | null>(null); // the name being saved
  const [savedAs, setSavedAs] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/personas", { cache: "no-store" }).catch(() => null);
      if (!res || !res.ok) return;
      const body = (await res.json().catch(() => null)) as { personas?: PersonaRow[] } | null;
      if (!body?.personas || cancelled) return;
      // The list arrives newest-first; the chip offers to name the newest unnamed persona.
      const candidate = body.personas.find(
        (p) => p.status !== "archived" && !p.display_name?.trim() && !isDismissed(p.id),
      );
      if (candidate) setPersona(candidate);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(
    async (raw: string) => {
      if (!persona) return;
      const check = personaDisplayNameSchema.safeParse(raw);
      if (!check.success) {
        setErr(check.error.issues[0]?.message ?? "That name won't work");
        return;
      }
      setSaving(raw);
      setErr(null);
      const res = await fetch(`/api/app/personas/${persona.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: check.data }),
      }).catch(() => null);
      setSaving(null);
      if (!res || !res.ok) {
        setErr("Couldn't save the name. Try again from the persona's page.");
        return;
      }
      setSavedAs(check.data);
    },
    [persona],
  );

  if (!persona) return null;
  const fallbackName = getPersonaDisplayName(persona);

  if (savedAs) {
    return (
      <div className="mb-8 rounded-2xl border border-[#22d3ee]/30 bg-[#22d3ee]/5 px-4 py-3 flex items-center gap-3">
        <PersonaAvatar slug={avatarSlugForTemplateKey(persona.template_key)} size="sm" alt={savedAs} />
        <p className="text-sm text-slate-300">
          Done — <span className="text-slate-100 font-medium">{savedAs}</span> it is. The name shows
          up everywhere this persona works.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-4">
      <div className="flex items-start gap-3">
        <PersonaAvatar
          slug={avatarSlugForTemplateKey(persona.template_key)}
          size="sm"
          alt={fallbackName}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-100">Give this one a name?</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {fallbackName} is on the job. A name makes it yours — it answers as that name in chat
            and on every channel.
          </p>

          {custom === null ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {suggestedNamesForTemplateKey(persona.template_key).map((name) => (
                <button
                  key={name}
                  onClick={() => save(name)}
                  disabled={saving !== null}
                  className="text-xs rounded-lg border border-slate-700 text-slate-200 px-3 py-1.5 hover:border-[#22d3ee]/60 hover:text-[#22d3ee] transition-colors disabled:opacity-50"
                >
                  {saving === name ? "Saving…" : name}
                </button>
              ))}
              <button
                onClick={() => setCustom("")}
                disabled={saving !== null}
                className="text-xs rounded-lg border border-dashed border-slate-700 text-slate-400 px-3 py-1.5 hover:border-slate-500 hover:text-slate-200 transition-colors disabled:opacity-50"
              >
                Something else
              </button>
              <button
                onClick={() => {
                  dismiss(persona.id);
                  setPersona(null);
                }}
                className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1.5"
              >
                Keep {fallbackName}
              </button>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <input
                autoFocus
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save(custom);
                  if (e.key === "Escape") setCustom(null);
                }}
                maxLength={40}
                placeholder="A name"
                className="w-40 rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-[#22d3ee]"
              />
              <button
                onClick={() => save(custom)}
                disabled={saving !== null}
                className="text-xs rounded-md bg-[#22d3ee] text-[#06222a] font-semibold px-3 py-1.5 disabled:opacity-50"
              >
                {saving !== null ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => setCustom(null)}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                Back
              </button>
            </div>
          )}

          {err && <p className="text-xs text-red-300 mt-2">{err}</p>}
        </div>
      </div>
    </div>
  );
}
