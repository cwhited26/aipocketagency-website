import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { MONO_FONT } from "@/components/marketing/cta";
import { nextWebinarAt, webinarWhenLabel } from "@/lib/webinar/config";
import RegisterForm from "./RegisterForm";
import { WebinarRegistrationVideo } from "./WebinarRegistrationVideo";

const PAGE_URL = "https://aipocketagent.com/training";
const DESCRIPTION =
  "Free training for owner-led businesses: build your AI team without becoming an AI expert. See how Pocket Agent turns scattered business context into an AI Agent Workspace — Business Brain, Personas, Apps, and Mission Control. Generic AI starts from zero. Pocket Agent starts from your business.";

export const metadata: Metadata = {
  title: "Free Training — Build Your AI Team Without Becoming An AI Expert",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Build your AI team without becoming an AI expert.",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "AI Pocket Agency",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Build your AI team without becoming an AI expert.",
    description: DESCRIPTION,
  },
};

const HERO_BULLETS: string[] = [
  "Why generic AI still makes you do all the work.",
  "How to build a Business Brain that starts from your company context.",
  "How to clone-and-customize AI Personas for admin, follow-up, content, email, sales, research, and operations.",
  "How Apps like Lead Scout, Email Drafter, Follow-Up Sweeps, Capture Inbox, YouTube Ingester, Podcast Ingester, Landing Page Builder, and Idea Engine actually move work forward.",
  "How Mission Control keeps you in review and approval.",
  "The first 3 Personas and 3 workflows to install inside Pocket Agent.",
];

const LESSONS: { n: string; title: string; body: string }[] = [
  {
    n: "1",
    title: "Why generic AI starts from zero",
    body: "You'll see why blank AI tools still make business owners do all the work, and why business context is the real bottleneck.",
  },
  {
    n: "2",
    title: "How to build your Business Brain",
    body: "You'll learn what to add first: offers, services, FAQs, customer notes, voice examples, screenshots, saved links, past AI chats, workflows, and decisions.",
  },
  {
    n: "3",
    title: "How Personas work",
    body: "You'll learn why Personas are the WHO, and how to clone-and-customize trained roles like Admin Assistant, Follow-Up Agent, Content Creator, Email Drafter, Lead Researcher, and Operations Chief of Staff.",
  },
  {
    n: "4",
    title: "How Apps move work forward",
    body: "You'll learn why Apps are the WHAT, and how Personas use Apps like Lead Scout, Email Drafter, Follow-Up Sweeps, Capture Inbox, YouTube Ingester, Podcast Ingester, Landing Page Builder, and Idea Engine.",
  },
  {
    n: "5",
    title: "How Mission Control keeps you in control",
    body: "You'll see how to review what Pocket Agent captured, drafted, researched, queued, built, and prepared.",
  },
  {
    n: "6",
    title: "How Idea Engine turns rough ideas into real assets",
    body: "You'll see why Idea Engine is different from prompt packs and blueprints. Other tools hand you more work. Idea Engine ends with a working website you can share.",
  },
  {
    n: "7",
    title: "How to start with 3-3-3 activation",
    body: "You'll learn the first milestone: 3 Business Brain assets. 3 trained Personas. 3 working workflows.",
  },
];

const WHO_SHOULD: string[] = [
  "You run an owner-led business.",
  "You already know AI could help, but you do not know where to start.",
  "You are tired of re-explaining your business to ChatGPT, Claude, or Gemini.",
  "You have leads, notes, screenshots, emails, ideas, and follow-ups scattered everywhere.",
  "You want AI agents, but you do not want to build them from scratch.",
  "You want help with admin, content, email, follow-up, lead research, landing pages, decisions, and operations.",
  "You want AI to prepare the work, but you still want to approve what matters.",
  "You want a simple first setup path instead of another blank tool.",
];

const WHO_SHOULD_NOT: string[] = [
  "You want AI to magically run your entire business with no setup.",
  "You refuse to add business context.",
  "You want AI to make decisions without review.",
  "You are looking for another prompt pack instead of an actual workspace.",
  "You already have a full internal AI engineering team and want a custom enterprise build from day one.",
  "You do not want to install at least one real workflow.",
];

