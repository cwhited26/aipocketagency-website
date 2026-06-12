---
slug: atmosa-cursor-spotlight-product-reveal
name: Atmosa — Cursor Spotlight Product Reveal
vibe: clean, technical, interactive, light, product-led
industries: consumer hardware, air and water purification, smart home devices, wellness tech, medtech devices, d2c product launches, iot products, appliance brands
source: motionsites.ai archive (catalog title "Reveal Hero", premium tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: studio_plus
last_used: never
last_client: never
---

## Hero treatment
A light, full-viewport product hero where the cursor is a flashlight. Two full-bleed scene images stack: the base scene, and a second hidden scene that only appears inside a 260px-radius soft circle around the cursor. The reveal is a per-frame canvas mask — each frame draws a radial gradient (solid to 40% of radius, feathering to nothing at the edge) onto a hidden canvas, converts it to a data-URL, and applies it as the `mask-image` of the second image layer. Move the mouse and you peel back reality: ideal for before/after pairs (hazy room vs. crystal-clear room for an air device).

Behind both images, a faint engineering grid (48px cells, 0.6px slate strokes at 10% opacity) drifts subtly AGAINST the cursor — raw mouse position is double-smoothed (0.1 ease toward the cursor, then 0.06 ease into a ±16px grid offset), so the whole scene feels gyroscopically alive without ever being busy. Hero copy sits small and confident at bottom-left: an uppercase tracked product eyebrow ("ATMOSA ONE" style), a two-line bold headline ("Clean Air, Clear Mind. Anywhere."), a dark "Discover" pill, and a quiet "View Specs" play link.

## Page layout
Single 100vh section under a fixed three-part nav: geometric mark left; a dark center pill bar with five links (active link inverted to a white pill); right, a dark "Reserve Yours" CTA with a live green status dot. Mobile swaps the pill bar for a hamburger and a white dropdown sheet. The hero text stays bottom-left at every size — only desktop raises it clear of the fold line.

## Typography
- Display + body: Inter (Google Fonts, weights 300–700) — bold tight headline, semibold tracked uppercase eyebrow (0.18em), medium UI labels
- Headline scale is modest: text-2xl mobile to text-4xl desktop; the interaction is the spectacle, not the type

## Color palette
- Base: white `#ffffff` page, near-black ink `#111111` / gray-900 for nav and buttons
- Grid strokes: slate `#64748b` at 10% opacity
- Status dot: green `#4ade80` (the only color on the page)
- Secondary text: gray-600/gray-700 neutrals throughout — no purple, no gradients

## Visual motifs
- **Cursor spotlight reveal** (the signature) — a feathered 260px circle around the mouse exposes a second scene beneath the first
- **Drifting engineering grid** — faint 48px blueprint grid slides a few pixels opposite the cursor, double-smoothed
- **Pill navigation with inverted active state** — dark center pill bar; the current page is a white pill inside it
- **Live status dot CTA** — "Reserve Yours" button carries a small green dot, reading as "in stock / live"
- **Small confident product copy** — eyebrow + two-line headline + two CTAs, tucked bottom-left, never competing with the scene
- **Before/after image pairing** — the two stacked scenes are authored as a contrast (problem world vs. product world)

## When to use
- Hardware launches where the product's effect is invisible — air, water, light, sound — and a reveal makes it visible
- Smart home and wellness devices with strong lifestyle photography in two states
- D2C pre-order pages built around one hero claim and a reserve button
- Medtech and lab devices that want technical credibility with a light touch
- Any brand with a true before/after pair worth exploring by hand

## When to NOT use
- Touch-first mobile audiences — there is no cursor; the signature interaction needs a pointer and a fallback plan
- Brands without two matched, art-directed scene images; mismatched pairs break the illusion
- Content-heavy or multi-product catalogs — this is a one-product, one-claim stage
- Dark, dramatic brand worlds (use `spd-luxury-automation-cinematic`)

## Build complexity
MEDIUM complexity. The canvas-mask loop and double-smoothed parallax are fiddly but contained; everything else is a standard light hero. Two matched scene renders are the asset cost.

## Library cross-references
- Motif: `cursor-spotlight-canvas-mask-reveal`
- Motif: `drifting-blueprint-grid`
- Motif: `pill-nav-inverted-active`
- Motif: `live-status-dot-cta`
- Motif: `before-after-stacked-scenes`
- Typography: `inter-neutral-product`
- Color palette: `white-ink-single-green-dot`
