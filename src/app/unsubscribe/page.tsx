// /unsubscribe?email=&token= — the marketing-email opt-out. Verifies the HMAC token server-side; only
// a valid link shows the unsubscribe button. Transactional account/billing mail is unaffected (Part 8).

import type { Metadata } from "next";
import { verifyUnsubscribeToken } from "@/lib/emails/render";
import { UnsubscribeClient } from "./UnsubscribeClient";

export const metadata: Metadata = {
  title: "Email preferences — Pocket Agent",
  robots: { index: false },
};

export default function UnsubscribePage({
  searchParams,
}: {
  searchParams: { email?: string; token?: string };
}) {
  const email = typeof searchParams.email === "string" ? searchParams.email : "";
  const token = typeof searchParams.token === "string" ? searchParams.token : "";
  const valid = email.length > 0 && token.length > 0 && verifyUnsubscribeToken(email, token);

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-16 text-neutral-100">
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-semibold">Email preferences</h1>
        {valid ? (
          <>
            <p className="mt-4 text-neutral-300">
              You can unsubscribe <strong>{email}</strong> from onboarding and marketing emails. You will
              still get account, billing, and transactional messages — those keep coming so you never miss
              something important about your subscription.
            </p>
            <UnsubscribeClient email={email} token={token} />
          </>
        ) : (
          <p className="mt-4 text-neutral-400">
            This unsubscribe link is invalid or expired. If you want to stop marketing emails, reply to any
            email from chase@aipocketagent.com and we&apos;ll take care of it.
          </p>
        )}
      </div>
    </main>
  );
}
