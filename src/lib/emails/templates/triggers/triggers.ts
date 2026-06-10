// lib/emails/templates/triggers/* — the 5 activation-based trigger emails (Part 5G). Fired by the
// activation state machine: four missing-action reminders + one 3-3-3 celebration.

import { composeEmail, type RenderedEmail } from "../../render";
import { LINKS, type BaseEmailProps } from "../shared";

// Trigger: user has not created Business Brain after 24h
export function noBbAfter24h(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "You have not started your Business Brain yet",
    blocks: [
      {
        kind: "p",
        text: "Pocket Agent cannot start from your business until you add your business context.",
      },
      { kind: "p", text: "Start with 3 assets: Your offer. Your voice. Your customer questions." },
      { kind: "p", text: "That is enough to begin. Do not make it perfect. Make it useful." },
      { kind: "button", label: "Start My Business Brain", href: LINKS.businessBrain },
    ],
  });
}

// Trigger: created Business Brain but no Persona
export function bbNoPersona(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Your Business Brain needs a Persona",
    blocks: [
      { kind: "p", text: "Good. Your Business Brain is started." },
      { kind: "p", text: "Now clone your first Persona. A Persona is the WHO." },
      {
        kind: "p",
        text: "Start with one: Admin Assistant. Follow-Up Agent. Content Creator. Email Drafter. Lead Researcher.",
      },
      { kind: "p", text: "Pick the role that removes the most repeated work from your week." },
      { kind: "button", label: "Clone My First Persona", href: LINKS.personas },
    ],
  });
}

// Trigger: created Persona but no workflow
export function personaNoWorkflow(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Your Persona needs a workflow",
    blocks: [
      { kind: "p", text: "A Persona without a workflow is just a character. Give it a job." },
      {
        kind: "p",
        text: "Install one workflow: Email Drafting. Follow-Up Sweeps. Capture Inbox to Content. Lead Scout run. Daily Mission Control Review.",
      },
      { kind: "p", text: "A Persona is the role. An App is the tool. A Persona uses Apps." },
      { kind: "button", label: "Install A Workflow", href: LINKS.apps },
    ],
  });
}

// Trigger: installed workflow but has not opened Mission Control
export function workflowNoMissionControl(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Review the work in Mission Control",
    blocks: [
      { kind: "p", text: "Your workflow is installed. Now review the output." },
      {
        kind: "p",
        text: "Mission Control is where you see what Pocket Agent captured, drafted, researched, queued, summarized, built, and prepared.",
      },
      { kind: "p", text: "AI does the prep. You stay in control." },
      { kind: "button", label: "Open Mission Control", href: LINKS.missionControl },
    ],
  });
}

// Trigger: completed 3-3-3
export function threeThreeThreeComplete(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "You hit 3-3-3 activation",
    blocks: [
      { kind: "p", text: "Good. You have hit 3-3-3 activation." },
      { kind: "p", text: "That means: 3 Business Brain assets. 3 trained Personas. 3 working workflows." },
      { kind: "p", text: "Pocket Agent is now installed at the basic level." },
      { kind: "p", text: "Now stack the next loop." },
      { kind: "p", text: "Choose based on your constraint:" },
      {
        kind: "bullets",
        items: [
          "Need more prospects? Lead Scout.",
          "Need to ship ideas? Idea Engine.",
          "Need better decisions? Decision Roundtable.",
          "Need more execution? Build Tools.",
          "Need better content? YouTube Ingester or Podcast Ingester.",
        ],
      },
      { kind: "button", label: "Choose My Next Workflow", href: LINKS.apps },
    ],
  });
}
