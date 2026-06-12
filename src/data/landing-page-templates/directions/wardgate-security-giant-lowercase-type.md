---
slug: wardgate-security-giant-lowercase-type
name: wardgate — Security / Giant Lowercase Type Over Video
vibe: dark, oversized type, lowercase, peach-accent, video-led
industries: cybersecurity, data privacy, vpn, password managers, cloud storage, compliance software, fintech security, infrastructure monitoring
source: motionsites.ai archive (catalog title "Guardnet", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
Black full-screen hero where the layout IS three giant lowercase words scattered across a background video. The words render at `text-[24vw]` mobile / `text-[18vw]` desktop with `letter-spacing: -0.04em; line-height: 0.95`, each absolutely positioned at a different height and side — one upper-left, one mid-right, one lower-center-left — so the eye zigzags down the viewport. A short low-key paragraph sits between them, and three stat blocks (`+2.7b`, `+90k`, `+450k` pattern) anchor the corners, each with a thin ANGLED hairline divider rotated ±20° beside the number. A bottom gradient fades the hero into the next section. The brand is all-lowercase throughout — nav, links, buttons — which reads quiet and confident against the huge type.

The navbar is a cluster of separate floating dark pills: a `bg-neutral-900/90` backdrop-blur pill for logo + wordmark, a second pill for the link row, and a solid white rounded CTA on the right. The logo is a sharp geometric four-quadrant SVG mark in white.

## Page layout
Four sections, all black. Hero (full-screen video + giant words), then a second full-screen video section with a floating center pill holding two buttons — a ghost "confirm real person" and a peach-gradient "run demo" — plus two offset paragraphs left and right. Then a client-logo section: a 2/4-column grid of `bg-neutral-950` rounded cards, each with a soft blurred color blob (navy, peach, yellow at blur-3xl, 25-40% opacity) behind a white SVG logo + wordmark, followed by a right-shifted paragraph and a gradient-border "Run Demo" button. Last, a "Key Benefits" 3-card grid of tall (`460px`) neutral-950 cards — two text cards with blurred navy blobs, one card that is 75% looping video fading into its caption. Sections stitch together with black gradient fades top and bottom.

## Typography
- Display + body: Jost (substitute for the prompt's Futura Md BT Medium) — geometric sans used everywhere, mostly font-light/medium
- Hero words: 18-24vw, `letter-spacing: -0.04em`, line-height 0.95, all lowercase
- Body copy runs 13-18px font-light at `text-white/70-90`; section heading "Key Benefits" at 3-5xl font-light with `-0.04em` tracking

## Color palette
- Background: pure black `#000`, cards `neutral-950`, nav pills `neutral-900/90`
- Text: white with opacity steps (`/90`, `/80`, `/70`)
- Peach gradient accent: `#FA8453` → `#F8C9B2` (demo button fill and 1.5px gradient border ring)
- Blob colors: deep navy `#1e3a8a`, peach `#FA8453`, yellow `#F5D547` — always blurred to soft glows

## Visual motifs
- **Giant lowercase words scattered over video** (the signature) — three viewport-scale words absolutely positioned at staggered heights and alternating sides, with a small paragraph threaded between them
- **Angled hairline stat dividers** — thin 1px white/40 lines rotated ±20° beside each stat number, like survey marks
- **Pill-cluster navbar** — logo pill, links pill, and white CTA as separate floating dark capsules
- **Peach gradient action** — the one warm element on the page; used as a button fill and as a thin gradient border ring around a black button
- **Blurred color blobs inside cards** — oversized blur-3xl circles in navy/peach/yellow glow behind logos and copy in near-black cards
- **Black gradient section stitching** — `from-black to-transparent` fades at section tops and bottoms so full-screen videos hand off without a hard cut
- **Video benefit card** — one grid card is 75% looping video that fades into its caption strip
- **Floating center pill with two buttons** — a dark blurred capsule holding a ghost action and the gradient action side by side

## When to use
- Cybersecurity, data privacy, VPN, and infrastructure brands that want presence without shouting features
- Products protecting something abstract (data, identity) — the giant calm words carry trust better than screenshots
- Brands with strong abstract or atmospheric video footage
- Companies that want a dark site with exactly one warm accent
- Audiences that respond to editorial confidence over dashboards

## When to NOT use
- Anyone who needs to show product UI above the fold — there is no screenshot anywhere
- Brands without video assets — three sections depend on looping footage
- Mobile-first conversion pages — the absolute word placement needs careful per-breakpoint tuning and rewards bigger screens
- Friendly consumer brands — all-lowercase + black reads guarded, not warm

## Build complexity
MEDIUM. No animation framework — motion is video loops and hover states — but the absolutely-positioned viewport-scale typography needs hand-tuning at every breakpoint, and there are three separate video sources to wrangle.

## Library cross-references
- Motif: `viewport-scale-scattered-words`
- Motif: `angled-hairline-stat-dividers`
- Motif: `pill-cluster-navbar`
- Motif: `gradient-border-ring-button`
- Motif: `blurred-color-blob-cards`
- Motif: `black-gradient-section-stitching`
- Typography: `jost-lowercase-light-geometric`
- Color palette: `black-peach-gradient-navy-blobs`
