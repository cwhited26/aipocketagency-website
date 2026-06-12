---
slug: roamline-electric-camper-black-serif
name: Roamline — Electric Camper / Black Serif Cinematic
vibe: dark, cinematic, serene, premium, video-led
industries: electric vehicles, RV and camper brands, outdoor recreation, premium consumer hardware, travel, vanlife products, marine and powersports, adventure gear
source: motionsites.ai archive (catalog title "Velorah", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
Full-screen hero on a pure black page: a landscape video of the camper in open country fills the viewport, with a bottom gradient (black via black-60% to transparent over the lower 40%) easing the footage into the next section. Headline is giant Instrument Serif — 5xl mobile up to 8xl desktop, line-height 0.95, tracking -2.46px — "Where dreams rise through the silence." Copy and buttons fade-rise in on a 0.8s stagger (0 / 0.2s / 0.4s delays, 24px translate). The CTA is a LIQUID GLASS pill: near-transparent fill with luminosity blend, blur(4px), an inset top highlight, and a gradient hairline border built with mask compositing — bright at the top and bottom edges, fading to nothing at the middle. Nav is simple: serif wordmark left, five links center, one glass "Begin Journey" pill right.

## Page layout
Six sections stacked on black: hero video → a 70vh serif tagline interlude ("So you can feel at home, anywhere.") → a feature split (dark card with heading, copy, a row of pill tabs with active state, a thin progress bar, and a glass CTA, beside a rounded video card) → a 90vh big-statement section over an HLS video stream with an uppercase tracking label, serif heading, paragraph, and a 4-up stats grid (OTA / 360° / AI / 24-7) → a 90vh preorder CTA over video with a price label ("Starting at $99,000"), "Join the ride" headline, and two buttons (glass "Preorder Now" + outlined "Schedule a Tour") → a 3-column footer with a serif statement, link list, and subscribe button. Cards use 1rem-2rem radii; section gutters ride a 7xl max-width container.

## Typography
- Display: Instrument Serif (Google Fonts, 400 + italic) — every heading, the wordmark (with a superscript ® at tiny size), and the stat values at font-light
- Body: Inter (400/500) — paragraphs, labels, tabs, footer links
- Labels: 0.3em letterspaced uppercase 12-14px in muted gray for section eyebrows

## Color palette
- Page: pure black `hsl(0,0%,0%)` / `#000000`
- Cards: near-black `#0f0f0f` (6% lightness) with `#2e2e2e` (18%) borders
- Text: white `#ffffff`; muted copy at `hsl(240,4%,66%)`
- Glass: `rgba(255,255,255,0.01)` fill, blur(4px), inset white-10% top highlight, gradient hairline border from white-45% through transparent and back

## Visual motifs
- **Liquid-glass pill buttons** (the signature) — near-invisible fill with luminosity blending and a mask-composited gradient border that catches light at the top and bottom edges; hover scales 1.03
- **Giant serif over video** — Instrument Serif at 8xl with negative tracking, the calm counterweight to the moving footage
- **Fade-rise entrance stagger** — three elements rise 24px on 0.2s offsets
- **Serif tagline interlude** — a full-width breathing section with nothing but one centered sentence
- **Feature tabs with progress bar** — pill tab row (active = white fill, dark text) above a 2px progress track, hinting at a carousel
- **Stats grid over streaming video** — four serif numbers with muted labels on a 90vh video section
- **Bottom gradient video blend** — every video section dissolves into the black page through a gradient, so the page reads as one continuous night drive

## When to use
- Vehicle and hardware launches where the product photographs at dusk or in landscapes
- Electric vehicle, camper, marine, or powersports brands taking preorders or deposits
- Premium outdoor brands that want quiet cinema instead of adrenaline
- Products with an app/companion story — the stats-over-video section is built for it
- Preorder funnels: the price label + refundable deposit framing is already in the structure

## When to NOT use
- Brands without strong landscape or product video — four video sections will expose stock footage
- Bright, friendly consumer brands — pure black sets a reserved, high-ticket tone
- Information-dense B2B — the page is mood-first, spec-light
- Local service businesses (use `contractor-photo-first-trust`)

## Build complexity
MEDIUM. Six sections and four video backgrounds (one HLS stream needing hls.js with a native fallback), plus the mask-composite glass border — each is known work, but there is a lot of it.

## Library cross-references
- Motif: `liquid-glass-gradient-border-pill`
- Motif: `giant-serif-over-video`
- Motif: `fade-rise-stagger-entrance`
- Motif: `serif-tagline-interlude`
- Motif: `stats-grid-over-video`
- Motif: `bottom-gradient-video-blend`
- Typography: `instrument-serif-inter-cinematic`
- Color palette: `pure-black-muted-gray-white`
