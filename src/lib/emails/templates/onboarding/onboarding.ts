// lib/emails/templates/onboarding/* — the 12 universal post-purchase onboarding emails (Part 5B).
// Day 0 → Day 14. GPT-Hormozi voice rides verbatim (no slop scan, no swaps). Each is a pure data
// function returning { subject, html, text } via composeEmail.

import { composeEmail, type RenderedEmail } from "../../render";
import { LINKS, type BaseEmailProps } from "../shared";

// ── Email 0: Immediate purchase confirmation ──────────────────────────────────────────────────────
export function day0PurchaseConfirmation(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    transactional: true, // the purchase receipt — always delivers
    subject: "Your Pocket Agent workspace is ready",
    blocks: [
      { kind: "p", text: "You're in." },
      { kind: "p", text: "Your Pocket Agent workspace is active." },
      { kind: "p", text: "Log in here: app.aipocketagent.com" },
      { kind: "p", text: "Do not try to build everything today." },
      { kind: "p", text: "Your first goal is simple:" },
      { kind: "p", text: "3 Business Brain assets. 3 trained Personas. 3 working workflows." },
      { kind: "p", text: "That is 3-3-3 activation." },
      {
        kind: "p",
        text: "Start with your Business Brain. Your Business Brain is your company memory in markdown, stored in your own git repo.",
      },
      { kind: "p", text: "Add useful context first:" },
      {
        kind: "p",
        text: "Your offer. Your services. Your FAQs. Your best emails. Your customer notes. Your screenshots. Your saved links. Your past AI chats. Your workflows. Your brand voice.",
      },
      {
        kind: "p",
        text: "After that, join the Pocket Agent Launchpad on Skool and follow the 7-Day Setup Plan.",
      },
      { kind: "p", text: "Generic AI starts from zero. Pocket Agent starts from your business." },
      { kind: "button", label: "Set Up My Business Brain", href: LINKS.businessBrain },
    ],
  });
}

// ── Email 1: Join the Launchpad ───────────────────────────────────────────────────────────────────
export function day0JoinLaunchpad(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Your next step: join the Pocket Agent Launchpad",
    blocks: [
      {
        kind: "p",
        text: "Your Pocket Agent subscription includes access to the Pocket Agent Launchpad.",
      },
      { kind: "p", text: "This is not a random community. It is the implementation hub." },
      { kind: "p", text: "Inside, you get:" },
      {
        kind: "p",
        text: "7-Day Setup Curriculum. Business Brain walkthroughs. Persona setup examples. Workflow installation training. Mission Control review process. Idea Engine examples. Lead Scout demos. Weekly implementation labs. Wins channel.",
      },
      {
        kind: "p",
        text: "Your first target is 3-3-3 activation: 3 Business Brain assets. 3 trained Personas. 3 working workflows.",
      },
      { kind: "p", text: "Software gives you the workspace. The Launchpad helps you install it." },
      { kind: "button", label: "Join The Pocket Agent Launchpad", href: LINKS.launchpad },
    ],
  });
}

// ── Email 2: Day 1 — Business Brain ───────────────────────────────────────────────────────────────
export function day1BusinessBrain(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Your AI needs a brain first",
    blocks: [
      { kind: "p", text: "Day 1 is Business Brain." },
      {
        kind: "p",
        text: 'Most people start with the wrong question. They ask: "What prompt should I use?"',
      },
      { kind: "p", text: "Wrong." },
      {
        kind: "p",
        text: 'The better question is: "What should Pocket Agent know about my business before it does any work?"',
      },
      {
        kind: "p",
        text: "Your Business Brain is your company memory in markdown, stored in your own git repo.",
      },
      { kind: "p", text: "Today, add 3 assets:" },
      {
        kind: "p",
        text: "1. Your offer — What do you sell? Who is it for? What problem does it solve? What makes it different?",
      },
      {
        kind: "p",
        text: "2. Your voice — Add examples of emails, posts, pages, or messages that sound like you.",
      },
      {
        kind: "p",
        text: "3. Your customer questions — Add common questions, objections, support issues, and buying triggers.",
      },
      { kind: "p", text: "Do not make this perfect. Make it useful." },
      { kind: "button", label: "Add My First 3 Business Brain Assets", href: LINKS.documents },
    ],
  });
}

// ── Email 3: Day 2 — First Persona ────────────────────────────────────────────────────────────────
export function day2Persona(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Day 2: clone your first Persona",
    blocks: [
      { kind: "p", text: "Day 2 is your first Persona." },
      { kind: "p", text: "A Persona is the WHO. It is the trained AI role." },
      { kind: "p", text: "Pocket Agent ships with 7 clone-and-customize Personas:" },
      {
        kind: "p",
        text: "Admin Assistant. Sales Assistant. Follow-Up Agent. Content Creator. Email Drafter. Lead Researcher. Operations Chief of Staff.",
      },
      { kind: "p", text: "Do not clone all seven today. Pick one." },
      { kind: "p", text: "Choose based on your biggest bottleneck:" },
      { kind: "p", text: "Admin chaos? Start with Admin Assistant." },
      { kind: "p", text: "Leads slipping? Start with Follow-Up Agent." },
      { kind: "p", text: "Content backlog? Start with Content Creator." },
      { kind: "p", text: "Email drag? Start with Email Drafter." },
      { kind: "p", text: "Prospecting? Start with Lead Researcher." },
      { kind: "p", text: "Operations messy? Start with Operations Chief of Staff." },
      {
        kind: "p",
        text: "Your job today: Clone one Persona. Customize its role. Tell it what to do. Tell it what not to do. Send output to Mission Control.",
      },
      { kind: "button", label: "Clone My First Persona", href: LINKS.personas },
    ],
  });
}

