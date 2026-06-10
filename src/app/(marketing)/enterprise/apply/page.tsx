import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { MONO_FONT } from "@/components/marketing/cta";
import ApplyForm from "./ApplyForm";

const PAGE_URL = "https://aipocketagent.com/enterprise/apply";

export const metadata: Metadata = {
  title: "Apply for Pocket Agent Enterprise",
  description:
    "Tell us about your business, workflows, team, and implementation needs. We'll review your application and determine whether Pocket Agent Enterprise is the right fit.",
  alternates: { canonical: PAGE_URL },
  robots: { index: false },
};

export default function EnterpriseApplyPage() {
  return (
    <>
      <SiteHeader />
      <main className="text-slate-100">
        <section className="relative overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 bg-grid opacity-20" aria-hidden />
          <div className="relative mx-auto max-w-2xl px-6 pb-12 pt-16 text-center sm:pt-20">
            <div
              className="mb-3 inline-block text-xs text-cyan-300/70"
              style={{ fontFamily: MONO_FONT }}
            >
              [ Pocket Agent Enterprise ]
            </div>
            <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
              Apply for Pocket Agent Enterprise
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-slate-300">
              Tell us about your business, workflows, team, and implementation
              needs. We will review your application and determine whether Enterprise
              is the right fit.
            </p>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-2xl px-6 py-12">
            <ApplyForm />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
