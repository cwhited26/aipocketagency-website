// classify.ts — the one cheap Haiku call that reads an owner chat message for a signal
// (PA-SIGNAL-1). Same discipline as the capture-triage classifier (lib/capture-inbox/triage.ts):
// direct REST, no SDK, degrade to null on no-key / API error / unparseable output — the chat turn
// already succeeded, a classification miss is a logged non-event, never a crash. Every call that
// reaches the model logs one pa_cost_events row: featureSlug 'signal_catcher', backend
// 'anthropic', model claude-haiku-4-5-…, idempotency `signal_catcher:classify:<messageId>`.

import { logCostFromUsage, type CostContext } from "@/lib/cost/log";
import { signalCatcherLog } from "./log";
import {
  ClassifiedSignalSchema,
  SIGNAL_RITUAL_APP_SLUGS,
  type ClassifiedSignal,
} from "./types";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
export const SIGNAL_CLASSIFY_MODEL = "claude-haiku-4-5-20251001"; // cheap — one JSON verdict

// Messages this short can't carry a wish worth ritualizing; skip the model call entirely.
export const MIN_CLASSIFIABLE_LENGTH = 20;

// Voice-checked: the classifier reads for a wish the owner voiced, and it is told the honest
// default is "this is not a signal". Cadence must come back in the plain English the Ritual
// Scheduler's parser already accepts — the raw cron never appears anywhere in this feature.
const CLASSIFY_PROMPT = `You read one message a business owner sent to their assistant. Decide whether it carries a standing wish — something they want done on a schedule but never set up. Examples of the pattern: "I wish I had a weekly revenue summary", "I keep meaning to check my pipeline every Monday", "it'd be great to get a digest of new leads on Fridays".

Reply with ONLY a JSON object, no other text:
{
  "signal_type": one of "recurring_task" (a chore they keep meaning to do), "dashboard" (a view or report they wish existed), "digest" (a summary they want delivered), "notification" (an alert they want when something happens), or "not_a_signal",
  "confidence": a number from 0 to 1 — how sure you are this is a standing wish, not a one-off request or small talk,
  "suggested_ritual_name": a short title case name for the recurring job, like "Monday Pipeline Review" (empty string when not_a_signal),
  "suggested_cadence": when it should run, in plain English a scheduler can read — like "every Monday at 8am", "daily at 6pm", "weekdays at 9am". Use the timing they mentioned; if they gave none, pick the most natural one for the wish (empty string when not_a_signal),
  "suggested_app_slug": which tool runs it — one of ${SIGNAL_RITUAL_APP_SLUGS.map((s) => `"${s}"`).join(", ")}. Use "lead-scout" for pipeline and lead review, "follow-up-sweeps" for chasing dormant contacts, "capture-inbox" for filing and note review, "daily-brief" for everything else (empty string when not_a_signal)
}

Most messages are not signals. Questions, one-off asks ("draft this email"), and ordinary conversation are "not_a_signal" with low confidence. Only a wish about recurring work counts.`;

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

/** Strip a ```json fence if the model wrapped its object in one. */
function unfence(text: string): string {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return (m ? m[1] : text).trim();
}

/**
 * Classify one owner chat message. Returns the Zod-validated signal, or null when the message is
 * too short, the key is missing, the API errs, or the output fails the schema — every miss is
 * logged with its reason, none of them throws.
 */
export async function classifySignal(params: {
  apiKey: string | null;
  message: string;
  cost?: CostContext;
}): Promise<ClassifiedSignal | null> {
  if (!params.apiKey) return null;
  if (params.message.trim().length < MIN_CLASSIFIABLE_LENGTH) return null;

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": params.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: SIGNAL_CLASSIFY_MODEL,
        max_tokens: 300,
        messages: [
          { role: "user", content: `${CLASSIFY_PROMPT}\n\nThe message:\n${params.message.slice(0, 2_000)}` },
        ],
      }),
      cache: "no-store",
    });
  } catch (e) {
    signalCatcherLog.warn("classify call failed (network)", {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
  if (!res.ok) {
    signalCatcherLog.warn("classify call failed", { status: res.status });
    return null;
  }

  const data = (await res.json()) as AnthropicResponse;
  if (params.cost) {
    await logCostFromUsage(params.cost, "anthropic", SIGNAL_CLASSIFY_MODEL, {
      tokensInput: data.usage?.input_tokens ?? 0,
      tokensOutput: data.usage?.output_tokens ?? 0,
    });
  }

  const text = data.content?.find((c) => c.type === "text")?.text ?? "";
  let raw: unknown;
  try {
    raw = JSON.parse(unfence(text));
  } catch {
    signalCatcherLog.warn("classify returned non-JSON", { preview: text.slice(0, 120) });
    return null;
  }

  const parsed = ClassifiedSignalSchema.safeParse(raw);
  if (!parsed.success) {
    signalCatcherLog.warn("classify output failed schema", {
      issue: parsed.error.issues[0]?.message ?? "shape mismatch",
    });
    return null;
  }
  return parsed.data;
}
