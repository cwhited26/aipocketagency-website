# Changelog

Everything shipped in Pocket Agent, newest first. Dates are when the code landed on main.

---

## June 8, 2026

### New app: Lead Scout

Drop a list of company or person URLs and Pocket Agent visits each one, pulls out a structured profile — who they are, what they do, whether they're a fit — sorts them hot / warm / cold, and hands you the batch to review with a CSV you can export. A lead list becomes its own Project, so you can keep working it over time.

### YouTube, read for you

Paste a YouTube link into any conversation and your agent reads the video. It pulls the transcript, works out what kind of video it is — a competitor, a tactic worth borrowing, a customer testimonial, an industry roundup — and files what matters into your brain. Paste a *channel* link instead and it'll watch that channel for new episodes — real-time, daily, or weekly, your call — and surface each new one when it lands.

### Text your agent

Pocket Agent has its own phone number now. Text it like you'd text a person. Send a voice memo and it transcribes it; send a photo and it reads it. It replies right there over text. Set it up in **Settings → Connections**.

### Email your agent

Two new addresses. Forward an email to your `inbound` address and Pocket Agent acts on it — reads the thread, pulls any attachments into your brain, replies when you want. BCC your `bcc` address on an email you send and it quietly logs the thread and watches for the reply, then drafts your follow-up when it comes in. Set both up in **Settings → Inbound email**.

### Slack, both ways

DM Pocket Agent in Slack or @mention it in any channel, and it answers in place. No more bouncing back to the app to ask it something.

### Snap a photo from your iPhone

Set up the Shortcut in **Settings → API keys** and you can send a photo straight from your phone's share sheet. Your agent reads it and replies — a receipt, a business card, a whiteboard, a sign.

### Drop an image into chat

There's a paperclip and a camera on the Ask box now. Attach a screenshot, a receipt, a photo, or a PDF and your agent reads both the text and the layout, shows you exactly what it saw, then works from it.

### Mission Control

The Inbox is now Mission Control: a live view of everything your agent is running right now, everything scheduled, and everything waiting on your decision — sorted by urgency. Tap any tile to jump straight to that section. It also keeps an eye out for stuck work and flags it instead of letting it sit.

### Projects hold context

A Project is now a place, not just a to-do. Give it its own instructions, its own memory, and reference files, and every conversation you link to it inherits all of that. A readiness pill tells you when a Project has enough to actually run.

### Calendly and Zoom

Connect Calendly to send booking links and Zoom to create meetings. When you're scheduling with an outside prospect, your agent reaches for the right one and drops the link into the calendar invite or the email for you.

### Honest pricing

The pricing page now shows what you'd otherwise pay for the same stack — an assistant, a prospecting tool, a CRM, an email AI, and the rest — and spells out the part that matters most: your brain is a git repo on your own GitHub. You own it forever, and you can take it with you.

**Also:** the agent stopped claiming it has "no GitHub access" when it can already read your brain repo; the home-screen setup checklist stays put until you finish it or dismiss it; fixed a sign-in redirect that was breaking the Calendar connect; cleaned up duplicate "try one of these" suggestions; the mascot breathes and reacts now; and every tab got rewritten in plain English with real examples.

---

## June 7, 2026

### Your agent knows what it's connected to

Pocket Agent now sees its own connections. Ask it to check your email or your calendar and it actually does, right there in the conversation, instead of giving you a canned "I can't do that."

### Gmail: send as you

When your agent drafts a reply, approving it sends the message from your own Gmail — threaded into the original conversation and saved in your Sent folder. No more copy-paste hand-off. It can also stage a draft in Gmail without sending, if you'd rather send it yourself.

### Connect your books

QuickBooks Online and Stripe. Your agent can read your customers, invoices, and P&L, and — only after you approve — create an invoice, record a payment, send a payment link, or issue a refund. Refunds always ask first. Every time.

### Google Calendar

Connect your calendar and your agent can see what's coming, propose times, and create, move, or cancel events. Anything that changes the calendar waits for your yes.

### Slack

Post to a channel, reply in a thread, or send a DM — all approval-gated.

### System email that actually reaches you

Your Daily Brief, "something needs your approval" pings, and "a connection needs reconnecting" notices now arrive as real email, not just in-app.

### New tabs up top

Inbox, Calendar, Email, Projects, and Connections are each their own place in the nav now. Tapping the agent lands you on your thread list instead of a blank screen.

**Also:** every file you capture — from chat or from your phone's share sheet — now lands in Documents; the Daily Brief and routine results show "Mark as read / Save to brain" instead of an Approve button that never fit them; and a couple of screens that were getting cut off on mobile now scroll properly.

---

## June 5, 2026

### Connect your Gmail

The first real connection. Pocket Agent syncs your inbox every few minutes and surfaces what needs a reply, with three one-tap actions on each.

### Build a team of agents

Personas: spin up specialized agents from five templates — or your own — each with its own focus and memory, and chat with them directly. Built for the kind of work you'd otherwise hand to a hire.

### Bring your own AI model

