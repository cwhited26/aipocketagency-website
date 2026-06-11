---
slug: yacht-club-liquid-cursor-luxury
name: Yacht Club — Liquid Cursor Luxury
vibe: ultra-luxury, hospitality, cinematic, immersive, italic serif, ocean / aspirational
industries: yacht clubs, luxury hospitality, high-end membership clubs, private aviation, luxury automotive, premium wellness retreats, ultra-luxury real estate, exclusive ski clubs, private islands
source: motionsites.ai (Yacht Club prompt — premium tier, extracted Jun 11 2026)
last_used: never
last_client: never
---

## Hero treatment
Full-bleed Vimeo background video (ocean / yacht footage), giant italic serif display heading split across four staggered lines ("MASTER THE / *ELEMENTS.* / EMBRACE THE / *OCEAN*"), an interactive LIQUID CURSOR TRAIL that follows the mouse with 80 ripple elements distorted by an SVG turbulence filter, a small uppercase paragraph anchored on the right ("JOIN AN EXCLUSIVE COMMUNITY OF SAILORS..."), and a floating italic CTA ("JOIN THE *CLUB*") in the bottom-right. Clicking "Our Fleet" in the GSAP staggered menu blurs the background video to `blur(100px)` and reveals a fleet video overlay modal with three side-by-side hover-to-play yacht videos with detailed specs.

## Page layout
Single immersive hero with two states (default + fleet open). The whole page is one layered composition, not a scrolled page. The GSAP custom menu is the secondary navigation surface; the fleet overlay is the secondary content surface.

## Typography
- Display + body: Instrument Serif (Google Fonts, italic and roman) — forced as `font-serif` globally
- Default: all text uppercase, serif, mid-weight
- Display sizing: `text-[64px] md:text-[140px]`, `leading-none`, with `drop-shadow-2xl` over the video
- Subhead: `text-[10px] md:text-xs`, `tracking-widest`, `w-[260px]` (strictly narrow)
- The italic letters in the headline are accents — `MASTER THE / *ELEMENTS* / EMBRACE THE / *OCEAN*` — the italic words carry the "luxury" feel; the roman words carry the structure

## Color palette
- Background: OKLCH dark — `oklch(0.145 0 0)` (very deep gray, slightly warmer than pure black)
- Foreground: `oklch(0.985 0 0)` (warm white)
- The video footage carries the actual color — blue-green ocean tones
- Menu accent: pale blue `#93c5fd` on dark `#1a1a1a`
- Liquid cursor trail: white at low opacity with a hint of blue `rgba(147,197,253,0.15)`

## Visual motifs
- **Liquid cursor trail** (the signature mechanic) — 80 ripple `div`s in a `useRef` pool, distorted by an SVG `feTurbulence` + `feDisplacementMap` filter (the "WebGL-like DOM" trick). On every `mousemove`, if distance from last position > 25px, spawn a new ripple. `requestAnimationFrame` ages each ripple (`age += 0.012`, `size = 20 + age * 280`, `opacity = 1 - age^1.2`). When `age >= 1`, reset. Each ripple uses `backdropFilter: 'url(#liquid-trail) blur(1px)'` and an inset white box-shadow.
- **OKLCH dark theme** — uses the modern `oklch()` color space for richer dark colors than `rgb` / `hex` allows
- **Vimeo background video** with dynamic blur on state change
- **GSAP slot-machine text transition** on the menu toggle — cycles "MENU" and "CLOSE" three times before settling
- **GSAP staggered prelayer menu** — array of div masking layers slide in from `100vw` staggered by 0.07s; main panel follows after 0.65s
- **Fleet video overlay** — three columns of muted videos, hover plays, hover scales to 105%, hover reveals title + specs + "VIEW" button
- **Italic serif as DEFAULT register** (not as accent) — the whole site reads as serif
- **Floating CTA** that translates left when the menu opens (the button stays visible but moves to balance the new content)

## When to use
- Yacht clubs, private aviation clubs, luxury membership clubs
- Ultra-luxury hospitality (private islands, premium resort brands, exclusive ski clubs)
- Luxury automotive (Bentley / Bugatti / Rolls-Royce tier, not the mass-luxury Mercedes / BMW tier)
- High-end wellness retreats with a "members only" positioning
- Anyone whose brand is built around exclusive access + ocean / mountain / wilderness aesthetic
- Brands where the visitor SHOULD feel slightly intimidated by the price tag — the design itself sets the gate

## When to NOT use
- Any business below the ultra-luxury tier — the design exposes mid-tier brands as imposters
- Local services / blue collar — wrong audience entirely
- Anyone whose audience reads sites on phones in active need
- Anyone without exceptional video footage (the video IS the experience; weak footage destroys the impression)
- Accessibility-critical brands (the liquid cursor + serif uppercase combo is challenging for low-vision users)

## Build complexity
HIGH complexity. The liquid cursor system + GSAP custom menu + Framer Motion fleet overlay = 60-80 hours minimum to build well. Quote as Custom Build, not Tier 3.

## Library cross-references
- Motif: `liquid-cursor-trail-svg-distortion` (the signature — unique in the library)
- Motif: `oklch-dark-luxury-theme`
- Motif: `gsap-slot-machine-menu-text`
- Motif: `gsap-staggered-prelayer-panel`
- Motif: `fleet-video-overlay-modal`
- Motif: `italic-serif-as-default-register`
- Typography: `instrument-serif-uppercase-default`
- Color palette: `oklch-deep-warm-black-pale-blue-accent`
