import CheckoutForm, { type BumpOffer } from "./CheckoutForm";
import { getKitConfig, type KitSlug } from "@/lib/kit-config";

const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

/**
 * Bump pitch copy keyed by primary kit slug. Each pitch ties the primary kit
 * to its `bumpTarget` (defined in kit-config) with a one-line "these compound"
 * frame. Russell-style — name the natural pairing, name the savings, kill
 * the abstract benefit speak.
 */
const BUMP_PITCH: Record<KitSlug, string> = {
  "dispatch-playbook":
    "Dispatch is the orchestration pattern. The Dev-Team Document Set is the artifacts the lanes read at session start — they compound.",
  "dev-team-document-set":
    "Artifacts are the half. The CLAUDE.md Template Library gives you the master context file that ties the artifacts together — drop both in, agent inherits everything on day one.",
  "claude-md-template-library":
    "Templates set the agent on rails. Wire-the-Brain-to-Stack is the seven MCP walkthroughs that turn the brain from static into a system that pulls from your real work.",
  "discovery-to-mvp-prompt-pack":
    "Prompts get you to a working MVP. Add the Dispatch Playbook and you can sequence the build across parallel lanes instead of one prompt at a time.",
  "wire-brain-to-stack-guide":
    "The brain is wired to your stack. The Discovery → MVP Prompt Pack is the eight prompts that drive it — same toolchain, faster from idea to ship.",
};

export default function KitCheckoutPage({
  slug,
  cancelled,
}: {
  slug: KitSlug;
  cancelled: boolean;
}) {
  const kit = getKitConfig(slug);
  if (!kit) {
    throw new Error(`KitCheckoutPage rendered with unknown slug: ${slug}`);
  }
  const bumpKit = getKitConfig(kit.bumpTarget);
  const bump: BumpOffer | null = bumpKit
    ? { name: bumpKit.shortName, pitch: BUMP_PITCH[slug] }
    : null;
  return (
    <main className="min-h-screen text-slate-100">
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
        <div className="absolute inset-0 bg-hero-glow" aria-hidden />
        <div className="relative mx-auto max-w-xl px-6 pb-20 pt-20 sm:pt-28">
          <div className="flex flex-col items-center text-center">
            <div
              className="mb-4 whitespace-nowrap text-xs text-cyan-300/70 sm:text-sm"
              style={{ fontFamily: MONO_FONT }}
            >
              [ checkout · $15 ]
            </div>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              <span className="bg-gradient-to-r from-accent via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
                {kit.fullName}
              </span>
            </h1>
            <p className="mt-6 text-balance text-lg text-slate-300 sm:text-xl">
              Drop your info. Pay $15. PDF lands in your inbox the moment Stripe
              confirms.
            </p>
          </div>

          {cancelled ? (
            <div
              className="mx-auto mt-8 max-w-md rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-4 text-center text-sm text-amber-200"
              role="status"
            >
              Checkout cancelled — no charge made. Re-submit when you&apos;re
              ready.
            </div>
          ) : null}

          <div className="mx-auto mt-10 max-w-md">
            <CheckoutForm source={kit.slug} bump={bump} />
          </div>

          <p className="mx-auto mt-6 max-w-md text-center text-xs text-slate-500">
            We never share your info. Used only to deliver the kit and send
            occasional updates.
          </p>
        </div>
      </section>
    </main>
  );
}
