// /workshop/lobby/[registration_id] — the pre-workshop lobby shell (PA-POS-38 §24.4). All the
// behavior lives in the client component; the registration id is the capability.

import type { Metadata } from "next";
import { LobbyClient } from "./LobbyClient";

export const metadata: Metadata = {
  title: "Workshop lobby — The Business Brain Workshop",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default function WorkshopLobbyPage({
  params,
}: {
  params: { registrationId: string };
}) {
  return <LobbyClient registrationId={params.registrationId} />;
}