// ── Email 4: Day 3 — First Workflow ───────────────────────────────────────────────────────────────
export function day3Workflow(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Day 3: install your first workflow",
    blocks: [
      { kind: "p", text: "Day 3 is your first workflow." },
      { kind: "p", text: "A Persona is the role. An App is the tool. A Persona uses Apps." },
      { kind: "p", text: "That is what makes Pocket Agent different from a blank chatbot." },
      { kind: "p", text: "Today, install one workflow." },
      {
        kind: "p",
        text: "Use this formula: Trigger. Persona. App. Input. Output. Review step. Approval rule. Success metric.",
      },
      { kind: "p", text: "Example:" },
      {
        kind: "bullets",
        items: [
          "Trigger: A lead has not responded.",
          "Persona: Follow-Up Agent.",
          "App: Follow-Up Sweeps.",
          "Input: Conversation context.",
          "Output: Follow-up draft.",
          "Review step: Mission Control.",
          "Approval rule: Owner approves before sending.",
          "Success metric: Follow-up sent.",
        ],
      },
      { kind: "p", text: "Do not build a complicated workflow first. Build one useful loop." },
      { kind: "button", label: "Install My First Workflow", href: LINKS.apps },
    ],
  });
}

// ── Email 5: Day 4 — Mission Control ──────────────────────────────────────────────────────────────
export function day4MissionControl(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Day 4: review Mission Control",
    blocks: [
      { kind: "p", text: "Day 4 is Mission Control." },
      {
        kind: "p",
        text: "Mission Control is the cockpit. This is where you review what Pocket Agent captured, drafted, researched, queued, summarized, built, and prepared.",
      },
      { kind: "p", text: "Business owners do not want AI running wild. Good. That fear is rational." },
      {
        kind: "p",
        text: "You should review before sending. Approve before publishing. Edit before client-facing use.",
      },
      { kind: "p", text: "Mission Control helps you check:" },
      {
        kind: "p",
        text: "Email drafts. Follow-up drafts. Captured ideas. Lead Scout results. Idea Engine outputs. Landing page drafts. Podcast summaries. YouTube summaries. Pending approvals. Next actions.",
      },
      { kind: "p", text: "Your job today: Open Mission Control and review one item." },
      { kind: "p", text: "AI does the prep. You stay in control." },
      { kind: "button", label: "Open Mission Control", href: LINKS.missionControl },
    ],
  });
}

// ── Email 6: Day 5 — Email + Follow-Up ────────────────────────────────────────────────────────────
export function day5Followup(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Day 5: catch money in the cracks",
    blocks: [
      { kind: "p", text: "Day 5 is email and follow-up." },
      { kind: "p", text: "This is where Pocket Agent can touch real revenue." },
      {
        kind: "p",
        text: "Most leads do not disappear because the offer is bad. They disappear because nobody followed up.",
      },
      {
        kind: "p",
        text: "The conversation got buried. The quote sat. The proposal never got chased. The owner got busy.",
      },
      { kind: "p", text: "Today, use either Email Drafter or Follow-Up Sweeps." },
      {
        kind: "p",
        text: "Your goal: Generate 3 drafts. Review them in Mission Control. Approve or edit one.",
      },
      {
        kind: "p",
        text: "This is how Pocket Agent becomes useful. Not by exploring features. By moving one real conversation forward.",
      },
      { kind: "button", label: "Run My First Follow-Up Sweep", href: LINKS.followUpSweeps },
    ],
  });
}

// ── Email 7: Day 6 — Capture Inbox ────────────────────────────────────────────────────────────────
export function day6Capture(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Day 6: stop losing ideas",
    blocks: [
      { kind: "p", text: "Day 6 is Capture Inbox." },
      {
        kind: "p",
        text: "Most owners do not have an idea problem. They have a processing problem.",
      },
      {
        kind: "p",
        text: "They hear something on a podcast. They save a YouTube video. They screenshot a competitor. They record a voice memo. They get a thought in the shower.",
      },
      { kind: "p", text: "Then nothing happens." },
      { kind: "p", text: "Capture Inbox gives raw ideas a place to go." },
      {
        kind: "p",
        text: "Today, add 3 items: A voice memo. A screenshot. A saved link. A customer question. A podcast insight. A YouTube idea. A rough offer idea.",
      },
      {
        kind: "p",
        text: "Then use your Content Creator Persona to turn one of them into a usable asset. A post. An email. A landing page section. A hook. A video script. A newsletter idea.",
      },
      { kind: "p", text: "Do not trust your memory. Capture it. Process it. Review it." },
      { kind: "button", label: "Open Captures Dashboard", href: LINKS.captureInbox },
    ],
  });
}

