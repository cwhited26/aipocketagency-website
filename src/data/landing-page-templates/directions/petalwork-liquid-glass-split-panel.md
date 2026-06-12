---
slug: petalwork-liquid-glass-split-panel
name: Petalwork — AI Botanical Studio / Liquid Glass Split Panel
vibe: grayscale, glassy, organic, futuristic, gallery-calm
industries: ai design tools, creative platforms, botanical and floral brands, 3d studios, generative art, garden and landscape design, beauty and skincare, digital galleries
source: motionsites.ai archive (catalog title "Bloom AI — Hero Section", free tier — export titles misaligned, identified by content; extracted Jun 12 2026)
tier_required: starter
last_used: never
last_client: never
---

## Hero treatment
A two-panel split hero floating on a full-screen looping video (`/placeholder-hero.mp4` — macro flowers or generative botanical motion; the footage supplies ALL the color). The UI itself is strict grayscale: every text and surface is white at stepped opacities, so the design reads as etched glass over whatever plays beneath it.

The left panel (52% width) carries a heavy liquid-glass overlay — an inset rounded-3xl pane with 50px backdrop blur and a gradient hairline border built from a masked `::before` (bright at top and bottom edges, fading to nothing mid-pane). Inside: a minimal nav (logo mark + lowercase wordmark left, glass "Menu" pill right), then a centered stack — logo mark large, a 6xl-7xl heading with its second line in serif italic at 80% white, a glass "Explore Now" pill CTA with a download icon in a white/15 circle, and three small glass pills (Artistic Gallery, AI Generation, 3D Structures). The panel closes with a "VISIONARY DESIGN" eyebrow, a mixed serif-italic quote, and an attribution line flanked by horizontal rules. The right panel (48%, desktop only) scatters lighter glass utilities: a social pill, an account button, a small community card, and a bottom feature cluster — two icon cards plus a thumbnail card with a "+" button, all in rounded glass.

## Page layout
Single viewport, flex-row split, no scroll. On mobile the right panel disappears entirely and the left glass pane becomes the page. Two glass tiers do the depth work: light glass (4px blur, inset top highlight) for pills and small cards, strong glass (50px blur, soft drop shadow, brighter border gradient) for the main panel and CTA. Every interactive element scales to 105% on hover, 95% on press. No border classes anywhere — the masked gradient `::before` IS the border.

## Typography
- Display + body: Poppins (Google Fonts, weight 500 headings) — geometric sans for everything structural
- Accent: Source Serif 4 (Google Fonts, italic) — emphasis words inside headings and the quote only
- Eyebrow labels uppercase at widest tracking, 50% white

## Color palette
- UI: strict grayscale — white `#ffffff` text stepped at 100/80/60/50% opacity
- Page base under the video: near-black `#0a0a0a`
- Glass surfaces: `rgba(255,255,255,0.01)` with luminosity blend; borders from white gradients at 45% → 0% → 45%
- Zero colored accents — the video is the palette

## Visual motifs
- **Two-tier liquid glass** (the signature) — a light 4px-blur glass for pills and a heavy 50px-blur glass for panels, both bordered by a masked gradient `::before` instead of a real border
- **Split-panel composition** — one dominant glass pane left, a loose constellation of glass utility cards right; asymmetry over symmetry
- **Grayscale-over-color discipline** — every UI element is white-on-transparent; only the background footage carries hue
- **Serif italic emphasis** — selected words inside the geometric-sans heading flip to serif italic at reduced opacity
- **Quote-with-rules sign-off** — an uppercase eyebrow, a mixed-face quote, and an author line flanked by thin horizontal rules at the panel's foot
- **Feature pill row** — three small glass pills naming capabilities, sitting directly under the CTA
- **Hover scale physics** — uniform 105% grow / 95% press on every interactive element

## When to use
- AI creative tools, generative art platforms, and design studios
- Botanical, floral, garden, or landscape brands with strong macro footage
- Beauty and skincare brands wanting a gallery-calm, organic-tech read
- 3D and motion studios showing work behind the interface
- Any brand whose footage is the asset — the UI is built to stay out of its way

## When to NOT use
- Brands without excellent video — grayscale glass over weak footage is just gray
- Text-heavy marketing pages; this is a single-screen mood piece with almost no copy
- Conversion-driven funnels needing pricing, proof, and FAQ sections
- High-energy consumer brands that want color in the UI itself (use `glassmorphism-purple-pink-agency`)

## Build complexity
MEDIUM. The two glass classes and the masked gradient-border trick are reusable CSS, but getting the split-panel card constellation balanced (and degrading it to single-panel mobile) takes design care.

## Library cross-references
- Motif: `liquid-glass-two-tier`
- Motif: `masked-gradient-hairline-border`
- Motif: `split-panel-glass-constellation`
- Motif: `grayscale-ui-over-color-video`
- Motif: `serif-italic-emphasis-words`
- Motif: `quote-with-horizontal-rules`
- Typography: `poppins-source-serif-italic`
- Color palette: `pure-grayscale-video-color`
