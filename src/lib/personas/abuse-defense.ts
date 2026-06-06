// abuse-defense.ts — server-side input screening for public + widget personas
// (SPEC v3 §9 Modes B/C; Adversarial Brief §3 a/c/d/e). This runs BEFORE the LLM call on
// every anonymous turn. Blocked input never reaches the model — the visitor gets a
// templated refusal, the turn is logged with blocked_by_containment=true, and a
// persona's owner is alerted when blocks spike (potential coordinated attack).
//
// This is defense-in-depth, NOT the only guard: ContainmentGuard still bounds every
// knowledge read at the read layer (a prompt cannot widen the zone), and the system
// prompt instructs refusal. This layer cheaply stops the well-known attack corpus before
// spending a model call on it and gives the owner an attack signal.
//
// Pure + synchronous so the full refuse-list is unit-tested in isolation
// (__tests__/abuse-defense.test.ts asserts every pattern is blocked).

export type InjectionCategory =
  | "instruction-override"
  | "system-prompt-extraction"
  | "jailbreak"
  | "role-swap"
  | "delimiter-injection"
  | "data-exfiltration";

export type InjectionPattern = {
  id: string;
  category: InjectionCategory;
  re: RegExp;
};

// Normalizes input so spacing / casing / zero-width tricks don't slip a known pattern
// past the matcher. Lowercases, strips zero-width + control chars, collapses runs of
// whitespace to a single space.
export function normalizeForScreening(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\u200b-\u200d\u2060\ufeff\u00ad]/g, "") // zero-width / soft hyphen
    .replace(/[\u0000-\u001f]/g, " ") // control chars
    .replace(/\s+/g, " ")
    .trim();
}

