import { notFound } from "next/navigation";
import {
  encodeAnswers,
  isFunnelSlug,
  isReassuranceSlug,
  nextSlug,
  parseAnswers,
  QUIZ_STEPS,
  reassuranceContent,
  setAnswer,
  stepForSlug,
} from "@/lib/launch-funnel/quiz";
import { MONO_FONT } from "@/lib/launch-funnel/copy";
import QuizOptions, {
  type QuizOptionLink,
} from "../../_components/QuizOptions";

const TOTAL_STEPS = QUIZ_STEPS.length;

function ProgressBar({ current }: { current: number }) {
  const pct = Math.round((current / TOTAL_STEPS) * 100);
  return (
    <div className="w-full">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function QuizStepPage({
  params,
  searchParams,
}: {
  params: { step: string };
  searchParams: { answers?: string };
}) {
  const slug = params.step;
  if (!isFunnelSlug(slug)) notFound();

  const answers = parseAnswers(searchParams.answers);
  const encoded = encodeAnswers(answers);

  // ── Micro-reassurance screens (after Step 1 and Step 3) ────────────────────────────────────
  if (isReassuranceSlug(slug)) {
    const content = reassuranceContent(slug, answers);
    const next = nextSlug(slug);
    const continueHref = next
      ? `/q/${next}${encoded ? `?answers=${encoded}` : ""}`
      : "/start";
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
        <span
          className="mb-4 text-xs uppercase tracking-wider text-cyan-300/80"
          style={{ fontFamily: MONO_FONT }}
        >
          {content.eyebrow}
        </span>
        <h1 className="text-balance text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          {content.headline}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-300">
          {content.body}
        </p>
        <a
          href={continueHref}
          className="mt-9 inline-flex w-full items-center justify-center rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] sm:text-lg"
        >
          Keep going
        </a>
      </main>
    );
  }

  // ── A numbered quiz question ───────────────────────────────────────────────────────────────
  const step = stepForSlug(slug);
  if (!step) notFound();

  const next = nextSlug(slug);
  const options: QuizOptionLink[] = step.options.map((opt, i) => {
    const enc = encodeAnswers(setAnswer(answers, step.index, i));
    const href = next
      ? `/q/${next}?answers=${enc}`
      : `/start?answers=${enc}`;
    return { label: opt.label, href, tier: opt.tier };
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <div className="mb-8 flex flex-col gap-3">
        <ProgressBar current={step.index + 1} />
        <span
          className="text-xs uppercase tracking-wider text-slate-400"
          style={{ fontFamily: MONO_FONT }}
        >
          {step.eyebrow}
        </span>
      </div>
      <h1 className="text-balance text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
        {step.question}
      </h1>
      <QuizOptions slug={slug} stepIndex={step.index} options={options} />
    </main>
  );
}
