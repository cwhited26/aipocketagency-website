// inbox-affordances.ts — the single source of truth for what buttons each Inbox
// item kind is allowed to show.
//
// The rule this encodes: affordances must be honest about the primitive. An
// `action_approval` only fires on Approve, so it gets Approve. A Daily Brief is an
// *output* — nothing happens if the user never taps — so it must NEVER show Approve
// or Reject. Putting Approve on an informational item lies about what it is.
//
// `affordancesFor` is an exhaustive switch with a `never` check: adding a new
// InboxItemKind without giving it an affordance set is a compile error. The Inbox
// card renderer and the affordance unit test both read from here, so the buttons a
// user sees can never silently drift from the buttons we test.

export type InboxItemKind =
  | "draft"
  | "decision"
  | "email_triage"
  | "persona_lead"
  | "action_approval"
  | "sub_agent_activity"
  | "routine_output"
  | "lead_scout_batch"
  | "build_action_approval"
  | "cost_budget_gate"
  | "skill_evolution_proposal"
  | "gate_findings";

export type AffordanceRole = "primary" | "secondary" | "destructive";

export type Affordance = {
  /** Stable identifier — what the renderer and tests key off (never user-facing copy). */
  key: string;
  /** User-visible button label. */
  label: string;
  role: AffordanceRole;
};

export type AffordanceSet = {
  /**
   * True when the primary affordance commits an external or otherwise irreversible
   * write that only happens BECAUSE the user approved it — sending an email, firing a
   * connector write-action, committing an owner-approved plan. Informational kinds
   * (routine_output, sub_agent_activity) are false: nothing fires either way.
   */
  hasApproval: boolean;
  affordances: Affordance[];
};

// Affordance keys that represent a commit-on-approve action. No informational kind
// may include one of these — `isInformational` enforces it and the test asserts it.
const APPROVAL_KEYS = new Set(["approve", "reject"]);

