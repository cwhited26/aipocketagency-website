// lib/emails/templates/pilot/* — the 18-email 14-Day Pilot nurture (Part 5E). Day 0 → Day 30
// (credit expiry). Paid skin in the game, not a free trial. GPT-Hormozi voice rides verbatim.

import { composeEmail, type RenderedEmail } from "../../render";
import { LINKS, type BaseEmailProps } from "../shared";

// Pilot Email 0: purchase confirmation
export function pilotDay0(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    transactional: true,
    subject: "Your 14-Day Pilot starts now",
    blocks: [
      { kind: "p", text: "Your 14-Day Pilot starts now." },
      {
        kind: "p",
        text: "This is not a free trial. Free trials attract dabblers. Paid pilots attract operators.",
      },
      {
        kind: "p",
        text: "Your Pilot goal is simple: 1 Business Brain starter. 1 Persona. 1 workflow. 1 Mission Control review.",
      },
      {
        kind: "p",
        text: "That is enough to answer the only question that matters: Can Pocket Agent help your business move real work forward?",
      },
      { kind: "p", text: "If you upgrade within 30 days, your $97 credits toward your subscription." },
      { kind: "p", text: "Start inside the Pilot Track in Pocket Agent Launchpad." },
      { kind: "button", label: "Start My Pilot Track", href: LINKS.launchpad },
    ],
  });
}

// Pilot Email 1: Day 1 — Business Brain starter
export function pilotDay1(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Pilot Day 1: build your Business Brain starter",
    blocks: [
      { kind: "p", text: "Day 1 of your Pilot is Business Brain." },
      { kind: "p", text: "Do not overbuild. Add 3 assets:" },
      { kind: "bullets", items: ["Your offer", "Your voice", "Your customer questions"] },
      { kind: "p", text: "That is enough to make your first Persona useful." },
      {
        kind: "p",
        text: "Your Business Brain is your company memory in markdown, stored in your own git repo.",
      },
      { kind: "p", text: "Generic AI starts from zero. Pocket Agent starts from your business." },
      { kind: "button", label: "Add My 3 Starter Assets", href: LINKS.documents },
    ],
  });
}

// Pilot Email 2: Day 2 — Pick one Persona
export function pilotDay2(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Pilot Day 2: clone one Persona",
    blocks: [
      {
        kind: "p",
        text: "Today, clone one Persona. Do not clone all seven. Pick one based on your biggest bottleneck.",
      },
      {
        kind: "p",
        text: "Admin chaos? Admin Assistant. Leads slipping? Follow-Up Agent. Content backlog? Content Creator. Email drag? Email Drafter. Prospecting? Lead Researcher. Operations messy? Operations Chief of Staff.",
      },
      { kind: "p", text: "Your Pilot does not need every Persona. It needs one useful role." },
      { kind: "button", label: "Clone My Pilot Persona", href: LINKS.personas },
    ],
  });
}

// Pilot Email 3: Day 3 — Install one workflow
export function pilotDay3(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Pilot Day 3: install one workflow",
    blocks: [
      { kind: "p", text: "Today, install one workflow." },
      {
        kind: "p",
        text: "Use this formula: Trigger. Persona. App. Input. Output. Review step. Approval rule. Success metric.",
      },
      { kind: "p", text: "Recommended Pilot workflows:" },
      {
        kind: "p",
        text: "Follow-Up Agent plus Follow-Up Sweeps. Email Drafter plus Email Drafter. Content Creator plus Capture Inbox. Lead Researcher plus Lead Scout.",
      },
      { kind: "p", text: "Pick one. Install it. Do not make it complicated." },
      { kind: "button", label: "Install My Pilot Workflow", href: LINKS.apps },
    ],
  });
}

// Pilot Email 4: Day 4 — Mission Control
export function pilotDay4(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Pilot Day 4: review Mission Control",
    blocks: [
      { kind: "p", text: "Today is where the Pilot becomes real." },
      { kind: "p", text: "Open Mission Control. Review what Pocket Agent prepared." },
      { kind: "p", text: "Look for: Drafts. Follow-ups. Captured ideas. Research. Next actions." },
      { kind: "p", text: "Approve what is useful. Edit what is close. Ignore what does not matter." },
      { kind: "p", text: "Then ask: What context would make this better?" },
      { kind: "p", text: "That answer tells you what to add to your Business Brain next." },
      { kind: "button", label: "Review Mission Control", href: LINKS.missionControl },
    ],
  });
}

// Pilot Email 5: Day 5 — First output
export function pilotDay5(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Pilot Day 5: create one useful output",
    blocks: [
      { kind: "p", text: "Today, create one useful output. Not ten. One." },
      {
        kind: "p",
        text: "Examples: One follow-up draft. One email reply. One lead research result. One content asset. One captured idea processed. One landing page section. One Mission Control approval.",
      },
      { kind: "p", text: "The Pilot works when it creates proof." },
      { kind: "p", text: "Your job today is to create one proof point." },
      { kind: "button", label: "Create My First Output", href: LINKS.app },
    ],
  });
}

