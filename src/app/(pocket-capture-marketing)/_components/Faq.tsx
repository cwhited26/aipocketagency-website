import { FAQ } from "@/data/pocket-capture/marketing";

export function Faq() {
  return (
    <section className="border-b border-white/5">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Questions.</h2>
        <div className="mt-10 divide-y divide-white/5">
          {FAQ.map((item) => (
            <div key={item.q} className="py-5">
              <h3 className="text-base font-semibold text-slate-100">{item.q}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-400">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
