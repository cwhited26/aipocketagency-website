---
slug: driftway-travel-glass-parallax
name: Driftway — Travel Glass Parallax Hero
vibe: cinematic, calm, glass, wanderlust, centered
industries: travel planning, tour operators, adventure travel, travel apps, boutique hospitality, retreat organizers, concierge services, experience booking
source: motionsites.ai archive (catalog title "Wanderful Hero", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
Full-viewport cinematic hero for a travel-planning brand. The background video is fixed, scaled to 1.08x, runs at 1.25x playback speed, and follows the mouse — a GSAP parallax that maps cursor position to up to 20px of drift, lerped at 0.06 per frame inside requestAnimationFrame, so the scene floats rather than snaps. The extra scale hides the edges the parallax exposes.

All chrome is liquid glass: a 1% white luminosity fill, 4px backdrop blur, an inset top highlight, and a masked 1.4px gradient rim that brightens at the top and bottom edges. The header holds the wordmark with a superscript TM left, a glass capsule nav center (four tiny 11px uppercase letterspaced links as pills inside the capsule), and a glass "GET ROAMING" pill right. The headline is fixed near the top, centered, two lines at `clamp(40px, 5.4vw, 72px)` in Inter 400 with -0.02em tracking — line one full white ("Venture without edges."), line two at 55% white. The bottom block stacks a two-tone paragraph (white opening phrase, 55%-white continuation), a solid white pill CTA ("Plan my escape today") that scales up with a soft white glow shadow on hover, and a trust line — a small lock icon plus 11px uppercase letterspaced text about data privacy.

## Page layout
One viewport, three fixed bands: header top, headline at 120px from the top, action block at bottom-14 — all floating over the parallax video. Both text blocks fade in and rise 24px on mount, the bottom one delayed 300ms. No scroll; the page is a held shot.

## Typography
- Display: Inter (Google Fonts, weight 400 for the headline) — large clamp-scaled lines with -0.02em tracking; nav and trust lines at 11px with 0.12-0.14em letterspacing
- Body: Barlow (Google Fonts, weights 300-600) — the page's base font for paragraph text
- The two-tone device: sentences split into a white phrase and a 55%-white phrase to steer emphasis without weight changes

## Color palette
- Background base: black `#000000` under the video
- Primary text: white `#ffffff`; secondary phrases at `rgba(255,255,255,0.55)`
- Glass: `rgba(255,255,255,0.01)` fill, 4px blur, gradient rim border
- CTA: solid white pill, black text, hover glow `rgba(255,255,255,0.2)` at 32px spread

## Visual motifs
- **Mouse-parallax video** — the fixed background drifts up to 20px with the cursor, lerped each frame, with 1.08x scale covering the edges
- **Liquid-glass capsule nav** — pill links nested inside a glass capsule with a gradient rim that catches light top and bottom
- **Two-tone sentences** — headline and paragraph lines split between full white and 55% white mid-sentence
- **Glow-hover CTA** — a white pill that scales to 1.03 and lights up a soft white shadow ring on hover, presses to 0.97 on click
- **Trust lock line** — a small lock icon with tiny uppercase letterspaced privacy copy as the final element
- **Sped-up footage** — the video plays at 1.25x, keeping slow drone footage alive without re-editing

## When to use
- Travel planning apps and itinerary services
- Tour operators and adventure travel brands with strong destination footage
- Boutique hotels, retreats, and experience-booking platforms
- Concierge and membership travel services
- Any brand selling escape, where one wide cinematic shot does the persuading

## When to NOT use
- Multi-destination catalogs that need browsing on screen one (use `terraway-travel-split-clip-headline` for a full travel site with destination pages)
- Touch-dominant traffic if the parallax is the main draw — it's cursor-only and the page goes static on mobile
- Budget or deals-led travel brands; the calm premium tone undersells urgency
- Anyone without licensed high-quality destination video

## Build complexity
LOW-MEDIUM. The glass CSS is copy-paste; the GSAP parallax is one small hook. Single screen, no scroll logic.

## Library cross-references
- Motif: `mouse-parallax-fixed-video`
- Motif: `liquid-glass-gradient-rim`
- Motif: `two-tone-sentence-emphasis`
- Motif: `glow-hover-pill-cta`
- Motif: `trust-lock-microcopy`
- Typography: `inter-clamp-barlow-letterspaced`
- Color palette: `black-white-55-percent-glass`
