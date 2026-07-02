// lib/pocket-agent-signup.ts — the pure decision at the center of the pay-first flow.
//
// customer.subscription.created fires for three kinds of buyer, and each wants different post-subscribe
// side effects. This function isolates that branching from the webhook's I/O so it's unit-testable:
//
//   1. Logged-in at checkout (metaUserId set) — already has a session and had the Launch Kit seeded on
//      checkout.session.completed. Nothing extra: no login email, no reseed, no alert.
//   2. Pay-first, brand-new email (anonymous, account created this run) — seed the Launch Kit and email
//      a login link. This is the account the pay-first funnel exists to create.
//   3. Pay-first onto an existing email (anonymous, account already existed) — free-then-pay or a repeat
//      purchase. Link + login link + (idempotent) seed, and if they already had an active/trial
//      subscription, alert the operator: a second paid subscription on one email may be a mistake or fraud.

export type SignupContext = {
  // Supabase user id carried in the subscription metadata — present only when the buyer was signed in
  // at checkout. Null on the pay-first path.
  metaUserId: string | null;
  // Did resolving the auth user CREATE it on this webhook run (vs. it already existing)?
  wasCreated: boolean;
  // Did an active/trial Pocket Agent subscription already exist for this email BEFORE this event?
  hadPriorActiveSub: boolean;
};

export type SignupSideEffects = {
  // Email the buyer a magic link — they finished checkout without a browser session.
  sendLoginLink: boolean;
  // (Idempotent) Launch Kit seed for the resolved user.
  seedLaunchKit: boolean;
  // Operator alert, or null when nothing is off.
  notifyOperator: "double_buy" | null;
  // Analytics: the account was created by the pay-first path on this run.
  anonymousSignup: boolean;
};

export function decideSignupSideEffects(ctx: SignupContext): SignupSideEffects {
  // Case 1 — a signed-in buyer keeps the existing behavior untouched.
  if (ctx.metaUserId) {
    return {
      sendLoginLink: false,
      seedLaunchKit: false,
      notifyOperator: null,
      anonymousSignup: false,
    };
  }

  // Cases 2 & 3 — pay-first. Always send the login link and (idempotently) seed the Launch Kit, which
  // also closes the free-then-pay gap where the account existed but never carried a paid seed. Alert
  // the operator only when a live subscription already existed for this email (possible double-charge).
  return {
    sendLoginLink: true,
    seedLaunchKit: true,
    notifyOperator: ctx.hadPriorActiveSub ? "double_buy" : null,
    anonymousSignup: ctx.wasCreated,
  };
}
