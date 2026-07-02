import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchLeadFunnelById } from "@/lib/wc-admin-supabase";
import {
  BUMP_USD,
  KIT_RETAIL_USD,
  getKitConfig,
  isKitSlug,
  type KitSlug,
} from "@/lib/kit-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * The natural-pair pitch copy for each primary kit. Russell-style frame —
 * name the next wall the operator will hit, name the kit that solves it,
 * name the price anchor. Voice-checked against `voice/chase-spec.md`.
 */
const PAIR_PITCH: Record<
  KitSlug,
  { headline: string; body: string[]; oneLiner: string }
> = {
  "dispatch-playbook": {
    headline:
      "Operators who buy the Dispatch Playbook hit the next wall fast.",
    body: [
      "Dispatch is the orchestration pattern. The Dev-Team Document Set is the artifacts the lanes read at session start — CLAUDE.md, AGENTS.md, MEMORY.md, conventions, templates. Without them the lanes drift; with them the lanes inherit dev-team discipline on day one.",
      "Eleven document templates plus three operational conventions. Drop them into any repo and the agents stop guessing.",
    ],
    oneLiner:
      "Dispatch tells the lanes how to run. The Dev-Team Document Set tells them what to know.",
  },
  "dev-team-document-set": {
    headline:
      "The artifacts work. The CLAUDE.md template is what ties them together.",
    body: [
      "The Dev-Team Document Set gives you the eleven templates. The CLAUDE.md Template Library gives you the master context file that pulls them into one entry point — six pre-built CLAUDE.md starters (SaaS, contractor SaaS, marketing site, mobile app, API service, internal tool).",
      "Pick the closest, fill five slots, the agent is on-rails in thirty minutes.",
    ],
    oneLiner: "Templates without a master context still leak. The library closes the leak.",
  },
  "claude-md-template-library": {
    headline:
      "Templates set the agent on rails. The next move is wiring it to your real work.",
    body: [
      "The CLAUDE.md Template Library puts the master context in place. Wire-the-Brain-to-Stack is the seven MCP walkthroughs — Drive, Gmail, Slack, Notion, Linear, GitHub, Supabase — that turn the brain from a static file into a system that pulls from your real work.",
      "Auth setup, working queries, real gotchas, and the brain-sync patterns operators actually run.",
    ],
    oneLiner: "Static brain is fine. Wired brain is the unlock.",
  },
  "discovery-to-mvp-prompt-pack": {
    headline:
      "Eight prompts get you to MVP. Dispatch is what runs them in parallel.",
    body: [
      "The Prompt Pack sequences the build — discovery → spec → schema → routes → UI → tests → deploy. Single-thread, that's a week of one-prompt-at-a-time work.",
      "The Dispatch Playbook is the parallel-lane pattern that lets you fan the build out across worktrees instead of waiting on one chat. Same prompts, four lanes.",
    ],
    oneLiner: "Prompts get you to MVP. Dispatch gets you there four lanes wide.",
  },
  "wire-brain-to-stack-guide": {
    headline:
      "The brain is wired to your stack. Now wire the prompts that drive it.",
    body: [
      "Wire-the-Brain gives you the seven MCP walkthroughs. The Discovery → MVP Prompt Pack is the eight sequenced prompts that drive the wired brain — discovery call to shipped software, with one real Patrick case study end to end.",
      "Same toolchain. Faster from idea to ship.",
    ],
    oneLiner: "MCPs read your work. Prompts ship the next thing.",
  },
};

export function generateMetadata(): Metadata {
  return {
    title: "Quick add-on — APA kit pairing | Pocket Agent",
    description:
      "Pair the kit you just claimed with the natural complement at $10 — this price isn't shown anywhere else on the site.",
    robots: { index: false, follow: false },
  };
}

