---
slug: lithos-geology-editorial
name: Lithos — Geology Editorial
vibe: editorial, premium, evidence-based, geological, serious, magazine-quality
industries: restoration (high-end), assessment, environmental services, science-based services, museums, premium consumer brands with a "discovery" angle, hospitality with a sense-of-place story
source: motionsites.ai (Lithos prompt)
last_used: never
last_client: never
---

## Hero treatment
Full viewport (`100dvh`) with a base geological-imagery background and a SECOND image revealed through a cursor-following spotlight (same canvas-mask mechanic as the Cyberpunk direction but applied to nature/material imagery rather than cyber/red). The display heading sits TOP-CENTER in two lines using Playfair Display ITALIC for line 1 and a tight non-italic sans for line 2 — a mixed-style heading reading like a magazine masthead. A short editorial paragraph anchors the bottom-LEFT corner; the primary CTA + supporting paragraph anchor the bottom-RIGHT.

The brand wordmark in the navbar uses the Playfair italic for a hand-set newspaper feel.

## Page layout
Single viewport hero (`100dvh`) with content layered over a base image + cursor reveal layer. Heading is top-centered (instead of bottom-anchored as in most heroes). Two text columns anchor opposite bottom corners.

## Typography
- Display: Playfair Display ITALIC (Google Fonts, italic 400/500/600) — used for line 1 of the heading and the brand wordmark
- Body + display line 2: Inter (Google Fonts) — weights 300/400/500/600/700, global default
- Heading sizing: `text-5xl sm:text-7xl md:text-8xl` with `letterSpacing: '-0.05em'` on the italic line and `'-0.08em'` on the sans line
- Global tracking: `tracking-[-0.02em]` on root

## Color palette
- Background: dark (full black + dark imagery)
- Primary text: white (with `text-white/80` for body)
- CTA: bright orange `#e8702a` with hover `#d2611f`, hover shadow `#e8702a/30`
- Translucent surfaces: `bg-white/20 backdrop-blur-md` for the navbar pill, `border-white/30` borders

## Visual motifs
- **Cursor spotlight reveal between two images** (same mechanic as Cyberpunk, different content register — this is the geology / restoration / discovery version)
- **Mixed-style display heading** — italic Playfair line 1 + tight sans line 2, top-centered like a magazine masthead
- **Editorial corner anchors** — short paragraph bottom-left, CTA + paragraph bottom-right, deliberately asymmetric
- **Italic serif wordmark in the nav** (the brand reads as a magazine masthead, not a SaaS logo)
- **Premium load animations** — `heroReveal` keyframe (opacity 0 + y 28px + blur 12px → clear) staggered 0.25s / 0.42s / 0.7s / 0.85s
- **Ken Burns intro** on base image (`scale 1.12 → 1.0` over 1.8s)
- **Frosted navbar pill** (`bg-white/20 backdrop-blur-md border border-white/30 rounded-full`) — feels like a museum kiosk overlay
- **Orange action CTA** that lifts the eye instantly without using a bright primary blue

## When to use
- High-end restoration / environmental services (Hanes Environmental tier)
- Assessment + investigation services (forensic, geological, scientific)
- Museums, science centers, planetariums
- Premium consumer brands with a "discovery / earth / origin" story (artisan food, natural cosmetics, mineral-based skincare)
- Hospitality brands with a strong sense-of-place narrative
- Anyone where the visitor should feel they're learning something credible, not being sold to
- Brands that want to feel "Smithsonian" / "National Geographic" / "MoMA" rather than "Bay Area startup"

## When to NOT use
- Local trades — wrong emotional register (too editorial, too slow)
- E-commerce — the cursor mechanic competes with product browsing
- Lifestyle brands targeting young, mass-market audiences — too slow-paced
- Anything where the visitor needs to convert in seconds
- Anyone without a credible "discovery / depth / craft" story to tell

## Reference source
motionsites.ai Lithos prompt — extracted 2026-06-11.

## Library cross-references
- Motif: `cursor-spotlight-reveal-canvas-mask` (shared with cyberpunk)
- Motif: `mixed-style-italic-display-heading`
- Motif: `editorial-corner-anchors-asymmetric`
- Motif: `frosted-navbar-pill`
- Motif: `premium-blur-rise-load-animations`
- Typography: `playfair-italic-inter`
- Color palette: `dark-with-orange-action`
