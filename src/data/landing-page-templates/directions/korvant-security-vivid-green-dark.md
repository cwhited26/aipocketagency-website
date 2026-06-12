---
slug: korvant-security-vivid-green-dark
name: Korvant — Security Systems Dark with Vivid Green
vibe: dark, technical, restrained, green-accent, b2b
industries: security systems, smart building automation, ai integrators, surveillance tech, facilities management, smart city vendors, industrial iot, enterprise it
source: motionsites.ai archive (catalog title "AKOR Security", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A dark single-page site for an intelligent-security integrator ("Korvant — Intelligent Security Systems"). The hero is full viewport, near-black `#141414`, with an autoplaying looping video covering the section and content pushed to the BOTTOM-LEFT (flex justify-end): a two-line light-weight H1 ("Intelligent / Security Systems") at text-5xl up to 5.5rem with `leading-[0.95]`, a one-line muted subtext, and two CTAs side by side — a vivid green "Get Consultation" button (uppercase text-xs, widest tracking, rounded-lg) and a "Learn More" text link underlined by a green border-bottom. Everything fades up in sequence (a shared fade-up keyframe, 16px rise over 600ms, delays 0.2s / 0.45s / 0.65s).

The fixed navbar carries the system: a 32px green icon box with a hexagon SVG plus "KORVANT" left, uppercase muted links center, and a gray "Get Quote" button right that compresses on press (`active:scale-[0.97]` — every button on the page does this). The vivid green `#08ea04` family appears only on primary actions and the logo box; the rest of the page stays gray-on-near-black.

## Page layout
Three sections alternating polarity: dark hero → INVERTED near-white services section (the dark theme's foreground color becomes the background, dark text on light) → pure black about section. Services runs an eyebrow label + full-width hairline divider, then a 38/62 two-column split: heading and green CTA left, a 2×2 grid of service cards right, each card left-bordered with an icon, a faint number label, a title, and muted copy. About mirrors the label+divider pattern with a video left (45%), a vertical hairline between columns, and a heading-top / paragraph-and-CTA-bottom right column stretched to match the video height.

## Typography
- Display + body: Sora (Google Fonts, weights 300-700) — light-weight hero headline, semibold buttons, uppercase widest-tracking labels
- Hero H1: text-5xl → 6xl → 5.5rem, font-light, tracking-tight
- Eyebrow labels: text-xs uppercase, `0.25em` tracking, muted at 60%

## Color palette
- Background: near-black `#1a1a1a` (hero panel `#141414`)
- Foreground: off-white `#f5f5f5` — also the SERVICES section background when inverted
- Primary accent: vivid green `#08ea04` with near-black text
- Muted text: gray `#999999`; borders gray `#333333`
- Nav button: dark gray `#2e2e2e`

## Visual motifs
- **Bottom-left hero copy** — headline, subtext, and CTAs anchor to the lower-left corner of the video, leaving the frame open
- **Polarity-flip sections** — dark hero, then the exact foreground color becomes a near-white section background; the palette inverts rather than adding new colors
- **Eyebrow label + hairline divider** — every section opens with a tiny uppercase label and a full-width 1px rule
- **Left-bordered service cards** — 2×2 grid where each card hangs off a 1px left border with icon, faint number, title, and muted copy
- **Single vivid green accent** — one saturated green reserved for primary buttons and the logo box; everything else stays grayscale
- **Press-down buttons** — all buttons scale to 0.97 on press, a small physical tell
- **Staggered fade-up entrance** — headline, subtext, and CTAs rise in at 0.2s intervals

## When to use
- Security system integrators, surveillance, and access-control firms
- Smart building automation and facilities tech vendors
- AI consultancies serving industrial or municipal clients
- Enterprise IT and IoT firms that want technical-and-trustworthy, not flashy
- Brands whose accent color is a saturated green (or one strong tech color)

## When to NOT use
- Consumer or home-security brands wanting warmth — this is cold, institutional B2B
- Brands without site/field footage for the hero and about videos
- Anyone needing red or warm branding; the single green accent is the identity (compare `targo-logistics-dark-red-clipped` for the red equivalent)
- Content-light startups — the services/about structure expects real offerings to fill it

## Build complexity
LOW — standard three-section layout with one keyframe and disciplined tokens; the inverted section is just swapped variables.

## Library cross-references
- Motif: `bottom-left-hero-copy`
- Motif: `polarity-flip-sections`
- Motif: `eyebrow-label-hairline-divider`
- Motif: `left-bordered-service-cards`
- Motif: `single-accent-on-grayscale`
- Typography: `sora-light-uppercase-tracking`
- Color palette: `near-black-vivid-green-accent`