export function affordancesFor(kind: InboxItemKind): AffordanceSet {
  switch (kind) {
    // Connector write-action a sub-agent staged. The blocked tool call fires only on
    // Approve. Edit lets the user tweak the payload first.
    case "action_approval":
      return {
        hasApproval: true,
        affordances: [
          { key: "approve", label: "Approve", role: "primary" },
          { key: "edit", label: "Edit", role: "secondary" },
          { key: "reject", label: "Reject", role: "destructive" },
        ],
      };

    // A BUILD connector write-action a sub-agent staged (create repo, push code, branch, PR).
    // Same commit-on-approve primitive as action_approval — the build fires only on Approve, and
    // the human reads the diff first. push_files in particular can never auto-approve (SPEC §11).
    case "build_action_approval":
      return {
        hasApproval: true,
        affordances: [
          { key: "approve", label: "Approve", role: "primary" },
          { key: "edit", label: "Edit", role: "secondary" },
          { key: "reject", label: "Reject", role: "destructive" },
        ],
      };

    // An email / message draft PA produced. Approving sends it live.
    case "draft":
      return {
        hasApproval: true,
        affordances: [
          { key: "approve", label: "Approve & send", role: "primary" },
          { key: "edit", label: "Edit", role: "secondary" },
          { key: "reject", label: "Reject", role: "destructive" },
        ],
      };

    // A Project Scaffolding plan the owner approves before PA dispatches lanes.
    case "decision":
      return {
        hasApproval: true,
        affordances: [
          { key: "approve", label: "Approve plan", role: "primary" },
          { key: "reject", label: "Reject", role: "destructive" },
        ],
      };

    // Incoming email to triage. No "approve" — the user handles, drafts a reply, or
    // archives. (Approving a drafted reply happens on the inline draft card, not here.)
    case "email_triage":
      return {
        hasApproval: false,
        affordances: [
          { key: "draft_reply", label: "Draft me a reply", role: "primary" },
          { key: "handle", label: "I'll handle", role: "secondary" },
          { key: "archive", label: "Archive", role: "destructive" },
        ],
      };

    // A captured persona lead. Surfaced and managed on the Personas surface, not in
    // the approval queue — no affordances render here.
    case "persona_lead":
      return { hasApproval: false, affordances: [] };

    // A Skill write the LEARN phase proposes (new technique or an update to an existing one,
    // PA-SKILL-3). Approving WRITES a versioned SKILL.md to the owner's brain — a commit-on-approve
    // primitive — so it carries Approve / Edit / Reject. Edit lets the owner tweak the technique
    // before it's saved; Reject feeds back so PA doesn't re-propose it.
    case "skill_evolution_proposal":
      return {
        hasApproval: true,
        affordances: [
          { key: "approve", label: "Approve", role: "primary" },
          { key: "edit", label: "Edit", role: "secondary" },
          { key: "reject", label: "Reject", role: "destructive" },
        ],
      };

    // Sub-agent progress card. Informational — dismissible, never approvable.
    case "sub_agent_activity":
      return {
        hasApproval: false,
        affordances: [{ key: "dismiss", label: "Dismiss", role: "secondary" }],
      };

    // Routine output (Daily Brief, Weekly Digest, Follow-up Sweep summary). An output,
    // not an action. Read it, optionally keep it, move on. NO Approve, NO Reject.
    case "routine_output":
      return {
        hasApproval: false,
        affordances: [
          { key: "mark_read", label: "Mark as read", role: "primary" },
          { key: "save_to_brain", label: "Save to brain", role: "secondary" },
          { key: "dismiss", label: "Dismiss", role: "destructive" },
        ],
      };

    // A finished Lead Scout batch — the leads are already saved to the brain + the run page. This
    // card is the readout (counts + CSV + a Phase-3 "draft outreach" hook), so it's informational:
    // Mark as read / Dismiss. NO Approve — nothing fires on tap, the scrape already ran.
    case "lead_scout_batch":
      return {
        hasApproval: false,
        affordances: [
          { key: "mark_read", label: "Mark as read", role: "primary" },
          { key: "dismiss", label: "Dismiss", role: "destructive" },
        ],
      };

    // The over-budget gate (PA-COST-14). The dispatcher paused new agent runs because the owner hit
    // their monthly cost cap. Nothing fires on tap — raising the cap (which actually un-gates) happens
    // in Settings → Budget, so this is informational: "Raise the cap" links there, "Wait until next
    // period" clears the card and lets runs resume on their own at the period reset.
    case "cost_budget_gate":
      return {
        hasApproval: false,
        affordances: [
          { key: "raise_cap", label: "Raise the cap", role: "primary" },
          { key: "wait", label: "Wait until next period", role: "secondary" },
        ],
      };

    // A held Project plan its specialist gates flagged or blocked (PA-GATE-9). The owner's real
    // choices are Revise (send the plan back to be rewritten — the normal path) or Reject (kill the
    // Project). "Approve anyway" overrides the flags and fires — but it's gated per-gate behind the
    // trust window, so the gate card renders it conditionally itself rather than always offering it
    // here. hasApproval=true: the plan fires ONLY because the owner decided here.
    case "gate_findings":
      return {
        hasApproval: true,
        affordances: [
          { key: "revise", label: "Revise plan", role: "primary" },
          { key: "approve_anyway", label: "Approve anyway", role: "secondary" },
          { key: "reject_plan", label: "Reject plan", role: "destructive" },
        ],
      };

    default: {
      // Exhaustiveness guard — a new InboxItemKind without an affordance set fails the
      // type-check right here, forcing this file to be updated before it can ship.
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/**
 * True for kinds that are pure outputs the user reads and clears — never an action
 * that fires on approval. Such kinds must carry no approve/reject affordance; this
 * is the invariant the affordance test pins.
 */
export function isInformational(kind: InboxItemKind): boolean {
  const set = affordancesFor(kind);
  return !set.hasApproval && !set.affordances.some((a) => APPROVAL_KEYS.has(a.key));
}
