import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { PrimaryCTA, SecondaryCTA, MONO_FONT } from "@/components/marketing/cta";
import { otherCompares } from "@/data/marketing/compare-pages";

// Shared shell for the five /compare/[slug] pages (PA-POS-19). Same skeleton every
// time — hero frame, TL;DR table, the actual difference, full feature table, honest
// take, FAQ, CTA — only the copy changes. Mirrors the persona-landing shell.

export type CompareVerdict = "them" | "pa" | "even";

export type TldrRow = { label: string; them: string; pa: string };

export type FeatureRow = {
  label: string;
  them: string;
  pa: string;
  verdict: CompareVerdict;
};

export type FeatureGroup = { title: string; rows: FeatureRow[] };

export type FaqItem = { q: string; a: string };

export type ComparePageCopy = {
  /** Registry slug — drives the "More comparisons" chip strip. */
  slug: string;
  /** Competitor display name — "Twin", "Claude Cowork". */
  competitor: string;
  /** Mono pill above the H1, e.g. "pocket agent vs twin". */
  pill: string;
  h1: string;
  sub: string;
  tldr: TldrRow[];
  /** Section 3 — three paragraphs. Fair first, then the ownership moat. */
  difference: string[];
  /** The one-sentence moat close, rendered bold under the difference paragraphs. */
  moatLine: string;
  featureGroups: FeatureGroup[];
  pickThem: string[];
  pickPa: string[];
  faq: FaqItem[];
};

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 inline-block text-xs text-cyan-300/70" style={{ fontFamily: MONO_FONT }}>
      {children}
    </div>
  );
}

function VerdictCell({ verdict, competitor }: { verdict: CompareVerdict; competitor: string }) {
  if (verdict === "pa") {
    return <span className="font-semibold text-cyan-300">Pocket Agent</span>;
  }
  if (verdict === "them") {
    return <span className="font-semibold text-slate-200">{competitor}</span>;
  }
  return <span className="text-slate-500">Even</span>;
}

function MoreComparisons({ slug }: { slug: string }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
      <span className="text-slate-500" style={{ fontFamily: MONO_FONT }}>
        More comparisons:
      </span>
      {otherCompares(slug).map((c) => (
        <Link
          key={c.slug}
          href={`/compare/${c.slug}`}
          className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-slate-400 transition hover:border-cyan-300/40 hover:text-slate-100"
        >
          vs {c.label}
        </Link>
      ))}
      <Link
        href="/compare"
        className="rounded-full border border-cyan-300/30 bg-cyan-300/[0.04] px-3 py-1 text-cyan-300 transition hover:border-cyan-300/60"
      >
        All comparisons →
      </Link>
    </div>
  );
}

