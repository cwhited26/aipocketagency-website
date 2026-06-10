// lib/emails/templates/dwy/* — the 6 Done-With-You Setup emails (Part 5D). Standard + Premium forks.

import { composeEmail, type RenderedEmail } from "../../render";
import { LINKS, type BaseEmailProps } from "../shared";

// Recap email carries the operator's filled-in loop details. Optional — blank inserts read as the
// GPT [insert] placeholders when the operator hasn't supplied them yet.
export type DwyRecapProps = BaseEmailProps & {
  businessBrain?: string;
  persona?: string;
  workflow?: string;
  missionControlReview?: string;
  nextAction?: string;
};

function insert(value: string | undefined): string {
  const v = value?.trim();
  return v && v.length > 0 ? v : "[insert]";
}

// DWY Email 1: Purchase confirmation
export function dwyConfirmation(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    transactional: true,
    subject: "Your Done-With-You Setup is confirmed",
    blocks: [
      { kind: "p", text: "Your Done-With-You Setup is confirmed." },
      {
        kind: "p",
        text: "Your next step is to schedule your implementation call and start your private setup thread inside Pocket Agent Launchpad.",
      },
      {
        kind: "p",
        text: "Before the call, gather: Your offer. Your services. Your FAQs. Your best emails. Your brand voice. Your customer notes. Your sales process. Your first workflow goal.",
      },
      {
        kind: "p",
        text: "The goal of Done-With-You Setup is not to build everything. The goal is to install one working loop.",
      },
      { kind: "p", text: "Business Brain. Persona. Workflow. Mission Control." },
      { kind: "button", label: "Schedule My Setup Call", href: LINKS.setupSprint },
    ],
  });
}

// DWY Email 2: Pre-call checklist
export function dwyPreCallChecklist(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Before your setup call, gather this",
    blocks: [
      { kind: "p", text: "Before your setup call, gather the assets that will make the setup useful." },
      { kind: "h", text: "Minimum:" },
      {
        kind: "bullets",
        items: [
          "Offer description",
          "Voice sample",
          "Customer questions",
          "Workflow you want installed",
          "Persona you want configured",
        ],
      },
      {
        kind: "p",
        text: "Recommended: Best emails. Sales page copy. FAQs. Screenshots. Lead examples. Past AI prompts. Customer notes. Follow-up examples.",
      },
      { kind: "p", text: "Your setup call will be better if your Business Brain has useful context." },
      { kind: "p", text: "Do not make it perfect. Make it usable." },
      { kind: "button", label: "Complete My Pre-Call Checklist", href: LINKS.setupSprint },
    ],
  });
}

// DWY Email 3: Standard setup reminder
export function dwyStandardReminder(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Your Standard Setup goal",
    blocks: [
      { kind: "p", text: "Your Standard Done-With-You Setup includes:" },
      {
        kind: "p",
        text: "Business Brain import. 1 Persona configured. 1 workflow installed. 60-minute implementation call. Private setup thread inside Pocket Agent Launchpad.",
      },
      { kind: "p", text: "The goal: One working loop." },
      {
        kind: "p",
        text: "Example: Business Brain context imported. Follow-Up Agent configured. Follow-Up Sweeps installed. Output reviewed in Mission Control.",
      },
      { kind: "p", text: "That is the loop." },
      { kind: "p", text: "Come to the call ready to choose your first Persona and workflow." },
      { kind: "button", label: "Open My Setup Thread", href: LINKS.setupSprint },
    ],
  });
}

// DWY Email 4: Premium setup reminder
export function dwyPremiumReminder(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Your Premium Setup goal",
    blocks: [
      { kind: "p", text: "Your Premium Done-With-You Setup includes:" },
      {
        kind: "p",
        text: "Business Brain import. 1 Persona configured. 1 workflow installed. First Lead Scout run. First follow-up sweep. 90-minute implementation call. Private setup thread inside Pocket Agent Launchpad. 30-day check-in.",
      },
      { kind: "p", text: "The goal: Install your first revenue-adjacent loop." },
      {
        kind: "p",
        text: "That usually means: Lead Researcher or Follow-Up Agent. Lead Scout or Follow-Up Sweeps. Mission Control review. Approved next actions.",
      },
      {
        kind: "p",
        text: "Come to the call with: Target vertical. Target location. Offer. Ideal prospect. Follow-up goal.",
      },
      { kind: "button", label: "Open My Premium Setup Thread", href: LINKS.setupSprint },
    ],
  });
}

// DWY Email 5: After setup call (recap)
export function dwyPostCallRecap(pr: DwyRecapProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Your setup call recap",
    blocks: [
      { kind: "p", text: "Your setup call is complete. Now the only thing that matters is usage." },
      { kind: "p", text: "Your installed loop:" },
      {
        kind: "bullets",
        items: [
          `Business Brain: ${insert(pr.businessBrain)}`,
          `Persona: ${insert(pr.persona)}`,
          `Workflow: ${insert(pr.workflow)}`,
          `Mission Control review: ${insert(pr.missionControlReview)}`,
          `Your next action: ${insert(pr.nextAction)}`,
        ],
      },
      {
        kind: "p",
        text: "Do not let this sit. Use the workflow this week. Then post your first win inside Pocket Agent Launchpad.",
      },
      { kind: "button", label: "Post My Setup Win", href: LINKS.launchpad },
    ],
  });
}

// DWY Email 6: 30-day check-in reminder (Premium)
export function dwy30DayCheckin(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Your 30-day check-in is coming up",
    blocks: [
      { kind: "p", text: "Your Premium Setup includes a 30-day check-in." },
      {
        kind: "p",
        text: "Before the check-in, review: What did Pocket Agent draft? What did it research? What did it capture? What did it prepare? What did you approve? What workflow repeated? What got ignored? What needs better context?",
      },
      { kind: "p", text: 'Bring one question: "What should we install next?"' },
      { kind: "p", text: "The answer should be based on your constraint." },
      { kind: "p", text: "More prospects? Lead Scout." },
      { kind: "p", text: "More ideas shipped? Idea Engine." },
      { kind: "p", text: "More follow-up? Follow-Up Sweeps." },
      { kind: "p", text: "Better decisions? Decision Roundtable." },
      { kind: "p", text: "More execution? Build Tools." },
      { kind: "button", label: "Prepare For My Check-In", href: LINKS.setupSprint },
    ],
  });
}
