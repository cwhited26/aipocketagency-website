// lib/emails/templates/usage-caps/* — the 3 usage-cap upgrade prompts (Part 5H). No token-cost
// language, no "monthly cost cap," no "API spend" — usage-allowance language only.

import { composeEmail, type RenderedEmail } from "../../render";
import { LINKS, type BaseEmailProps } from "../shared";

// Leads cap
export function leadsCap(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "You hit your lead allowance",
    blocks: [
      {
        kind: "p",
        text: "You hit your lead allowance for this tier. That means your Lead Researcher is being used. Good.",
      },
      {
        kind: "p",
        text: "To keep running Lead Scout and researching more prospects, upgrade to the next tier.",
      },
      { kind: "p", text: "No surprise bills. Flat monthly plan. Clear usage allowances." },
      { kind: "button", label: "Upgrade My Plan", href: LINKS.pricing },
    ],
  });
}

// Whisper hours cap
export function whisperHoursCap(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "You hit your Whisper hours allowance",
    blocks: [
      { kind: "p", text: "You hit your Whisper hours allowance for this tier." },
      {
        kind: "p",
        text: "If you want to keep processing voice, audio, podcasts, calls, or long-form spoken content, upgrade to the next tier.",
      },
      {
        kind: "p",
        text: "Your plan includes usage allowances. No surprise bills. Upgrade when you need more work done.",
      },
      { kind: "button", label: "Upgrade My Usage", href: LINKS.pricing },
    ],
  });
}

// Sub-agent runs cap
export function subAgentRunsCap(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "You hit your sub-agent run allowance",
    blocks: [
      {
        kind: "p",
        text: "You hit your sub-agent run allowance for this tier. That means your workspace is doing real agent work.",
      },
      { kind: "p", text: "To continue running more sub-agent workflows, upgrade to the next tier." },
      { kind: "p", text: "Flat monthly bill. Clear usage allowances. No surprise bills." },
      { kind: "button", label: "Upgrade My Plan", href: LINKS.pricing },
    ],
  });
}
