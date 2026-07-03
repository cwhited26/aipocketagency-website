// migrate.ts — the §22.1 step-8 signup handoff. Stripe's checkout.session.completed with
// metadata.trial_thread_id lands here: resolve-or-create the permanent account from the
// checkout email, write the pocket_agent_subscriptions row (so the price-keyed tier
// provisioning finds it), send the login link, and migrate the trial thread — the composed
// Persona plus the accumulated Business Brain facts become ONE agent_builder_proposal card in
// the new owner's Inbox (the shipped PA-POS-27 approval surface), because the repo push needs
// the owner's own GitHub connection, which can't exist before their first login. Then Poc
// welcomes the owner back on the WhatsApp thread and the thread keeps working in converted
// mode.

import { resolveOrCreatePocketAgentUser } from "@/lib/auth-admin";
import { sendPocketAgentLoginLink } from "@/lib/pocket-agent-login-link";
import { upsertPocketAgentTrial } from "@/lib/pocket-agent-supabase";
import { createAgentBuild } from "@/lib/agent-builder/db";
import { stageAgentBuildApproval } from "@/lib/agent-builder/stage-approval";
import type { ComposedAgent } from "@/lib/agent-builder/types";
import { coldWhatsappConfig } from "./config";
import { fetchTrialThreadByThreadId, fetchTrialThreadByOwner, updateTrialThread } from "./db";
import { readConversationState } from "./handler";
import { sendColdOutbound } from "./outbound";
import { pocWelcomeBack } from "./poc-voice";
import { COOLOFF_DAYS_AFTER_CANCEL, type TrialComposed } from "./types";
import { coldLog } from "./log";
import { hashPhoneForLog } from "./phone";

// ── Session/subscription slices (Zod-free: the webhook route already parsed the event JSON;
//    these are the fields this module reads, typed narrowly) ─────────────────────────────────

export type TrialCheckoutSession = {
  id: string;
  customer: string | null;
  customer_email: string | null;
  customer_details?: { email?: string | null } | null;
  subscription: string | null;
  metadata: Record<string, string> | null;
};

/** Rebuild a full ComposedAgent from the stored trial profile. Brain scopes stay empty —
 *  the owner grants zones when they approve the card in their own workspace. */
export function composedAgentFromTrial(
  buildId: string,
  trial: TrialComposed,
  facts: readonly string[],
): ComposedAgent {
  const customFields = { ...trial.customFields };
  if (facts.length > 0) {
    customFields.trial_context = facts.map((f) => `- ${f}`).join("\n");
  }
  return {
    buildId,
    specText: trial.specText,
    intent: trial.intent,
    personaTemplateKey: trial.personaTemplateKey,
    personaName: trial.personaName,
    personaSlug: trial.personaSlug,
    tone: trial.tone,
    starterPrompt: trial.starterPrompt,
    customFields,
    apps: trial.apps,
    skillSlugs: trial.skillSlugs,
    brainScopes: [],
    schedule: trial.intent.schedule,
    candidateSkill: null,
  };
}

/**
 * checkout.session.completed with metadata.trial_thread_id. Idempotent on the thread status:
 * a Stripe redelivery against an already-converted thread no-ops.
 */