// Pilot Email 6: Day 6 — Fix the context
export function pilotDay6(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Pilot Day 6: make the output better",
    blocks: [
      { kind: "p", text: "If the output was generic, the problem is usually context." },
      { kind: "p", text: "Add better Business Brain assets." },
      {
        kind: "p",
        text: "Examples: Better voice sample. Clearer offer. More customer questions. Better FAQ. Sales process. Do-not-say list. Follow-up examples.",
      },
      {
        kind: "p",
        text: "The agent cannot use context it does not have. Bad input creates generic output. Better Business Brain creates better work.",
      },
      { kind: "p", text: "Today, add one missing context asset." },
      { kind: "button", label: "Improve My Business Brain", href: LINKS.documents },
    ],
  });
}

// Pilot Email 7: Day 7 — Midpoint check
export function pilotDay7(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Pilot midpoint: is one loop working?",
    blocks: [
      { kind: "p", text: "You are halfway through the Pilot. Check your progress." },
      {
        kind: "p",
        text: "Do you have: 1 Business Brain starter? 1 Persona? 1 workflow? 1 Mission Control review?",
      },
      { kind: "p", text: "If yes, good. Now use the workflow again." },
      { kind: "p", text: "If not, fix the missing piece today." },
      { kind: "p", text: "Do not explore more features. Finish the first loop." },
      { kind: "p", text: "That is the Pilot. One useful loop. Then decide if you want more." },
      { kind: "button", label: "Complete My Pilot Loop", href: LINKS.app },
    ],
  });
}

// Pilot Email 8: Day 8 — Use it again
export function pilotDay8(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Pilot Day 8: repeat the workflow",
    blocks: [
      { kind: "p", text: "A workflow only matters if it repeats." },
      { kind: "p", text: "Today, run the same workflow again. Same Persona. Same App. Same review step." },
      { kind: "p", text: "You are testing repeatability." },
      {
        kind: "p",
        text: "Ask: Was it faster the second time? Was the output better? Did the Business Brain help? Did Mission Control make review easier? Would this save time weekly?",
      },
      { kind: "p", text: "If yes, this is not a toy. It is a workflow." },
      { kind: "button", label: "Run My Workflow Again", href: LINKS.app },
    ],
  });
}

// Pilot Email 9: Day 9 — Upgrade framing
export function pilotDay9(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "When should you upgrade?",
    blocks: [
      {
        kind: "p",
        text: "Upgrade when Pocket Agent has proven it can move real work forward. Not when you have explored every feature.",
      },
      {
        kind: "p",
        text: "Ask: Did it draft something useful? Did it research something useful? Did it prepare a follow-up? Did it capture an idea? Did it save time? Did it reveal a workflow you should repeat?",
      },
      { kind: "p", text: "If yes, upgrade before the momentum dies." },
      { kind: "p", text: "Your $97 credits toward your subscription if you upgrade within 30 days." },
      { kind: "p", text: "Most owner-led businesses should start with Business Agent at $97/month." },
      {
        kind: "p",
        text: "If you want Idea Engine, Lead Scout vertical packs, Decision Roundtable, and full cockpit, choose AI Agent Workspace at $497/month.",
      },
      { kind: "button", label: "Upgrade My Pilot", href: LINKS.pricing },
    ],
  });
}

// Pilot Email 10: Day 10 — Plan choice
export function pilotDay10(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Which plan should your Pilot become?",
    blocks: [
      { kind: "p", text: "Here is the simple plan choice." },
      {
        kind: "p",
        text: "Personal Brain — $37/month — Choose this if you only need one brain.",
      },
      {
        kind: "p",
        text: "Business Agent — $97/month — Choose this if you want the main business plan with Personas, Apps, Mission Control, active integrations, and 20 Skills.",
      },
      {
        kind: "p",
        text: "AI Agent Workspace — $497/month — Choose this if you want Idea Engine, Lead Scout vertical packs, Decision Roundtable, full cockpit, and all 30 Skills.",
      },
      { kind: "p", text: "Your $97 Pilot credit applies if you upgrade within 30 days." },
      { kind: "button", label: "Choose My Plan", href: LINKS.pricing },
    ],
  });
}

// Pilot Email 11: Day 11 — Objection: "I'm not ready"
export function pilotDay11(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "You do not need to be fully ready",
    blocks: [
      { kind: "p", text: "You do not need to be fully ready. You need one working loop." },
      {
        kind: "p",
        text: "Most people delay because they think they need: Perfect docs. Perfect prompts. Perfect workflows. Perfect strategy.",
      },
      { kind: "p", text: "No." },
      {
        kind: "p",
        text: "You need: Useful Business Brain context. One Persona. One App. Mission Control review.",
      },
      { kind: "p", text: "That is enough to start." },
      { kind: "p", text: "If your Pilot produced one useful output, upgrade and keep building." },
      { kind: "p", text: "If it did not, go fix the missing context." },
      { kind: "p", text: "Either way, do not drift." },
      { kind: "button", label: "Continue With Pocket Agent", href: LINKS.app },
    ],
  });
}

