import { MONO_FONT } from "./CheckoutButton";

// The wedge vs typing-only competitors (SPEC §1, PA-CAPTURE-2). Short comparison block.

const STEPS = ["Type?", "Speak.", "Share.", "Forward.", "Text."];

export function Wedge() {
  return (
    <section className="border-b border-white/5 bg-black/20">
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Most capture apps want you to type.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
          Typing needs a free hand, your eyes, and a keyboard. The moment you actually want to
          capture something, you usually have none of those. So the idea is gone.
        </p>

        <div
          className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-lg font-semibold"
          style={{ fontFamily: MONO_FONT }}
        >
          {STEPS.map((step, i) => (
            <span
              key={step}
              className={i === 0 ? "text-slate-500 line-through" : "text-cyan-300"}
            >
              {step}
            </span>
          ))}
        </div>

        <p className="mt-8 text-lg font-semibold text-slate-100">
          Pick the one closest to your hand.
        </p>
      </div>
    </section>
  );
}
