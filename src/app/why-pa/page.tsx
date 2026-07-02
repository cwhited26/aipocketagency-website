import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { PrimaryCTA } from "@/components/marketing/cta";

const PAGE_URL = "https://aipocketagent.com/why-pa";
const DESCRIPTION =
  "Honest answers to 'how is this different from ChatGPT, a VA, or my CRM?' Where each one fits, and where Pocket Agent picks up.";

export const metadata: Metadata = {
  title: "How Pocket Agent is different — ChatGPT, a VA, your CRM",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "How Pocket Agent is different",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "Pocket Agent",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "How Pocket Agent is different",
    description: DESCRIPTION,
  },
};

const COMPARISONS: { heading: string; body: React.ReactNode }[] = [
  {
    heading: "“I already use ChatGPT.”",
    body: (
      <>
        <p>
          ChatGPT is good at answering the question in front of it. But it meets
          you fresh every time — it doesn&apos;t know your prices, your
          customers, or what you decided last month, so you re-explain your
          business at the top of every chat. And when it&apos;s done answering,
          it&apos;s done. It can&apos;t go send the email or stage the invoice.
        </p>
        <p className="mt-4">
          Pocket Agent starts from everything you&apos;ve already told it and
          actually does the work in your tools — with your okay. If ChatGPT is
          the smart intern you brief every morning, Pocket Agent is the one who
          already knows the place. Plenty of owners run both: ask ChatGPT a
          question, hand the running of the business to Pocket Agent.
        </p>
      </>
    ),
  },
  {
    heading: "“I tried hiring a VA.”",
    body: (
      <>
        <p>
          A good assistant is worth it — a person who knows your business and
          takes work off your plate is hard to beat. The catch is everything
          around it: the hiring, the training, the time-zone gap, the handoff
          doc, and the day they leave and take the context with them.
        </p>
        <p className="mt-4">
          Pocket Agent doesn&apos;t replace a great assistant. It does the part
          you&apos;d hand a VA on day one and never have to re-train — the
          follow-ups, the drafts, the chasing — at any hour, and it never forgets
          what you taught it. Some owners run it instead of a VA. Some run it so
          their VA stops doing grunt work and starts doing the judgment work.
        </p>
      </>
    ),
  },
  {
    heading: "“I already have Jobber, HoneyBook, a CRM.”",
    body: (
      <>
        <p>
          Your CRM is the system of record — the jobs, the contacts, the
          invoices, the pipeline. Keep it. What it doesn&apos;t do is the
          thinking and the chasing between the records: noticing the quote that
          went cold, writing the follow-up, answering the customer, pulling the
          photos into a supplement letter.
        </p>
        <p className="mt-4">
          That&apos;s the part that still lands on you — or just doesn&apos;t get
          done. Pocket Agent sits next to your CRM and does that work. As more
          connections come online it reads and writes to the tools you already
          pay for, instead of asking you to move your whole business into one
          more app.
        </p>
      </>
    ),
  },
];

export default function WhyPaPage() {
  return (
    <main className="min-h-screen text-slate-100">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-grid opacity-25" aria-hidden />
        <div className="absolute inset-0 bg-hero-glow" aria-hidden />
        <div className="relative mx-auto max-w-3xl px-6 pb-16 pt-24 sm:pt-28">
          <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            You&apos;re already paying for tools. Here&apos;s where this one is
            different.
          </h1>
          <p className="mt-6 text-balance text-lg leading-relaxed text-slate-300 sm:text-xl">
            No knock on what you&apos;re using. Most of it is good at one job.
            The honest version of where each one fits — and where Pocket Agent
            picks up the part that still lands on you.
          </p>
        </div>
      </section>

      <section className="border-b border-white/5">
        <div className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
          <div className="space-y-14 sm:space-y-20">
            {COMPARISONS.map((c) => (
              <div key={c.heading} className="grid gap-5 sm:grid-cols-12 sm:gap-8">
                <h2 className="text-2xl font-bold leading-tight tracking-tight text-slate-100 sm:col-span-5 sm:text-[28px]">
                  {c.heading}
                </h2>
                <div className="text-lg leading-relaxed text-slate-300 sm:col-span-7">
                  {c.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/5 bg-black/30">
        <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Where it&apos;s not the move.
          </h2>
          <div className="mt-6 space-y-4 text-lg leading-relaxed text-slate-300">
            <p>
              If you want a human to physically show up, this isn&apos;t that. If
              you want a tool that runs your whole business with zero oversight
              today, that&apos;s not this either — and you should be careful with
              anything that promises it.
            </p>
            <p>
              Pocket Agent shows you the work and waits for your okay, on
              purpose. It does the chasing. You keep the call. That&apos;s the
              trade, and for most owners it&apos;s the right one.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-3xl px-6 py-20 text-center sm:py-24">
          <h2 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
            The fastest way to know is to use it for a week.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-balance text-lg leading-relaxed text-slate-300">
            Free for 14 days. Hand it the work you&apos;ve been putting off and
            see what comes back.
          </p>
          <div className="mt-10 flex justify-center">
            <PrimaryCTA />
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
