// /workshop/thanks?session=<stripe_session_id> — the dynamic thank-you page (PA-POS-38 §24.3
// step 4). Branches on what they bought: workspace login, Skool invite, the Setup Sprint
// calendar link when OTO 1 was taken, and the lobby note. Service-role reads; force-dynamic.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/marketing/site-nav";
import { MONO_FONT } from "@/components/marketing/cta";
import { SKOOL_URL } from "@/lib/constants/skool";
import {
  getWorkshopRegistrationBySession,
  listWorkshopOtoPurchases,
} from "@/lib/workshop/db";
import { formatSlotDisplay, workshopLobbyUrl } from "@/lib/workshop/provision";
import { WORKSHOP_COPY } from "@/lib/workshop/copy";

export const metadata: Metadata = {
  title: "You're in — The Business Brain Workshop",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function WorkshopThanksPage({
  searchParams,
}: {
  searchParams: { session?: string };
}) {
  const sessionId = searchParams.session ?? "";
  if (!sessionId) redirect("/workshop");

  const reg = await getWorkshopRegistrationBySession(sessionId);
  // The webhook stamps the session id within seconds of payment; if the buyer outran it, render
  // the universal branch (email + lobby note) rather than an error.
  const registration = reg.ok ? reg.data : null;
  const otos = registration ? await listWorkshopOtoPurchases(registration.id) : null;
  const otoRows = otos?.ok ? otos.data : [];
  const setupSprint = otoRows.some((o) => o.oto_number === 1 && o.status === "succeeded");
  const backstage = otoRows.some((o) => o.oto_number === 2 && o.status === "succeeded");

  return (
    <>
      <main className="min-h-screen text-slate-100">
        <section className="mx-auto max-w-2xl px-6 pb-20 pt-20">
          <div className="mb-4 inline-block text-xs text-cyan-300/70" style={{ fontFamily: MONO_FONT }}>
            [ seat reserved ]
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">{WORKSHOP_COPY.thanks.heading}</h1>
          {registration ? (
            <p className="mt-4 text-[15px] leading-relaxed text-slate-300">
              Your session:{" "}
              <span className="font-semibold text-slate-100">
                {formatSlotDisplay(registration.chosen_slot_at, registration.timezone)}
              </span>
              .
            </p>
          ) : null}
          <p className="mt-4 text-[15px] leading-relaxed text-slate-300">
            {WORKSHOP_COPY.thanks.lobbyNote}
          </p>

          <div className="mt-10 space-y-4">
            {registration ? (
              <ThanksRow
                title="Your workshop lobby"
                detail="Opens 15 minutes before your slot. Bookmark it — the same link is in your confirmation email."
                href={workshopLobbyUrl(registration.id)}
                label="Open the lobby page"
              />
            ) : null}
            <ThanksRow
              title="Your workspace"
              detail="Your 30 days of Business Agent are already provisioned. The log-in link is in your inbox — or head straight in."
              href="/app"
              label="Log in to Pocket Agent"
            />
            <ThanksRow
              title="The Skool community"
              detail="Lifetime access, including the Friday Implementation Lab. Request to join with the email you bought with."
              href={SKOOL_URL}
              label="Join the community"
            />
            {setupSprint ? (
              <ThanksRow
                title="Your Setup Sprint"
                detail="The $997 Done-With-You Sprint is booked against your account. Pick your call time — the confirmation email has the same link."
                href="/app/setup-sprint"
                label="Schedule your Sprint call"
              />
            ) : null}
            {backstage ? (
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.04] p-5">
                <p className="text-sm font-semibold text-slate-100">Backstage Pass — active.</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  Every future workshop lands in your inbox automatically. The private Skool tier
                  unlocks when you join with your purchase email.
                </p>
              </div>
            ) : null}
          </div>

          <p className="mt-10 text-sm leading-relaxed text-slate-400">
            One piece of homework before your session: a free GitHub account. Your Business Brain
            will live there, under your name. Two minutes at github.com if you don&apos;t have one.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function ThanksRow({ title, detail, href, label }: {
  title: string;
  detail: string;
  href: string;
  label: string;
}) {
  const external = href.startsWith("http");
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <p className="text-sm font-semibold text-slate-100">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">{detail}</p>
      <div className="mt-3">
        {external ? (
          <a href={href} className="text-sm font-semibold text-cyan-300 hover:underline">
            {label} →
          </a>
        ) : (
          <Link href={href} className="text-sm font-semibold text-cyan-300 hover:underline">
            {label} →
          </Link>
        )}
      </div>
    </div>
  );
}
