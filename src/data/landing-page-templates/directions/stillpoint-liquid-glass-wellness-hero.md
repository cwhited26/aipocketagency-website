---
slug: stillpoint-liquid-glass-wellness-hero
name: Stillpoint — Wellness App / Liquid Glass Video Hero
vibe: calm, glassy, video-led, minimal, modern
industries: wellness apps, fitness and habit tracking, meditation, health coaching, spas and retreats, yoga studios, lifestyle apps, personal development
source: motionsites.ai archive (catalog title "Equilibrium", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
One full-screen hero: a looping background video of calm, naturalistic footage with NO overlay, and a family of "liquid glass" surfaces floating on top. The glass recipe is specific: near-zero white fill (`rgba(255,255,255,0.01)`) with luminosity blend, a light blur(4px), an inset top highlight, and a gradient hairline border built with mask compositing — bright white-45% at the top and bottom edges, fading to nothing through the middle, so each element looks like a pane of curved glass catching light. No keyframe animation anywhere; the video supplies all motion, the UI stays still.

Hero copy sits BOTTOM-LEFT, not centered: a 4xl-6xl medium-weight headline ("Live Better, Feel Whole Every Day"), a short white-60% paragraph capped at one column, and two pills — solid white "Start Today" and liquid-glass "Discover How."

## Page layout
Single screen. Nav spans the top in three parts: an infinity-icon + wordmark left; a centered liquid-glass capsule holding four links as buttons (active state gets a white-15% fill, one link carries a chevron for a dropdown); and two right-side pills (glass "Log in", solid white "Begin Now"). On mobile the capsule collapses to a glass hamburger toggle opening a floating glass panel below the nav with stacked links and a two-button row. Everything uses `transition-colors` only — restrained by design.

## Typography
- Display + body: Geist (Google Fonts, 300-700) — medium-weight headline with tight tracking, 13-16px UI text; one modern grotesque carries the whole page

## Color palette
- Canvas: the video itself — typically deep greens/blues of nature footage; fallback near-black `#0a0a0a`
- Text: white `#ffffff`; secondary white-60%/70%
- Glass: `rgba(255,255,255,0.01)` fill, inset `rgba(255,255,255,0.1)` top highlight, gradient border white-45% → transparent → white-45%
- Solid CTAs: pure white pills with black text

## Visual motifs
- **Liquid-glass surfaces** (the signature) — mask-composited gradient hairline borders + luminosity blend + light blur, applied consistently to nav capsule, buttons, and mobile menu
- **Bottom-left hero copy** — headline and CTAs anchored to the lower-left corner, leaving the video's upper field open
- **Centered glass nav capsule** — links rendered as buttons inside one floating pane, active link in a white-15% fill
- **Full-bleed video, no tint** — the footage runs untouched; the glass elements provide all the contrast
- **Motionless UI over moving video** — zero keyframes; calm comes from restraint
- **Floating glass mobile menu** — the hamburger opens a rounded glass panel inset from the screen edges, not a full-screen takeover

## When to use
- Wellness, meditation, and habit apps with serene brand footage
- Spas, retreats, and yoga studios — the glass-over-nature look matches the room
- Health coaching and personal development brands selling calm
- Any single-CTA app launch where one video plus two buttons is the whole pitch
- Brands that want the current glass aesthetic without dark-tech coldness

## When to NOT use
- Anyone without quality full-screen video — there is no fallback design under it
- Content-heavy sites — this is one screen with one message
- High-energy fitness brands — the stillness reads soft, not intense
- B2B SaaS needing proof sections (use `bookedup-deep-shadow-saas`)
- If the project also wants the same glass recipe on a dark multi-section page, see `roamline-electric-camper-black-serif` — it extends this exact treatment

## Build complexity
LOW. One screen, one reusable glass class, no animation engineering — the mask-composite border is the only fiddly CSS.

## Library cross-references
- Motif: `liquid-glass-gradient-border-pill`
- Motif: `bottom-left-hero-copy`
- Motif: `glass-nav-capsule-active-fill`
- Motif: `full-bleed-video-no-overlay`
- Motif: `floating-glass-mobile-menu`
- Typography: `geist-single-grotesque`
- Color palette: `video-canvas-white-glass`
