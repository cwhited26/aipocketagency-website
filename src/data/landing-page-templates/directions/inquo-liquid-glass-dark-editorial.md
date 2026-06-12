---
slug: inquo-liquid-glass-dark-editorial
name: Inquo — Dark Liquid Glass / Giant Serif Newsletter Hero
vibe: dark, glassy, editorial, cinematic, serif-led
industries: innovation studios, research labs, newsletters and media, ai startups, think tanks, creative agencies, venture studios, technology brands
source: motionsites.ai archive (catalog title "Asme — Hero Section", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
A black, full-viewport hero on looping background video with a hand-rolled crossfade loop: the clip fades in from black over 500ms on play, fades back out when 0.55s remain, resets, and fades in again — all driven by `requestAnimationFrame` so each loop dissolves through black instead of jump-cutting. Navigation is a liquid-glass pill (max-w-5xl, fully rounded): globe mark + wordmark left, three links, a plain "Sign Up" text button and a glass "Login" pill right. The glass recipe is the page's DNA — `rgba(255,255,255,0.01)` with luminosity blend, 4px backdrop blur, inset top highlight, and a gradient hairline border drawn by a masked `::before` (bright at the top and bottom edges, vanishing mid-element).

Centered content goes very large: an Instrument Serif headline at text-7xl up to text-9xl, one word flipped to italic ("Know it then *all*."). Conversion is a single glass email pill — transparent input plus a white circular arrow button — over a short newsletter subtitle and a glass "Manifesto" pill. Three glass circular social buttons close the viewport at the bottom.

## Page layout
Five sections, all on black. After the hero: an About section (uppercase eyebrow at 40% white, a 4xl-7xl heading with serif-italic phrases at 60% white, faint radial-gradient glow behind it); a featured-video section (rounded-3xl 16:9 clip with a bottom gradient and a glass "Our Approach" card plus glass "Explore more" button overlaid); a Philosophy section ("Innovation *x* Vision" heading, then a two-column grid — 4:3 video left, two labeled text blocks split by a hairline divider right, sliding in from opposite sides); and a Services section — two glass cards each with a video header that scales 105% on hover, an uppercase tag, an arrow-in-glass-circle, title, and description. All reveals are once-only viewport fades (0.6-0.9s) with gentle y or x offsets.

## Typography
- Display: Instrument Serif (Google Fonts, regular + italic) — the giant headline and every italic emphasis phrase
- Body: system sans stack (the prompt loads no second face; Tailwind defaults) — UI, labels, and paragraphs at 14-18px
- Eyebrow labels uppercase, widest tracking, 40-50% white

## Color palette
- Base: pure black `#000000`
- Text: white `#ffffff` stepped at 100/80/70/60/50/40% opacity
- Glass: `rgba(255,255,255,0.01)` luminosity-blended surfaces; gradient borders from white at 45% fading to 0%
- Faint radial glows at 2-3% white behind section headings
- No color accents — footage and glass carry everything

## Visual motifs
- **Liquid-glass pill system** (the signature) — nav, email capture, buttons, and cards all share one glass class: near-transparent luminosity fill, 4px blur, inset highlight, masked-gradient hairline border
- **Crossfade video loop** — JS-driven opacity ramps at loop start and end so the background dissolves through black, never jump-cuts
- **Giant serif headline with one italic word** — text-9xl Instrument Serif where a single italic word at reduced opacity lands the emphasis
- **Glass email capture pill** — transparent input and a solid-white circular arrow button inside one rounded glass bar; the page's only form
- **Glass card over featured video** — a rounded glass panel with eyebrow and body copy sitting on a 16:9 clip's bottom gradient
- **Serif-italic phrase mixing** — section headings alternate plain white sans-set words with italic serif phrases at 40-60% white
- **Hover-scale video service cards** — two glass cards whose video headers zoom 105% over 700ms on hover, with arrow-in-circle affordances
- **Radial whisper glows** — barely-there white radial gradients (2-3%) that lift sections off the black

## When to use
- Innovation studios, research labs, and think tanks with a manifesto to publish
- Newsletter and media brands where the email signup is the one conversion
- AI and deep-tech startups that want mystique over feature lists
- Creative and venture studios with cinematic reel footage
- Brands selling curiosity and ideas rather than a priced product

## When to NOT use
- Anyone without several pieces of quality video — the page uses five separate clips
- Products needing pricing tables, feature grids, or signup flows beyond an email
- Bright, friendly consumer brands; the black-glass mood reads exclusive, not warm
- SEO/content-heavy plays — copy here is sparse by design (use `cognitra-ai-agency-gray-panel` for a fuller agency page)

## Build complexity
MEDIUM. The glass CSS and section reveals are reusable patterns, but the requestAnimationFrame crossfade loop and the five-video page weight need real attention to loading and performance.

## Library cross-references
- Motif: `liquid-glass-pill-system`
- Motif: `crossfade-video-loop-raf`
- Motif: `giant-serif-one-italic-word`
- Motif: `glass-email-capture-pill`
- Motif: `glass-card-over-featured-video`
- Motif: `hover-scale-video-cards`
- Motif: `radial-whisper-glow`
- Typography: `instrument-serif-system-sans`
- Color palette: `pure-black-glass-white-ladder`
