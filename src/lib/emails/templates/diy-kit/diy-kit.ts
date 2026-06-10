// lib/emails/templates/diy-kit/* — the 3 DIY Setup Kit delivery emails (Part 5F). Info-product,
// NOT full Launchpad access. Delivery / Day+1 / Day+3.

import { composeEmail, type RenderedEmail } from "../../render";
import { LINKS, type BaseEmailProps } from "../shared";

// DIY Email 1: Delivery. The signed download URL is passed in (24h Storage link from the webhook).
export type DiyDeliveryProps = BaseEmailProps & { downloadUrl?: string };

export function diyDelivery(pr: DiyDeliveryProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    transactional: true,
    subject: "Your AI Office DIY Setup Kit",
    blocks: [
      { kind: "p", text: "Your AI Office DIY Setup Kit is ready." },
      { kind: "p", text: "This is a downloadable bundle." },
      {
        kind: "p",
        text: "Inside, you get: Business Brain Upload Checklist. 3 Persona setup templates. Workflow templates. 7-Day Plan. Example prompts.",
      },
      {
        kind: "p",
        text: "This is not Done-With-You Setup. This does not include full Pocket Agent Launchpad access. This is the shortcut for people who want the instructions and want to execute themselves.",
      },
      { kind: "p", text: "Start with the Business Brain Upload Checklist." },
      { kind: "button", label: "Download The DIY Setup Kit", href: pr.downloadUrl || LINKS.diyKit },
    ],
  });
}

// DIY Email 2: Start with Business Brain
export function diyStartWithBusinessBrain(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Do this first: Business Brain",
    blocks: [
      { kind: "p", text: "Do not start by building Personas. Start with Business Brain." },
      { kind: "p", text: "Your AI needs context before it does work." },
      { kind: "p", text: "Add: Your offer. Your voice. Your customer questions." },
      { kind: "p", text: "Then use the Persona templates." },
      { kind: "p", text: "Context first. Persona second. Workflow third. Review fourth." },
      { kind: "p", text: "That is the order." },
      { kind: "button", label: "Open The Business Brain Checklist", href: LINKS.diyKit },
    ],
  });
}

// DIY Email 3: Upgrade to subscription
export function diyUpgradeToSubscription(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Want Pocket Agent to actually run the workflow?",
    blocks: [
      { kind: "p", text: "The DIY Setup Kit gives you the instructions. Pocket Agent gives you the workspace." },
      {
        kind: "p",
        text: "If you want to actually build your Business Brain, clone Personas, use Apps, and review everything in Mission Control, start a paid Pocket Agent subscription.",
      },
      {
        kind: "p",
        text: "Every paid subscription includes: AI Office Launch Kit. Pocket Agent Launchpad. Prebuilt Skills based on tier. Implementation Guarantee.",
      },
      { kind: "p", text: "Start with Business Agent if you want the main business workspace." },
      { kind: "button", label: "Start Pocket Agent", href: LINKS.start },
    ],
  });
}
