// lib/workshop/provision.ts — what the workshop webhook does when a $97 checkout completes
// (PA-POS-38 §24.4). The SHIPPED subscription.created handler on the main webhook provisions the
// workspace itself (account resolution, pro tier, login link, onboarding emails, Launch Kit) —
// the subscription metadata carries source=pocket_agent on purpose. This module layers the
// workshop-specific work on top:
//
//   1. stamp the registration with the Stripe customer + resolved owner
//   2. ledger the Fast-Start bump if it rode the invoice
//   3. enqueue the 4-email pre-session sequence anchored to the chosen slot
//   4. stamp trial_source='workshop' on the subscription row (best-effort analytics)
//   5. Skool add — NOT automated (no Skool API integration exists in this codebase); the invite
//      link rides the confirmation email + thank-you page. Logged so the gap is visible.
//
// Injected `deps` default to the real implementations; tests swap them without network.

import { enqueueWorkshop } from "@/lib/emails/enqueue";
import { resolveOrCreatePocketAgentUser } from "@/lib/auth-admin";
import {
  getWorkshopRegistration,
  insertWorkshopBumpPurchase,
  patchWorkshopRegistration,
  stampTrialSourceWorkshop,
} from "./db";
import { WORKSHOP_BUMP_CENTS, WORKSHOP_BUMP_SLUG } from "./product";

const SITE_ORIGIN = "https://aipocketagent.com";

export type WorkshopCheckoutSessionLike = {
  id: string;
  customer: string | null;
  metadata: Record<string, string> | null;
};

export type ProvisionDeps = {
  getRegistration: typeof getWorkshopRegistration;
  patchRegistration: typeof patchWorkshopRegistration;
  insertBump: typeof insertWorkshopBumpPurchase;
  stampTrialSource: typeof stampTrialSourceWorkshop;
  resolveOrCreateUser: typeof resolveOrCreatePocketAgentUser;
  enqueueEmails: typeof enqueueWorkshop;
  log: (message: string, fields: Record<string, unknown>) => void;
};

const defaultDeps: ProvisionDeps = {
  getRegistration: getWorkshopRegistration,
  patchRegistration: patchWorkshopRegistration,
  insertBump: insertWorkshopBumpPurchase,
  stampTrialSource: stampTrialSourceWorkshop,
  resolveOrCreateUser: resolveOrCreatePocketAgentUser,
  enqueueEmails: enqueueWorkshop,
  log: (message, fields) => console.error(message, fields),
};

export function workshopLobbyUrl(registrationId: string): string {
  return `${SITE_ORIGIN}/workshop/lobby/${registrationId}`;
}

/** "Tuesday, July 7 at 1:00 PM (CDT)" in the attendee's own timezone. */
export function formatSlotDisplay(slotAtIso: string, timezone: string): string {
  const t = Date.parse(slotAtIso);
  if (!Number.isFinite(t)) return slotAtIso;
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(t);
  } catch {
    return new Date(t).toUTCString();
  }
}

export type ProvisionOutcome =
  | { ok: true; registrationId: string; ownerId: string | null; emailsEnqueued: number }
  | { ok: false; error: string };

export async function handleWorkshopCheckoutCompleted(
  session: WorkshopCheckoutSessionLike,
  deps: ProvisionDeps = defaultDeps,
  nowMs: number = Date.now(),
): Promise<ProvisionOutcome> {
  const registrationId = session.metadata?.registration_id;
  if (!registrationId) {
    deps.log("[workshop/webhook] completed session missing registration_id", {
      session_id: session.id,
    });
    return { ok: false, error: "missing registration_id metadata" };
  }

  const reg = await deps.getRegistration(registrationId);
  if (!reg.ok) {
    deps.log("[workshop/webhook] registration lookup failed", {
      registration_id: registrationId,
      status: reg.status,
      error: reg.error,
    });
    return { ok: false, error: reg.error };
  }
  if (!reg.data) {
    deps.log("[workshop/webhook] registration not found", { registration_id: registrationId });
    return { ok: false, error: "registration not found" };
  }
  const registration = reg.data;

  // Idempotency: a Stripe retry re-delivers the completed event. The session stamp is the marker —
  // if this session already stamped the registration, the work below already ran.
  if (registration.stripe_session_id === session.id) {
    return { ok: true, registrationId, ownerId: registration.owner_id, emailsEnqueued: 0 };
  }

  // Resolve (or create) the buyer's account — the same pay-first path the main webhook uses; both
  // sides calling it is safe (create-first, probe-on-conflict).
  let ownerId: string | null = registration.owner_id;
  if (!ownerId) {
    const resolved = await deps.resolveOrCreateUser(registration.email);
    if (resolved.ok) {
      ownerId = resolved.user.userId;
    } else {
      deps.log("[workshop/webhook] account resolution failed (main webhook will retry it)", {
        registration_id: registrationId,
        status: resolved.status,
        error: resolved.error,
      });
    }
  }

  const patch = await deps.patchRegistration(registrationId, {
    ...(ownerId ? { owner_id: ownerId } : {}),
    ...(session.customer ? { stripe_customer_id: session.customer } : {}),
    stripe_session_id: session.id,
  });
  if (!patch.ok) {
    deps.log("[workshop/webhook] registration stamp failed", {
      registration_id: registrationId,
      status: patch.status,
      error: patch.error,
    });
    return { ok: false, error: patch.error };
  }

  // The Fast-Start bump ledger row, when the checkbox rode the invoice.
  if (session.metadata?.bump_fast_start_brain_import === "true") {
    const bump = await deps.insertBump({
      registrationId,
      stripeLineItemId: null,
      productSlug: WORKSHOP_BUMP_SLUG,
      amountCents: WORKSHOP_BUMP_CENTS,
    });
    if (!bump.ok) {
      deps.log("[workshop/webhook] bump ledger failed", {
        registration_id: registrationId,
        status: bump.status,
        error: bump.error,
      });
    }
  }

  // trial_source stamp — analytics for the /admin/workshop funnel, never blocking.
  const stamp = await deps.stampTrialSource(registration.email);
  if (!stamp.ok) {
    deps.log("[workshop/webhook] trial_source stamp failed (subscription row may not exist yet)", {
      registration_id: registrationId,
      status: stamp.status,
    });
  }

  // Skool: no API integration exists — the invite is a link in the confirmation email + thank-you
  // page, and Chase approves members in Skool itself. Logged so the manual step stays visible.
  deps.log("[workshop/webhook] skool add is manual (no Skool API) — invite link rides the emails", {
    registration_id: registrationId,
  });

  const enqueue = await deps.enqueueEmails(
    { ownerId, email: registration.email, firstName: registration.name },
    Date.parse(registration.chosen_slot_at),
    {
      lobbyUrl: workshopLobbyUrl(registrationId),
      slotDisplay: formatSlotDisplay(registration.chosen_slot_at, registration.timezone),
      bump: session.metadata?.bump_fast_start_brain_import === "true",
    },
    nowMs,
  );
  if (!enqueue.ok) {
    deps.log("[workshop/webhook] pre-session email enqueue failed", {
      registration_id: registrationId,
      error: enqueue.error,
    });
    return { ok: false, error: enqueue.error };
  }

  return { ok: true, registrationId, ownerId, emailsEnqueued: enqueue.count };
}
