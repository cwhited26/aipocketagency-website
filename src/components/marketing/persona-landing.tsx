import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { PrimaryCTA, SecondaryCTA, MONO_FONT } from "@/components/marketing/cta";
import { otherPersonas } from "@/data/marketing/persona-pages";
import { verticalForMarketingSlug, verticalTemplates } from "@/lib/onboarding/verticals";
import { PersonaAvatar } from "@/components/personas/avatar";

// Shared shell for the six /for/[persona] landing pages (PA-POS-17). Every page is the
// same product told through one owner's day — only the copy changes. The shell mirrors
// the homepage: same header, same hero treatment, same trust bar, same CTA row. The
// seeded-Personas section (PA-POS-22/23) reads the vertical registry so the marketing
// page and the onboarding picker never drift.

export type DayEntry = { time: string; body: string };

export type PersonaPageCopy = {
  /** Registry slug — drives the "Also for" chip strip. */
  slug: string;
  /** Mono pill above the H1, e.g. "Pocket Agent · for coaches". */
  pill: string;
  h1: string;
  sub: string;
  /** Intro line above the two-column day. */
  dayIntro: string;
  without: DayEntry[];
  withPa: DayEntry[];
  /** Section 3 — 8-12 persona-specific outcomes. */
  handles: string[];
  /** Section 4 — the hire-vs-subscription anchor, persona-scoped. */
  anchor: { heading: string; body: string[] };
};

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 inline-block text-xs text-cyan-300/70" style={{ fontFamily: MONO_FONT }}>
      {children}
    </div>
  );
}

function AlsoForChips({ slug }: { slug: string }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
      <span className="text-slate-500" style={{ fontFamily: MONO_FONT }}>
        Also for:
      </span>
      {otherPersonas(slug).map((p) => (
        <Link
          key={p.slug}
          href={`/for/${p.slug}`}
          className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-slate-400 transition hover:border-cyan-300/40 hover:text-slate-100"
        >
          {p.label}
        </Link>
      ))}
    </div>
  );
}

function DayColumn({
  title,
  entries,
  highlighted,
}: {
  title: string;
  entries: DayEntry[];
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 sm:p-7 ${
        highlighted ? "border-cyan-300/25 bg-cyan-300/[0.04]" : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <h3
        className={`text-sm font-semibold uppercase tracking-wider ${
          highlighted ? "text-cyan-300" : "text-slate-500"
        }`}
        style={{ fontFamily: MONO_FONT }}
      >
        {title}
      </h3>
      <div className="mt-6 space-y-5">
        {entries.map((e) => (
          <div key={`${title}-${e.time}`} className="flex gap-4">
            <div
              className={`w-16 shrink-0 pt-0.5 text-sm font-semibold ${
                highlighted ? "text-cyan-300/90" : "text-slate-500"
              }`}
              style={{ fontFamily: MONO_FONT }}
            >
              {e.time}
            </div>
            <p className="flex-1 text-[15px] leading-relaxed text-slate-300">{e.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeededPersonas({ slug }: { slug: string }) {
  const vertical = verticalForMarketingSlug(slug);
  if (!vertical) return null;
  const templates = verticalTemplates(vertical);

  return (
    <section className="border-b border-white/5">
      <div className="mx-auto max-w-4xl px-6 py-20">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          The crew that lands with your pick.
        </h2>
        <p className="mt-4 max-w-2xl text-slate-400">
          Pick <span className="text-slate-200">{vertical.label}</span> when you set up your
          workspace and these three Personas arrive ready to customize — their specs written into
          your own Business Brain repo (a GitHub repository you own), not our database. Everything
          they prepare is staged for your review; nothing goes out until you approve it.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {templates.map((t) => (
            <div
              key={t.key}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
            >
              <PersonaAvatar slug={t.avatarSlug} size="xl" alt={t.suggestedName} />
              <h3 className="mt-4 font-semibold text-slate-100">{t.suggestedName}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{t.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PersonaLanding({ copy }: { copy: PersonaPageCopy }) {
  return (
    <>
      <SiteHeader />
      <main className="text-slate-100">
        {/* HERO */}
        <section className="relative overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
          <div className="absolute inset-0 bg-hero-glow" aria-hidden />
          <div className="relative mx-auto max-w-3xl px-6 pb-16 pt-10 text-center sm:pb-20">
            <AlsoForChips slug={copy.slug} />
            <div className="mt-12 sm:mt-16">
              <Pill>[ {copy.pill} ]</Pill>
              <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
                {copy.h1}
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
                {copy.sub}
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <PrimaryCTA href="/start?tier=starter" label="Start for $37" />
                <SecondaryCTA href="/pricing" label="See pricing" />
              </div>
              <p className="mt-6 text-sm text-slate-400">
                Generic AI starts from zero. Pocket Agent starts from your business.
              </p>
            </div>
          </div>
        </section>

        {/* THE DAY, TRANSFORMED */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              Same day. Different owner.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-slate-400">{copy.dayIntro}</p>
            <div className="mt-12 grid gap-5 lg:grid-cols-2">
              <DayColumn title="Without Pocket Agent" entries={copy.without} />
              <DayColumn title="With Pocket Agent" entries={copy.withPa} highlighted />
            </div>
          </div>
        </section>

        {/* WHAT IT HANDLES */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-4xl px-6 py-20">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              What it handles for you.
            </h2>
            <p className="mt-4 max-w-2xl text-slate-400">
              Your AI Agents — Pocket Agent calls them Personas — use Apps and Skills to do this
              work. Everything they prepare is staged in Mission Control; nothing goes out until
              you approve it.
            </p>
            <ul className="mt-10 grid gap-3 sm:grid-cols-2">
              {copy.handles.map((h) => (
                <li
                  key={h}
                  className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-[15px] leading-relaxed text-slate-300"
                >
                  <span className="mt-0.5 text-cyan-300">✓</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* THE SEEDED CREW — the three Personas this vertical starts with (PA-POS-22/23) */}
        <SeededPersonas slug={copy.slug} />

        {/* THE ANCHOR — what the alternative costs */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.04] p-8 sm:p-10">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {copy.anchor.heading}
              </h2>
              <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-slate-300">
                {copy.anchor.body.map((p) => (
                  <p key={p}>{p}</p>
                ))}
                <p className="text-slate-400">
                  Three plans: $37, $97, $497 a month.{" "}
                  <Link href="/pricing" className="text-cyan-300 hover:underline">
                    See what each one covers →
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST BAR — same three businesses as the homepage. */}
        <section className="border-b border-white/5 bg-black/30">
          <div className="mx-auto max-w-4xl px-6 py-8 text-center text-sm leading-relaxed text-slate-400">
            Built and run inside three businesses Chase Whited owns:{" "}
            <span className="text-slate-200">Tennessee Valley Exteriors</span> (a contracting
            company) · <span className="text-slate-200">Whited Consulting</span> (a software
            agency) · <span className="text-slate-200">AthleteOS</span> (a sports SaaS). Same
            workspace. Same brain. Same cockpit.
          </div>
        </section>

        {/* BOTTOM CTA */}
        <section>
          <div className="mx-auto max-w-2xl px-6 py-24 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{copy.h1}</h2>
            <p className="mt-5 text-lg text-slate-300">
              Pocket Agent takes the second pile — the work that has to get done by tomorrow
              morning — so you can do the work that grows the business.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <PrimaryCTA href="/start?tier=starter" label="Start for $37" />
            </div>
            <p className="mt-5 text-sm text-slate-500">
              Or{" "}
              <Link href="/pricing" className="text-cyan-300 hover:underline">
                see pricing
              </Link>{" "}
              first.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
