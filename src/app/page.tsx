import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { PrimaryCTA, SecondaryCTA, MONO_FONT } from "@/components/marketing/cta";
import { BeforeAfter, PersonaSpecMock, ScaffoldMock } from "@/components/marketing/mocks";

const DESCRIPTION =
  "Pocket Agent is the one chat you tell what needs doing — and it does the work. It remembers how your business runs, it's plugged into the tools you already use, and nothing goes out without your okay.";

export const metadata: Metadata = {
  title: "Pocket Agent — the one chat that does the work",
  description: DESCRIPTION,
  metadataBase: new URL("https://aipocketagent.com"),
  openGraph: {
    title: "Pocket Agent — the one chat that does the work",
    description: DESCRIPTION,
    url: "https://aipocketagent.com",
    siteName: "AI Pocket Agency",
    type: "website",
    images: [
      {
        url: "https://aipocketagent.com/og-share.png",
        width: 1200,
        height: 630,
        alt: "Pocket Agent",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pocket Agent — the one chat that does the work",
    description: DESCRIPTION,
    images: ["https://aipocketagent.com/og-share.png"],
  },
};

export default function Page() {
  return (
    <main className="min-h-screen text-slate-100">
      <SiteHeader />
      <Hero />
      <ValueBand />
      <SeeItWork />
      <YouStatements />
      <FounderLetter />
      <Features />
      <RealExamples />
      <PricingTeaser />
      <FinalCTA />
      <SiteFooter />
    </main>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/5">
      <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="relative mx-auto max-w-4xl px-6 pb-20 pt-24 text-center sm:pt-32">
        <h1 className="text-balance text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          Everything runs through you.
          <br />
          <span className="bg-gradient-to-r from-accent via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
            It doesn&apos;t have to.
          </span>
        </h1>
        <p className="mx-auto mt-7 max-w-2xl text-balance text-lg leading-relaxed text-slate-300 sm:text-xl">
          Pocket Agent is the one chat you tell what needs doing — and it does
          the work. It remembers how your business runs, it&apos;s plugged into
          the tools you already use, and nothing goes out the door without your
          okay.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4">
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <PrimaryCTA />
            <SecondaryCTA href="/pocket-agent" label="See it work" />
          </div>
          <p className="text-xs text-slate-500" style={{ fontFamily: MONO_FONT }}>
            14-day free trial · cancel before day 15 and pay $0
          </p>
        </div>

        <TrustBar />
      </div>
    </section>
  );
}

function TrustBar() {
  const names = ["Tennessee Valley Exteriors", "Whited Consulting", "AthleteOS"];
  return (
    <div className="mx-auto mt-14 max-w-3xl border-t border-white/5 pt-8 text-center">
      <p className="text-xs uppercase tracking-wider text-slate-500">
        Run every day across the businesses Chase runs himself
      </p>
      <div className="mt-3 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-6">
        {names.map((n) => (
          <span key={n} className="text-sm text-slate-400">
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

// Shortened value-stack anchor, lifted above the fold so the comparison isn't
// buried on /pricing. Full footed breakdown lives on the pricing page.
function ValueBand() {
  return (
    <section className="border-b border-white/5 bg-black/30">
      <div className="mx-auto max-w-4xl px-6 py-14 text-center sm:py-16">
        <p className="text-balance text-xl font-semibold leading-relaxed text-slate-200 sm:text-2xl">
          An assistant, a lead tool, a copywriter, and a CRM run about{" "}
          <span className="text-slate-400 line-through">$2,000 a month</span> —
          and you&apos;re still the one stitching them together.
        </p>
        <p className="mt-4 text-balance text-xl font-semibold leading-relaxed sm:text-2xl">
          Pocket Agent does the same job for{" "}
          <span className="text-accent">$37</span>.
        </p>
        <p className="mt-5 text-sm text-slate-500">
          <Link href="/pricing" className="underline-offset-4 transition hover:text-slate-300 hover:underline">
            See the full breakdown →
          </Link>
        </p>
      </div>
    </section>
  );
}

function SeeItWork() {
  return (
    <section className="border-b border-white/5 bg-black/30">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Here&apos;s the same 7am, with and without it.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-400">
            A rep needs the supplement template. One version of that morning ends
            with the wrong scope signed. The other ends with you tapping approve
            over coffee.
          </p>
        </div>
        <div className="mt-12">
          <BeforeAfter />
        </div>
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-slate-500">
          That second column is how Patrick at Fresh Page Home Improvement, a
          Pocket Agent customer, uses it to brief his reps in the field. Styled
          example — swapped for real screen captures as the feature ships.
        </p>
      </div>
    </section>
  );
}

const YOU_STATEMENTS = [
  {
    claim: "Your business should remember itself.",
    body: (
      <>
        <p>
          Right now your business remembers because you remember. Every price
          you quoted, every promise you made, every reason you do it the way you
          do — it all lives in your head, and it walks out the door when you do.
        </p>
        <p className="mt-4">
          Pocket Agent holds that for you. Tell it once how you handle a
          deposit, what you charge for a tear-off, why you stopped using that
          supplier — and it keeps it. Next week, next month, a year from now, it
          still knows. You stop being the only copy.
        </p>
      </>
    ),
  },
  {
    claim: "Your team should ask the bot, not you.",
    body: (
      <>
        <p>
          You hired people so the work would stop landing on you. Then they text
          you all day anyway — what&apos;s our price on that, how do we handle
          this one, where&apos;s the file.
        </p>
        <p className="mt-4">
          Build a specialist for the questions you keep answering: a sales
          manager that knows your pricing, a front desk that knows your
          policies, an onboarder that walks a new hire through week one. Teach it
          once, hand your team a link, and it answers in your voice off what you
          taught it — and only what you taught it. The questions stop coming to
          your phone.
        </p>
      </>
    ),
  },
  {
    claim: "Your busywork should run on its own.",
    body: (
      <>
        <p>
          The follow-ups. The quotes. The invoice nobody sent. The email
          you&apos;ve been meaning to write since Tuesday. None of it is hard —
          it just never gets to the top of the pile, because the pile is you.
        </p>
        <p className="mt-4">
          Tell Pocket Agent what you want done and it lays out a plan, does the
          work across the tools you already use, and brings it back for one look
          before anything goes out. You&apos;re not clicking through twelve tabs.
          You&apos;re saying yes or no.
        </p>
      </>
    ),
  },
];

function YouStatements() {
  return (
    <section className="border-b border-white/5">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="space-y-16 sm:space-y-24">
          {YOU_STATEMENTS.map((s, i) => (
            <div
              key={s.claim}
              className="grid gap-6 sm:grid-cols-12 sm:gap-10"
            >
              <div className="sm:col-span-5">
                <span
                  className="text-sm text-accent/70"
                  style={{ fontFamily: MONO_FONT }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-2xl font-bold leading-tight tracking-tight text-slate-100 sm:text-3xl">
                  {s.claim}
                </h3>
              </div>
              <div className="text-lg leading-relaxed text-slate-300 sm:col-span-6 sm:col-start-7">
                {s.body}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FounderLetter() {
  return (
    <section className="border-b border-white/5 bg-gradient-to-b from-accent/[0.04] via-transparent to-transparent">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
        <h2 className="text-2xl font-bold italic tracking-tight text-slate-100 sm:text-3xl">
          Why I built this
        </h2>
        <div className="mt-8 space-y-5 text-lg leading-relaxed text-slate-300">
          <p>
            I run a roofing company. I also run a software studio, a youth-sports
            product, and a handful of client builds on the side. For a long time
            the thing holding all of it together was me — my memory, my phone, my
            willingness to answer the same question for the fourth time that week.
          </p>
          <p>
            The breaking point wasn&apos;t dramatic. It was a Tuesday. Tennessee
            Valley Exteriors needed a supplement sent to a homeowner. A client —
            Patrick, who runs Fresh Page Home Improvement — was waiting on me to
            ship something. AthleteOS was sitting half-finished because I never
            got an hour to myself. Every one of those was an hour of me
            re-explaining where
            things stood to whatever tool I&apos;d opened. The tools were smart.
            They just forgot me the second I closed the tab.
          </p>
          <p>
            So I built the thing I actually needed. One place that remembers how
            my businesses run, that&apos;s wired into the tools I already pay for,
            and that I can tell what needs doing from the truck, from a job site,
            from the bleachers at my kid&apos;s game. It plans the work, does the
            parts it can, and shows me before anything goes out. I approve from my
            phone. The work happens whether I&apos;m at a desk or not.
          </p>
          <p>
            Pocket Agent is that thing, opened up so you can run your business on
            it too. It&apos;s what I use to run mine — not a demo I built to sell
            you.
          </p>
        </div>
        <div className="mt-10 flex items-center gap-4">
          {/* AVATAR PLACEHOLDER — swap for a real photo at /public/chase.jpg */}
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent/15 text-sm font-semibold text-accent ring-1 ring-accent/30">
            CW
          </span>
          <div>
            <div className="text-[15px] font-semibold text-slate-100">Chase Whited</div>
            <div className="text-sm text-slate-500">founder · Whited Consulting</div>
          </div>
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    title: "A brain your business runs on",
    body: "Every decision, price, policy, and preference you give it gets written down and kept — in your own files, not a chat that scrolls away. Ask it anything you've ever told it and the answer comes back with where it came from.",
  },
  {
    title: "Specialists your team can ask",
    body: "Build an agent for a role — sales, front desk, onboarding — teach it what that job needs to know, and hand your team a link. It answers off your playbook, in your voice, and only knows the slice you gave it. New hires stop waiting on you to get up to speed.",
  },
  {
    title: "The plan before the work",
    body: "Give it something real — “follow up on the three open quotes and send the Reyes proposal” — and it lays out the steps before it touches anything. You see the plan, change what you want, and approve it. Then it works against a plan you signed off on, not a black box.",
  },
  {
    title: "Connected to the tools you already use",
    body: "It works with your email, your calendar, your invoicing — the apps your business already runs on. It can draft the email, stage the invoice, set the appointment, using your accounts, not some walled-off copy. You're handing off the parts you hate, not switching software.",
  },
  {
    title: "What stays private, stays private",
    body: "You decide what each agent can see. The front-desk bot never touches your books. The sales agent never reads your personal files. That's enforced before the AI ever gets the question — not a setting it can talk its way around.",
  },
];

function Features() {
  return (
    <section className="border-b border-white/5 bg-black/30">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Five things working underneath that one chat.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-400">
            You never see the machinery. You just talk to it. But here&apos;s
            what&apos;s actually carrying the weight.
          </p>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-[#080b10] p-7 sm:p-8">
              <h3 className="text-xl font-semibold text-slate-100">{f.title}</h3>
              <p className="mt-3 text-base leading-relaxed text-slate-400">{f.body}</p>
            </div>
          ))}
          <div className="flex flex-col justify-center gap-4 bg-[#080b10] p-7 sm:p-8">
            <p className="text-base leading-relaxed text-slate-300">
              All of it under one chat input. No tabs to learn, no setup weekend.
            </p>
            <PrimaryCTA className="w-full sm:w-auto" />
          </div>
        </div>
      </div>
    </section>
  );
}

function RealExamples() {
  return (
    <section className="border-b border-white/5">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            What it actually looks like.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-400">
            Two pieces of the same job: the plan Pocket Agent shows you before it
            starts, and a specialist you&apos;d hand your sales team.
          </p>
        </div>
        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <div>
            <ScaffoldMock />
            <p className="mt-4 text-sm leading-relaxed text-slate-500">
              The plan it draws up from one sentence. You approve it before a
              single email or invoice moves.
            </p>
          </div>
          <div>
            <PersonaSpecMock />
            <p className="mt-4 text-sm leading-relaxed text-slate-500">
              A specialist your team can ask — built from a short spec you can
              read, edit, and lock down to what it should know.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingTeaser() {
  const tiers = [
    { name: "Starter", price: "$37", note: "The brain. It remembers your business and drafts the work." },
    { name: "Pro", price: "$97", note: "The operator turns on. It does the work and answers your team." },
    { name: "Studio", price: "$297", note: "Every tool connected, plus an agent on your website." },
  ];
  return (
    <section className="border-b border-white/5 bg-black/30">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Start where you are. Move up when the business does.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-400">
              Every plan earns its price by turning on the next thing you can
              hand off. Start free for 14 days on any of them.
            </p>
          </div>
          <SecondaryCTA href="/pricing" label="See all plans" />
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {tiers.map((t) => (
            <div key={t.name} className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <div className="text-sm font-semibold uppercase tracking-wider text-accent">
                {t.name}
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-slate-100">{t.price}</span>
                <span className="text-sm text-slate-500">/mo</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{t.note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center sm:py-32">
        <h2 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
          Stop being the only one who can run it.
        </h2>
        <p className="mt-6 max-w-xl text-balance text-lg leading-relaxed text-slate-300">
          Tell Pocket Agent what needs doing and watch it come back with the work
          done — for your okay. Free for 14 days. Your data stays yours.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4">
          <PrimaryCTA />
          <p className="text-sm text-slate-500">
            Want this built around your exact business?{" "}
            <Link
              href="https://buildoutstudios.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 underline-offset-4 transition hover:text-slate-200 hover:underline"
            >
              Buildout Studios
            </Link>{" "}
            does the custom path.
          </p>
        </div>
      </div>
    </section>
  );
}