Point Pocket Agent at whichever model you want: the managed Claude, your own Anthropic key, OpenAI, Groq, xAI's Grok, or any OpenAI-compatible endpoint.

### A public API

There's now a REST API and key management for your brain, memory, personas, and privacy zones — with docs — for the developers in the room.

**Also:** the unified pricing ladder went live with working checkout, and a gap that could charge a card without setting up the tier behind it was closed.

---

## June 4, 2026

### Capture Inbox cleanup

Long URLs no longer overflow the card, note cards are tappable, and old leftover items get filtered out so the inbox shows what you actually captured.

---

## June 3, 2026

### Routines, steadier

Recurring tasks won't pile up duplicates anymore, and when one hits a snag you get a clear message instead of a broken screen.

---

## June 2, 2026

### Voice memos

Capture a thought out loud and Pocket Agent transcribes it straight into your brain.

### Inbox, finished

Drafts and a decisions queue, so everything waiting on you lives in one place.

**Also:** a pricing update, plus a batch of fixes across capture and the email drafter.

---

## May 31, 2026

### Your brain, indexed

A backfill pass reads everything already sitting in your brain repo and makes it searchable to your agent — so it can use what you've collected, not just what you tell it today.

**Also:** a welcome email on signup, a cleaner settings checklist, a glow on the input box, and a fix for a 404 when landing on **/app**.

---

## May 26, 2026

### Share to brain from your iPhone

A share-sheet token and setup page so you can send things into your brain from anywhere on iOS.

### Routines

Recurring agent tasks on a schedule that deliver their results to your Inbox.

### Capture Inbox

A viewer for everything you've captured but haven't filed yet.

---

## May 25, 2026

### Brain task list + Customer Avatar

The Brain page now has a gamified "Build your brain" checklist — seven tasks worth a combined 105 points. Complete each one to unlock sharper agent output. Customer Avatar is the biggest task: define the specific person you sell to (their job, their pains, what makes them bite), and every draft your agent writes gets aimed at that person. The avatar form lives at **/app/brain/avatar**.

**Also:** mobile header visibility fix — the top bar no longer obscures content on small screens.

### Brain repo change flow

New panel in Settings: connect an existing brain repo by name, or fork the official template into your GitHub account to start fresh. Honest confirm copy before anything destructive happens.

---

## May 25, 2026 (earlier)

### Alien mascot + tentacle nav hub

The Pocket Agent mascot is now a proper component with animated states: idle, thinking, working, inbox mode, and brain mode. The hub on the home screen shows its tentacles as nav entry points. Fix: tendrils were visible before interaction — now they appear on hover/tap only.

---

## May 24, 2026

### Approval gate — first reversible write

Your agent can now propose memory updates to your brain. When it decides something is worth remembering from a conversation, it stages a proposal in your **Inbox** instead of writing directly. You review the proposed content, then Approve or Reject. Nothing gets committed to your brain repo without your explicit yes.

This is the first "write" action the agent can take — and it's fully reversible at the approval step.

### Secrets vault + Google OAuth scaffolding

Behind the scenes: AES-256-GCM encrypted vault for storing OAuth tokens, HMAC-signed state parameter for secure OAuth flows. The Connections panel in Settings is now wired — Google read-only access (Gmail + Calendar) is the first integration coming.

### ⌘K command palette

Open the command palette with ⌘K (Mac) or Ctrl+K (Windows/Linux) from anywhere in the app. Tap the palette button in the left rail on mobile. Jump to any section without touching the nav.

### Brain freshness + weekly digest

The Brain page now shows which areas are fresh, which are getting stale, and which haven't been filled yet. Thresholds: warn at 14 days without an update, stale at 30+. The **Weekly Read** button generates an AI digest of everything currently in your brain — useful for reviewing what the agent knows before an important draft.

### Documents tab + activity feed

New Documents tab: browse every file in your brain repo, open any markdown file in a clean reader. The Activity Feed on the home hub replaced a placeholder panel — it now shows recent brain writes and agent actions.

### Work apps: six surfaces launched

- **Quote / Proposal Writer** — paste a client name and scope, get a structured proposal in your voice
- **Email Drafter** — tell it who, why, and what; get a draft that sounds like you
- **Follow-up Radar** — surfaces cold leads and drafts the nudge
- **Daily Brief** — morning read: what's on the radar, what's pending, the one thing to move on
- **Inbox** — approval desk for agent proposals (live now)
- **Calendar** — upcoming items from your brain (live calendar sync coming with Connections)

### Feed your brain: file upload + Capture page

Upload files directly to your brain repo from **/app/capture** — PDF, TXT, Markdown. Files are committed to the `uploads/` folder in your repo. The Capture page also lets you write freeform notes into any brain area on the fly.

### Premium app shell redesign

Left rail navigation, alien nav hub on the home screen, new conversation start flow. This replaced the earlier single-panel layout.

### Mascot + brand hero

Brand mascot introduced, hero section added to the premium dashboard.

---

*Pocket Agent is actively built. New features ship weekly.*
