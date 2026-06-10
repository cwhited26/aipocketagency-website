import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/marketing/site-nav";
import DownsellKitForm from "./DownsellKitForm";

const PAGE_URL = "https://aipocketagent.com/downsell-kit";

export const metadata: Metadata = {
  title: "Set it up yourself — the $97 AI Office DIY Setup Kit — Pocket Agent",
  description:
    "Rather do it yourself? The $97 AI Office DIY Setup Kit: the Business Brain upload checklist, the Mission Control review, the 7-day setup plan, three Persona templates, 25 workflow prompts, and an import-ready file for when you sign up.",
  alternates: { canonical: PAGE_URL },
  robots: { index: false },
};

const INCLUDES = [
  "The Business Brain upload checklist — what to gather, ready for day one",
  "The Mission Control review — how to read the cockpit once you're in",
  "The 7-day setup plan — a day-by-day path with prompts you can paste",
  "Setup templates for your three starter Personas (Admin, Sales Follow-Up, Content)",
  "25 workflow prompts — the full AI Workflow Vault as a reference",
  "An import-ready file you drop into Pocket Agent when you subscribe",
];

export default function DownsellKitPage() {
  return (
    <>
      <main className="text-slate-100">
        <section className="relative overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 bg-grid opacity-20" aria-hidden />
          <div className="relative mx-auto max-w-3xl px-6 pb-12 pt-20 text-center sm:pt-24">
            <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-5xl">
              Rather set it up yourself? Here&rsquo;s the playbook. $97.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
              Not ready to subscribe and not looking for hand-holding. Fair. This
              is the whole setup written down: the checklists, the 7-day plan, the
              Persona templates, and the 25 workflow prompts. Work it on your own,
              then drop the import file in when you sign up and start from a
              running workspace instead of an empty one.
            </p>
          </div>
        </section>

        <section className="border-b border-white/5">
          <div className="mx-auto grid max-w-5xl gap-10 px-6 py-16 md:grid-cols-2">
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.04] p-7">
              <h2 className="text-lg font-semibold text-slate-100">
                The AI Office DIY Setup Kit — $97
              </h2>
              <ul className="mt-5 space-y-3 text-sm text-slate-300">
                {INCLUDES.map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <span className="mt-1 text-cyan-300">✓</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col justify-center">
              <DownsellKitForm />
              <p className="mt-5 text-xs leading-relaxed text-slate-500">
                After payment confirms, we email you a download link for the full
                kit. The link is good for 24 hours.
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-3xl px-6 py-16">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 text-[15px] leading-relaxed text-slate-300">
              <p>
                Everything in this kit is also free inside the product once you
                subscribe — the Launch Kit walks you through the same steps. The
                kit is for the person who wants to do the reading and the prep now,
                before they&rsquo;re paying for anything. If that&rsquo;s you, the
                button&rsquo;s above. If you&rsquo;d rather just see it run, the{" "}
                <Link href="/pricing" className="text-cyan-300 hover:underline">
                  plans are here
                </Link>
                .
              </p>
              <p className="mt-4 text-right text-sm text-slate-500">&mdash; Chase</p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
