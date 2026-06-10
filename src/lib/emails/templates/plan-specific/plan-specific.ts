// lib/emails/templates/plan-specific/* — the 3 plan-specific onboarding forks (Part 5C).
// Sent immediately alongside the universal Day-0, picked from the subscription tier.

import { composeEmail, type RenderedEmail } from "../../render";
import { LINKS, type BaseEmailProps } from "../shared";

// Personal Brain (tier: starter)
export function personalBrainWelcome(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Start with one brain",
    blocks: [
      { kind: "p", text: "You chose Personal Brain. Good." },
      {
        kind: "p",
        text: "Your job is not to build a full AI team yet. Your job is to build one useful Business Brain.",
      },
      {
        kind: "p",
        text: "Start with: Your offer. Your notes. Your saved links. Your voice. Your customer questions. Your ideas.",
      },
      { kind: "p", text: "Personal Brain is for the solo owner who wants one place for AI memory." },
      { kind: "p", text: "Do not overbuild. Make the brain useful first." },
      {
        kind: "p",
        text: "When you are ready for Personas, Apps, active integrations, and business workflows, upgrade to Business Agent.",
      },
      { kind: "button", label: "Set Up My Personal Brain", href: LINKS.businessBrain },
    ],
  });
}

// Business Agent (tier: pro, and pro_plus)
export function businessAgentWelcome(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Business Agent: build the first working loop",
    blocks: [
      {
        kind: "p",
        text: "You chose Business Agent. This is the main starting point for owner-led businesses.",
      },
      {
        kind: "p",
        text: "Your goal is 3-3-3 activation: 3 Business Brain assets. 3 trained Personas. 3 working workflows.",
      },
      { kind: "p", text: "Start with: Admin Assistant. Follow-Up Agent. Content Creator." },
      { kind: "p", text: "Then install: Email Drafting. Follow-Up Sweeps. Capture Inbox to Content." },
      {
        kind: "p",
        text: "Business Agent gives you the core workspace: Business Brain. Personas. Apps. Mission Control. 20 prebuilt Skills. Pocket Agent Launchpad.",
      },
      { kind: "p", text: "Use the Launchpad. Build the first loop. Then stack." },
      { kind: "button", label: "Start Business Agent Setup", href: LINKS.businessBrain },
    ],
  });
}

// AI Agent Workspace (tier: studio_plus, and studio)
export function aiAgentWorkspaceWelcome(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "AI Agent Workspace: start with the full cockpit",
    blocks: [
      { kind: "p", text: "You chose AI Agent Workspace. That means you have the full cockpit." },
      {
        kind: "p",
        text: "Your plan includes: Lead Scout vertical packs. Decision Roundtable. Idea Engine. Advanced Mission Control. All 30 Skills.",
      },
      {
        kind: "p",
        text: "Do not skip the foundation. Start with Business Brain. Then create your first Personas. Then install the first workflows.",
      },
      {
        kind: "p",
        text: "After that, use the heavy hitters: Run Lead Scout for one vertical. Run Idea Engine on one idea. Use Mission Control to review everything.",
      },
      { kind: "p", text: "The goal is not to play with features. The goal is to ship work." },
      { kind: "button", label: "Open AI Agent Workspace", href: LINKS.app },
    ],
  });
}
