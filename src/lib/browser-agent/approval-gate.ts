// approval-gate.ts — the pure classifier that decides whether a planned browser action is
// irreversible and must stage a Mission Control card before it runs (the PA principle: the
// agent drafts, the owner approves). Read-only navigation, screenshots, scrolls, and reads
// pass through without a card.
//
// "Irreversible" (Browser Agent SPEC):
//   1. any form submission (submit control click, or Enter inside a form)
//   2. any purchase / checkout control
//   3. any delete / remove / unsubscribe control
//   4. any authentication — credentials are NEVER auto-entered; the card asks the owner
//   5. any navigation to a new registrable domain (basic sanity gate)
//
// Pure function on (action, element-under-cursor, current/target URLs) — unit-tested with no
// browser, no network.

import { domainOf } from "@/lib/browser/domains";
import type { ElementInfo, PlannedAction } from "./types";

export type ApprovalDecision =
  | { requiresApproval: false }
  | { requiresApproval: true; reason: string };

// Controls whose visible text / label marks a purchase or checkout.
const PURCHASE_RE =
  /\b(buy( now)?|purchase|checkout|check out|place (your )?order|order now|pay( now)?|complete (order|purchase)|subscribe now|add payment)\b/i;

// Controls that destroy or detach something.
const DESTRUCTIVE_RE =
  /\b(delete|remove|unsubscribe|deactivate|cancel (subscription|account|order|plan)|close account|revoke)\b/i;

// Controls that submit a form even when the element isn't a literal <input type=submit>.
const SUBMIT_TEXT_RE =
  /\b(submit|send|apply now|sign up|register|create account|save changes|post|publish|confirm)\b/i;

// Authentication surfaces.
const AUTH_TEXT_RE = /\b(sign in|log ?in|authenticate|continue with (google|microsoft|apple|facebook))\b/i;

function elementText(el: ElementInfo): string {
  return [el.text, el.ariaLabel ?? "", el.href ?? ""].join(" ").slice(0, 400);
}

function isSubmitControl(el: ElementInfo): boolean {
  if (el.inputType === "submit" || el.inputType === "image") return true;
  // A <button> inside a form defaults to type=submit — clicking it submits.
  if (el.tag === "button" && el.inForm && el.inputType !== "button" && el.inputType !== "reset") {
    return true;
  }
  return SUBMIT_TEXT_RE.test(elementText(el));
}

function isCredentialField(el: ElementInfo): boolean {
  if (el.isPasswordField || el.inputType === "password") return true;
  const auto = (el.autocomplete ?? "").toLowerCase();
  return auto.includes("username") || auto.includes("current-password") || auto.includes("new-password");
}

/**
 * The gate. `element` is the hit-tested element under the action's coordinate (null when the
 * driver couldn't resolve one — unknown targets fail toward the card for click/type).
 */
export function classifyActionForApproval(params: {
  action: PlannedAction;
  element: ElementInfo | null;
  currentUrl: string;
}): ApprovalDecision {
  const { action, element, currentUrl } = params;

  switch (action.kind) {
    case "screenshot":
    case "scroll":
    case "wait":
      return { requiresApproval: false };

    case "navigate": {
      const from = domainOf(currentUrl);
      const to = domainOf(action.url);
      if (from && to && from !== to) {
        return {
          requiresApproval: true,
          reason: `Leaves ${from} for ${to} — new domains need your OK.`,
        };
      }
      return { requiresApproval: false };
    }

    case "key": {
      const key = action.text.toLowerCase();
      const submits = key === "return" || key === "enter" || key.endsWith("+return") || key.endsWith("+enter");
      if (submits && element?.inForm) {
        return {
          requiresApproval: true,
          reason: "Pressing Enter here submits the form.",
        };
      }
      return { requiresApproval: false };
    }

    case "type": {
      if (!element) {
        return { requiresApproval: false };
      }
      if (isCredentialField(element)) {
        return {
          requiresApproval: true,
          reason: "This is a sign-in field. Your agent never enters credentials on its own.",
        };
      }
      return { requiresApproval: false };
    }

    case "click": {
      if (!element) {
        // Can't see what's under the cursor — a blind click could be any of the gated
        // controls, so it fails toward the card.
        return {
          requiresApproval: true,
          reason: "Could not identify the control under this click.",
        };
      }
      const text = elementText(element);
      if (isCredentialField(element) || AUTH_TEXT_RE.test(text)) {
        return {
          requiresApproval: true,
          reason: "This click starts a sign-in. Your agent never authenticates on its own.",
        };
      }
      if (PURCHASE_RE.test(text)) {
        return {
          requiresApproval: true,
          reason: "This looks like a purchase or checkout step.",
        };
      }
      if (DESTRUCTIVE_RE.test(text)) {
        return {
          requiresApproval: true,
          reason: "This control deletes, removes, or unsubscribes something.",
        };
      }
      if (isSubmitControl(element)) {
        return {
          requiresApproval: true,
          reason: "This click submits a form.",
        };
      }
      return { requiresApproval: false };
    }
  }
}