// Pilot Email 12: Day 12 — Use case push
export function pilotDay12(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "What should Pocket Agent do next?",
    blocks: [
      { kind: "p", text: "Choose your next use case." },
      { kind: "p", text: "If you need more leads: Use Lead Scout." },
      { kind: "p", text: "If you need better follow-up: Use Follow-Up Sweeps." },
      { kind: "p", text: "If you need emails drafted: Use Email Drafter." },
      { kind: "p", text: "If you need to process ideas: Use Capture Inbox." },
      {
        kind: "p",
        text: "If you need to turn content into assets: Use YouTube Ingester or Podcast Ingester.",
      },
      { kind: "p", text: "If you need to ship ideas: Use Idea Engine." },
      { kind: "p", text: "If you need owner control: Use Mission Control." },
      { kind: "p", text: "Your next plan should match your next use case." },
      { kind: "button", label: "Pick My Next Use Case", href: LINKS.apps },
    ],
  });
}

// Pilot Email 13: Day 13 — Pilot ending
export function pilotDay13(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Your Pilot ends soon",
    blocks: [
      { kind: "p", text: "Your 14-Day Pilot ends soon." },
      {
        kind: "p",
        text: "Before it ends, answer this: Did Pocket Agent help your business move real work forward?",
      },
      { kind: "p", text: "If yes, upgrade. Your $97 credits toward your subscription if you upgrade within 30 days." },
      {
        kind: "p",
        text: "If no, ask why. Did you add enough Business Brain context? Did you clone a Persona? Did you install a workflow? Did you review Mission Control?",
      },
      { kind: "p", text: "Most failed Pilots are not product failures. They are incomplete setup." },
      { kind: "p", text: "Finish the loop. Then decide." },
      { kind: "button", label: "Upgrade Before My Pilot Ends", href: LINKS.pricing },
    ],
  });
}

// Pilot Email 14: Day 14 — Final Pilot day
export function pilotDay14(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Final day of your Pilot",
    blocks: [
      { kind: "p", text: "Today is the final day of your 14-Day Pilot." },
      {
        kind: "p",
        text: "Your goal was: 1 Business Brain starter. 1 Persona. 1 workflow. 1 Mission Control review.",
      },
      { kind: "p", text: "If you completed that and saw value, upgrade now." },
      { kind: "p", text: "Your $97 credits toward your subscription if you upgrade within 30 days." },
      {
        kind: "p",
        text: "Recommended: Business Agent at $97/month if you want the main business workspace. AI Agent Workspace at $497/month if you want Idea Engine, Lead Scout vertical packs, Decision Roundtable, and the full cockpit.",
      },
      { kind: "p", text: "Do not let the setup momentum die." },
      { kind: "button", label: "Upgrade My Pilot", href: LINKS.pricing },
    ],
  });
}

// Pilot Email 15: Day 21 — Credit reminder
export function pilotDay21CreditReminder(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Your $97 Pilot credit is still available",
    blocks: [
      {
        kind: "p",
        text: "Reminder: Your $97 Pilot payment credits toward your subscription if you upgrade within 30 days.",
      },
      { kind: "p", text: "If Pocket Agent helped you build one useful loop, keep going." },
      {
        kind: "p",
        text: "Start with Business Agent at $97/month. Choose AI Agent Workspace at $497/month if you want Idea Engine, Lead Scout vertical packs, Decision Roundtable, and the full cockpit.",
      },
      { kind: "p", text: "Generic AI starts from zero. Pocket Agent starts from your business." },
      { kind: "button", label: "Use My $97 Credit", href: LINKS.pricing },
    ],
  });
}

// Pilot Email 16: Day 29 — Credit expiring
export function pilotDay29CreditExpiring(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Your $97 credit expires soon",
    blocks: [
      { kind: "p", text: "Your $97 Pilot credit expires soon. Use it before the 30-day window closes." },
      {
        kind: "p",
        text: "If the Pilot showed you that Pocket Agent can help move real work forward, do not restart from zero later.",
      },
      {
        kind: "p",
        text: "Keep the workspace going. Business Brain. Personas. Apps. Mission Control. That is the system.",
      },
      { kind: "button", label: "Use My Pilot Credit", href: LINKS.pricing },
    ],
  });
}

// Pilot Email 17: Day 30 — Final credit deadline
export function pilotDay30FinalDeadline(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Last day to use your $97 Pilot credit",
    blocks: [
      {
        kind: "p",
        text: "Today is the last day to use your $97 Pilot credit toward a Pocket Agent subscription.",
      },
      { kind: "p", text: "After today, the credit expires." },
      { kind: "p", text: "Choose your plan:" },
      {
        kind: "p",
        text: "Personal Brain — $37/month. Business Agent — $97/month. AI Agent Workspace — $497/month.",
      },
      { kind: "p", text: "If you want the main business workspace, choose Business Agent." },
      {
        kind: "p",
        text: "If you want Idea Engine, Lead Scout vertical packs, Decision Roundtable, and full cockpit, choose AI Agent Workspace.",
      },
      { kind: "button", label: "Use My $97 Credit Today", href: LINKS.pricing },
    ],
  });
}
