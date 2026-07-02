import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-nav";
import { MONO_FONT } from "@/components/marketing/cta";
import {
  WEBINAR_DURATION_MINUTES,
  WEBINAR_TITLE,
  nextWebinarAt,
  webinarJoinUrl,
  webinarWhenLabel,
} from "@/lib/webinar/config";
import AddToCalendar from "./AddToCalendar";

const PAGE_URL = "https://aipocketagent.com/training-confirmed";
const DESCRIPTION =
  "You're registered for the Pocket Agent training. Add it to your calendar, watch for your reminder emails, and come ready to choose your first Persona.";

export const metadata: Metadata = {
  title: "You're registered — Pocket Agent Training",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  robots: { index: false, follow: false },
  openGraph: {
    title: "You're registered.",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "Pocket Agent",
    type: "website",
  },
};

const BEFORE: { title: string; body: string }[] = [
  {
    title: "Think about where your business context is scattered.",
    body: "Email. CRM. Notes. Screenshots. Google Docs. Spreadsheets. YouTube. Podcasts. Your head.",
  },
  {
    title: "Pick your biggest bottleneck.",
    body: "Admin. Follow-up. Content. Lead research. Email. Operations. Ideas you never ship.",
  },
  {
    title: "Come ready to choose your first Persona.",
    body: "Admin Assistant. Follow-Up Agent. Content Creator. Email Drafter. Lead Researcher. Operations Chief of Staff.",
  },
];

export default function TrainingConfirmedPage() {
  const at = nextWebinarAt();
  const when = webinarWhenLabel(at);

  return (
    <main className="min-h-screen text-slate-100">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
        <div className="absolute inset-0 bg-hero-glow" aria-hidden />
        <div className="relative mx-auto max-w-2xl px-6 pb-16 pt-20 text-center sm:pt-28">
          <div
            className="mb-4 text-xs uppercase tracking-wider text-cyan-300/70"
            style={{ fontFamily: MONO_FONT }}
          >
            Seat saved
          </div>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            You&apos;re registered.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-slate-300">
            Your training seat is saved. Check your email for the webinar link from
            chase@aipocketagent.com.
          </p>
          <p className="mt-6 text-sm text-cyan-300/80" style={{ fontFamily: MONO_FONT }}>
            [ {when} ]
          </p>

          <div className="mt-8 flex flex-col items-center gap-4">
            <AddToCalendar
              startIso={at ? at.toISOString() : null}
              durationMinutes={WEBINAR_DURATION_MINUTES}
              title={WEBINAR_TITLE}
              description={`Join the training: ${webinarJoinUrl()}`}
              url={webinarJoinUrl()}
            />
            <Link
              href="https://aipocketagent.com"
              className="text-sm text-slate-400 transition hover:text-slate-100"
            >
              Visit aipocketagent.com
            </Link>
          </div>

          <p className="mt-6 text-sm text-slate-500">
            The training is called {WEBINAR_TITLE}.
          </p>
        </div>
      </section>

      {/* BEFORE THE TRAINING */}
      <section className="border-b border-white/5">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Before the training, do this:</h2>
          <div className="mt-8 space-y-5">
            {BEFORE.map((b, i) => (
              <div key={b.title} className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <span
                  className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent"
                  style={{ fontFamily: MONO_FONT }}
                >
                  {i + 1}
                </span>
                <div>
                  <div className="font-semibold text-slate-100">{b.title}</div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">{b.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REMINDER */}
      <section className="border-b border-white/5">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Watch for the reminder emails.</h2>
          <div className="mt-5 space-y-2 text-slate-300">
            <p>Your training link and reminders will come from: chase@aipocketagent.com</p>
            <p>Training domain: aipocketagent.com</p>
            <p>App domain after purchase: app.aipocketagent.com</p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
