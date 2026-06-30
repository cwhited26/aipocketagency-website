import { MONO_FONT } from "@/lib/launch-funnel/copy";
import FunnelView from "../_components/FunnelView";

const APP_URL = "https://app.aipocketagent.com";

// Stripe redirect target (success_url). The subscription is provisioned by the Stripe webhook;
// this page just confirms and points the buyer at their workspace. Fires funnel_checkout_completed.
export default function SuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const hasSession =
    typeof searchParams.session_id === "string" &&
    searchParams.session_id.length > 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16 text-center">
      <FunnelView event="funnel_checkout_completed" />
      <span
        className="mx-auto mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-300/[0.08] text-2xl text-cyan-200"
        aria-hidden
      >
        ✓
      </span>
      <h1 className="text-balance text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
        You&apos;re in. Your AI office is live.
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-slate-300">
        Your 14-day trial just started. Next: set up your Business Brain, clone
        your first Persona, and watch the work in Mission Control.
      </p>

      <a
        href={APP_URL}
        className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] sm:text-lg"
      >
        Open my workspace
      </a>

      <p
        className="mt-4 text-xs text-slate-500"
        style={{ fontFamily: MONO_FONT }}
      >
        {hasSession
          ? "Receipt and login details are on the way to your inbox."
          : "Check your inbox for your receipt and login details."}
      </p>
    </main>
  );
}
