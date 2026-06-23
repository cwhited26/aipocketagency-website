import { HERO, PRICE_LABEL, SURFACES } from "@/data/pocket-capture/marketing";
import { CheckoutButton, MONO_FONT } from "./CheckoutButton";
import { DemoSlot } from "./DemoSlot";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/5">
      <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="relative mx-auto max-w-3xl px-6 pb-16 pt-20 text-center sm:pt-28">
        <div
          className="mb-5 inline-block text-xs text-cyan-300/70"
          style={{ fontFamily: MONO_FONT }}
        >
          [ Pocket Capture · by Pocket Agent ]
        </div>
        <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
          {HERO.headline}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
          {HERO.sub}
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3">
          <CheckoutButton />
          <p className="text-sm text-slate-500">
            One-time {PRICE_LABEL}. No subscription. 30-day money-back guarantee.
          </p>
        </div>

        {/* Four-surface demo strip — placeholder posters (PC-MARK-6 drops in the videos). */}
        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SURFACES.map((s) => (
            <DemoSlot key={s.key} surfaceKey={s.key} label={s.label} icon={s.icon} />
          ))}
        </div>
      </div>
    </section>
  );
}