// 50+ known prompt-injection / extraction / jailbreak / exfiltration patterns. Each entry
// is matched against the NORMALIZED input. Patterns are deliberately broad per the brief
// ("start broad"); false positives on a public bot are acceptable — it refuses and
// redirects, which is the safe failure mode.
export const PROMPT_INJECTION_REFUSE_LIST: InjectionPattern[] = [
  // ── Instruction override ──────────────────────────────────────────────────────────
  { id: "ignore-previous", category: "instruction-override", re: /ignore (all |the |any )?(previous|prior|earlier|above)/ },
  { id: "ignore-all-instructions", category: "instruction-override", re: /ignore (all |your )?(instructions|rules|guidelines|directives)/ },
  { id: "disregard-previous", category: "instruction-override", re: /disregard (all |the |any |your )?(previous|prior|earlier|above|instructions|rules)/ },
  { id: "forget-previous", category: "instruction-override", re: /forget (all |everything|the |your )?(previous|prior|above|instructions|you were told)/ },
  { id: "override-instructions", category: "instruction-override", re: /override (your |the |all )?(instructions|rules|settings|guidelines)/ },
  { id: "new-instructions", category: "instruction-override", re: /(new|updated|the following) (instructions|rules|directives)\s*:/ },
  { id: "from-now-on", category: "instruction-override", re: /from now on,? you (are|will|must|should|can)/ },
  { id: "you-must-now", category: "instruction-override", re: /you (must|will|shall|are required to) now/ },
  { id: "stop-being", category: "instruction-override", re: /stop (being|acting as|following)/ },
  { id: "do-not-follow", category: "instruction-override", re: /do(n't| not) (follow|obey|adhere to) (your |the |any )?(instructions|rules|spec)/ },
  { id: "this-is-authorized", category: "instruction-override", re: /this (is|has been) (authorized|approved|permitted) (by the owner|by the admin)?/ },
  { id: "i-am-the-owner", category: "instruction-override", re: /i('?m| am) (the |your )?(owner|admin|administrator|developer|creator)/ },
  { id: "verified-owner", category: "instruction-override", re: /(the user is|i am) (a |the )?verified (owner|admin|user)/ },

  // ── System-prompt / config extraction ───────────────────────────────────────────
  { id: "reveal-instructions", category: "system-prompt-extraction", re: /(reveal|show|tell|give|share) (me )?(your |the )?(instructions|prompt|system prompt|directives)/ },
  { id: "what-are-instructions", category: "system-prompt-extraction", re: /what (are|were|is) your (exact |initial |original |system )?(instructions|prompt|configuration|directives)/ },
  { id: "initial-instructions", category: "system-prompt-extraction", re: /(initial|original|first|underlying) (instructions|prompt|system message)/ },
  { id: "print-system-prompt", category: "system-prompt-extraction", re: /(print|output|display|dump|echo) (your |the )?(system )?(prompt|instructions|spec|configuration)/ },
  { id: "repeat-text-above", category: "system-prompt-extraction", re: /repeat (the )?(text|words|everything|all)? ?(above|before this|preceding)/ },
  { id: "repeat-verbatim", category: "system-prompt-extraction", re: /repeat (the )?(text|message|content)? ?(verbatim|word for word|exactly)/ },
  { id: "starting-with-first-word", category: "system-prompt-extraction", re: /starting (with|from) (the )?(first|very first) word/ },
  { id: "translate-your-prompt", category: "system-prompt-extraction", re: /translate your (system )?(prompt|instructions)/ },
  { id: "finish-from-config", category: "system-prompt-extraction", re: /(finish|complete) (this )?sentence from your (configuration|instructions|prompt)/ },
  { id: "you-are-a-fill", category: "system-prompt-extraction", re: /['"]?you are a ?\.\.\.?['"]?/ },
  { id: "in-a-code-block", category: "system-prompt-extraction", re: /(your |the )(instructions|prompt|spec).*(in a code block|verbatim)/ },
  { id: "what-model", category: "system-prompt-extraction", re: /what (model|llm|version|ai) (are you|do you|powers you|is this)/ },
  { id: "reveal-tools", category: "system-prompt-extraction", re: /(list|show|what are) your (tools|functions|capabilities|commands)/ },
  { id: "containment-config", category: "system-prompt-extraction", re: /(containment|zone|privacy zone|brain-containment)/ },

  // ── Jailbreak personas / modes ────────────────────────────────────────────────────
  { id: "dan", category: "jailbreak", re: /\bd\.?a\.?n\.?\b|do anything now/ },
  { id: "developer-mode", category: "jailbreak", re: /developer mode/ },
  { id: "jailbreak", category: "jailbreak", re: /jail ?break/ },
  { id: "god-mode", category: "jailbreak", re: /god mode|sudo mode|root mode|admin mode/ },
  { id: "unrestricted", category: "jailbreak", re: /(unrestricted|unfiltered|uncensored) (mode|assistant|ai|version)/ },
  { id: "no-restrictions", category: "jailbreak", re: /(with )?no (restrictions|limits|filters|rules|guidelines|guardrails)/ },
  { id: "without-restrictions", category: "jailbreak", re: /without (any )?(restrictions|limits|filters|rules|guidelines)/ },
  { id: "bypass-filters", category: "jailbreak", re: /bypass (your |the )?(filters|safety|restrictions|guardrails)/ },
  { id: "no-longer-bound", category: "jailbreak", re: /no longer (bound|restricted|limited|constrained) by/ },
  { id: "hypothetically-anything", category: "jailbreak", re: /hypothetical(ly)?.*(no rules|anything|unrestricted)/ },

  // ── Role / persona swap ─────────────────────────────────────────────────────────
  { id: "you-are-now", category: "role-swap", re: /you are now (a |an |the )?/ },
  { id: "act-as", category: "role-swap", re: /\bact as (a |an |if )/ },
  { id: "pretend-you-are", category: "role-swap", re: /pretend (you are|to be|that you)/ },
  { id: "roleplay-as", category: "role-swap", re: /role ?play (as|a|the)/ },
  { id: "you-are-chatgpt", category: "role-swap", re: /you are (chatgpt|gpt-?\d|claude|gemini|a general (purpose )?assistant)/ },
  { id: "different-ai", category: "role-swap", re: /(act|behave) (as|like) a different (ai|assistant|model)/ },
  { id: "simulate", category: "role-swap", re: /simulate (a|an|being) (an? )?(ai|assistant|persona|character) (with|that has) no/ },

  // ── Delimiter / token injection ───────────────────────────────────────────────────
  { id: "system-tag", category: "delimiter-injection", re: /<\/?system>|<\/?\|?im_(start|end)\|?>/ },
  { id: "inst-tag", category: "delimiter-injection", re: /\[\/?inst\]/ },
  { id: "system-colon", category: "delimiter-injection", re: /(^|[\s>])system\s*:/ },
  { id: "assistant-colon-inject", category: "delimiter-injection", re: /(^|[\s>])(assistant|ai)\s*:\s*(sure|ok|here|yes)/ },
  { id: "hash-system", category: "delimiter-injection", re: /#{2,}\s*system/ },
  { id: "end-of-prompt", category: "delimiter-injection", re: /(end of (system )?prompt|---end---)/ },

  // ── Data exfiltration / cross-zone ──────────────────────────────────────────────────
  { id: "print-all-files", category: "data-exfiltration", re: /(print|output|show|list|dump|reveal) (me )?(the )?(full )?(contents of )?(every|all|each) (the )?files?/ },
  { id: "list-everything", category: "data-exfiltration", re: /(list|show|tell me|enumerate) (me )?(everything|all the (files|data|documents)) (you|that you)/ },
  { id: "everything-you-can-see", category: "data-exfiltration", re: /everything you (can )?(see|access|read|have access to)/ },
  { id: "read-private-path", category: "data-exfiltration", re: /\b(personal|finance|payroll|private)\/[\w.-]+/ },
  { id: "path-traversal", category: "data-exfiltration", re: /\.\.\/|\.\.\\/ },
  { id: "owner-private", category: "data-exfiltration", re: /(owner[- ]?private|user[- ]?private|marked private)/ },
  { id: "quote-first-line", category: "data-exfiltration", re: /quote (me )?the (first|last) line of/ },
  { id: "another-persona-zone", category: "data-exfiltration", re: /(another|other|different) persona('s)? (knowledge|zone|files)/ },
  { id: "training-data", category: "data-exfiltration", re: /(show|reveal|dump|access) (me )?your training data/ },
];

export type ScreenResult =
  | { blocked: false }
  | { blocked: true; pattern: InjectionPattern };

/**
 * Screens one visitor message against the refuse-list. Returns the first matching
 * pattern (deterministic — list order). The caller refuses + logs on a block.
 */
export function screenForInjection(input: string): ScreenResult {
  const normalized = normalizeForScreening(input);
  for (const pattern of PROMPT_INJECTION_REFUSE_LIST) {
    if (pattern.re.test(normalized)) return { blocked: true, pattern };
  }
  return { blocked: false };
}

// ── Off-topic redirector ───────────────────────────────────────────────────────────

/**
 * Builds the configurable off-topic / refusal message. Owner can override per persona via
 * persona_widget_config.off_topic_message; otherwise we fall back to a role+contact
 * template (SPEC v3 §9 Mode B "Off-topic redirector").
 */
export function offTopicRedirector(params: {
  override: string | null;
  personaRole: string;
  ownerEmail: string | null;
}): string {
  if (params.override && params.override.trim()) return params.override.trim();
  const contact = params.ownerEmail
    ? ` For other questions please contact ${params.ownerEmail}.`
    : " For other questions please reach out to the business directly.";
  return `I can only help with ${params.personaRole}.${contact}`;
}

/** The single user-facing line returned when input is blocked by the refuse-list. */
export function buildBlockedResponse(redirector: string): string {
  return redirector;
}

// Owner gets a Resend alert when blocks for a persona exceed this many in one hour —
// the signal of a coordinated probing attempt (Adversarial Brief §3).
export const BLOCKED_ALERT_THRESHOLD_PER_HOUR = 5;
