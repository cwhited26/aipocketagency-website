---
slug: terraway-travel-split-clip-headline
name: Terraway — Split-Screen Luxury Travel
vibe: warm, editorial, split-screen, multi-page, curated
industries: tour operators, luxury travel, destination marketing, travel agencies, retreat companies, expedition outfitters, boutique hospitality, experience curation
source: motionsites.ai archive (catalog title "Scenic Travel", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
Split-screen travel hero on warm sand `#f3ebe4`. The left half of the viewport is flat sand color; the right half is a full-bleed destination video (focal point pinned left, easing in from 1.06x scale over 2.2s). The signature is the headline: the SAME centered two-line heading is rendered twice in perfectly aligned layers, one ink-dark and clipped to the left half (`clip-path: inset(0 50% 0 0)`), one white and clipped to the right half — so a single sentence reads dark on sand and white on video with a razor edge exactly at the screen's midline. Each line clip-reveals upward from 110% inside overflow-hidden wrappers on the shared easing curve `[0.76, 0, 0.24, 1]`, followed by a body paragraph fading up.

Bottom-right of the video sits a "Hidden Gems" card: white, 32px radius, holding a small looping video thumbnail, a two-sentence teaser, and a black pill "Explore more" button, rising in at 0.5s. Navigation is unconventional — a star glyph fixed top-left whose color flips by route, a hamburger top-right opening a fullscreen white menu (slides down, text-5xl to 7xl light links that italicize on hover, the active route prefixed with a slash), and on desktop a quiet vertical link list fixed bottom-left in 13px letterspaced caps. Below 850px the split collapses: the video fills the viewport, the dark text layer hides, and the gem card docks to the bottom edge as a fixed rounded-top sheet.

## Page layout
A small multi-page site, not a single hero. Page two (/destinations) is a search-led catalog: an oversized transparent search input (clamp 24-42px, centered, light placeholder at 20% black), a "Popular" label, and a horizontally scrolling row of tour cards with deliberately varied widths and heights (200-340px wide, 215-360px tall) so the shelf reads hand-arranged; video-backed cards show a paused first frame that plays only on the detail page. Page three (/destinations/[id]) is a full-bleed destination video or photo with a sand-colored info card pinned bottom-right: back link, title, description, overlapping friend avatars with a "+N friends been there" chip, three label/value rows (avg cost, best time, visa), a three-up thumbnail grid, and a full-width dark "Book this tour" button. A matching minimal 404 (giant 10%-black "404") catches everything else.

## Typography
- Display + body: Inter (Google Fonts, weights 300-500) — headlines at `clamp(42px, 6vw, 80px)`, weight 300, tracking -0.04em; the luxury comes from lightness and tracking, not a second face
- Detail-card values at text-sm bold against 40%-black uppercase letterspaced labels

## Color palette
- Base: `#f3ebe4` warm sand — page background and info cards
- Ink: `#1c1c1c` near-black text; buttons `#0f1115`
- White: the right-half headline layer, gem card, and menu panel
- Muted: black at 10-45% opacities for labels, placeholders, and the 404
- Selection: black background, white text

## Visual motifs
- **Split clip-path headline** (the signature) — one headline drawn twice and clipped at the 50% line, dark over the sand half, white over the video half
- **Half-and-half hero** — flat warm color left, full-bleed video right, with the seam down the exact center
- **Hidden gems card** — a white rounded card with its own looping video thumb and a black pill CTA, floating on the hero's corner
- **Hand-arranged card shelf** — destination cards at varied widths and heights in a horizontal scroll, staggered into view
- **Giant quiet search** — a 42px transparent input with a faint placeholder as the entire catalog header
- **Sand info card** — the booking panel as a rounded card over the destination video: avatars, cost/season/visa rows, thumbnail trio, dark book button
- **Route-aware star mark** — a fixed star glyph that swaps black/white depending on the page behind it
- **Slash-prefix active nav** — current page marked with a leading "/" in both the fullscreen menu and the bottom-left desktop list
- **Bottom-sheet mobile collapse** — under 850px the gem card becomes a fixed rounded-top sheet and the dark headline layer disappears

## When to use
- Tour operators and travel curators with a real catalog of trips
- Luxury and small-group travel brands selling editorial calm over deal pressure
- Destination marketing organizations with strong footage per location
- Retreats and expedition outfitters that want browse → detail → book in three screens
- Brands wanting one signature visual trick (the split headline) that no template competitor has

## When to NOT use
- Single-offer travel brands — a one-screen hero serves them better (use `driftway-travel-glass-parallax`)
- Deals-led or volume agencies; the unhurried tone buries urgency
- Teams without per-destination photo/video assets — the catalog and detail pages expose gaps
- Tight scopes: this is a multi-page build with routing, search, and a 404, not a landing page

## Build complexity
HIGH. Multi-page routing, the dual-layer clip-path hero, the variable-card catalog, and the detail-card system make this a multi-day build. Quote above a standard landing page.

## Library cross-references
- Motif: `split-clip-path-dual-headline`
- Motif: `half-color-half-video-hero`
- Motif: `floating-teaser-card`
- Motif: `varied-card-horizontal-shelf`
- Motif: `giant-transparent-search`
- Motif: `route-aware-fixed-mark`
- Motif: `mobile-bottom-sheet-collapse`
- Typography: `inter-light-tight-luxury`
- Color palette: `warm-sand-ink-white`
