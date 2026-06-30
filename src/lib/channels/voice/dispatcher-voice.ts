// lib/channels/voice/dispatcher-voice.ts — the voice-channel branch of the Persona dispatcher
// (spec build-step 7 + approval gates). Pure policy over injected effects so it's unit-tested without
// an LLM: given a transcribed turn and the call's confirm-state, decide whether to ANSWER read-only,
// STAGE a write for approval, or EXECUTE an unlocked write — and what the agent says.
//
// Posture (spec §approval-gates 1–3):
//   • Read-only by default. A read turn runs the inline conversation agent and the answer is spoken.
//   • A write-intent turn stages an Approval card (dispatchUserGoal with untrusted_origin=true, which
//     the Gate Phase parks as a card) and the agent says "I've staged that."
//   • The fixed "confirm send" phrase unlocks execution FOR THE REST OF THE CALL. While unlocked, a
//     write-intent turn routes to `execute` (the dispatcher, where the per-domain Trust Ladder still
//     governs). v0.1 limitation: the phrase unlocks the call; binding it to a SPECIFIC already-staged
//     action ("one phrase, one execution") is v1.5 — until then the caller re-states the action while
//     unlocked. If no `execute` effect is wired, an unlocked write still stages (fail-safe).
//
// The system-prompt preamble (buildVoiceSystemPreamble) is injected by the caller into the answer/
// execute effects; this module owns only the read-vs-write-vs-confirm decision.

import { isConfirmSendPhrase, isWriteIntent, STAGED_REPLY } from "./profile";

export type VoiceTurnDeps = {
  /** Answer a read-only turn inline (wraps runConversationTurn). Returns the spoken reply text. */
  answer: (transcript: string) => Promise<string>;
  /** Stage a write-intent turn as a Mission Control approval card (dispatchUserGoal, untrusted). */
  stageWrite: (transcript: string) => Promise<void>;
  /** Execute an unlocked write through the dispatcher (Trust Ladder governs). Optional in v0.1. */
  execute?: (transcript: string) => Promise<string>;
};

export type VoiceTurnState = {
  /** Set once the caller says "confirm send"; unlocks execution for the rest of the call. */
  confirmUnlocked: boolean;
};

export function initialVoiceTurnState(): VoiceTurnState {
  return { confirmUnlocked: false };
}

export type VoiceTurnResult = {
  /** What the agent speaks back (empty = nothing to say; the loop skips synthesis). */
  spokenText: string;
  /** True when this turn staged a write for approval (for logging + the transcript trail). */
  staged: boolean;
  /** True when this turn executed an unlocked write. */
  executed: boolean;
  /** The carry-forward state (confirm-unlock persists across turns within the call). */
  state: VoiceTurnState;
};

/**
 * Decide and perform one voice turn. Pure control flow over the injected effects — deterministic and
 * unit-tested. Never throws on an empty transcript (returns a no-op turn).
 */
export async function handleVoiceTurn(
  transcript: string,
  state: VoiceTurnState,
  deps: VoiceTurnDeps,
): Promise<VoiceTurnResult> {
  const text = transcript.trim();
  if (text === "") {
    return { spokenText: "", staged: false, executed: false, state };
  }

  const unlock = isConfirmSendPhrase(text);
  const nextState: VoiceTurnState = unlock ? { confirmUnlocked: true } : state;

  // Strip the confirm phrase before write detection so "confirm send" alone isn't read as a "send"
  // write that executes itself — it only flips the unlock, and the caller then states the action.
  const actionable = unlock ? text.replace(/\bconfirm\s+send\b/gi, " ").trim() : text;

  if (actionable !== "" && isWriteIntent(actionable)) {
    if (nextState.confirmUnlocked && deps.execute) {
      const out = await deps.execute(actionable);
      return {
        spokenText: out.trim() === "" ? "Done." : out,
        staged: false,
        executed: true,
        state: nextState,
      };
    }
    await deps.stageWrite(actionable);
    return { spokenText: STAGED_REPLY, staged: true, executed: false, state: nextState };
  }

  if (unlock) {
    // "confirm send" with no concurrent write request — acknowledge the unlock; the caller can now
    // re-state the action (v0.1) or approve it in the inbox.
    return {
      spokenText: "Confirmed — go ahead and tell me what to send.",
      staged: false,
      executed: false,
      state: nextState,
    };
  }

  const answer = await deps.answer(actionable);
  return { spokenText: answer, staged: false, executed: false, state: nextState };
}