export function CompareLanding({ copy }: { copy: ComparePageCopy }) {
  return (
    <>
      <SiteHeader />
      <main className="text-slate-100">
        {/* HERO */}
        <section className="relative overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
          <div className="absolute inset-0 bg-hero-glow" aria-hidden />
          <div className="relative mx-auto max-w-3xl px-6 pb-16 pt-10 text-center sm:pb-20">
            <MoreComparisons slug={copy.slug} />
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

        {/* TL;DR TABLE */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-4xl px-6 py-20">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              The short version.
            </h2>
            <div className="mt-10 overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[560px] text-left text-[15px]">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    <th className="p-4 sm:p-5" aria-label="Row" />
                    <th
                      className="p-4 text-sm font-semibold uppercase tracking-wider text-slate-400 sm:p-5"
                      style={{ fontFamily: MONO_FONT }}
                    >
                      {copy.competitor}
                    </th>
                    <th
                      className="p-4 text-sm font-semibold uppercase tracking-wider text-cyan-300 sm:p-5"
                      style={{ fontFamily: MONO_FONT }}
                    >
                      Pocket Agent
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {copy.tldr.map((row) => (
                    <tr key={row.label} className="border-b border-white/5 last:border-b-0">
                      <td
                        className="w-40 p-4 align-top text-sm font-semibold text-slate-500 sm:p-5"
                        style={{ fontFamily: MONO_FONT }}
                      >
                        {row.label}
                      </td>
                      <td className="p-4 align-top leading-relaxed text-slate-300 sm:p-5">
                        {row.them}
                      </td>
                      <td className="bg-cyan-300/[0.03] p-4 align-top leading-relaxed text-slate-200 sm:p-5">
                        {row.pa}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* THE ACTUAL DIFFERENCE */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <Pill>[ the actual difference ]</Pill>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Where the two products actually split.
            </h2>
            <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
              {copy.difference.map((p) => (
                <p key={p.slice(0, 40)}>{p}</p>
              ))}
            </div>
            <div className="mt-8 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.04] p-6">
              <p className="text-[15px] font-semibold leading-relaxed text-slate-100">
                {copy.moatLine}
              </p>
            </div>
          </div>
        </section>

        {/* FULL FEATURE TABLE */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              Feature by feature.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-slate-400">
              The third column says who wins each row. Some rows {copy.competitor} wins — a
              comparison that never concedes anything isn&apos;t a comparison.
            </p>
            <div className="mt-12 space-y-10">
              {copy.featureGroups.map((group) => (
                <div key={group.title}>
                  <h3
                    className="mb-4 text-sm font-semibold uppercase tracking-wider text-cyan-300/80"
                    style={{ fontFamily: MONO_FONT }}
                  >
                    {group.title}
                  </h3>
                  <div className="overflow-x-auto rounded-2xl border border-white/10">
                    <table className="w-full min-w-[720px] text-left text-[15px]">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/[0.02]">
                          <th className="p-4" aria-label="Feature" />
                          <th
                            className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-400"
                            style={{ fontFamily: MONO_FONT }}
                          >
                            {copy.competitor}
                          </th>
                          <th
                            className="p-4 text-xs font-semibold uppercase tracking-wider text-cyan-300"
                            style={{ fontFamily: MONO_FONT }}
                          >
                            Pocket Agent
                          </th>
                          <th
                            className="w-32 p-4 text-xs font-semibold uppercase tracking-wider text-slate-400"
                            style={{ fontFamily: MONO_FONT }}
                          >
                            Who wins
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((row) => (
                          <tr key={row.label} className="border-b border-white/5 last:border-b-0">
                            <td className="w-44 p-4 align-top text-sm font-medium text-slate-200">
                              {row.label}
                            </td>
                            <td className="p-4 align-top leading-relaxed text-slate-400">
                              {row.them}
                            </td>
                            <td className="bg-cyan-300/[0.03] p-4 align-top leading-relaxed text-slate-300">
                              {row.pa}
                            </td>
                            <td className="p-4 align-top text-sm">
                              <VerdictCell verdict={row.verdict} competitor={copy.competitor} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HONEST TAKE */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-4xl px-6 py-20">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">The honest take.</h2>
            <div className="mt-10 grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-7">
                <h3
                  className="text-sm font-semibold uppercase tracking-wider text-slate-400"
                  style={{ fontFamily: MONO_FONT }}
                >
                  Pick {copy.competitor} if
                </h3>
                <ul className="mt-6 space-y-3">
                  {copy.pickThem.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-[15px] leading-relaxed text-slate-300"
                    >
                      <span className="mt-0.5 text-slate-500">→</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.04] p-6 sm:p-7">
                <h3
                  className="text-sm font-semibold uppercase tracking-wider text-cyan-300"
                  style={{ fontFamily: MONO_FONT }}
                >
                  Pick Pocket Agent if
                </h3>
                <ul className="mt-6 space-y-3">
                  {copy.pickPa.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-[15px] leading-relaxed text-slate-300"
                    >
                      <span className="mt-0.5 text-cyan-300">→</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CUSTOMER QUOTE — TODO(chase): real customer quote goes here. Do not invent one.
            The card ships with the honest placeholder below until a real customer signs off. */}
        <section className="border-b border-white/5 bg-black/20">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-center sm:p-10">
              <p
                className="text-xs uppercase tracking-wider text-slate-500"
                style={{ fontFamily: MONO_FONT }}
              >
                From a customer
              </p>
              <p className="mt-5 text-lg leading-relaxed text-slate-300">
                This spot is reserved for a real customer, in their own words. We don&apos;t print
                invented quotes, and we don&apos;t print composites here either.
              </p>
              <p className="mt-4 text-sm text-slate-500">
                Until then: Pocket Agent runs inside three businesses Chase Whited owns —
                Tennessee Valley Exteriors (a contracting company), Whited Consulting (a software
                agency), and AthleteOS (a sports SaaS). Same workspace, same brain, same cockpit.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Questions buyers actually ask.
            </h2>
            <div className="mt-10 space-y-4">
              {copy.faq.map((item) => (
                <div
                  key={item.q}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
                >
                  <h3 className="text-[17px] font-semibold text-slate-100">{item.q}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-slate-400">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BOTTOM CTA */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-2xl px-6 py-24 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{copy.h1}</h2>
            <p className="mt-5 text-lg text-slate-300">
              The cheapest way to settle it is to run both against a week of your real work.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <PrimaryCTA href="/start?tier=starter" label="Start for $37" />
              <SecondaryCTA href="/pricing" label="See pricing" />
            </div>
          </div>
        </section>

        {/* MORE COMPARISONS */}
        <section>
          <div className="mx-auto max-w-3xl px-6 py-14">
            <MoreComparisons slug={copy.slug} />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
