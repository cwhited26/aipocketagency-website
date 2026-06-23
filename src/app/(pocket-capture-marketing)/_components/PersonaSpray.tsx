import { PERSONAS } from "@/data/pocket-capture/marketing";

export function PersonaSpray() {
  return (
    <section className="border-b border-white/5 bg-black/20">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Whatever you keep meaning to write down.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-slate-400">
          The thing you’d lose otherwise. Here’s who’s already pointing Pocket Capture at it.
        </p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PERSONAS.map((p) => (
            <div
              key={p.name}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <h3 className="text-base font-semibold text-slate-100">{p.name}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-400">{p.prop}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
