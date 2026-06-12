---
slug: arden-warm-architecture-bird-hero
name: Arden — Warm Architecture / Living Bird Hero
vibe: warm, architectural, organic, frosted, quietly-premium
industries: architecture firms, landscape architecture, interior design studios, property developers, civic design, premium construction, placemaking consultancies, design-build studios
source: motionsites.ai archive (catalog title "Mythic Naturecore (best guess, not confidently identified)", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A warm, sunlit hero where something is alive in the frame. The base is a full-bleed background video softened by a warm 12% cream overlay. Centered behind everything sits the brand wordmark at architectural scale — 22vw desktop, 26vw mobile — in a deep warm brown, more monument than logo. Over the wordmark, a stone slab/sculpture image (160vw wide desktop) floats at center and drifts upward at 0.3x scroll speed, so the monolith parallaxes past the giant type.

The signature is a BIRD that lives on the page: four transparent-background flight clips wired into a state machine. On load the enter clip plays (bird flies in); when it ends, two idle clips alternate in an endless loop; the moment the visitor scrolls past 10px, everything cuts to the leave clip (bird flies away); scroll back to top and it returns. The page literally reacts to attention. Bottom corners hold two frosted panels that push downward as you scroll: left, a tagline card ("Designing places beyond what's expected") with a hairline divider and an "EXPLORE OUR APPROACH" link; right, a photo CTA card with a dark top gradient, a one-line invitation, an envelope icon circle, and a white "START A PROJECT" button.

## Page layout
Two full-height sections. Section 2 swaps to a second background video under a heavier 38% warm overlay, with one centered statement at clamp 32–80px ("What stands the test of time is all that guides the work."), then a thin vertical rule, a map-pin icon, and a short trust line about civic and private clients. Navigation is fixed: bold wordmark with superscript ® left; frosted pill links (Projects / Studio / Responsibility / Archive — active pill gets a small dot) plus an EN language capsule right. Mobile collapses to a frosted hamburger dropdown; the bottom panels stack into a single column.

## Typography
- Display + body: Hanken Grotesk (substitute for the prompt's Zimula Trial Med/Bd) — bold cuts for wordmark and hero, medium for everything else
- Wordmark tracking `-0.05em` at giant scale; nav pills uppercase 13px with 0.07em tracking
- Statement line-height 1.18, tracking `-0.025em`

## Color palette
- Page base: near-black warm `#0e0c0a`
- Ink: deep warm brown `#241f21` / `#2a2420`
- Warm overlays: `rgba(235,230,218,0.12)` hero, `rgba(242,238,230,0.38)` section 2
- Frosted glass surfaces: `rgba(248,245,240,0.72–0.96)` with 8–16px backdrop blur
- White `#ffffff` for the CTA card text and buttons

## Visual motifs
- **A bird that reacts to scroll** (the signature) — enter / idle-loop / leave flight clips switch with visitor behavior; the page feels inhabited
- **Monument-scale wordmark** — the brand name fills a quarter of the viewport behind the scene
- **Floating sculpture parallax** — a centered slab image drifts up at 0.3x scroll speed across the giant type
- **Frosted corner panels** — tagline card and photo CTA card in warm translucent glass, pushed down by scroll
- **Warm veil over video** — cream overlays calm both background films into one golden palette
- **Pill navigation with active dot** — frosted pills, the current page marked by a 3px dot under the label
- **Quiet trust footer** — vertical rule, map pin, one modest sentence about who relies on the firm

## When to use
- Architecture and design-build firms that want presence without shouting
- Landscape and placemaking studios — the living-bird conceit matches "designing with nature"
- Property developers marketing a flagship warm-modern project
- Interior design studios with cinematic footage of finished spaces
- Civic-facing practices that need premium feel and institutional calm at once

## When to NOT use
- Anyone without the four alpha-channel bird clips or budget to produce them — the state machine is the point
- Conversion-driven service pages; there are exactly two soft CTAs on the whole page
- Cold/tech brands — the warm palette and organic motion read wrong (use `cognitra-ai-agency-gray-panel`)
- Listing-driven real estate (use `real-estate-listing-grid-search`)

## Build complexity
MEDIUM complexity. The code is plain React state + scroll handlers (no animation libraries), but it depends on six bespoke video assets — two background films and four transparent-webm bird clips — which is where the real cost sits.

## Library cross-references
- Motif: `scroll-reactive-video-state-machine`
- Motif: `monument-scale-background-wordmark`
- Motif: `floating-image-scroll-parallax`
- Motif: `frosted-corner-panel-pair`
- Motif: `warm-overlay-video-veil`
- Motif: `pill-nav-active-dot`
- Typography: `hanken-grotesk-warm-architectural`
- Color palette: `warm-brown-cream-frosted-glass`
