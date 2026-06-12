---
slug: reviva-prosthetics-quiet-video-hero
name: Reviva — Prosthetics / Quiet Small-Type Video Hero
vibe: calm, human, minimal, restrained, light
industries: prosthetics, orthotics, medical devices, rehabilitation clinics, physical therapy, assistive technology, mobility equipment, health tech, patient-care startups
source: motionsites.ai archive (catalog title "Prosthetics Hero — Hero", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
A full-screen background video on a warm light-gray page (`#f0f0ee`), no overlay — the footage carries the whole hero. The text block is deliberately tiny: bottom-left aligned, constrained to roughly 320px wide (`max-w-xs`), with a headline at only 24-28px (`1.5rem`/`1.75rem`, medium weight, tight tracking). Copy reads like a person talking, not a pitch deck ("Simple, smart prosthetics made for people who keep fighting"). Above the headline sits a small blue credibility badge link with a right arrow that nudges 2px on hover; below it a one-line gray subtext and an outlined blue pill CTA ("Try a free fitting") that fills solid blue on hover.

The navigation is two separate floating pills centered at the top: a small circular pill holding the logo mark, and a wider rounded pill holding four text links — both in flat `#EDEDED`. No fixed bar, no shadow, no CTA in the nav.

The signature is the scale inversion: a huge emotional video against the smallest possible type block. The restraint is what reads as confidence in a category where most sites over-explain.

## Page layout
Single full-viewport hero, nothing else. Content sits in a flex column — pill nav at top, copy block pinned to the bottom-left with generous bottom padding (40-80px responsive). Horizontal padding scales 24px mobile to 112px desktop. Mobile keeps the identical structure; the copy block is already small enough to need no rework.

## Typography
- Display + body: system sans-serif stack (no custom font load) — medium weight headline at 24px mobile / 28px desktop, tight tracking
- Supporting text at 13px, badge at 11.5px, nav links 12-14px — everything intentionally small

## Color palette
- Page background: warm light gray `#f0f0ee`
- Nav pills: flat gray `#EDEDED`
- Headline: near-black `#111827` (gray-900)
- Subtext: light gray `#9ca3af` (gray-400)
- Accent: blue `#3b82f6` (badge link, CTA border/fill)

## Visual motifs
- **Tiny bottom-left copy block** — the entire message lives in a 320px-wide column at 24-28px headline size while the video fills the screen; the inversion of scale is the design
- **Two-pill floating navigation** — a circular logo pill plus a separate rounded link pill, both flat `#EDEDED`, centered at the top with no bar behind them
- **Full-bleed video, no overlay** — the footage runs at 100% opacity; nothing dims or tints it
- **Outlined pill CTA that fills on hover** — blue border and blue text resting state, solid blue with white text on hover, 200ms transition
- **Arrow nudge micro-interaction** — the `→` in the badge and CTA translates 2px right on group hover, the only motion on the page
- **Credibility badge as first line** — a small blue text link above the headline carries the social proof ("as seen on..." style) instead of a logo bar

## When to use
- Prosthetics, orthotics, and mobility device companies with strong human footage
- Rehabilitation clinics and physical therapy practices that want warmth without clinical coldness
- Medical device brands whose product is best shown in use, not described
- Any health brand where the patient story is the pitch
- Founders who want one page, one message, one button

## When to NOT use
- Brands without a strong hero video — the type block is too small to carry the page alone
- Services that need to list offerings or pricing up front; there is no room for it
- Conversion pages needing forms or multiple CTAs (use `medspa-booking-calendar-first` for booking-led health)
- Brands that want to feel big and corporate — this direction reads boutique and personal

## Build complexity
LOW complexity. One section, no custom fonts, no JavaScript beyond a hamburger-free static nav; the whole hero is layout and hover states.

## Library cross-references
- Motif: `full-bleed-video-no-overlay`
- Motif: `tiny-bottom-left-copy-block`
- Motif: `two-pill-floating-nav`
- Motif: `outlined-pill-cta-fill-on-hover`
- Motif: `arrow-nudge-hover`
- Typography: `system-sans-small-scale`
- Color palette: `warm-gray-blue-accent-light`
