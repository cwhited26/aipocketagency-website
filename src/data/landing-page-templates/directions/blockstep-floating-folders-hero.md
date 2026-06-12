---
slug: blockstep-floating-folders-hero
name: Blockstep — Project Management / Floating Folders + Sticky Note Hero
vibe: light, playful, skeuomorphic, organized, friendly
industries: project management SaaS, productivity tools, team collaboration software, agencies selling process, task apps, creative ops tools, startup tools
source: motionsites.ai archive (catalog title "Prioritize", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A near-white `#FDFDFD` page holding one massive hero card: white, 85vh minimum, 2.5rem radius, hairline black-10% border, filled edge-to-edge with a dot-grid texture (1px black-8% radial dots on a 20px grid). Centered content is clean SaaS — the brand mark (three staggered blocks stepping up bottom-left to top-right in `#2563EB`) in a drop-shadowed white tile, an h1 up to 7xl ("Draft, build, and ship / every single idea." with the second line in gray), a one-line subtitle, and a blue rounded-xl CTA that pops in with a scale.

The personality lives in FOUR FLOATING DESK-OBJECT GROUPS hung around the edges, each anchored partly off-canvas. Top-left: a yellow sticky note (`#FFF188`, red pin dot, handwritten Caveat text) tilted 2-3°, plus a translucent folder icon with a blue check card. Bottom-left: a 450px pale folder labeled "Active Sprints" holding two real task cards — colored numeric badges, project names, overlapping avatar stacks, date badges and progress bars (one showing red overage). Bottom-right: a folder labeled "Integrations" with three white tiles holding mail, chat, and calendar icons in their product colors. Top-right: a "Deadlines" folder with a meeting card (time badge in light blue `#E1F5FE` with `#03A9F4` text), a tilted timer tile sliding in from the left, and an empty translucent folder laid on top at 15° as a finishing layer. Each group enters on its own delay (0.4s → 1.4s), fading, rising, and settling into a slightly different rotation.

## Page layout
Navbar plus the single hero card. Nav: brand mark + wordmark left, four center links, "Sign in" text + a white bordered "Try for free" button right; mobile collapses to a hamburger dropdown where the CTA flips to solid blue. The floating groups scale down hard on smaller screens (40-90% across breakpoints) so they decorate without colliding; the centered stack holds the conversion path on every size.

## Typography
- Display + body: Inter (weights 100-500) — the headline stays in light-to-regular weights, hierarchy from size and the gray second line
- Accent: Caveat (Google Fonts, 400-700) — handwritten sticky-note text at ~21px in soft charcoal `#424242`

## Color palette
- Page `#FDFDFD`, hero card white `#ffffff` with dot-grid `rgba(0,0,0,0.08)`
- Brand blue `#2563EB` (logo, CTA, check tile) with a blue-tinted shadow
- Sticky note `#FFF188` with pin red `#D32F2F`
- Folder fill `#F2F3F5`; task badges orange `#FF5722` and green `#00C853`; progress blue `#00BFFF`, overage red `#FF5252`
- Text near-black `#141414`, grays at 400-500 level

## Visual motifs
- **Giant translucent folders holding live UI** (the signature) — oversized pale folder icons used as trays, each carrying real task cards, integration tiles, or meeting cards, tilted a few degrees and pinned half off-canvas
- **Handwritten sticky note with pin** — a yellow note in Caveat script with a red pin dot, the analog touch against the digital cards
- **Dot-grid hero card** — a fine radial-dot texture giving the white canvas a planner-paper feel
- **Task cards with avatar stacks** — numeric badges, overlapping avatars, date chips, and progress bars (including a red over-budget state) as decoration that doubles as product preview
- **Staggered settle-in choreography** — each corner group fades, rises, and rotates into rest on sequential delays across a full second
- **Stepped-block brand mark** — three blocks climbing diagonally, repeated in nav and hero tile
- **Tilted timer tile** — a small white block with a timer icon sliding in last, slightly rotated

## When to use
- Project management, task, and collaboration tools — the floating cards ARE the product demo
- Productivity brands that want warmth and play without losing credibility
- Agencies or consultancies selling organized process
- Products whose real UI is card-based — the decoration previews actual screens
- Startups that want a hero with personality but a conventional conversion path in the center

## When to NOT use
- Serious enterprise or compliance software — the sticky notes and tilts read casual
- Brands with no UI to show — the floating groups need believable product content
- Mobile-dominant traffic — the desk-object groups shrink to ornament below tablet size
- Dark, technical brands (use `ciphra-pink-arc-neumorphic-pipeline`)

## Build complexity
MEDIUM. No scroll engineering, but four absolutely positioned composition groups with per-breakpoint scaling and a dozen small fake-UI cards take patient layout tuning.

## Library cross-references
- Motif: `oversized-folder-tray-compositions`
- Motif: `handwritten-sticky-note-pin`
- Motif: `dot-grid-hero-card`
- Motif: `fake-ui-task-cards-decoration`
- Motif: `staggered-settle-entrance`
- Motif: `stepped-block-brand-mark`
- Typography: `inter-light-caveat-handwriting`
- Color palette: `near-white-brand-blue-sticky-yellow`
