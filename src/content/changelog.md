# Changelog

Everything shipped in Pocket Agent, newest first. Dates are when the code landed on main.

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
