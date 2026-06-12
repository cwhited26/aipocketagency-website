---
slug: ellora-glass-serif-email-morph
name: Ellora — Glass Serif Hero with Email-Morph CTA
vibe: dark, serif-led, glassy, single-screen, waitlist
industries: ai apps, no-code platforms, creative tools, pre-launch startups, productivity software, consumer ai, design tools, beta waitlists
source: motionsites.ai archive (catalog title "Asme — Hero Section", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
A single locked screen (100vh, no scroll) on black with a full-bleed background video at 100% opacity — no overlay (HLS `.m3u8` via hls.js in the source; `/placeholder-hero.mp4` in our builds). The navbar is one LIQUID-GLASS CAPSULE: a rounded-full bar holding logo, three links, a plain "Sign Up" text button, and a glass "Login" pill, floating over the video and animating down from -20px on load.

Centered content: an uppercase tagline tracked at 0.2em ("BUILD A NO-CODE AI APP IN MINUTES" register, 10-11px), then the headline in Instrument Serif at 64px — gradient-clipped white fading from solid to 70% opacity top-to-bottom, so the serif glows softly against the footage. Easing is `[0.16, 1, 0.3, 1]` over 1s.

The CTA is the signature: a quiet outlined pill reading "Get early access" that MORPHS on click into an inline email form (AnimatePresence swap, scale 0.95 to 1). The form's placeholder TYPES ITSELF, character by character at 60ms intervals — "Enter Your Email Here For Early Access" — and after submit the arrow icon swaps to a check while the placeholder retypes a confirmation, then the whole control resets to the button state after 4 seconds. A small "Play Video Demo" link fades in last.

## Page layout
One viewport, three stacked elements: glass capsule nav, centered tagline/headline/CTA column (max-w-5xl), nothing else. Selection color inverts (white background, black text). The page is an email-capture machine wearing an editorial serif.

## Typography
- Display: Instrument Serif (Google Fonts) — the 64px gradient-clipped headline, `tracking-[-0.01em]`, line-height 1.1
- Body: Inter (Google Fonts, weights 300-600) — nav, tagline, buttons
- Tagline uppercase at 0.2em letter-spacing; buttons at 14px

## Color palette
- Background: black `#000000` under full-opacity video
- Headline gradient: white `#ffffff` through `rgba(255,255,255,0.95)` to `rgba(255,255,255,0.7)`
- Glass surfaces: `rgba(255,255,255,0.01-0.04)` fills, `blur(4-16px)`, gradient hairline borders
- CTA borders: `white/10` resting, `white/30` hover, `white/40` focused form
- Secondary text: `white/80`

## Visual motifs
- **Email-morph CTA** (the signature) — one outlined pill swaps in place into an email form on click, animates its own typewriter placeholder, confirms with an icon swap, and resets itself after 4s
- **Typewriter placeholder** — the input's placeholder text types in at 60ms per character, before AND after submission
- **Glass capsule navbar** — the entire nav lives in one rounded-full liquid-glass bar with a masked gradient border, floating over the video
- **Gradient-faded serif headline** — a large serif line clipped to a white gradient that dissolves toward 70% opacity at the baseline
- **Full-bleed video, no overlay** — the footage carries the mood at 100% opacity, with glass and gradients providing legibility
- **Single-screen lock** — 100vh, no scroll; everything the page wants is one email

## When to use
- Pre-launch products and beta waitlists where the only conversion is an email address
- AI and creative tools that want a softer, editorial voice instead of techno-dark
- Consumer-leaning apps with atmospheric brand footage
- Founders who need a one-evening page that still feels designed
- Brands pairing a serif identity with a modern glass UI

## When to NOT use
- Anything that needs to explain itself — there is no feature, pricing, or proof section
- Phone-first local services (use `trades-phone-first-emergency`)
- Audiences that distrust waitlists and want a working product link
- Brands without usable background footage; the page is footage plus one input

## Build complexity
LOW — one screen and one clever component; the CTA morph with its typed placeholder and auto-reset is the only piece needing real state work.

## Library cross-references
- Motif: `email-morph-cta`
- Motif: `typewriter-input-placeholder`
- Motif: `glass-capsule-navbar`
- Motif: `gradient-faded-serif-headline`
- Motif: `full-bleed-video-no-overlay`
- Typography: `instrument-serif-inter-glass`
- Color palette: `black-white-gradient-glass`
