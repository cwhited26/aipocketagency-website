import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { PrimaryCTA, SecondaryCTA, MONO_FONT } from "@/components/marketing/cta";
import { ChatMock, ScaffoldMock, PersonaSpecMock } from "@/components/marketing/mocks";

const PAGE_URL = "https://aipocketagency.com/pocket-agent";
const DESCRIPTION =
  "How Pocket Agent works: you tell it what needs doing in plain words, it lays out a plan, does the work across your tools, and shows you before anything goes out. You approve. It executes.";

export const metadata: Metadata = {
  title: "How Pocket Agent works — the one chat that does the work",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "How Pocket Agent works",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "AI Pocket Agency",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "How Pocket Agent works",
    description: DESCRIPTION,
  },
};

export default function PocketAgentPage() {
  return (
    <main className="min-h-screen text-slate-100">
      <SiteHeader />
      <Hero />
      <Walkthrough />
      <FourSteps />
      <Specialists />
      <Connected />
      <Privacy />
      <FAQ />
      <FinalCTA />
      <SiteFooter />
    </main>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/5">
      <div className="absolute inset-0 bg-grid opacity-25" aria-hidden />
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="relative mx-auto max-w-3xl px-6 pb-16 pt-24 text-center sm:pt-28">
        <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl">
          Watch it run a real job.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-slate-300 sm:text-xl">
          One chat input. You type what you need the way you&apos;d say it out
          loud. Pocket Agent figures out the steps, does the parts it can, and
          stops at the line where you&apos;d want to look first.
        </p>
        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <PrimaryCTA />
          <SecondaryCTA href="/pricing" label="See pricing" />
        </div>
      </div>
    </section>
  );
}

function Walkthrough() {
  return (
    <section className="border-b border-white/5 bg-black/30">
      <div className="mx-auto max-w-2xl px-6 py-16 sm:py-20">
        <p className="text-center text-sm text-slate-500" style={{ fontFamily: MONO_FONT }}>
          a contractor, on his phone, between job sites
        </p>
        <div className="mt-6">
          <ChatMock />
        </div>
        <p className="mt-6 text-center text-sm leading-relaxed text-slate-500">
          Six tools touched, the work drafted, one approval before anything left
          the building, one minute of his time. Styled example — swapped for a
          real screen capture as the feature ships.
        </p>
      </div>
    </section>
  );
}

const STEPS = [
  {
    n: "01",
    title: "You ask in plain words",
    body: "No menus, no fields, no setup weekend. You type what you need the same way you'd text an employee — “follow up on the three open quotes,” “send Patrick the supplement,” “fix the line in my QuickBooks export.”",
  },
  {
    n: "02",
    title: "It lays out a plan",
    body: "For anything with more than one step, it shows you the plan first — the milestones, what it'll do at each one, which of your tools it'll touch. You read it, change what you want, and approve. No black box.",
  },
  {
    n: "03",
    title: "It does the work",
    body: "It runs the steps across the tools you already use — drafting the email, staging the invoice, pulling the file, setting the appointment — and reports back against the plan you approved, not a wall of activity you can't read.",
  },
  {
    n: "04",
    title: "You approve what leaves",
    body: "Anything that sends, charges, or posts stops for your okay. One tap to send, one to edit, one to hold. The agent does the chasing. You keep the call — every time, by default.",
  },
];

