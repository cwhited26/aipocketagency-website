// /workshop/oto/2?session=<stripe_session_id> — OTO 2, the $297 Backstage Pass (PA-POS-38
// §24.3). Shown only to OTO 1 decliners; yes or no lands on the thank-you page.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WORKSHOP_COPY } from "@/lib/workshop/copy";
import { OtoDecision } from "../OtoDecision";

export const metadata: Metadata = {
  title: "The Backstage Pass — The Business Brain Workshop",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default function WorkshopOto2Page({
  searchParams,
}: {
  searchParams: { session?: string };
}) {
  const sessionId = searchParams.session ?? "";
  if (!sessionId) redirect("/workshop");

  const thanks = `/workshop/thanks?session=${encodeURIComponent(sessionId)}`;
  return (
    <OtoDecision
      oto={2}
      sessionId={sessionId}
      copy={WORKSHOP_COPY.oto2}
      nextOnYes={thanks}
      nextOnNo={thanks}
    />
  );
}
