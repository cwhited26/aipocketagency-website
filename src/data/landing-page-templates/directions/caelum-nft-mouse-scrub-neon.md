---
slug: caelum-nft-mouse-scrub-neon
name: Caelum.Nft — Mouse-Scrub Video / Neon Script Accent
vibe: dark, spacey, interactive, bold-condensed, neon-accent
industries: nft collections, web3 projects, digital art drops, game studios, space and astronomy brands, music releases, streetwear drops, creator collectives
source: motionsites.ai archive (catalog title "Orbis NFT", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
A full-screen video (`/placeholder-hero.mp4`) that never plays on its own — the visitor's MOUSE is the timeline. The video loads paused at frame zero; moving the cursor left or right scrubs the footage backward or forward. Each `mousemove` delta (normalized across the viewport width) is multiplied by a 0.8 sensitivity and the video duration, accumulated into a clamped target time, and applied through chained seeks — a new seek only fires after the previous `seeked` event lands, so no frames are dropped. Sweep your hand and the cosmos rolls past; stop and it holds.

Type sits bottom-left over the footage: a condensed all-caps display heading at up to 90px ("BEYOND EARTH / AND ( ITS ) FAMILIAR / BOUNDARIES" — the parenthetical aside is part of the typographic voice), line-height ~1.0, in soft off-white. Pinned to the heading's top-right corner floats the counterpunch: a handwritten script accent ("Nft collection") in electric green at up to 48px, rotated -1°, at 90% opacity with `mix-blend-mode: exclusion` so it reacts against whatever frame is beneath it.

## Page layout
One viewport, one interaction, one heading. Fixed nav on top: a geometric interlocking mark left, a dark center pill bar with five links (active link inverted to a white pill), and a "Reserve Yours" CTA with a live green dot right. Mobile drops the pill bar for a hamburger with a white dropdown sheet. Below the fold there is nothing — the scrub IS the page.

## Typography
- Display: Anton (Google Fonts) — condensed uppercase heading, 40px mobile to 90px desktop, leading 1.0–1.05
- Accent: Condiment (Google Fonts) — cursive script for the neon aside, 24–48px
- The pairing is the identity: industrial condensed caps annotated by a handwritten neon scrawl

## Color palette
- Background: deep space navy `#010828`
- Heading: cream off-white `#EFF4FF`
- Accent script: neon green `#6FFF00` with exclusion blend
- Nav: gray-900 pill bar, white active pill, green-400 status dot

## Visual motifs
- **Mouse-scrubbed video timeline** (the signature) — horizontal cursor movement drives video playback with chained, drop-free seeks
- **Neon script over condensed caps** — a rotated handwritten accent pinned to the heading corner, blending against the footage
- **Parenthetical headline voice** — the heading carries a typographic aside "( its )" like marginalia
- **Pill navigation with inverted active state** — dark center pill bar, current page as a white pill
- **Live status dot CTA** — "Reserve Yours" with a small green dot reading as a live drop
- **Liquid-glass utility** — a masked gradient-border glass class ships in the design system for secondary surfaces

## When to use
- NFT and digital-art collection drops where the artwork is motion-rendered
- Web3 and game projects teasing a world before launch
- Music, fashion, and streetwear drops built on one cinematic loop
- Space, astronomy, and sci-fi brands with orbital or cosmic footage
- Single-CTA reservation pages where exploration beats explanation

## When to NOT use
- Touch-first audiences — there is no mouse to scrub; mobile needs an autoplay fallback that loses the trick
- Brands needing content depth on page one; this is a poster, not a site
- Corporate or trust-sensitive categories — neon-script crypto styling reads wrong (use `cognitra-ai-agency-gray-panel`)
- Full agency sites wanting page-wide scrub navigation (use `mainframe-mouse-scrub-agency`)

## Build complexity
LOW complexity. One section, one video, and a contained seek-chaining handler; the rest is standard Tailwind. The render-farm-quality clip is the only real cost.

## Library cross-references
- Motif: `mouse-scrub-video-timeline`
- Motif: `neon-script-accent-exclusion-blend`
- Motif: `parenthetical-display-headline`
- Motif: `pill-nav-inverted-active`
- Motif: `live-status-dot-cta`
- Typography: `anton-condiment-neon-pairing`
- Color palette: `space-navy-cream-neon-green`