function FourSteps() {
  return (
    <section className="border-b border-white/5">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Four steps, every time.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-400">
              The same shape whether it&apos;s a one-line errand or a five-part
              project. You stay in front of it the whole way.
            </p>
            <div className="mt-8 hidden lg:block">
              <ScaffoldMock />
            </div>
          </div>
          <ol className="space-y-8">
            {STEPS.map((s) => (
              <li key={s.n} className="grid grid-cols-[auto_1fr] gap-5">
                <span
                  className="text-2xl font-semibold text-accent/60"
                  style={{ fontFamily: MONO_FONT }}
                >
                  {s.n}
                </span>
                <div>
                  <h3 className="text-xl font-semibold text-slate-100">{s.title}</h3>
                  <p className="mt-2 text-base leading-relaxed text-slate-400">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="lg:hidden">
            <ScaffoldMock />
          </div>
        </div>
      </div>
    </section>
  );
}

function Specialists() {
  return (
    <section className="border-b border-white/5 bg-black/30">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 sm:py-28 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Build the specialist you keep being.
          </h2>
          <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
            <p>
              The same brain that does your work can be handed to your team as a
              specialist for a single role. A sales manager that knows your
              pricing. A front desk that knows your policies. An onboarder that
              walks a new hire through their first week.
            </p>
            <p>
              You teach it once and give your team a link. It answers in your
              voice, off your playbook, and only knows the slice you handed it.
              The questions that used to interrupt your day stop reaching your
              phone.
            </p>
          </div>
          <div className="mt-8">
            <SecondaryCTA href="/pricing" label="See team plans" />
          </div>
        </div>
        <PersonaSpecMock />
      </div>
    </section>
  );
}

function Connected() {
  return (
    <section className="border-b border-white/5">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          It uses the tools you already pay for.
        </h2>
        <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
          <p>
            Pocket Agent connects to your email, your calendar, your invoicing,
            your files — the apps your business already runs on. It doesn&apos;t
            ask you to move everything into one more platform. It works in the
            accounts you already have.
          </p>
          <p>
            Every connection starts as read-only — it can see, but not touch —
            and you turn on the actions you want, one at a time. The first time
            it sends an email or stages an invoice, it asks. After you&apos;ve
            seen it get a kind of task right enough times, you can let that one
            run on its own. Your call, per action, never all-or-nothing.
          </p>
        </div>
      </div>
    </section>
  );
}

function Privacy() {
  return (
    <section className="border-b border-white/5 bg-black/30">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          What stays private, stays private.
        </h2>
        <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
          <p>
            Your memory lives in your own files, not buried in a database you
            can&apos;t open. You can read it, edit it, and take it with you. Stop
            paying and you don&apos;t lose it.
          </p>
          <p>
            And you decide what each agent can reach. The front-desk bot never
            touches your books. The sales specialist never reads your personal
            files. That boundary is enforced before the AI ever sees the
            question — it&apos;s built into how the thing works, not a setting it
            can be talked around.
          </p>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const faqs = [
    {
      q: "Do I need to be technical?",
      a: "No. If you can text an employee what you need, you can use Pocket Agent. There's no setup weekend and nothing to configure to get started.",
    },
    {
      q: "Will it send things without me seeing them?",
      a: "No. Anything that sends, charges, or posts stops for your okay first. You can choose to let a specific kind of task run on its own once you trust it — but that's a switch you flip, never the default.",
    },
    {
      q: "Does it train on my business?",
      a: "No. It reads your files when you ask it something and answers from them. Your content isn't used to train shared models, and it stays in your account.",
    },
    {
      q: "What happens to my data if I cancel?",
      a: "It's yours and it stays yours. Your memory lives in plain files you keep. Cancel anytime — nothing gets locked away or deleted on our end.",
    },
    {
      q: "What can it actually connect to?",
      a: "Your email, calendar, invoicing, and files to start, with more connections coming online over time. Each one is read-only until you turn on the actions you want.",
    },
    {
      q: "What if I want this built around my exact business?",
      a: "Buildout Studios handles custom builds, websites, and software. Pocket Agent is the starting point you can run today. BOS is the custom path when you want it shaped to you.",
    },
  ];
  return (
    <section className="border-b border-white/5">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Straight answers.
        </h2>
        <dl className="mt-10 space-y-6">
          {faqs.map((faq) => (
            <div key={faq.q} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
              <dt className="text-base font-semibold text-slate-100 sm:text-lg">{faq.q}</dt>
              <dd className="mt-2 text-base leading-relaxed text-slate-300 sm:text-lg">{faq.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center sm:py-28">
        <h2 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
          Hand it the next thing on your list.
        </h2>
        <p className="mt-6 max-w-xl text-balance text-lg leading-relaxed text-slate-300">
          Free for 14 days. Tell it what needs doing and see what comes back.
        </p>
        <div className="mt-10 flex flex-col items-center gap-3">
          <PrimaryCTA />
          <Link href="/pricing" className="text-sm text-slate-400 underline-offset-4 transition hover:text-slate-200 hover:underline">
            Or compare the plans
          </Link>
        </div>
      </div>
    </section>
  );
}