// ── Email 8: Day 7 — 3-3-3 Activation ─────────────────────────────────────────────────────────────
export function day7Activation(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Day 7: complete your 3-3-3 setup",
    blocks: [
      { kind: "p", text: "Day 7 is your activation review." },
      { kind: "p", text: "Your first milestone is 3-3-3." },
      {
        kind: "p",
        text: "Check your setup: Do you have 3 Business Brain assets? Do you have 3 trained Personas? Do you have 3 working workflows? Did you review output in Mission Control?",
      },
      { kind: "p", text: "If yes, Pocket Agent is now installed at the basic level." },
      {
        kind: "p",
        text: "If no, find the missing piece. Most users are missing one of these: Not enough Business Brain context. Too many Personas and no workflow. Workflow installed but no Mission Control review.",
      },
      { kind: "p", text: "Fix the missing link." },
      { kind: "p", text: "Then post your 3-3-3 win inside the Pocket Agent Launchpad." },
      {
        kind: "p",
        text: "Remember the guarantee: Complete the Launch Kit's 7-day setup steps. If you don't have 3 trained Personas and 3 working workflows inside Pocket Agent by day 7, we help you finish the setup.",
      },
      { kind: "button", label: "Complete My 3-3-3 Setup", href: LINKS.app },
    ],
  });
}

// ── Email 9: Day 8 — What To Build Next ───────────────────────────────────────────────────────────
export function day8Next(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "Now stack the next loop",
    blocks: [
      { kind: "p", text: "Once you hit 3-3-3, do not stop. Now stack the next loop." },
      {
        kind: "p",
        text: "Ask: Where did Pocket Agent save time? Where did it prepare something useful? Which Persona was most useful? Which App should you use more? Which workflow should repeat weekly? What should go into Mission Control daily?",
      },
      { kind: "p", text: "Choose the next workflow based on your constraint." },
      { kind: "p", text: "Need more prospects? Use Lead Scout." },
      { kind: "p", text: "Need more ideas shipped? Use Idea Engine." },
      { kind: "p", text: "Need more content? Use YouTube Ingester or Podcast Ingester." },
      { kind: "p", text: "Need better decisions? Use Decision Roundtable." },
      { kind: "p", text: "Need execution? Use Build Tools." },
      { kind: "p", text: "Do not add random complexity. Add the next workflow that creates leverage." },
      { kind: "button", label: "Choose My Next Workflow", href: LINKS.apps },
    ],
  });
}

// ── Email 10: Day 10 — Usage + Upgrade Education ──────────────────────────────────────────────────
export function day10Usage(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "When should you upgrade?",
    blocks: [
      {
        kind: "p",
        text: "Pocket Agent plans include usage allowances. Your tier comes with leads, Whisper hours, and sub-agent runs.",
      },
      { kind: "p", text: "If you hit a cap, upgrade to the next tier." },
      { kind: "p", text: "No surprise bills. Flat monthly bill. Clear usage allowances." },
      { kind: "p", text: "Here is the simple upgrade rule:" },
      { kind: "p", text: "If you only need one brain, stay on Personal Brain." },
      { kind: "p", text: "If you want business workflows, use Business Agent." },
      {
        kind: "p",
        text: "If you want Idea Engine, Lead Scout vertical packs, Decision Roundtable, and the full cockpit, use AI Agent Workspace.",
      },
      {
        kind: "p",
        text: "If your agents are doing useful work and you hit limits, that is not a problem. That means the workspace is working.",
      },
      { kind: "p", text: "Upgrade when your business needs more execution." },
      { kind: "button", label: "Review My Plan", href: LINKS.pricing },
    ],
  });
}

// ── Email 11: Day 14 — Retention Check ────────────────────────────────────────────────────────────
export function day14Retention(pr: BaseEmailProps): RenderedEmail {
  return composeEmail({
    recipientEmail: pr.email,
    subject: "What has Pocket Agent done for you so far?",
    blocks: [
      { kind: "p", text: "You are 14 days in. Do a simple review." },
      {
        kind: "p",
        text: "What did Pocket Agent help you: Draft? Research? Capture? Summarize? Build? Queue? Review? Approve?",
      },
      {
        kind: "p",
        text: "Which Persona was most useful? Which workflow should repeat weekly? Which output was bad? What context does your Business Brain still need? What should you build next?",
      },
      {
        kind: "p",
        text: "If you have not hit 3-3-3 yet, go back to the Launchpad and finish the setup path.",
      },
      { kind: "p", text: "If you have hit 3-3-3, stack the next workflow." },
      { kind: "p", text: "Pocket Agent gets more valuable as your Business Brain gets better." },
      { kind: "p", text: "Generic AI starts from zero. Pocket Agent starts from your business." },
      { kind: "button", label: "Open Mission Control", href: LINKS.missionControl },
    ],
  });
}
