---
slug: lumengate-portal-zoom-scroll
name: Lumengate — Portal Zoom Scroll Hero
vibe: immersive, dreamlike, scroll-driven, dark, cinematic
industries: ai products, gaming, vr and ar studios, entertainment, creative tech, digital art platforms, media startups, experiential brands
source: motionsites.ai archive (catalog title "Portal — Hero", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
The page opens on a full-screen portal image — a glowing gateway — with a fixed cloud-world image hidden behind it. Scrolling through a 160vh pinned track zooms the portal to 7.5x scale (transform-origin 52% 38%) while the world behind scales to 1.18x, so the visitor literally scrolls THROUGH the portal into the world. The hero copy fades out in the first 22% of scroll; the portal itself fades between 66% and 88%, completing the reveal. Easing is a custom easeInOut applied to raw scroll progress (`clamp(scrollY / (trackHeight - viewportHeight), 0, 1)`).

On top of the scroll engine sits mouse parallax: raw mouse position is smoothed each animation frame with `lerp(..., 0.07)` and inverted, so the world layer (magnitude 6px) and portal layer (magnitude 7px) drift in opposite directions under the cursor. The hero copy is bottom-anchored, not centered — headline at `clamp(40px, 4vw, 58px)` with a script "Discover" lead-in in muted gray, plus a small right-hand column pairing a large script "A." with a one-line studio note.

## Page layout
Two scenes on one page: the pinned portal intro, then a scrollable section rendered over the fixed world background — a centered "Real wonders. Real worlds." heading, an arc-fanned testimonial carousel, and a four-column footer. Everything keys off a 767px mobile breakpoint: smaller carousel constants, the hero's right column hidden, footer collapsing to two columns. Root background is near-black `#0a0608` so layer fades never flash white.

## Typography
- Display + body: Inter (substitute for the prompt's Helvetica Now Display) — weight 500 headlines, `letter-spacing -0.02em`, line-height 1.04
- Accent: Mr Dafoe (Google Fonts, cursive) — used for the "Lumen" half of the wordmark, the script "Discover" lead-in at 1.15em, and a large standalone "A." at 64px
- Body copy small and quiet: 13-14px at 50% white opacity, max-width 340px

## Color palette
- Root background: `#0a0608` (near-black with a warm cast)
- Text: white, with secondary copy at `rgba(255,255,255,0.5)`
- Script accent: `#9a9a9a` muted gray
- Center carousel card: solid `rgb(247,251,255)` with layered white glow shadows; quote text `#2c2420`
- Inactive carousel cards: frosted glass — white gradient at 24-42% opacity, `backdrop-filter: blur(18px) saturate(140%)`

## Visual motifs
- **Portal zoom-through** — the signature: a pinned 160vh scroll track scales the portal image to 7.5x and cross-fades it away, revealing a fixed world background behind. The page IS the transition
- **Opposite-direction mouse parallax** — world and portal layers drift against each other under the cursor, smoothed per-frame with lerp 0.07
- **Script-accent wordmark** — brand name mixes a cursive script half with a clean sans half on one baseline; the script face repeats in the headline lead-in
- **Arc-fanned testimonial carousel** — seven cards fan along a downward arc (each card `translateX(pos*295px) translateY(|pos|*52px) rotate(pos*8deg)`); the center card is solid white with a soft glow, neighbors are frosted glass at falling opacity
- **Glowing chevron nav buttons** — prev button is translucent with a white-glow drop-shadow chevron; next is near-solid white with a dark chevron
- **Bottom-anchored hero copy** — headline and support text sit at the bottom edge of the viewport, leaving the portal image clear

## When to use
- AI worlds, gaming, VR/AR, or any product whose pitch is "step into something"
- Entertainment and media brands launching an immersive experience
- Creative tech startups that want the landing page itself to be the demo
- Digital art platforms and experiential brands with one strong key visual
- Anyone with a hero image worth zooming into — the portal art carries the whole page

## When to NOT use
- Service businesses that need pricing, features, and a phone number above the fold — the intro costs a full scroll before any selling happens
- Brands without a strong portal/world key visual; weak art makes the zoom feel empty
- Conversion-focused landing pages where scroll choreography delays the CTA (use `targo-logistics-dark-red-clipped` for direct-response confidence)
- Text-heavy B2B audiences who skim — this page is built for browsing, not scanning

## Build complexity
HIGH — a custom scroll-progress engine, rAF-smoothed mouse parallax, layered opacity choreography, and the arc carousel transform math all need to work together; budget real time for tuning the zoom feel.

## Library cross-references
- Motif: `portal-zoom-through-pinned-scroll`
- Motif: `opposite-direction-mouse-parallax`
- Motif: `arc-fanned-card-carousel`
- Motif: `script-accent-wordmark`
- Motif: `bottom-anchored-hero-copy`
- Motif: `glowing-chevron-nav-buttons`
- Typography: `inter-script-accent-mix`
- Color palette: `near-black-white-glow-glass`
