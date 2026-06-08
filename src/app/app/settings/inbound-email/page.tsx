import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ensureInboundAddresses } from "@/lib/inbound-email/addresses";
import { INBOUND_DOMAIN, BCC_DOMAIN } from "@/lib/inbound-email/parse";
import { listInboundLog } from "@/lib/inbound-email/log";
import InboundEmailPrivacyClient, {
  type PrivacyEntry,
} from "./InboundEmailPrivacyClient";

export const dynamic = "force-dynamic";

function toPrivacyEntries(
  rows: {
    id: string;
    address_kind: "inbound" | "bcc";
    from_addr: string;
    subject: string | null;
    received_at: string;
    brain_path: string | null;
    status: PrivacyEntry["status"];
  }[],
): PrivacyEntry[] {
  return rows.map((r) => ({
    id: r.id,
    addressKind: r.address_kind,
    fromAddr: r.from_addr,
    subject: r.subject,
    receivedAt: r.received_at,
    brainPath: r.brain_path,
    status: r.status,
  }));
}

export default async function InboundEmailPrivacyPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const seedName =
    (user.user_metadata?.user_name as string | undefined) ?? user.email?.split("@")[0] ?? "owner";
  const addressesResult = await ensureInboundAddresses(user.id, seedName);
  const inboundLocal = addressesResult.ok
    ? addressesResult.data.find((a) => a.kind === "inbound")?.local_part ?? null
    : null;
  const bccLocal = addressesResult.ok
    ? addressesResult.data.find((a) => a.kind === "bcc")?.local_part ?? null
    : null;
  const inboundAddress = inboundLocal ? `${inboundLocal}@${INBOUND_DOMAIN}` : null;
  const bccAddress = bccLocal ? `${bccLocal}@${BCC_DOMAIN}` : null;

  const [inboundLog, bccLog] = await Promise.all([
    listInboundLog(user.id, { kind: "inbound", limit: 30 }),
    listInboundLog(user.id, { kind: "bcc", limit: 30 }),
  ]);
  const inboundEntries = inboundLog.ok ? toPrivacyEntries(inboundLog.data) : [];
  const bccEntries = bccLog.ok ? toPrivacyEntries(bccLog.data) : [];

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-lg mx-auto px-6 py-10 space-y-8">
        <div>
          <a
            href="/app/settings/connections"
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
          >
            ← Connections
          </a>
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mt-3 mb-1">
            Inbound email · privacy
          </div>
          <h1 className="text-2xl font-bold text-slate-100">What your agent received by email</h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Everything that landed on your two email addresses. Purge any entry to hard-delete the
            copy your agent saved to your brain — and stop watching for a reply if it was a BCC.
          </p>
        </div>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Forwarded to act on</h2>
            <p className="text-xs text-slate-500 mt-1 font-mono break-all">
              {inboundAddress ?? "not provisioned"}
            </p>
          </div>
          <InboundEmailPrivacyClient initial={inboundEntries} />
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100">BCC’d to be aware</h2>
            <p className="text-xs text-slate-500 mt-1 font-mono break-all">
              {bccAddress ?? "not provisioned"}
            </p>
          </div>
          <InboundEmailPrivacyClient initial={bccEntries} />
        </section>
      </div>
    </div>
  );
}