export default async function UpgradePairPage({
  params,
}: {
  params: { "kit-slug": string; lead_id: string };
}) {
  const slug = params["kit-slug"];
  const leadId = params.lead_id;

  if (!isKitSlug(slug)) notFound();
  if (!UUID_V4_RE.test(leadId)) notFound();

  const lookup = await fetchLeadFunnelById(leadId);
  if (!lookup.ok) {
    console.error("[upgrade-pair] failed to load lead", {
      lead_id: leadId,
      status: lookup.status,
      error: lookup.error,
    });
    notFound();
  }
  if (!lookup.lead) notFound();
  if (lookup.lead.source !== slug) {
    console.error("[upgrade-pair] slug/source mismatch", {
      lead_id: leadId,
      url_slug: slug,
      lead_source: lookup.lead.source,
    });
    notFound();
  }

  const primaryKit = getKitConfig(slug);
  const bumpKit = primaryKit ? getKitConfig(primaryKit.bumpTarget) : null;
  if (!primaryKit || !bumpKit) notFound();

  const pitch = PAIR_PITCH[slug];
  const yesUrl = `/${slug}/upgrade-bundle/${encodeURIComponent(leadId)}?pair=1`;
  const noUrl = `/${slug}/upgrade-bundle/${encodeURIComponent(leadId)}?pair=0`;

  return (
    <main className="min-h-screen text-slate-100">
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
        <div className="absolute inset-0 bg-hero-glow" aria-hidden />
        <div className="relative mx-auto max-w-3xl px-6 pb-24 pt-16 sm:pt-24">
          <div className="text-center">
            <div
              className="mb-4 whitespace-nowrap text-xs text-cyan-300/70 sm:text-sm"
              style={{ fontFamily: MONO_FONT }}
            >
              [ step 1 of 2 · pairing offer ]
            </div>
            <h1 className="text-balance text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
              <span className="bg-gradient-to-r from-accent via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
                {pitch.headline}
              </span>
            </h1>
            <p className="mt-5 text-lg text-slate-300 sm:text-xl">
              {pitch.oneLiner}
            </p>
          </div>

          {bumpKit.heroAvailable ? (
            <div className="mt-10 overflow-hidden rounded-xl border border-white/10 bg-slate-900/40">
              <Image
                src={`/funnel-images/${bumpKit.slug}-hero.png`}
                alt={bumpKit.ogAlt}
                width={1200}
                height={800}
                priority
                className="block w-full h-auto"
              />
            </div>
          ) : null}

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-7 shadow-[0_0_60px_-25px_rgba(99,102,241,0.55)] sm:p-9">
            <h2 className="text-2xl font-bold leading-tight text-slate-50 sm:text-3xl">
              {bumpKit.fullName}
            </h2>
            <div className="mt-5 space-y-4 text-base leading-relaxed text-slate-200">
              {pitch.body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>

            <div
              className="mt-8 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] p-5"
              style={{ fontFamily: MONO_FONT }}
            >
              <div className="text-xs uppercase tracking-wider text-slate-400">
                pricing
              </div>
              <div className="mt-2 flex items-baseline gap-3 text-base">
                <span className="text-slate-500 line-through">
                  ${KIT_RETAIL_USD}
                </span>
                <span className="text-2xl font-extrabold text-accent">
                  +${BUMP_USD}
                </span>
                <span className="text-sm text-slate-400">
                  added to this checkout
                </span>
              </div>
              <div className="mt-3 text-sm leading-relaxed text-slate-300">
                Regularly ${KIT_RETAIL_USD} on its own. Today, if you add it
                here, it&apos;s ${BUMP_USD}. This price isn&apos;t shown
                anywhere else on the site.
              </div>
            </div>

            <div className="mt-8">
              <Link
                href={yesUrl}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_50px_-12px_rgba(34,211,238,0.8)] transition hover:scale-[1.01] hover:shadow-[0_0_70px_-8px_rgba(34,211,238,0.95)] sm:text-lg"
              >
                Yes — add {bumpKit.shortName} for +${BUMP_USD} →
              </Link>
              <div className="mt-4 text-center">
                <Link
                  href={noUrl}
                  className="text-sm text-slate-400 underline-offset-4 transition hover:text-slate-200 hover:underline"
                >
                  No thanks, continue
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
