import { CHECKOUT_ACTION, HERO } from "@/data/pocket-capture/marketing";

const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

// The single Get Pocket Capture action. A plain form POST to the checkout endpoint
// (PC-MARK-2 owns the handler, which creates the Stripe session and redirects). No client
// JS — the button works before hydration, which keeps the surface fast on TikTok mobile
// traffic and resilient if a script fails to load.

export function CheckoutButton({
  label = HERO.cta,
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <form action={CHECKOUT_ACTION} method="POST" className={className}>
      <input type="hidden" name="source" value="pocket_capture_landing" />
      <button
        type="submit"
        className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-7 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)] sm:w-auto sm:text-lg"
      >
        {label}
      </button>
    </form>
  );
}

export { MONO_FONT };
