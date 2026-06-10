// lib/emails/templates/upgrades/* — the 5 plan upgrade emails (Part 5I).

import { composeEmail, type RenderedEmail } from "../../render";
import { LINKS, type BaseEmailProps } from "../shared";

// Personal Brain → Business Agent
export function personalToBusiness(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Ready for Personas and Apps?",
    blocks: [
      { kind: "p", text: "Personal Brain is for one brain. Business Agent is for business workflows." },
      {
        kind: "p",
        text: "Upgrade when you want: Clone-and-customize Personas. Workflow Apps. Mission Control. Active integrations. 20 prebuilt Skills. AI Office Launch Kit. Pocket Agent Launchpad.",
      },
      {
        kind: "p",
        text: "If your Business Brain is useful and you are ready for AI roles that do work, upgrade to Business Agent.",
      },
      { kind: "button", label: "Upgrade To Business Agent", href: LINKS.pricing },
    ],
  });
}

// Business Agent → AI Agent Workspace
export function businessToAaw(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Ready for the full cockpit?",
    blocks: [
      { kind: "p", text: "Business Agent gives you the core workspace. AI Agent Workspace gives you the heavy hitters." },
      {
        kind: "p",
        text: "Upgrade when you want: Idea Engine. Lead Scout vertical packs. Decision Roundtable. Full cockpit. All 30 Skills. Advanced Mission Control.",
      },
      {
        kind: "p",
        text: "If you want Pocket Agent to help turn ideas into live pages and prospect lists, upgrade to AI Agent Workspace.",
      },
      { kind: "p", text: "Other tools give you blueprints. Idea Engine gives you a working website you can share." },
      { kind: "button", label: "Upgrade To AI Agent Workspace", href: LINKS.pricing },
    ],
  });
}

// Pro+ → Studio
export function proPlusToStudio(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Ready for deeper execution?",
    blocks: [
      { kind: "p", text: "Pro+ gives you more advanced planning and prompts. Studio gives you deeper execution." },
      {
        kind: "p",
        text: "Upgrade when you need more build capability, Studio-level workflows, and advanced execution.",
      },
      { kind: "p", text: "If you are ready to move from plans to implementation, Studio is the next step." },
      { kind: "button", label: "Upgrade To Studio", href: LINKS.pricing },
    ],
  });
}

// Studio → AI Agent Workspace
export function studioToAaw(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Unlock the full AI Agent Workspace",
    blocks: [
      { kind: "p", text: "Studio gives you deeper build capability. AI Agent Workspace gives you the full cockpit." },
      {
        kind: "p",
        text: "Upgrade when you want: Idea Engine. Lead Scout vertical packs. Decision Roundtable. All 30 Skills. Advanced Mission Control. Full workspace visibility.",
      },
      { kind: "p", text: "If you want the strongest Pocket Agent experience, upgrade to AI Agent Workspace." },
      { kind: "button", label: "Unlock AI Agent Workspace", href: LINKS.pricing },
    ],
  });
}

// AI Agent Workspace → Enterprise
export function aawToEnterprise(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Need custom usage, permissions, or implementation?",
    blocks: [
      { kind: "p", text: "AI Agent Workspace gives you the full cockpit. Enterprise is for teams that need more control." },
      {
        kind: "p",
        text: "Upgrade to Enterprise if you need: Custom usage allowances. Advanced permissions. Team workflows. BYO LLM configuration. Custom implementation. Integrations. Enterprise support.",
      },
      {
        kind: "p",
        text: "If Pocket Agent is becoming part of how your business runs, Enterprise may be the next step.",
      },
      { kind: "button", label: "Apply For Enterprise", href: LINKS.enterprise },
    ],
  });
}