export async function handleWhatsappTrialCheckoutCompleted(
  session: TrialCheckoutSession,
): Promise<void> {
  const threadId = session.metadata?.trial_thread_id ?? null;
  if (!threadId) {
    coldLog.error("trial migration: session missing trial_thread_id", { sessionId: session.id });
    return;
  }

  const threadRes = await fetchTrialThreadByThreadId(threadId);
  if (!threadRes.ok || !threadRes.data) {
    coldLog.error("trial migration: thread not found", { threadId, sessionId: session.id });
    return;
  }
  const thread = threadRes.data;
  const sender = hashPhoneForLog(thread.sender_phone);

  if (thread.status === "converted" && thread.converted_to_owner_id) {
    coldLog.info("trial migration: already converted — redelivery ignored", { sender });
    return;
  }

  const email = session.customer_details?.email ?? session.customer_email;
  if (!email) {
    coldLog.error("trial migration: no email on session", { sender, sessionId: session.id });
    return;
  }

  // 1. The permanent account (idempotent: create-first, probe-on-conflict).
  const resolved = await resolveOrCreatePocketAgentUser(email);
  if (!resolved.ok) {
    coldLog.error("trial migration: account resolve failed", {
      sender,
      status: resolved.status,
    });
    return;
  }
  const ownerId = resolved.user.userId;

  // 2. The subscription row — the price-keyed tier provisioning on
  //    customer.subscription.created finds this and applies the Starter tier.
  if (session.customer && session.subscription) {
    const now = new Date();
    const upserted = await upsertPocketAgentTrial({
      email,
      name: null,
      userId: ownerId,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      stripeSessionId: session.id,
      trialStartedAt: now.toISOString(),
      trialEndsAt: null,
    });
    if (!upserted.ok) {
      coldLog.error("trial migration: subscription row upsert failed", {
        sender,
        status: upserted.status,
      });
    }
  }

  // 3. The login link — the owner's way into the workspace where the approval card waits.
  const login = await sendPocketAgentLoginLink(email);
  if (!login.ok) {
    coldLog.error("trial migration: login link send failed", { sender, error: login.error });
  }

  // 4. Migrate the composed Persona + accumulated facts into ONE approval card.
  const state = readConversationState(thread, sender);
  if (state.composed) {
    const build = await createAgentBuild({
      ownerId,
      workspaceId: null,
      specText: state.composed.specText,
    });
    if (build.ok) {
      const staged = await stageAgentBuildApproval({
        ownerId,
        composed: composedAgentFromTrial(build.data.id, state.composed, state.facts),
      });
      if (!staged.ok) {
        coldLog.error("trial migration: approval card staging failed", {
          sender,
          error: staged.error,
        });
      }
    } else {
      coldLog.error("trial migration: build row create failed", { sender, error: build.error });
    }
  } else {
    coldLog.warn("trial migration: no composed agent on thread — account only", { sender });
  }

  // 5. Mark the thread converted (the WhatsApp thread continues as a surface).
  const marked = await updateTrialThread(thread.sender_phone, {
    status: "converted",
    converted_to_owner_id: ownerId,
    last_active_at: new Date().toISOString(),
  });
  if (!marked.ok) {
    coldLog.error("trial migration: thread mark failed", { sender, status: marked.status });
  }

  // 6. Poc welcomes the owner back on the thread.
  const config = coldWhatsappConfig();
  if (config && state.composed) {
    await sendColdOutbound(config, thread.sender_phone, [
      { kind: "text", text: pocWelcomeBack(state.composed.personaName) },
    ]);
  }

  coldLog.info("trial thread migrated to permanent workspace", { sender });
}

/**
 * customer.subscription.deleted for an owner who came in through a trial thread: start the
 * §22.4 seven-day cool-off so cancel → re-trial isn't a free loop.
 */
export async function applyWhatsappTrialCooloffOnCancel(args: {
  ownerId: string | null;
}): Promise<void> {
  if (!args.ownerId) return;
  const threadRes = await fetchTrialThreadByOwner(args.ownerId);
  if (!threadRes.ok || !threadRes.data) return;
  const thread = threadRes.data;

  const until = new Date();
  until.setDate(until.getDate() + COOLOFF_DAYS_AFTER_CANCEL);
  const marked = await updateTrialThread(thread.sender_phone, {
    status: "expired",
    cooloff_until: until.toISOString(),
  });
  if (!marked.ok) {
    coldLog.error("trial cooloff mark failed", {
      sender: hashPhoneForLog(thread.sender_phone),
      status: marked.status,
    });
    return;
  }
  coldLog.info("trial cooloff applied after cancel", {
    sender: hashPhoneForLog(thread.sender_phone),
  });
}
