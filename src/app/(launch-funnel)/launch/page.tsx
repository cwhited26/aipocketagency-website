import Image from "next/image";
import { MONO_FONT, OPERATOR_COUNT } from "@/lib/launch-funnel/copy";
import FunnelView from "./_components/FunnelView";

const VALUE_BULLETS = [
  {
    label: "Brain",
    detail: "It knows you — your voice, customers, prices, processes.",
  },
  { label: "Personas", detail: "Who does the work — Admin, Sales, Content." },
  { label: "Apps", detail: "What they run on — drafts, follow-ups, pages." },
];

// Landing — the single-screen hero. Problem-aware CTA into the 5-step qualifier quiz.
export default function LaunchLandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center px-6 py-12 sm:py-16">
      <FunnelView event="funnel_landing_viewed" />

      <span
        className="mb-6 inline-flex items-center rounded-full border border-cyan-300/30 bg-cyan-300/[0.06] px-4 py-1.5 text-xs font-medium text-cyan-200 sm:text-sm"
        style={{ fontFamily: MONO_FONT }}
      >
        Built for owner-led businesses
      </span>

      <h1 className="text-balance text-center text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
        Your business. Finally has an agent.
      </h1>

      <p className="mt-5 max-w-2xl text-balance text-center text-lg text-slate-300 sm:text-xl">
        Pocket Agent is an AI workspace that knows your business — your voice,
        your customers, your prices, your processes — and actually does the work.
      </p>

      <div className="mt-8 w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-[0_0_80px_-30px_rgba(34,211,238,0.6)]">
        <Image
          src="/landing-hero.png"
          alt="The Pocket Agent dashboard — Mission Control, Personas, and your Business Brain in one workspace."
          width={1600}
          height={1000}
          priority
          className="h-auto w-full"
        />
      </div>

      <a
        href="/q/1"
        className="mt-9 inline-flex w-full max-w-md items-center justify-center rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)] sm:text-lg"
      >
        Build my AI office
      </a>

      <p
        className="mt-4 text-xs text-slate-400 sm:text-sm"
        style={{ fontFamily: MONO_FONT }}
      >
        30 seconds · No credit card · Instant access
      </p>
      <p className="mt-2 text-sm text-slate-400">
        Trusted by {OPERATOR_COUNT}+ owner-operators.
      </p>

      <div className="mt-12 grid w-full max-w-3xl gap-4 sm:grid-cols-3">
        {VALUE_BULLETS.map((b) => (
          <div
            key={b.label}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center"
          >
            <div className="text-lg font-semibold text-slate-100">{b.label}</div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
              {b.detail}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
