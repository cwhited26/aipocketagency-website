"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  getTemplate,
  listTemplates,
  templateCustomizeFields,
} from "@/lib/personas/templates";
import {
  TONE_KEYS,
  TONE_LABELS,
  TONE_GUIDANCE,
  type ToneKey,
} from "@/lib/personas/types";
import { APP_CATALOG, appsByIds } from "@/lib/apps/catalog";

type StagedUrl = { url: string };

const TOTAL_STEPS = 6;

export default function PersonaWizardClient() {
  const router = useRouter();
  const templates = useMemo(() => listTemplates(), []);

  const [step, setStep] = useState(1);
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [tone, setTone] = useState<ToneKey>("conversational");
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [apps, setApps] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [urls, setUrls] = useState<StagedUrl[]>([]);
  const [urlDraft, setUrlDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const template = templateKey ? getTemplate(templateKey) : null;
  const customizeFields = template ? templateCustomizeFields(template) : [];

  function pickTemplate(key: string) {
    const t = getTemplate(key);
    if (!t) return;
    setTemplateKey(key);
    setName((n) => n || t.suggestedName);
    setTone(t.defaultTone);
    const seed: Record<string, string> = {};
    for (const f of templateCustomizeFields(t)) seed[f.key] = f.starter;
    setCustomFields(seed);
    setApps([...t.defaultApps]);
    setStep(2);
  }

  function toggleApp(id: string) {
    setApps((cur) => (cur.includes(id) ? cur.filter((a) => a !== id) : [...cur, id]));
  }

  const canNext = (() => {
    if (step === 1) return Boolean(templateKey);
    if (step === 2) return name.trim().length >= 2;
    if (step === 3) return customizeFields.every((f) => (customFields[f.key] ?? "").trim().length > 0);
    return true;
  })();

  async function submit() {
    if (!templateKey) return;
    setSubmitting(true);
    setError(null);
    try {
      setProgress("Creating persona…");
      const res = await fetch("/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey,
          name: name.trim(),
          tone,
          customFields,
          accessibleApps: apps,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { persona?: { id: string }; error?: string };
      if (!res.ok || !body.persona) {
        throw new Error(body.error ?? "Failed to create persona");
      }
      const id = body.persona.id;

      let i = 0;
      for (const file of files) {
        i += 1;
        setProgress(`Uploading knowledge (${i}/${files.length})…`);
        const form = new FormData();
        form.append("file", file);
        const up = await fetch(`/api/personas/${id}/knowledge`, { method: "POST", body: form });
        if (!up.ok) {
          const e = (await up.json().catch(() => ({}))) as { error?: string };
          throw new Error(`Knowledge upload failed: ${e.error ?? up.status}`);
        }
      }
      for (const u of urls) {
        setProgress("Ingesting URL…");
        const up = await fetch(`/api/personas/${id}/knowledge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: u.url }),
        });
        if (!up.ok) {
          const e = (await up.json().catch(() => ({}))) as { error?: string };
          throw new Error(`URL ingest failed: ${e.error ?? up.status}`);
        }
      }

      router.push(`/app/personas/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
      setProgress(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-5 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link href="/app/personas" className="text-sm text-slate-500 hover:text-slate-300">
            ← Personas
          </Link>
          <span className="text-xs font-mono text-slate-500">
            Step {step} of {TOTAL_STEPS}
          </span>
        </div>

        <div className="h-1 w-full bg-slate-800 rounded-full mb-8 overflow-hidden">
          <div
            className="h-full bg-[#22d3ee] transition-all"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 mb-5">
            {error}
          </div>
        )}

        {step === 1 && (
          <section>
            <h2 className="text-xl font-semibold text-slate-100 mb-1">Pick a template</h2>
            <p className="text-sm text-slate-500 mb-5">
              Each one is ~80% pre-built. You&apos;ll customize a few fields next.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {templates.map((t) => (
                <button
                  key={t.key}
                  onClick={() => pickTemplate(t.key)}
                  className={`text-left rounded-xl border p-4 transition-colors ${
                    templateKey === t.key
                      ? "border-[#22d3ee] bg-[#22d3ee]/5"
                      : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
                  }`}
                >
                  <h3 className="text-slate-100 font-medium">{t.role}</h3>
                  <p className="text-sm text-slate-400 mt-1">{t.description}</p>
                  <p className="text-xs text-slate-500 mt-3 italic">“{t.sampleQuestion}”</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 2 && template && (
          <section>
            <h2 className="text-xl font-semibold text-slate-100 mb-1">Name & tone</h2>
            <p className="text-sm text-slate-500 mb-5">
              What should your team call this agent, and how should it sound?
            </p>
            <label className="block text-sm text-slate-300 mb-1.5">Persona name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={template.suggestedName}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2.5 text-slate-100 outline-none focus:border-[#22d3ee] mb-6"
            />
            <label className="block text-sm text-slate-300 mb-1.5">Tone</label>
            <div className="grid gap-2 sm:grid-cols-3">
              {TONE_KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => setTone(k)}
                  className={`text-left rounded-lg border p-3 transition-colors ${
                    tone === k
                      ? "border-[#22d3ee] bg-[#22d3ee]/5"
                      : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
                  }`}
                >
                  <div className="text-slate-100 text-sm font-medium">{TONE_LABELS[k]}</div>
                  <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                    {TONE_GUIDANCE[k].split(".")[0]}.
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 3 && template && (
          <section>
            <h2 className="text-xl font-semibold text-slate-100 mb-1">Customize</h2>
            <p className="text-sm text-slate-500 mb-5">
              These fields make the persona yours. We&apos;ve pre-filled starters — edit to fit
              your business.
            </p>
            <div className="space-y-5">
              {customizeFields.map((f) => (
                <div key={f.key}>
                  <label className="block text-sm text-slate-300">{f.label}</label>
                  <p className="text-xs text-slate-500 mb-1.5">{f.help}</p>
                  <textarea
                    value={customFields[f.key] ?? ""}
                    onChange={(e) =>
                      setCustomFields((c) => ({ ...c, [f.key]: e.target.value }))
                    }
                    rows={4}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-[#22d3ee]"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {step === 4 && template && (
          <section>
            <h2 className="text-xl font-semibold text-slate-100 mb-1">Apps it can use</h2>
            <p className="text-sm text-slate-500 mb-5">
              A persona is the <span className="text-slate-300">who</span>; Apps are the{" "}
              <span className="text-slate-300">what</span> it uses. Pick the tools this one is set up to
              run. You can change these anytime.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {APP_CATALOG.map((a) => {
                const on = apps.includes(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => toggleApp(a.id)}
                    className={`text-left rounded-xl border p-3.5 transition-colors ${
                      on
                        ? "border-[#22d3ee] bg-[#22d3ee]/5"
                        : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-100">{a.label}</span>
                      <span
                        className={`shrink-0 text-[15px] leading-none ${
                          on ? "text-[#22d3ee]" : "text-slate-600"
                        }`}
                        aria-hidden
                      >
                        {on ? "✓" : "+"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-snug">{a.blurb}</p>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-4">
              {apps.length === 0
                ? "No Apps selected — that's fine; you can add them later from the persona's Apps tab."
                : `${apps.length} App${apps.length === 1 ? "" : "s"} selected.`}
            </p>
          </section>
        )}

        {step === 5 && (
          <section>
            <h2 className="text-xl font-semibold text-slate-100 mb-1">Knowledge</h2>
            <p className="text-sm text-slate-500 mb-5">
              Add the docs this persona should read — playbooks, policies, SOPs. PDF, Word,
              Markdown, text, or a URL. The agent re-reads these every time someone asks (it
              isn&apos;t &quot;trained&quot; on them).
            </p>

            <label className="block rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center cursor-pointer hover:border-slate-600 transition-colors">
              <input
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.docx,.md,.txt,.png,.jpg,.jpeg,.webp"
                onChange={(e) => {
                  const list = e.target.files;
                  if (list) setFiles((f) => [...f, ...Array.from(list)]);
                  e.currentTarget.value = "";
                }}
              />
              <span className="text-sm text-slate-300">Click to add files</span>
              <span className="block text-xs text-slate-500 mt-1">Up to 10 MB each</span>
            </label>

            <div className="mt-3 flex gap-2">
              <input
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="https://your-site.com/page"
                className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#22d3ee]"
              />
              <button
                onClick={() => {
                  const u = urlDraft.trim();
                  if (/^https?:\/\//.test(u)) {
                    setUrls((p) => [...p, { url: u }]);
                    setUrlDraft("");
                  }
                }}
                className="rounded-lg border border-slate-700 text-slate-300 text-sm px-3 hover:bg-slate-800"
              >
                Add URL
              </button>
            </div>

            {(files.length > 0 || urls.length > 0) && (
              <ul className="mt-4 space-y-1.5">
                {files.map((f, i) => (
                  <li
                    key={`f-${i}`}
                    className="flex items-center justify-between text-sm text-slate-300 bg-slate-900/60 rounded-lg px-3 py-2"
                  >
                    <span className="truncate">{f.name}</span>
                    <button
                      onClick={() => setFiles((arr) => arr.filter((_, j) => j !== i))}
                      className="text-slate-500 hover:text-red-400 text-xs ml-3"
                    >
                      remove
                    </button>
                  </li>
                ))}
                {urls.map((u, i) => (
                  <li
                    key={`u-${i}`}
                    className="flex items-center justify-between text-sm text-slate-300 bg-slate-900/60 rounded-lg px-3 py-2"
                  >
                    <span className="truncate">{u.url}</span>
                    <button
                      onClick={() => setUrls((arr) => arr.filter((_, j) => j !== i))}
                      className="text-slate-500 hover:text-red-400 text-xs ml-3"
                    >
                      remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-slate-500 mt-4">
              You can also add or remove knowledge anytime after creating the persona.
            </p>
          </section>
        )}

        {step === 6 && template && (
          <section>
            <h2 className="text-xl font-semibold text-slate-100 mb-1">Confirm</h2>
            <p className="text-sm text-slate-500 mb-5">
              We&apos;ll write the persona spec into your brain, create a private knowledge zone,
              and upload your docs.
            </p>
            <dl className="rounded-xl border border-slate-800 bg-slate-900/40 divide-y divide-slate-800 text-sm">
              <Row label="Template" value={template.role} />
              <Row label="Name" value={name.trim()} />
              <Row label="Tone" value={TONE_LABELS[tone]} />
              <Row
                label="Apps"
                value={
                  apps.length === 0
                    ? "None yet"
                    : appsByIds(apps).map((a) => a.shortLabel).join(", ")
                }
              />
              <Row label="Knowledge" value={`${files.length} file(s), ${urls.length} URL(s)`} />
            </dl>
            <div className="mt-4 rounded-xl border border-slate-800/60 bg-slate-950/50 p-4">
              <div className="text-[11px] font-mono text-[#22d3ee]/60 uppercase tracking-[0.16em]">
                Try this first
              </div>
              <p className="mt-1.5 text-sm text-slate-300 leading-relaxed">
                &ldquo;{template.starterPrompt}&rdquo;
              </p>
            </div>
            {progress && <p className="text-sm text-[#22d3ee] mt-4">{progress}</p>}
          </section>
        )}

        <div className="flex items-center justify-between mt-8">
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1 || submitting}
            className="text-sm text-slate-400 hover:text-slate-200 disabled:opacity-30"
          >
            Back
          </button>
          {step < TOTAL_STEPS ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext}
              className="rounded-lg bg-[#22d3ee] text-[#06222a] text-sm font-semibold px-5 py-2.5 hover:bg-[#67e8f9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={submitting}
              className="rounded-lg bg-[#22d3ee] text-[#06222a] text-sm font-semibold px-5 py-2.5 hover:bg-[#67e8f9] disabled:opacity-40 transition-colors"
            >
              {submitting ? "Creating…" : "Create persona"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-200 text-right max-w-[60%] truncate">{value}</dd>
    </div>
  );
}
