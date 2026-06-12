---
slug: fluve-defi-light-rounded-video-cards
name: Fluve — DeFi Platform / Light Gray Rounded Video Cards
vibe: light, fluid, rounded, glassy, fintech
industries: crypto and DeFi, fintech, staking platforms, wealth apps, banking products, B2B financial infrastructure, investment tools, web3 protocols
source: motionsites.ai archive (catalog title "RIVR DeFi", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
The inversion that makes this direction: a DeFi site on LIGHT gray `#f0f0f0` instead of dark-mode crypto black. The hero is a full-screen rounded container (radius 1.5rem mobile / 3rem desktop, max 1536px) with a looping abstract-fluid background video filling it, floated inside the light page with 12-20px of breathing room — the page frame stays visible around the video like a mat around a print. Over the video: a frosted badge pill (white-60% + blur, sparkle icon, "Fluid Staking"), an h1 in a muted slate `#5E6470`, a supporting paragraph, all entering with staggered fade-and-scale.

The signature detail is the INVERTED CORNER CUT-OUT at the hero's bottom-right: a light-gray block appears merged into the video container with a large rounded top-left corner, holding a faint circle with an arrow and "Documentation / Library" text. Two absolutely positioned 3.5rem SVG paths (`M56 56V0C56 30.9279 30.9279 56 0 56H56Z`) fill the gaps so the inner curve sits flush — an architectural notch carved out of the rounded video card. A glass card ("5.2K Active Yielders" + a white Join Discord pill) floats bottom-left to balance it.

## Page layout
Five sections, all riding the same 1536px rounded-container rhythm: hero video card → a metrics band in a near-invisible tinted box (`rgba(30,50,90,0.02)` fill, 2x4 divided grid: $2.4B TVL, 8.5% yield, 140K+ participants, <2s finality) → a features grid of pure white cards on the gray (one tall row-span-2 card, one wide col-span-2, two squares; each carries a giant Lucide icon watermark at 2% opacity that scales up on hover) → a CTA section repeating the hero's rounded-video-card treatment with a different clip ("Melt rigid assets into fluid yield." + white and frosted buttons) → a simple border-top footer with three muted link columns. Metrics and cards stagger upward on scroll via whileInView.

## Typography
- Display + body: Inter (substitute for the prompt's self-hosted Helvetica Regular) — one neutral grotesque throughout, hierarchy from size and the slate-gray tones, not weight contrast
- Hero h1 in muted slate `#5E6470` rather than black — low-contrast confidence

## Color palette
- Page: light gray `#f0f0f0`
- Cards: pure white `#ffffff` with `0 8px 30px rgb(0,0,0,0.04)` hover shadows
- Metrics tint: `rgba(30,50,90,0.02)` fill, `rgba(30,50,90,0.05)` border, `rgba(30,50,90,0.1)` dividers
- Hero heading slate: `#5E6470`; dark navy CTA button accents
- Glass: white at 30-60% with backdrop blur

## Visual motifs
- **Inverted corner cut-out** (the signature) — a notch carved from the rounded video card using two small SVG curve-fillers so the page background flows into the card flush
- **Rounded video cards floated on light gray** — full-bleed footage matted inside 3rem-radius containers with the page showing around the edges
- **Frosted badge and glass cards** — white-60% blur pills and a glassmorphism stat card floating over the video
- **2%-opacity icon watermarks** — giant Lucide icons ghosted into white feature cards, scaling up on hover
- **Divided metrics grid** — four big numbers separated by hairline dividers in a barely-tinted box
- **Mirror-image CTA** — the closing section reuses the hero's rounded video treatment with new footage, bookending the page
- **Staggered whileInView rises** — every section's children fade up in sequence as they enter

## When to use
- Crypto, staking, and DeFi products that want to look like a calm financial product, not a casino
- Fintech and wealth apps aiming for an Apple-adjacent light aesthetic
- Financial infrastructure selling trust to institutions
- Any product with abstract motion footage (fluids, particles, renders) that reads premium inside a rounded frame
- Brands differentiating from dark-mode competitors by going light

## When to NOT use
- Brands wanting aggressive, hype-driven crypto energy — this is deliberately quiet
- Sites without quality abstract video — two sections depend on it
- Heavy text/content marketing — the layout is visual and metric-led
- Local or trades businesses (use `contractor-photo-first-trust`)

## Build complexity
MEDIUM. The corner cut-out SVG trick needs exact sizing to sit flush, and there are five sections with scroll-triggered staggers — known patterns, but precision work.

## Library cross-references
- Motif: `inverted-corner-svg-cutout`
- Motif: `rounded-video-card-on-light`
- Motif: `frosted-badge-pill`
- Motif: `ghost-icon-watermark-cards`
- Motif: `hairline-divided-metrics-grid`
- Motif: `hero-mirrored-cta-section`
- Typography: `single-grotesque-slate-hierarchy`
- Color palette: `light-gray-white-slate-navy`
