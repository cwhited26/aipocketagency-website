// /workshop/oto/1?session=<stripe_session_id> — OTO 1, the $997 Done-With-You Setup Sprint
// (PA-POS-38 §24.3). Full-screen, one yes / one no. Yes charges the saved payment method and
// goes to the thank-you page; no advances to OTO 2 (§24.3: OTO 2 is for OTO 1 decliners).

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WORKSHOP_COPY } from "@/lib/workshop/copy";
import { OtoDecision } from "../OtoDecision";

export const metadata: Metadata = {
  title: "One-time offer — The Business Brain Workshop",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default function WorkshopOto1Page({
  searchParams,
}: {
  searchParams: { session?: string };
}) {
  const sessionId = searchParams.session ?? "";
  if (!sessionId) redirect("/workshop");

  return (
    <OtoDecision
      oto={1}
      sessionId={sessionId}
      copy={WORKSHOP_COPY.oto1}
      nextOnYes={`/workshop/thanks?session=${encodeURIComponent(sessionId)}`}
      nextOnNo={`/workshop/oto/2?session=${encodeURIComponent(sessionId)}`}
    />
  );
}