const ABOUT: { title: string; body: string }[] = [
  { title: "Business Brain", body: "Your company memory in markdown, stored in your own git repo." },
  { title: "Personas", body: "Clone-and-customize trained AI roles." },
  { title: "Apps", body: "Workflow tools each Persona uses to do work." },
  { title: "Mission Control", body: "The cockpit where you review and approve everything." },
];

const FAQ: { q: string; a: string }[] = [
  { q: "Is this training free?", a: "Yes. The training is free." },
  {
    q: "Who is teaching it?",
    a: "The training is from Pocket Agent. It shows owner-led businesses how to build their AI Agent Workspace using Business Brain, Personas, Apps, and Mission Control.",
  },
  {
    q: "Do I need to be technical?",
    a: "No. This is built for business owners who do not want to learn APIs, build agents from scratch, or wire together complicated automation systems.",
  },
  {
    q: "Is this just about ChatGPT prompts?",
    a: "No. Pocket Agent is not a prompt pack. It is an AI Agent Workspace where your Business Brain, Personas, Apps, and Mission Control live together.",
  },
  {
    q: "Will you show the product?",
    a: "Yes. The training explains the mechanism and shows how Pocket Agent works.",
  },
  {
    q: "What happens after I register?",
    a: "You'll receive the training link and reminder emails from chase@aipocketagent.com.",
  },
  {
    q: "What is the main thing I'll learn?",
    a: "You'll learn how to start with 3-3-3 activation: 3 Business Brain assets. 3 trained Personas. 3 working workflows.",
  },
];

function Section({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`border-b border-white/5 ${className}`}>
      <div className="mx-auto max-w-3xl px-6 py-16">{children}</div>
    </section>
  );
}

