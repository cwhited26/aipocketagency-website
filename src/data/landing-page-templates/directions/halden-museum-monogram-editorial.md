---
slug: halden-museum-monogram-editorial
name: Halden Museum — Giant Monogram Editorial
vibe: editorial, monochrome, archival, mono-labeled, exhibit-like
industries: museums, galleries, cultural institutions, exhibitions, heritage sites, science centers, universities, foundations
source: motionsites.ai archive (catalog title "Neo Museum", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
An off-white `#fcfcfc` page that opens not with a headline but with the BRAND ITSELF: a full-width three-letter monogram ("HMN" — Halden Museum of Nature) drawn as a custom inline SVG where every letter is built from simple polygons — verticals, diagonals, crossbars. Each polygon slides up from `y: 120` with a long expressive ease (`1.2s cubic-bezier(0.16, 1, 0.3, 1)`), staggered 60ms apart, so the wordmark assembles stroke by stroke on load. Below it, a sub-nav row of tiny mono labels (10-11px, 0.2em tracking, uppercase): institution name left, a one-sentence mission center, nav links right, with thin arrow glyphs as separators.

The hero's background video holds back — it fades in only after a 2.8 second delay, so the visitor reads the typography on clean paper first, then the scene arrives behind it. Left side: a numbered section indicator ("01" + rule), a display headline ("TIMELESS WONDERS") at 3.5-5rem, a short description, and a dark CTA button whose white background panel slides in from the left on hover while its leaf icon rotates and lifts. Right side: a specimen data card — exhibit name, period, and length/height stats in mono labels — like a museum placard.

## Page layout
Three movements. Section 2 ("Explore Our World") is centered on the off-white: a bracketed mono section label (`[ 02 ]`), a large statement heading, and five icon pills (Dinosaurs, Ancient Life, Minerals, Fossils, Learn More) that invert to black on hover — plus a tall spacer. Section 3 flips to near-black `#0a0a0a`: a giant cut-out creature image OVERLAPS upward across the section boundary (rising from -65% to -78% translateY as it scrolls into view), then a two-panel exhibit browser — left panel shows the active chapter image dissolving between chapters with a SAND-PARTICLE transition (SVG turbulence + displacement + offset + blur, 900ms), right panel lists five chapters where the active one is white with an arrow icon and the rest sit at `#444`. Chapters auto-cycle every 3.5 seconds and respond to clicks. Mono micro-captions anchor the corners throughout ("WE DON'T JUST TELL STORIES.").

## Typography
- Display: Inter (Google Fonts, weights 300-600) — large headings at font-medium, tight tracking; the SVG monogram carries the display duty
- Body: JetBrains Mono (Google Fonts, weights 400-500) — ALL labels, nav, captions, counters at 9-11px uppercase with 0.2em+ tracking
- Hierarchy is three steps only: giant display, mono micro-label, 13-14px body

## Color palette
- Page: off-white `#fcfcfc`
- Ink: near-black `#111` / `#1a1a1a`
- Dark section: `#0a0a0a` with gray-800 hairline dividers
- Inactive chapter text: `#444`; muted captions gray-500
- Strictly monochrome — no accent color anywhere

## Visual motifs
- **Self-assembling SVG monogram** (the signature) — the brand's letters built from polygons that slide up stroke by stroke on load, full page width
- **Delayed background video** — 2.8 seconds of clean typography before the footage fades in behind it
- **Specimen placard** — a right-rail data card with exhibit name, era, and measurements in mono labels, like museum signage
- **Cross-section overlap image** — a giant cut-out image rides up over the boundary between the light and dark sections as you scroll
- **Sand-dissolve image transitions** — chapter images disintegrate into particles and reform (SVG turbulence/displacement filter chain) when the active chapter changes
- **Auto-cycling chapter list** — five exhibits rotate every 3.5s with an animated counter (01 / 05) and arrow on the active row
- **Sliding-panel CTA button** — a dark button whose light background sweeps in from the left while the icon rotates and lifts
- **Mono corner captions** — tiny uppercase mono statements pinned to section corners and footers

## When to use
- Museums, galleries, exhibitions, and cultural institutions of any kind
- Heritage brands and foundations that want an archival, curated feel
- Science centers and universities presenting collections or research
- Any brand with a strong 2-4 letter monogram and gallery-grade imagery
- Storytelling sites where browsing matters more than converting

## When to NOT use
- Conversion-driven businesses — there is no pricing, booking, or contact path in the layout
- Brands without strong cut-out imagery; the overlap creature and chapter gallery carry the dark section
- Editorial-with-rock-texture needs may fit `lithos-geology-editorial` better
- Mobile-first audiences in a hurry — the slow reveals reward patient desktop browsing

## Build complexity
HIGH complexity. A custom polygon-letter SVG wordmark, an SVG-filter sand transition component, scroll-overlap choreography, and auto-cycling state — several bespoke pieces with no library shortcuts.

## Library cross-references
- Motif: `self-assembling-svg-monogram`
- Motif: `delayed-background-video`
- Motif: `specimen-placard-data-card`
- Motif: `cross-section-overlap-image`
- Motif: `sand-dissolve-image-transition`
- Motif: `auto-cycling-chapter-list`
- Motif: `sliding-panel-cta-button`
- Typography: `inter-jetbrains-mono-archival`
- Color palette: `off-white-near-black-museum`
