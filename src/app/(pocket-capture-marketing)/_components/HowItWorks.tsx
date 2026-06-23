import { SURFACES } from "@/data/pocket-capture/marketing";
import { DemoSlot } from "./DemoSlot";
import { MONO_FONT } from "./CheckoutButton";

export function HowItWorks() {
  return (
    <section className="border-b border-white/5">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <div
          className="mb-5 text-center text-xs text-cyan-300/70"
          style={{ fontFamily: MONO_FONT }}
        >
          [ four surfaces ]
        </div>
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Four ways in. Pick the one closest to your hand.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-slate-400">
          Capture happens in four moments — inside another app, hands busy, already in email,
          or somewhere weird. There’s a surface for each.
        </p>

        <div className="mt-14 space-y-10">
          {SURFACES.map((s, i) => (
            <div
              key={s.key}
              className={`flex flex-col items-center gap-6 sm:gap-10 ${
                i % 2 === 1 ? "sm:flex-row-reverse" : "sm:flex-row"
              }`}
            >
              <div className="w-40 shrink-0 sm:w-48">
                <DemoSlot surfaceKey={s.key} label={s.label} icon={s.icon} />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-xl font-semibold text-slate-100">
                  <span className="mr-2" aria-hidden>
                    {s.icon}
                  </span>
                  {s.label}
                </h3>
                <p className="mt-1 text-sm font-medium text-cyan-300/80">{s.tagline}</p>
                <p className="mt-3 text-[15px] leading-relaxed text-slate-400">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