export default function TrainingPage() {
  const when = webinarWhenLabel(nextWebinarAt());

  return (
    <main className="min-h-screen text-slate-100">
      <SiteHeader />

      {/* SECTION 1: HERO */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
        <div className="absolute inset-0 bg-hero-glow" aria-hidden />
        <div className="relative mx-auto max-w-3xl px-6 pb-20 pt-20 text-center sm:pt-28">
          <div
            className="mb-4 text-xs uppercase tracking-wider text-cyan-300/70"
            style={{ fontFamily: MONO_FONT }}
          >
            Free Training From Pocket Agent
          </div>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Build your AI team without becoming an AI expert.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
            Business owners are being told to use AI agents, automate their workflows, and replace
            repetitive work. But most do not want to learn APIs, duct-tape tools together, or hire an
            AI consultant every time they need a new workflow.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
            In this free training, you&apos;ll see how Pocket Agent helps owner-led businesses build a
            Business Brain, clone-and-customize trained Personas, use workflow Apps, and review
            everything from Mission Control.
          </p>
          <p className="mt-6 text-sm text-cyan-300/80" style={{ fontFamily: MONO_FONT }}>
            [ {when} ]
          </p>

          <RegisterForm />

          <div className="mx-auto mt-12 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left">
            <div className="text-sm font-semibold text-slate-100">On this training, you&apos;ll learn:</div>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-300">
              {HERO_BULLETS.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span className="mt-1 text-cyan-300">→</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* VIDEO */}
      <Section className="text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Watch the 60-second intro.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-400">
          Generic AI starts from zero. Pocket Agent starts from your business.
        </p>
        <div className="mt-8">
          <WebinarRegistrationVideo />
        </div>
      </Section>

      {/* SECTION 2: PROBLEM */}
      <Section>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Everyone says you need AI agents. Nobody shows you where to start.
        </h2>
        <div className="mt-5 space-y-3 text-slate-300">
          <p>You hear it everywhere.</p>
          <p>
            Use AI agents. Automate your business. Use AI for admin. Use AI for sales. Use AI for
            content. Use AI for follow-up. Use AI for lead research. Use AI for operations.
          </p>
          <p>But when you actually try to do it, everything gets messy.</p>
          <p>
            ChatGPT is in one place. Claude is in another. Gemini is somewhere else. Your emails are
            in Gmail. Your leads are in your CRM. Your ideas are in Notes. Your screenshots are buried
            in your phone. Your documents are in Google Drive. Your content ideas are half-finished.
            Your follow-ups are in your head.
          </p>
          <p>And every generic AI tool still starts from zero.</p>
          <p className="font-semibold text-slate-100">That is not an AI system.</p>
          <p className="font-semibold text-slate-100">That is generic AI chaos.</p>
        </div>
      </Section>

      {/* SECTION 3: TRAINING PROMISE */}
      <Section>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          This training shows you the simple installation path.
        </h2>
        <div className="mt-5 space-y-3 text-slate-300">
          <p>You do not need to become technical.</p>
          <p>You do not need to build agents from scratch.</p>
          <p>You do not need to hire a consultant just to get started.</p>
          <p>You need a simple structure: Business Brain. Personas. Apps. Mission Control.</p>
          <p>Your Business Brain gives the AI your company memory.</p>
          <p>Your Personas give the AI roles.</p>
          <p>Your Apps give the Personas tools.</p>
          <p>Mission Control gives you review and approval.</p>
          <p className="font-semibold text-slate-100">That is the Pocket Agent System.</p>
        </div>
      </Section>

      {/* SECTION 4: WHAT YOU WILL LEARN */}
      <Section>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          What you&apos;ll learn on the training
        </h2>
        <div className="mt-8 space-y-5">
          {LESSONS.map((l) => (
            <div key={l.n} className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <span
                className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent"
                style={{ fontFamily: MONO_FONT }}
              >
                {l.n}
              </span>
              <div>
                <div className="font-semibold text-slate-100">{l.title}</div>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">{l.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* SECTION 5 + 6: WHO SHOULD / SHOULD NOT */}
      <Section>
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <h2 className="text-xl font-bold tracking-tight">This is for you if:</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-300">
              {WHO_SHOULD.map((w) => (
                <li key={w} className="flex items-start gap-2">
                  <span className="mt-1 text-cyan-300">✓</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">This is not for you if:</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
              {WHO_SHOULD_NOT.map((w) => (
                <li key={w} className="flex items-start gap-2">
                  <span className="mt-1 text-slate-600">✕</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* SECTION 7: ABOUT POCKET AGENT */}
      <Section>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">What is Pocket Agent?</h2>
        <p className="mt-4 text-slate-300">
          Pocket Agent is the AI Agent Workspace for owner-led businesses. It gives you:
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {ABOUT.map((a) => (
            <div key={a.title} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="font-semibold text-slate-100">{a.title}</div>
              <p className="mt-1 text-sm text-slate-400">{a.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-slate-300">Generic AI starts from zero.</p>
        <p className="font-semibold text-slate-100">Pocket Agent starts from your business.</p>
      </Section>

      {/* SECTION 8: IDEA ENGINE TEASER */}
      <Section>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          See how an idea becomes a real thing on the internet.
        </h2>
        <div className="mt-5 space-y-3 text-slate-300">
          <p>On the training, you&apos;ll see how Idea Engine works.</p>
          <p>
            Drop an idea — a voice memo, a podcast you just listened to, a thought you had in the
            shower. Pocket Agent validates whether real people would buy it, plans the version that
            should actually ship, builds it for you, gets a sales page live, and lines up the first 25
            prospects to email. By the time you finish your morning coffee, your idea is a real thing
            on the internet you can show people.
          </p>
          <p>Other tools hand you a blueprint and prompts.</p>
          <p className="font-semibold text-slate-100">
            Idea Engine ends with a working website you can share.
          </p>
        </div>
      </Section>

      {/* SECTION 9: CTA BLOCK */}
      <Section className="text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Build your AI team without becoming technical.
        </h2>
        <p className="mt-3 text-slate-300">
          Register for the free training and see the Pocket Agent System.
        </p>
        <RegisterForm />
        <p className="mt-4 text-sm text-slate-500">
          You&apos;ll get the training link by email from chase@aipocketagent.com.
        </p>
      </Section>

      {/* SECTION 10: FAQ */}
      <Section>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Registration FAQ</h2>
        <div className="mt-8 space-y-4">
          {FAQ.map((f) => (
            <details key={f.q} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <summary className="cursor-pointer font-semibold text-slate-100">{f.q}</summary>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      <SiteFooter />
    </main>
  );
}
