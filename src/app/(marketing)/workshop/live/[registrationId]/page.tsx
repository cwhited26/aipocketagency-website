// /workshop/live/[registration_id] — the workshop player shell (PA-POS-38 §24.4). Behavior in
// the client component; the registration id is the capability.

import type { Metadata } from "next";
import { PlayerClient } from "./PlayerClient";

export const metadata: Metadata = {
  title: "Live — The Business Brain Workshop",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default function WorkshopLivePage({
  params,
}: {
  params: { registrationId: string };
}) {
  return <PlayerClient registrationId={params.registrationId} />;
}
