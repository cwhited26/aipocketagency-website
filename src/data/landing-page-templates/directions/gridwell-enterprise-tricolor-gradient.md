---
slug: gridwell-enterprise-tricolor-gradient
name: Gridwell — Enterprise Infrastructure / Tri-Color Gradient System
vibe: enterprise, polished, gradient-led, choreographed, premium
industries: enterprise software, infrastructure operations, construction tech, data centers, energy, engineering services, logistics platforms, compliance software, b2b platforms
source: motionsites.ai archive (catalog title "NexaCore", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
Full-screen background video hero with centered copy, anchored by a strict gradient system that runs the whole site. The eyebrow line is gradient text (blue `rgb(43,167,255)` → purple `rgb(202,69,255)` → orange `rgb(254,136,27)`, clipped to the type), the H1 below it is white medium-weight at `clamp(32px, 4vw, 56px)`, and the supporting paragraph sits in muted lavender. A 192px gradient fade at the hero's bottom edge dissolves the video into the next section.

The navbar is the second signature: a white floating pill (rounded-2xl, shadow) that physically shrinks on scroll — max-width animates from 72rem down to 48rem over 500ms with easing, link padding tightening in sync. The Contact button is a gradient-border pill: a 1px gradient frame around a solid blue core that floods with the full gradient on hover.

Two brand gradients are law: Gradient A (blue→purple→orange) for logos, buttons, and lines; Gradient B (light blue→violet→orange) for headline highlight spans. Purple and indigo never appear outside these exact stops. Headings are always weight 500, body 400 — the restraint keeps the loud gradients feeling engineered.

## Page layout
Four choreographed sections after the hero. (1) A dark image-backed section with four hover cards: each card is near-black glass (`rgba(10,5,20,0.88)`, 36px blur, rounded-36px); on hover a product image slides down from the top, a gradient overlay rises from the bottom, the title lifts 8px, and a hidden gradient "Learn more" button expands open. (2) A white comparison section: a circular video (HLS-streamed, 22vw wide, perfect circle crop) flanked by two columns of shadowed white cards — pain points with cross icons on the left, outcomes with check icons on the right; the circle jumps to first position on mobile. (3) A light image-backed "staircase" finale: four labeled pillars positioned at ascending heights, each a white glass chip atop a 1px multi-stop gradient line with its capability list hanging off the line — process-as-architecture. All sizing uses fluid `clamp()` and vw units so the choreography holds at any width.

## Typography
- Display + body: Poppins (substitute for the prompt's Mazzard H) — geometric sans, weight 500 for every heading, 400 for body, never heavier
- Fluid scale throughout: H2s at `clamp(32px, 4vw, 56px)`, body at `clamp(14px, 1.25vw, 18px)`

## Color palette
- Deep navy text: `#1a0b54`
- Primary solid blue: `#1c4eff`
- Accent purple: `#c86fff`
- Gradient A (buttons/logos): `#1c4eff` → `#ac24ff` → `#fe881b`
- Gradient B (headline spans): `#2ba7ff` → `#ca45ff` → `#fe881b`
- Muted lavender body text: `#a997ce` / `#bdaee7`
- Dark glass cards: `rgba(10,5,20,0.88)` with 36px backdrop blur
- Off-white chips: `#f9f9f9`

## Visual motifs
- **Navbar that shrinks as you scroll** — a floating white pill whose max-width animates from 72rem to 48rem past 20px of scroll, links tightening with it
- **Gradient-border contact button** — 1px gradient frame around a solid blue pill; the fill becomes the full gradient on hover
- **Two-gradient discipline** — every gradient on the site is one of two exact blue-purple-orange ramps; headline highlight spans use clipped gradient text
- **Hover-reveal service cards** — dark glass cards where an image slides in from above, an overlay rises from below, and a gradient button expands open, all on one hover
- **Circular video centerpiece** — an HLS video cropped to a perfect circle, flanked by cross-icon pain cards and check-icon outcome cards
- **Gradient staircase pillars** — four process stages at ascending heights, each a glass chip on a thin multi-stop gradient line, reading as a skyline of capability
- **Section-fade transitions** — tall gradient overlays dissolve each image/video section into the next background color

## When to use
- Enterprise platforms selling to operations, engineering, or program teams
- Infrastructure, construction-tech, data-center, and energy companies that want to look like a top-tier software brand
- B2B products with a 4-stage process story (the staircase section is built for it)
- Brands that need visual wow for a premium price point without going dark-mode
- Companies replacing a dated corporate site that still needs to feel serious

## When to NOT use
- Small local services — the gradient system reads as big-company budget and overpromises
- Brands with an established palette that clashes with blue-purple-orange; the gradients are the identity here
- Content-light sites; the choreography needs four sections of real substance to land
- Teams that want fast edits — the fluid vw sizing and staircase positioning are tightly coupled (use `cognitra-ai-agency-gray-panel` for a simpler enterprise look)

## Build complexity
HIGH complexity. Scroll-reactive navbar, multi-layer hover cards, HLS video wiring, and an absolutely-positioned staircase with separate mobile layout — every section has custom behavior.

## Library cross-references
- Motif: `shrinking-pill-navbar-on-scroll`
- Motif: `gradient-border-button`
- Motif: `hover-reveal-image-card`
- Motif: `circular-video-centerpiece`
- Motif: `gradient-staircase-pillars`
- Motif: `cross-vs-check-comparison-columns`
- Typography: `poppins-medium-only-fluid`
- Color palette: `navy-blue-purple-orange-trigradient`
